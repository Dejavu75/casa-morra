export const PUZZLE_FEN = '8/8/8/8/8/k1K5/4Q3/8 w - - 0 1';

const FILES = 'abcdefgh';
const SOLUTION = 'e2a6';
const SOLUTION_NOTATION = 'Qa6#';
const QUEEN = Object.freeze({ glyph: '♕', nameKey: 'whiteQueen' });
const FIXED_PIECES = Object.freeze({
  c3: { glyph: '♔', nameKey: 'whiteKing' },
  a3: { glyph: '♚', nameKey: 'blackKing' },
});

export const puzzleEs = Object.freeze({
  eyebrow: 'Problema de demostración · Composición original de Casa Morra',
  title: 'Mate en una',
  instructions: 'Juegan las blancas. Escriba la casilla de origen y la de destino en formato UCI, sin espacios. Se puede usar íntegramente con el teclado.',
  boardInitial: 'Posición inicial: juegan las blancas',
  boardFinal: (notation) => `Posición final tras ${notation}`,
  boardAxis: 'Fila y columna',
  whiteKing: 'rey blanco',
  blackKing: 'rey negro',
  whiteQueen: 'dama blanca',
  empty: 'casilla vacía',
  squareLabel: (square, piece) => `${square}, ${piece}`,
  moveLabel: 'Su jugada (origen y destino)',
  checkMove: 'Comprobar jugada',
  controls: 'Controles del problema',
  reveal: 'Revelar solución',
  reset: 'Reiniciar',
  initialFeedback: 'Elija una jugada blanca para intentar el mate.',
  invalidFeedback: 'Escriba cuatro caracteres: casilla de origen y de destino, por ejemplo c3c4.',
  wrongFeedback: 'Esa respuesta no es el mate en una. Intente otra jugada.',
  correctFeedback: (notation) => `Correcto: ${notation} es mate en una.`,
  revealedFeedback: (notation) => `Solución: ${notation}. La dama va de e2 a a6 y el rey negro no tiene respuesta legal.`,
});

function msg(messages, key, ...args) {
  const fallback = puzzleEs[key];
  const value = typeof messages?.[key] === typeof fallback ? messages[key] : fallback;
  const resolved = typeof value === 'function' ? value(...args) : value;
  return resolved == null ? (typeof fallback === 'function' ? fallback(...args) : fallback) : resolved;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

export function initialPuzzleState(messages = puzzleEs) {
  return { status: 'ready', feedback: msg(messages, 'initialFeedback') };
}

export function transitionPuzzle(state, action, messages = puzzleEs) {
  if (action?.type === 'reset') return initialPuzzleState(messages);
  if (action?.type === 'reveal') {
    return { status: 'revealed', feedback: msg(messages, 'revealedFeedback', SOLUTION_NOTATION) };
  }
  if (action?.type !== 'submit' || state.status !== 'ready') return state;

  const move = String(action.move ?? '').trim().toLowerCase();
  if (!/^[a-h][1-8][a-h][1-8]$/.test(move)) {
    return { status: 'ready', feedback: msg(messages, 'invalidFeedback') };
  }
  if (move !== SOLUTION) {
    return { status: 'ready', feedback: msg(messages, 'wrongFeedback') };
  }
  return { status: 'solved', feedback: msg(messages, 'correctFeedback', SOLUTION_NOTATION) };
}

function renderBoard(solved, messages) {
  const columns = [...FILES].map((file) => `<th scope="col">${file}</th>`).join('');
  const rows = [];
  for (let rank = 8; rank >= 1; rank -= 1) {
    const cells = [...FILES].map((file, fileIndex) => {
      const square = `${file}${rank}`;
      const shown = square === (solved ? 'a6' : 'e2') ? QUEEN : FIXED_PIECES[square];
      const tone = (fileIndex + rank) % 2 ? 'dark' : 'light';
      const pieceName = shown ? msg(messages, shown.nameKey) : msg(messages, 'empty');
      const label = msg(messages, 'squareLabel', square, pieceName);
      return `<td class="puzzle-square puzzle-square--${tone}" data-square="${square}" aria-label="${escapeHtml(label)}"><span aria-hidden="true">${shown?.glyph ?? ''}</span></td>`;
    }).join('');
    rows.push(`<tr><th scope="row">${rank}</th>${cells}</tr>`);
  }
  const caption = solved ? msg(messages, 'boardFinal', SOLUTION_NOTATION) : msg(messages, 'boardInitial');
  return `<div class="puzzle-board-wrap"><table class="puzzle-board"><caption>${escapeHtml(caption)}</caption><thead><tr><th scope="col"><span class="puzzle-visually-hidden">${escapeHtml(msg(messages, 'boardAxis'))}</span></th>${columns}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}

export function renderPuzzle(messages = puzzleEs, state = initialPuzzleState(messages)) {
  const finished = state.status === 'solved' || state.status === 'revealed';
  const feedback = escapeHtml(state.feedback ?? '');
  return `<section class="puzzle" data-puzzle data-fen="${PUZZLE_FEN}" aria-labelledby="puzzle-title">
    <p class="puzzle-eyebrow">${escapeHtml(msg(messages, 'eyebrow'))}</p>
    <h2 id="puzzle-title">${escapeHtml(msg(messages, 'title'))}</h2>
    <p id="puzzle-instructions">${escapeHtml(msg(messages, 'instructions'))}</p>
    ${renderBoard(finished, messages)}
    <form class="puzzle-form" data-puzzle-form>
      <label for="puzzle-move">${escapeHtml(msg(messages, 'moveLabel'))}</label>
      <input id="puzzle-move" data-puzzle-input name="move" type="text" maxlength="4" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="puzzle-instructions puzzle-feedback"${finished ? ' disabled' : ''}>
      <button type="submit"${finished ? ' disabled' : ''}>${escapeHtml(msg(messages, 'checkMove'))}</button>
    </form>
    <div class="puzzle-actions" role="group" aria-label="${escapeHtml(msg(messages, 'controls'))}">
      <button type="button" data-puzzle-action="reveal"${finished ? ' disabled' : ''}>${escapeHtml(msg(messages, 'reveal'))}</button>
      <button type="button" data-puzzle-action="reset">${escapeHtml(msg(messages, 'reset'))}</button>
    </div>
    <p id="puzzle-feedback" class="puzzle-feedback" data-puzzle-feedback role="status" aria-live="polite" aria-atomic="true" tabindex="-1">${feedback}</p>
  </section>`;
}

// Attach to a host container. Re-rendering keeps state local to this single demo puzzle.
export function attachPuzzle(host, { messages = puzzleEs } = {}) {
  if (!host?.addEventListener || !host?.removeEventListener) return () => {};
  let state = initialPuzzleState(messages);
  const update = (focusTarget) => {
    host.innerHTML = renderPuzzle(messages, state);
    host.querySelector?.(focusTarget)?.focus?.();
  };
  const onSubmit = (event) => {
    if (!event.target?.matches?.('[data-puzzle-form]')) return;
    event.preventDefault();
    const move = host.querySelector?.('[data-puzzle-input]')?.value ?? '';
    state = transitionPuzzle(state, { type: 'submit', move }, messages);
    update(state.status === 'ready' ? '[data-puzzle-input]' : '[data-puzzle-feedback]');
  };
  const onClick = (event) => {
    const action = event.target?.closest?.('[data-puzzle-action]')?.dataset?.puzzleAction;
    if (action !== 'reset' && action !== 'reveal') return;
    state = transitionPuzzle(state, { type: action }, messages);
    update(action === 'reset' ? '[data-puzzle-input]' : '[data-puzzle-feedback]');
  };
  host.addEventListener('submit', onSubmit);
  host.addEventListener('click', onClick);
  update();
  return () => {
    host.removeEventListener('submit', onSubmit);
    host.removeEventListener('click', onClick);
  };
}

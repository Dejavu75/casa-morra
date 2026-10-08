import { routeHref } from '../router.js';
import { escapeHtml as h, formatDate, playerName } from './common.js';

export const gameEs = Object.freeze({
  missing: 'Partida no encontrada', missingText: 'No existe una partida con ese identificador en la muestra.',
  game: 'Partida', demo: 'Datos ficticios de demostración', back: '← Torneos',
  noMoves: 'Sin jugadas registradas. El resultado permanece disponible, pero no hay tablero para reproducir.',
  invalid: 'La secuencia no se puede reproducir con este visor limitado.',
  scope: 'Secuencia de coordenadas UCI preparada para esta muestra. No es un archivo PGN ni un validador general de legalidad ajedrecística.',
  boardAt: (ply) => `Tablero tras ${ply} ${ply === 1 ? 'jugada' : 'jugadas'}`, white: 'blanco', black: 'negro',
  whiteFeminine: 'blanca', blackFeminine: 'negra', empty: 'casilla vacía',
  first: 'Primera posición', previous: 'Jugada anterior', next: 'Siguiente jugada', last: 'Última posición',
  transcript: 'Secuencia disponible', current: 'Jugada actual', initial: 'Posición inicial',
  controls: 'Controles de reproducción', round: 'Ronda', moveNumber: 'Jugada',
  movesCount: (ply, total) => `${ply} de ${total} jugadas`,
  pieces: Object.freeze({ p: 'peón', r: 'torre', n: 'caballo', b: 'alfil', q: 'dama', k: 'rey' }),
});

const msg = (messages, key) => messages?.[key] ?? gameEs[key];
const files = 'abcdefgh';
const initialRows = [
  'rnbqkbnr', 'pppppppp', '........', '........',
  '........', '........', 'PPPPPPPP', 'RNBQKBNR',
];
// Solo esta secuencia del fixture fue revisada para el visor. No aceptar UCI arbitrario como partida legal.
const supportedGameId = 'patio-2025-r1-p1';
const supportedMoves = 'd2d4 g8f6 c2c4 e7e6 b1c3 d7d5 c4d5 e6d5 c1g5 f8e7 e2e3 e8g8 g1f3 c7c6 f1d3 b8d7'.split(' ');
const glyphs = Object.freeze({
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
});

function initialBoard() {
  const board = new Map();
  for (let rank = 8; rank >= 1; rank -= 1) {
    for (let file = 0; file < 8; file += 1) {
      const piece = initialRows[8 - rank][file];
      if (piece !== '.') board.set(`${files[file]}${rank}`, piece);
    }
  }
  return board;
}

export function hasDemoReplay(game) {
  return game?.id === supportedGameId && Array.isArray(game.moves)
    && game.moves.length === supportedMoves.length
    && game.moves.every((move, index) => move === supportedMoves[index]);
}

function applyKnownMove(board, move, index) {
  if (typeof move !== 'string' || !/^[a-h][1-8][a-h][1-8]$/.test(move)) throw new TypeError('Coordenada UCI no soportada');
  const from = move.slice(0, 2);
  const to = move.slice(2, 4);
  const piece = board.get(from);
  const target = board.get(to);
  if (!piece || (piece === piece.toUpperCase()) !== (index % 2 === 0)) throw new TypeError('Origen o turno incompatible');
  if (target && (target === target.toUpperCase()) === (piece === piece.toUpperCase())) throw new TypeError('Destino ocupado por pieza propia');
  // El fixture conocido contiene un único enroque corto negro. No se implementa un motor de reglas.
  if (piece === 'k' && from === 'e8' && to === 'g8') {
    if (board.get('h8') !== 'r' || board.has('f8') || board.has('g8')) throw new TypeError('Enroque incompatible');
    board.delete('h8');
    board.set('f8', 'r');
  } else if (piece.toLowerCase() === 'k' && Math.abs(files.indexOf(from[0]) - files.indexOf(to[0])) > 1) {
    throw new TypeError('Otro enroque no soportado');
  }
  board.delete(from);
  board.set(to, piece);
}

export function replayKnownPosition(moves, ply = 0) {
  if (!Array.isArray(moves)) throw new TypeError('Secuencia no disponible');
  const step = Number(ply);
  if (!Number.isInteger(step) || step < 0 || step > moves.length) throw new RangeError('Paso fuera de la secuencia');
  const board = initialBoard();
  for (let index = 0; index < step; index += 1) applyKnownMove(board, moves[index], index);
  return board;
}

function pieceDescription(piece, messages) {
  if (!piece) return msg(messages, 'empty');
  const names = messages?.pieces ?? gameEs.pieces;
  const feminine = piece.toLowerCase() === 'r' || piece.toLowerCase() === 'q';
  const color = piece === piece.toUpperCase()
    ? msg(messages, feminine ? 'whiteFeminine' : 'white')
    : msg(messages, feminine ? 'blackFeminine' : 'black');
  return `${names[piece.toLowerCase()] ?? piece} ${color}`;
}

function boardTable(board, ply, messages) {
  const columns = [...files].map((file) => `<th scope="col">${file}</th>`).join('');
  const rows = [];
  for (let rank = 8; rank >= 1; rank -= 1) {
    const squares = [...files].map((file) => {
      const square = `${file}${rank}`;
      const piece = board.get(square);
      return `<td data-square="${square}" aria-label="${h(square)}: ${h(pieceDescription(piece, messages))}"><span aria-hidden="true">${piece ? glyphs[piece] : '·'}</span></td>`;
    }).join('');
    rows.push(`<tr><th scope="row">${rank}</th>${squares}</tr>`);
  }
  return `<div class="game-board-wrap"><table class="game-board"><caption>${h(msg(messages, 'boardAt')(ply))}</caption><thead><tr><td></td>${columns}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}

function replayButton(action, text, disabled) {
  return `<button type="button" data-replay-action="${h(action)}"${disabled ? ' disabled' : ''}>${h(text)}</button>`;
}

function renderReplay(game, ply, messages) {
  const moves = game.moves;
  const board = replayKnownPosition(moves, ply);
  const transcript = moves.map((move, index) => `<li${index + 1 === ply ? ' aria-current="step"' : ''}><span class="visually-hidden">${h(msg(messages, 'moveNumber'))} ${index + 1}: </span><code>${h(move.slice(0, 2))}–${h(move.slice(2, 4))}</code></li>`).join('');
  return `<p class="content-note">${h(msg(messages, 'scope'))}</p><p class="game-counter" aria-live="polite">${h(msg(messages, 'movesCount')(ply, moves.length))}</p>
    ${boardTable(board, ply, messages)}<div class="game-controls" role="group" aria-label="${h(msg(messages, 'controls'))}">
      ${replayButton('first', msg(messages, 'first'), ply === 0)}${replayButton('prev', msg(messages, 'previous'), ply === 0)}
      ${replayButton('next', msg(messages, 'next'), ply === moves.length)}${replayButton('last', msg(messages, 'last'), ply === moves.length)}
    </div><section aria-labelledby="game-transcript"><h2 id="game-transcript">${h(msg(messages, 'transcript'))}</h2><ol class="game-transcript">${transcript}</ol></section>`;
}

export function renderGame(data, id, { ply = 0 } = {}, messages = gameEs) {
  const game = data.games?.find((item) => item.id === id);
  if (!game) return { title: `${msg(messages, 'missing')} — Casa Morra`, html: `<div class="content-page container"><h1>${h(msg(messages, 'missing'))}</h1><p>${h(msg(messages, 'missingText'))}</p><a href="${h(routeHref('tournaments'))}">${h(msg(messages, 'back'))}</a></div>` };
  const event = data.tournaments?.find((item) => item.id === game.tournamentId);
  const result = ({ '1-0': '1–0', '0-1': '0–1', '1/2-1/2': '½–½' })[game.result] ?? game.result;
  let replay = `<p>${h(msg(messages, 'noMoves'))}</p>`;
  let current = 0;
  if (Array.isArray(game.moves) && game.moves.length) {
    try {
      if (!hasDemoReplay(game)) throw new TypeError('Secuencia fuera de la muestra revisada');
      current = Math.max(0, Math.min(game.moves.length, Number.isInteger(Number(ply)) ? Number(ply) : 0));
      // Verificar la secuencia completa antes de ofrecer cualquier control parcial.
      replayKnownPosition(game.moves, game.moves.length);
      replay = `<div data-game-replay data-game-id="${h(game.id)}" data-ply="${current}">${renderReplay(game, current, messages)}</div>`;
    } catch {
      replay = `<p class="content-error">${h(msg(messages, 'invalid'))}</p>`;
    }
  }
  return { title: `${msg(messages, 'game')} — Casa Morra`, html: `<div class="content-page content-game container"><p class="content-eyebrow">${h(msg(messages, 'demo'))}</p>
    <h1>${h(msg(messages, 'game'))}: ${h(playerName(data, game.whiteId))} — ${h(playerName(data, game.blackId))}</h1>
    <p>${event ? `${h(event.name)} · ` : ''}${h(formatDate(game.date))} · ${h(msg(messages, 'round'))} ${h(game.round)} · ${h(result)}</p>${replay}</div>` };
}

const actions = Object.freeze({ first: () => 0, prev: (ply) => ply - 1, next: (ply) => ply + 1, last: (_ply, total) => total });

export function attachGameReplay(root, data, id, messages = gameEs) {
  const game = data.games?.find((item) => item.id === id);
  if (!root || !hasDemoReplay(game) || (root.dataset?.gameId && root.dataset.gameId !== id)) return () => {};
  try { replayKnownPosition(game.moves, game.moves.length); } catch { return () => {}; }
  const onClick = (event) => {
    const button = event.target?.closest?.('[data-replay-action]');
    const action = button?.dataset?.replayAction;
    if (!button || button.disabled || (root.contains && !root.contains(button)) || !Object.hasOwn(actions, action)) return;
    const current = Number(root.dataset.ply);
    const next = Math.max(0, Math.min(game.moves.length, actions[action](Number.isInteger(current) ? current : 0, game.moves.length)));
    root.innerHTML = renderReplay(game, next, messages);
    root.dataset.ply = String(next);
    const preferred = root.querySelector?.(`[data-replay-action="${action}"]:not(:disabled)`);
    const fallbackAction = next === 0 ? 'next' : 'prev';
    const fallback = root.querySelector?.(`[data-replay-action="${fallbackAction}"]:not(:disabled)`);
    (preferred ?? fallback ?? root.querySelector?.('.game-controls button:not(:disabled)'))?.focus?.();
  };
  root.addEventListener('click', onClick);
  return () => root.removeEventListener('click', onClick);
}

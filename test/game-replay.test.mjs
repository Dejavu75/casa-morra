import test from 'node:test';
import assert from 'node:assert/strict';
import { players, tournaments, games } from '../dist/data/demo.js';
import { renderGame, attachGameReplay, hasDemoReplay, replayKnownPosition } from '../dist/views/game.js';

const data = { players, tournaments, games };
const featured = games.find((game) => game.moves?.length);

test('el visor limitado muestra posición inicial, avance y enroque de la partida revisada', () => {
  assert.ok(featured);
  assert.equal(hasDemoReplay(featured), true);
  const start = renderGame(data, featured.id, { ply: 0 });
  assert.match(start.html, /<caption>Tablero tras 0 jugadas/);
  assert.match(start.html, /data-square="d2"[^>]*aria-label="d2: peón blanco"/);
  assert.match(start.html, /data-replay-action="first"[^>]*disabled/);
  assert.match(start.html, /data-replay-action="prev"[^>]*disabled/);
  assert.match(start.html, /No es un archivo PGN ni un validador general/);

  const one = renderGame(data, featured.id, { ply: 1 });
  assert.match(one.html, /<caption>Tablero tras 1 jugada<\/caption>/);
  assert.match(one.html, /data-square="d4"[^>]*aria-label="d4: peón blanco"/);
  assert.match(one.html, /data-square="d2"[^>]*aria-label="d2: casilla vacía"/);
  assert.match(renderGame(data, featured.id, { ply: 2 }).html, /<caption>Tablero tras 2 jugadas<\/caption>/);
  const end = renderGame(data, featured.id, { ply: featured.moves.length });
  assert.match(end.html, /data-square="g8"[^>]*aria-label="g8: rey negro"/);
  assert.match(end.html, /data-square="f8"[^>]*aria-label="f8: torre negra"/);
  assert.match(end.html, /data-replay-action="next"[^>]*disabled/);
  assert.match(end.html, /data-replay-action="last"[^>]*disabled/);
  assert.equal(replayKnownPosition(featured.moves, featured.moves.length).get('g8'), 'k');
});

test('partidas sin planilla, ausentes o incompatibles no exponen controles de reproducción', () => {
  const noMoves = games.find((game) => !game.moves);
  assert.match(renderGame(data, noMoves.id).html, /Sin jugadas registradas/);
  assert.doesNotMatch(renderGame(data, noMoves.id).html, /data-replay-action/);
  assert.equal(renderGame(data, 'inexistente').title, 'Partida no encontrada — Casa Morra');
  const invalid = { ...data, games: [{ ...featured, id: 'invalid', moves: ['a3a4'] }] };
  assert.equal(hasDemoReplay(invalid.games[0]), false);
  assert.match(renderGame(invalid, 'invalid').html, /La secuencia no se puede reproducir/);
  assert.doesNotMatch(renderGame(invalid, 'invalid').html, /data-replay-action/);
  const changed = { ...data, games: games.map((game) => game.id === featured.id
    ? { ...game, moves: ['a2a5', ...game.moves.slice(1)] } : game) };
  assert.match(renderGame(changed, featured.id).html, /La secuencia no se puede reproducir/);
  assert.throws(() => replayKnownPosition(featured.moves, featured.moves.length + 1), RangeError);
});

test('el controlador avanza y vuelve sin navegación ni red y se puede desconectar', () => {
  let handler;
  const root = {
    dataset: { gameId: featured.id, ply: '0' }, innerHTML: '',
    addEventListener(_type, value) { handler = value; },
    removeEventListener() { handler = null; },
    querySelector() { return { focus() {} }; },
  };
  const detach = attachGameReplay(root, data, featured.id);
  handler({ target: { closest() { return { dataset: { replayAction: 'next' } }; } } });
  assert.equal(root.dataset.ply, '1');
  assert.match(root.innerHTML, /data-square="d4"[^>]*aria-label="d4: peón blanco"/);
  handler({ target: { closest() { return { dataset: { replayAction: 'last' } }; } } });
  assert.equal(root.dataset.ply, String(featured.moves.length));
  handler({ target: { closest() { return { dataset: { replayAction: 'prev' } }; } } });
  assert.equal(root.dataset.ply, String(featured.moves.length - 1));
  handler({ target: { closest() { return { dataset: { replayAction: 'first' } }; } } });
  assert.equal(root.dataset.ply, '0');
  handler({ target: { closest() { return { dataset: { replayAction: 'unknown' } }; } } });
  assert.equal(root.dataset.ply, '0');
  detach();
  assert.equal(handler, null);
  assert.equal(attachGameReplay({ dataset: { gameId: 'different' } }, data, featured.id) instanceof Function, true);
});

test('el foco sigue en un control de reproducción útil al llegar a ambos extremos por teclado', () => {
  let handler;
  let focused;
  const root = {
    dataset: { gameId: featured.id, ply: '0' }, innerHTML: '',
    addEventListener(_type, value) { handler = value; },
    removeEventListener() { handler = null; },
    querySelector(selector) {
      const match = selector.match(/data-replay-action="([^"]+)"/);
      const action = match?.[1] ?? ['first', 'prev', 'next', 'last'].find((candidate) =>
        !this.isDisabled(candidate));
      if (!action || this.isDisabled(action)) return null;
      return { focus() { focused = action; } };
    },
    isDisabled(action) {
      return Number(this.dataset.ply) === 0 ? ['first', 'prev'].includes(action)
        : Number(this.dataset.ply) === featured.moves.length && ['next', 'last'].includes(action);
    },
  };
  const detach = attachGameReplay(root, data, featured.id);
  const press = (action) => handler({ detail: 0, target: { closest() {
    return { dataset: { replayAction: action }, disabled: root.isDisabled(action) };
  } } });

  press('next');
  assert.equal(root.dataset.ply, '1');
  assert.equal(focused, 'next');
  press('last');
  assert.equal(root.dataset.ply, String(featured.moves.length));
  assert.equal(focused, 'prev');
  press('next');
  assert.equal(root.dataset.ply, String(featured.moves.length));
  assert.equal(focused, 'prev');
  press('first');
  assert.equal(root.dataset.ply, '0');
  assert.equal(focused, 'next');
  press('prev');
  assert.equal(root.dataset.ply, '0');
  assert.equal(focused, 'next');
  detach();
});

test('nombres y metadatos de la partida se escapan y el catálogo admite traducción futura', () => {
  const unsafe = { ...data,
    players: players.map((player) => player.id === featured.whiteId ? { ...player, name: '<img src=x onerror=alert(1)>' } : player),
    tournaments: tournaments.map((event) => event.id === featured.tournamentId ? { ...event, name: '<script>alert(1)</script>' } : event),
  };
  const html = renderGame(unsafe, featured.id).html;
  assert.doesNotMatch(html, /<img src=x|<script>/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(renderGame(data, featured.id, { ply: 0 }, { game: 'Board' }).html, /<h1>Board:/);
  assert.match(renderGame(data, featured.id, { ply: 1 }, { boardAt: (ply) => `Board after ${ply} move` }).html,
    /<caption>Board after 1 move<\/caption>/);
});

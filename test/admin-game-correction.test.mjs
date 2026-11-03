import test from 'node:test';
import assert from 'node:assert/strict';
import { players, tournaments, games, byes, titles, seasons, editorial } from '../dist/data/demo.js';
import { prepareAdminGame } from '../scripts/admin-game.mjs';

const base = () => structuredClone({ players, tournaments, games, byes, titles, seasons, editorial });

test('corrige resultado y fecha de una partida sin duplicarla y ajusta la tabla', () => {
  const data = base();
  const event = data.tournaments.find((row) => row.id === 'patio-2025');
  const first = event.standings[0].playerId;
  const second = event.standings[1].playerId;
  const created = prepareAdminGame(data, { mode: 'create', game: {
    id: 'admin-correccion-prueba', tournamentId: event.id, round: event.rounds + 1,
    date: event.date, whiteId: first, blackId: second, result: '1-0', moves: null, finish: null,
  } });
  const changed = prepareAdminGame(created.next, { mode: 'correct', gameId: 'admin-correccion-prueba',
    result: '1/2-1/2', date: '2025-05-02', round: event.rounds + 1 });
  const updated = changed.next.games.find((row) => row.id === 'admin-correccion-prueba');
  assert.equal(updated.result, '1/2-1/2');
  assert.equal(updated.date, '2025-05-02');
  assert.equal(changed.next.games.length, created.next.games.length);
  const before = created.next.tournaments.find((row) => row.id === event.id);
  const after = changed.next.tournaments.find((row) => row.id === event.id);
  assert.equal(after.standings.find((row) => row.playerId === first).points,
    before.standings.find((row) => row.playerId === first).points - 0.5);
  assert.equal(after.standings.find((row) => row.playerId === second).points,
    before.standings.find((row) => row.playerId === second).points + 0.5);
});

test('rechaza fecha inválida y conserva el snapshot de entrada', () => {
  const data = base();
  const game = data.games[0];
  const before = JSON.stringify(data);
  assert.throws(() => prepareAdminGame(data, { mode: 'correct', gameId: game.id,
    result: game.result, date: '2025-99-99', round: game.round }), /fecha/i);
  assert.equal(JSON.stringify(data), before);
});

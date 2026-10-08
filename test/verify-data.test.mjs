import test from 'node:test';
import assert from 'node:assert/strict';
import { players, tournaments, games, byes, titles, seasons, editorial } from '../dist/data/demo.js';
import { calculateElo } from '../dist/domain/statistics.js';
import { renderHome } from '../dist/views/home.js';
import { renderPlayersDirectory } from '../dist/views/players.js';
import { verifyData } from '../scripts/verify-data.mjs';

const data = { players, tournaments, games, byes, titles, seasons, editorial };
const codes = (report) => report.errors.map((error) => error.code);

test('la muestra completa concilia datos, motor y contadores públicos', () => {
  const report = verifyData(data);
  assert.deepEqual(report.counts, { players: 6, tournaments: 6, games: 70, byes: 5 });
  assert.equal(report.ok, true, JSON.stringify(report.errors));
  assert.deepEqual(report.errors, []);
});

test('detecta claves duplicadas y referencias inválidas sin romper el proceso', () => {
  const invalid = { ...data,
    games: [{ ...games[0], id: games[1].id, blackId: 'jugador-inexistente' }, ...games.slice(1)],
  };
  const report = verifyData(invalid);
  assert.equal(report.ok, false);
  assert.ok(codes(report).includes('DUPLICATE_ID'));
  assert.ok(codes(report).includes('UNKNOWN_PLAYER'));
});

test('recalcula puntos oficiales desde partidas y descansos, sin inventar juegos para tabla aislada', () => {
  const changed = tournaments.map((event) => event.id === 'patio-2025' ? {
    ...event, standings: event.standings.map((row, index) => index === 0 ? { ...row, points: row.points + 1 } : row),
  } : event);
  const report = verifyData({ ...data, tournaments: changed });
  assert.ok(codes(report).includes('STANDING_POINTS'));
  const tableOnly = data.tournaments.find((event) => event.format === 'table-only');
  assert.ok(tableOnly.standings.every((row) => row.wins == null && row.draws == null && row.losses == null));
  assert.ok(!codes(verifyData(data)).includes('STANDING_POINTS'));
});

test('detecta cambios de Elo no bilaterales y registros faltantes', () => {
  const badElo = (fixture) => {
    const ratings = structuredClone(calculateElo(fixture));
    ratings[fixture.players[0].id].history[0].after += 2;
    return ratings;
  };
  const report = verifyData(data, { calculateElo: badElo });
  assert.equal(report.ok, false);
  assert.ok(codes(report).includes('ELO_BILATERAL'));
});

test('detecta contadores visibles que divergen del dataset', () => {
  const badHome = () => ({ html: '<section class="home-totals"><strong>999</strong> jugadores</section>' });
  const badDirectory = () => ({ html: '<p class="players-count">999 jugadores en el padrón</p>' });
  const report = verifyData(data, { renderHome: badHome, renderPlayersDirectory: badDirectory });
  assert.ok(codes(report).includes('HOME_VIEW_TOTAL'));
  assert.ok(codes(report).includes('DIRECTORY_VIEW_TOTAL'));
  assert.equal(verifyData(data, { renderHome, renderPlayersDirectory }).ok, true);
});

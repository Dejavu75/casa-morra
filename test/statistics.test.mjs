import test from 'node:test';
import assert from 'node:assert/strict';
import { players, tournaments, games, byes, titles, seasons } from '../dist/data/demo.js';
import {
  getHomeTotals, getPlayerProfile, getAnnualStandings,
  calculateElo,
} from '../dist/domain/statistics.js';

const demo = { players, tournaments, games, byes, titles, seasons };
const p = (id, name = id) => ({ id, name });
const event = (id, seasonId, date, standings, extra = {}) => ({
  id, seasonId, date, standings, annualEligible: true, eloEligible: true, ...extra,
});
const standing = (playerId, points, rank, order = rank) => ({ playerId, points, rank, order });
const game = (id, tournamentId, date, round, whiteId, blackId, result, moves = null) => ({
  id, tournamentId, date, round, whiteId, blackId, result, moves,
});
const fixture = (overrides = {}) => ({
  players: [p('a'), p('b'), p('c')],
  seasons: [{ id: 's1', start: '2025-08-01', end: '2026-07-31' }],
  tournaments: [], games: [], byes: [], titles: [], ...overrides,
});

test('la portada usa poblaciones explícitas y no cuenta byes ni tabla-only como partidas', () => {
  assert.deepEqual(getHomeTotals(demo), { players: 6, tournaments: 6, games: 70 });
  const data = fixture({
    tournaments: [event('sin-detalle', 's1', '2025-09-01', [standing('a', 3, 1)])],
    byes: [{ id: 'bye', tournamentId: 'sin-detalle', playerId: 'a', round: 1, points: 1 }],
  });
  assert.deepEqual(getHomeTotals(data), { players: 3, tournaments: 1, games: 0 });
});

test('perfil: victoria y rendimiento distintos, colores conciliados y ausencia de jugadas irrelevante', () => {
  const data = fixture({
    tournaments: [event('t', 's1', '2025-09-01', [])],
    games: [
      game('g1', 't', '2025-09-01', 1, 'a', 'b', '1-0'),
      game('g2', 't', '2025-09-01', 2, 'c', 'a', '1/2-1/2'),
      game('g3', 't', '2025-09-01', 3, 'a', 'c', '0-1'),
    ],
  });
  const profile = getPlayerProfile(data, 'a');
  assert.deepEqual(profile.record, { wins: 1, draws: 1, losses: 1, played: 3, points: 1.5, winRate: 100 / 3, scoreRate: 50 });
  assert.equal(profile.colors.white.played, 2);
  assert.equal(profile.colors.black.played, 1);
  assert.equal(profile.colors.white.wins, 1);
  assert.equal(profile.colors.black.draws, 1);
  assert.equal(profile.colors.white.played + profile.colors.black.played, profile.record.played);
  const empty = getPlayerProfile(fixture(), 'a');
  assert.equal(empty.record.played, 0);
  assert.equal(empty.record.winRate, null);
  assert.equal(empty.record.scoreRate, null);
  assert.equal(empty.elo.rating, 1400);
  assert.equal(empty.elo.provisional, true);
});

test('anual: puntos oficiales, empates compartidos y movimiento desde el evento previo de la misma temporada', () => {
  const data = fixture({
    seasons: [
      { id: 's0', start: '2024-08-01', end: '2025-07-31' },
      { id: 's1', start: '2025-08-01', end: '2026-07-31' },
    ],
    tournaments: [
      event('viejo', 's0', '2025-04-01', [standing('a', 99, 1)]),
      event('uno', 's1', '2025-09-01', [standing('a', 3, 1), standing('b', 2, 2)]),
      event('excluido', 's1', '2025-10-01', [standing('c', 50, 1)], { annualEligible: false }),
      event('dos', 's1', '2025-11-01', [standing('b', 1, 1), standing('c', 3, 2), standing('a', 0, 3)]),
    ],
  });
  const annual = getAnnualStandings(data, 's1');
  assert.deepEqual(annual.events.map((row) => row.id), ['uno', 'dos']);
  assert.deepEqual(annual.standings.map((row) => [row.playerId, row.points, row.rank, row.movement]), [
    ['a', 3, 1, 0], ['b', 3, 1, 1], ['c', 3, 1, null],
  ]);
  assert.equal(getAnnualStandings(data, 's0').standings[0].movement, null);
});

test('Elo demo: actualización bilateral previa, precisión interna, bye y tabla-only ignorados', () => {
  const data = fixture({
    tournaments: [
      event('t', 's1', '2025-09-01', [standing('a', 1, 1), standing('b', 0, 2)]),
      event('tabla', 's1', '2025-10-01', [standing('b', 99, 1)], { eloEligible: false }),
    ],
    games: [game('g1', 't', '2025-09-01', 1, 'a', 'b', '1-0')],
    byes: [{ id: 'bye', tournamentId: 't', playerId: 'c', round: 1, points: 1 }],
  });
  const elo = calculateElo(data);
  assert.equal(elo.a.rating, 1410);
  assert.equal(elo.b.rating, 1390);
  assert.equal(elo.c.rating, 1400);
  assert.equal(elo.a.peak, 1410);
  assert.equal(elo.b.peak, 1400);
  assert.equal(elo.a.history[0].before, 1400);
  assert.equal(elo.b.history[0].before, 1400);
  assert.equal(elo.a.history[0].after, 1410);
  assert.equal(elo.b.history[0].after, 1390);
  assert.equal(elo.c.played, 0);
});

test('Elo no redondea cálculos internos entre partidas', () => {
  const data = fixture({
    tournaments: [event('t', 's1', '2025-09-01', [])],
    games: [
      game('g1', 't', '2025-09-01', 1, 'a', 'b', '1-0'),
      game('g2', 't', '2025-09-01', 2, 'a', 'b', '1/2-1/2'),
    ],
  });
  const elo = calculateElo(data);
  const expectedA = 1410 + 20 * (0.5 - 1 / (1 + 10 ** ((1390 - 1410) / 400)));
  assert.ok(Math.abs(elo.a.rating - expectedA) < 1e-9);
  assert.equal(elo.a.history[1].before, 1410);
  assert.equal(elo.b.history[1].before, 1390);
});

test('racha cronológica: empate corta solo victorias; bye y tabla-only no cortan nada', () => {
  const data = fixture({
    tournaments: [event('t', 's1', '2025-09-01', [])],
    games: [
      game('g1', 't', '2025-09-01', 1, 'a', 'b', '1-0'),
      game('g2', 't', '2025-09-01', 2, 'a', 'b', '1-0'),
      game('g3', 't', '2025-09-01', 3, 'a', 'b', '1/2-1/2'),
      game('g4', 't', '2025-09-01', 4, 'a', 'b', '1-0'),
      game('g5', 't', '2025-09-01', 5, 'a', 'b', '0-1'),
    ],
    byes: [{ id: 'bye', tournamentId: 't', playerId: 'a', round: 6, points: 1 }],
  });
  const profile = getPlayerProfile(data, 'a');
  assert.deepEqual(profile.streaks, { winning: 2, unbeaten: 4 });
});

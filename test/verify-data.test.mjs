import test from 'node:test';
import assert from 'node:assert/strict';
import { players, tournaments, games, byes, titles, seasons, editorial } from '../dist/data/demo.js';
import { calculateElo, getHeadToHead, getLeaderboards } from '../dist/domain/statistics.js';
import { renderHome } from '../dist/views/home.js';
import { renderPlayerProfile, renderPlayersDirectory } from '../dist/views/players.js';
import { renderClassic } from '../dist/views/records.js';
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

test('rechaza puestos oficiales imposibles y fechas calendario inválidas antes de calcular derivados', () => {
  const tableOnly = tournaments.find((event) => event.format === 'table-only');
  for (const rank of [-1, 0, 1.5, tableOnly.standings.length + 1]) {
    const changed = tournaments.map((event) => event.id === tableOnly.id ? {
      ...event, standings: event.standings.map((row, index) => index === 0 ? { ...row, rank } : row),
    } : event);
    const report = verifyData({ ...data, tournaments: changed });
    assert.equal(report.ok, false, `rank=${rank}`);
    assert.ok(codes(report).includes('STANDING_RANK'), `rank=${rank}`);
  }
  const invalid = verifyData({ ...data,
    tournaments: tournaments.map((event, index) => index === 0 ? { ...event, date: '2030-99-99' } : event),
  });
  assert.ok(codes(invalid).includes('INVALID_DATE'));
});

test('concilia primeros puestos y podios de récords y perfil con tablas oficiales independientes', () => {
  const changedBoards = (fixture) => getLeaderboards(fixture).map((board) => board.id === 'podiums'
    ? { ...board, entries: board.entries.map((entry, index) => index === 0
      ? { ...entry, value: entry.value - 1 } : entry) } : board);
  assert.ok(codes(verifyData(data, { getLeaderboards: changedBoards })).includes('RECORD_PODIUMS'));

  const changedWins = (fixture) => getLeaderboards(fixture).map((board) => board.id === 'tournamentsWon'
    ? { ...board, entries: board.entries.map((entry, index) => index === 0
      ? { ...entry, value: entry.value + 1 } : entry) } : board);
  assert.ok(codes(verifyData(data, { getLeaderboards: changedWins })).includes('RECORD_TOURNAMENT_WINS'));

  const changedProfile = (fixture, slug) => {
    const view = renderPlayerProfile(fixture, slug);
    return { ...view, html: view.html.replace(/(Podios oficiales<\/dt><dd>)\d+/, (_match, label) => `${label}999`) };
  };
  assert.ok(codes(verifyData(data, { renderPlayerProfile: changedProfile })).includes('PROFILE_PODIUMS_VIEW'));
});

test('concilia clásicos desde ambos jugadores y usa partidas reales como denominador', () => {
  const changedPair = (fixture, firstId, secondId) => {
    const pair = getHeadToHead(fixture, firstId, secondId);
    if (!pair) return pair;
    return { ...pair, record: { ...pair.record, played: pair.record.played + 1 } };
  };
  assert.ok(codes(verifyData(data, { getHeadToHead: changedPair })).includes('CLASSIC_RECORD'));

  const changedReverse = (fixture, firstId, secondId) => {
    const pair = getHeadToHead(fixture, firstId, secondId);
    return pair && firstId > secondId
      ? { ...pair, record: { ...pair.record, wins: pair.record.wins + 1 } } : pair;
  };
  assert.ok(codes(verifyData(data, { getHeadToHead: changedReverse })).includes('CLASSIC_RECORD'));

  const changedView = (fixture, firstSlug, secondSlug) => {
    const view = renderClassic(fixture, firstSlug, secondSlug);
    return { ...view, html: view.html.replace(/(Porcentaje de victorias: )\d+ %/, '$1 999 %') };
  };
  assert.ok(codes(verifyData(data, { renderClassic: changedView })).includes('CLASSIC_VIEW'));
});

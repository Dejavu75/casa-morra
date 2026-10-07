import test from 'node:test';
import assert from 'node:assert/strict';
import { seasons, players, tournaments, games, byes, titles, editorial } from '../dist/data/demo.js';

const unique = (values) => new Set(values).size === values.length;
const byId = (rows) => new Map(rows.map((row) => [row.id, row]));
const seasonById = byId(seasons);
const playerById = byId(players);
const tournamentById = byId(tournaments);

test('la muestra es original, determinista y cubre tres temporadas', () => {
  assert.equal(seasons.length, 3);
  assert.equal(players.length, 6);
  assert.equal(tournaments.length, 6);
  assert.equal(games.length, 70);
  assert.equal(byes.length, 5);
  assert.ok(titles.length >= 1);
  assert.ok(editorial.news.length >= 1);
  assert.equal(unique(seasons.map((row) => row.id)), true);
  assert.equal(unique(players.map((row) => row.id)), true);
  assert.equal(unique(players.map((row) => row.slug)), true);
  assert.equal(unique(tournaments.map((row) => row.id)), true);
  assert.equal(unique(tournaments.map((row) => row.slug)), true);
  assert.equal(unique(games.map((row) => row.id)), true);
  assert.equal(unique(byes.map((row) => row.id)), true);
  assert.equal(unique(titles.map((row) => row.id)), true);
  assert.ok(players.every((row) => row.demo === true));
});

test('las temporadas agosto-julio y todas las referencias son válidas', () => {
  for (const season of seasons) {
    assert.match(season.start, /-08-01$/);
    assert.match(season.end, /-07-31$/);
    assert.ok(season.start < season.end);
  }
  for (const event of tournaments) {
    const season = seasonById.get(event.seasonId);
    assert.ok(season, `${event.id}: temporada`);
    assert.ok(season.start <= event.date && event.date <= season.end, `${event.id}: fecha`);
    assert.ok(event.rounds > 0);
    assert.equal(unique(event.standings.map((row) => row.playerId)), true);
    assert.equal(unique(event.standings.map((row) => row.order)), true);
    for (const row of event.standings) {
      assert.ok(playerById.has(row.playerId), `${event.id}: participante`);
      assert.ok(row.rank >= 1 && row.order >= 1);
      assert.ok(Number.isFinite(row.points));
    }
  }
  for (const title of titles) {
    assert.ok(playerById.has(title.playerId));
    assert.ok(tournamentById.has(title.tournamentId));
  }
});

test('las partidas y byes no duplican jugador ni ronda', () => {
  const occupied = new Set();
  for (const game of games) {
    const event = tournamentById.get(game.tournamentId);
    assert.ok(event);
    assert.ok(game.date >= seasonById.get(event.seasonId).start);
    assert.ok(game.date <= seasonById.get(event.seasonId).end);
    assert.ok(game.round >= 1 && game.round <= event.rounds);
    assert.ok(playerById.has(game.whiteId));
    assert.ok(playerById.has(game.blackId));
    assert.notEqual(game.whiteId, game.blackId);
    assert.ok(['1-0', '0-1', '1/2-1/2'].includes(game.result));
    assert.ok(event.standings.some((row) => row.playerId === game.whiteId));
    assert.ok(event.standings.some((row) => row.playerId === game.blackId));
    for (const playerId of [game.whiteId, game.blackId]) {
      const key = `${event.id}:${game.round}:${playerId}`;
      assert.equal(occupied.has(key), false, key);
      occupied.add(key);
    }
  }
  for (const bye of byes) {
    const event = tournamentById.get(bye.tournamentId);
    assert.ok(event);
    assert.ok(playerById.has(bye.playerId));
    assert.ok(event.standings.some((row) => row.playerId === bye.playerId));
    assert.ok(bye.round >= 1 && bye.round <= event.rounds);
    assert.equal(bye.points, 1);
    const key = `${event.id}:${bye.round}:${bye.playerId}`;
    assert.equal(occupied.has(key), false, key);
    occupied.add(key);
  }
});

test('cuatro todos-contra-todos aseguran 20 partidas por jugador y cuatro clásicos por pareja', () => {
  const roundRobins = tournaments.filter((event) => event.format === 'round-robin-6');
  assert.equal(roundRobins.length, 4);
  for (const event of roundRobins) {
    assert.equal(event.standings.length, 6);
    assert.equal(games.filter((game) => game.tournamentId === event.id).length, 15);
  }
  for (const player of players) {
    const count = games.filter((game) =>
      roundRobins.some((event) => event.id === game.tournamentId) &&
      (game.whiteId === player.id || game.blackId === player.id)).length;
    assert.equal(count, 20, player.id);
  }
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i].id;
      const b = players[j].id;
      const count = games.filter((game) =>
        roundRobins.some((event) => event.id === game.tournamentId) &&
        [game.whiteId, game.blackId].includes(a) &&
        [game.whiteId, game.blackId].includes(b)).length;
      assert.equal(count, 4, `${a}/${b}`);
    }
  }
});

test('las tablas oficiales con detalle concilian puntos; tabla sin jugadas queda separada', () => {
  const tableOnly = tournaments.filter((event) => event.format === 'table-only');
  assert.equal(tableOnly.length, 1);
  assert.equal(games.filter((game) => game.tournamentId === tableOnly[0].id).length, 0);
  assert.equal(byes.filter((bye) => bye.tournamentId === tableOnly[0].id).length, 0);
  assert.ok(tableOnly[0].standings.every((row) => row.wins === null && row.draws === null && row.losses === null));

  const odd = tournaments.find((event) => event.format === 'round-robin-5');
  assert.equal(games.filter((game) => game.tournamentId === odd.id).length, 10);
  assert.equal(byes.filter((bye) => bye.tournamentId === odd.id).length, 5);

  for (const event of tournaments.filter((row) => row.format !== 'table-only')) {
    const sorted = [...event.standings].sort((a, b) => a.order - b.order);
    assert.deepEqual(sorted, event.standings);
    for (const standing of event.standings) {
      let wins = 0;
      let draws = 0;
      let losses = 0;
      for (const game of games.filter((row) => row.tournamentId === event.id)) {
        if (game.whiteId !== standing.playerId && game.blackId !== standing.playerId) continue;
        if (game.result === '1/2-1/2') draws++;
        else if ((game.result === '1-0' && game.whiteId === standing.playerId) ||
          (game.result === '0-1' && game.blackId === standing.playerId)) wins++;
        else losses++;
      }
      const byePoints = byes.filter((row) => row.tournamentId === event.id && row.playerId === standing.playerId)
        .reduce((sum, row) => sum + row.points, 0);
      assert.equal(standing.wins, wins);
      assert.equal(standing.draws, draws);
      assert.equal(standing.losses, losses);
      assert.equal(standing.points, wins + draws * 0.5 + byePoints);
    }
  }
});

test('las jugadas son opcionales: el resultado permanece sin PGN', () => {
  assert.ok(games.some((game) => Array.isArray(game.moves) && game.moves.length > 0));
  assert.ok(games.some((game) => game.moves === null));
  assert.ok(games.every((game) => game.result));
});

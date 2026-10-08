import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as demo from '../dist/data/demo.js';
import { calculateElo, getAnnualStandings, getHeadToHead, getHomeTotals, getLeaderboards, getPlayerProfile } from '../dist/domain/statistics.js';
import { formatNumber } from '../dist/views/common.js';
import { renderHome } from '../dist/views/home.js';
import { renderPlayerProfile, renderPlayersDirectory } from '../dist/views/players.js';
import { renderClassic } from '../dist/views/records.js';
import { renderTournamentList } from '../dist/views/tournaments.js';
import { validateOfficialFields } from './data-integrity.mjs';

const EPSILON = 1e-7;
const RESULTS = new Set(['1-0', '0-1', '1/2-1/2']);
const close = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < EPSILON;

function unique(rows, name, errors) {
  const ids = new Set();
  for (const row of rows) {
    if (!row?.id || ids.has(row.id)) errors.push({ code: 'DUPLICATE_ID', detail: `${name}: ${row?.id ?? '(sin ID)'}` });
    ids.add(row?.id);
  }
}

function boardTotals(games, byes) {
  const totals = new Map();
  const get = (id) => {
    if (!totals.has(id)) totals.set(id, { wins: 0, draws: 0, losses: 0, points: 0 });
    return totals.get(id);
  };
  for (const game of games) {
    const white = get(game.whiteId);
    const black = get(game.blackId);
    if (game.result === '1-0') { white.wins++; white.points++; black.losses++; }
    if (game.result === '0-1') { black.wins++; black.points++; white.losses++; }
    if (game.result === '1/2-1/2') { white.draws++; black.draws++; white.points += 0.5; black.points += 0.5; }
  }
  for (const bye of byes) get(bye.playerId).points += bye.points;
  return totals;
}

function validateForeignKeys(data, errors) {
  const playerIds = new Set(data.players.map((row) => row.id));
  const eventIds = new Set(data.tournaments.map((row) => row.id));
  const seasonIds = new Set(data.seasons.map((row) => row.id));
  for (const event of data.tournaments) {
    if (!seasonIds.has(event.seasonId)) errors.push({ code: 'UNKNOWN_SEASON', detail: event.id });
    const seen = new Set();
    for (const row of event.standings ?? []) {
      if (!playerIds.has(row.playerId)) errors.push({ code: 'UNKNOWN_PLAYER', detail: `${event.id}/${row.playerId}` });
      if (seen.has(row.playerId)) errors.push({ code: 'DUPLICATE_STANDING', detail: `${event.id}/${row.playerId}` });
      seen.add(row.playerId);
    }
  }
  for (const game of data.games) {
    if (!eventIds.has(game.tournamentId)) errors.push({ code: 'UNKNOWN_TOURNAMENT', detail: game.id });
    for (const id of [game.whiteId, game.blackId])
      if (!playerIds.has(id)) errors.push({ code: 'UNKNOWN_PLAYER', detail: `${game.id}/${id}` });
    if (game.whiteId === game.blackId) errors.push({ code: 'SELF_GAME', detail: game.id });
    if (!RESULTS.has(game.result)) errors.push({ code: 'GAME_RESULT', detail: game.id });
  }
  for (const bye of data.byes) {
    if (!eventIds.has(bye.tournamentId)) errors.push({ code: 'UNKNOWN_TOURNAMENT', detail: bye.id });
    if (!playerIds.has(bye.playerId)) errors.push({ code: 'UNKNOWN_PLAYER', detail: `${bye.id}/${bye.playerId}` });
    if (!Number.isFinite(bye.points) || bye.points < 0) errors.push({ code: 'BYE_POINTS', detail: bye.id });
  }
  for (const title of data.titles) {
    if (!playerIds.has(title.playerId)) errors.push({ code: 'UNKNOWN_PLAYER', detail: `${title.id}/${title.playerId}` });
    if (!eventIds.has(title.tournamentId)) errors.push({ code: 'UNKNOWN_TOURNAMENT', detail: title.id });
  }
}

function validateStandings(data, errors) {
  for (const event of data.tournaments) {
    const games = data.games.filter((game) => game.tournamentId === event.id);
    const byes = data.byes.filter((bye) => bye.tournamentId === event.id);
    // Una tabla oficial sin partidas individuales no permite reconstruir WDL ni puntos.
    if (!games.length) continue;
    const totals = boardTotals(games, byes);
    const standingIds = new Set((event.standings ?? []).map((row) => row.playerId));
    for (const id of totals.keys())
      if (!standingIds.has(id)) errors.push({ code: 'MISSING_STANDING', detail: `${event.id}/${id}` });
    for (const row of event.standings ?? []) {
      const expected = totals.get(row.playerId);
      if (!expected) { errors.push({ code: 'UNEXPLAINED_STANDING', detail: `${event.id}/${row.playerId}` }); continue; }
      if (!close(row.points, expected.points)) errors.push({ code: 'STANDING_POINTS', detail: `${event.id}/${row.playerId}: ${row.points} ≠ ${expected.points}` });
      for (const key of ['wins', 'draws', 'losses'])
        if (row[key] !== expected[key]) errors.push({ code: 'STANDING_WDL', detail: `${event.id}/${row.playerId}/${key}` });
    }
  }
}

function validateElo(data, errors, compute) {
  let elo;
  try { elo = compute(data); } catch (error) {
    errors.push({ code: 'ELO_ENGINE', detail: error.message }); return;
  }
  const eligibleEvents = new Set(data.tournaments.filter((event) => event.eloEligible).map((event) => event.id));
  const histories = new Map();
  for (const player of data.players) {
    const result = elo[player.id];
    if (!result || !Array.isArray(result.history)) { errors.push({ code: 'ELO_MISSING_PLAYER', detail: player.id }); continue; }
    const expectedPlayed = data.games.filter((game) =>
      (game.whiteId === player.id || game.blackId === player.id) &&
      eligibleEvents.has(game.tournamentId)).length;
    if (result.played !== expectedPlayed || result.history.length !== expectedPlayed)
      errors.push({ code: 'ELO_PLAYED', detail: player.id });
    if (result.history.length && !close(result.rating, result.history.at(-1).after))
      errors.push({ code: 'ELO_FINAL', detail: player.id });
    for (const step of result.history) {
      if (!histories.has(step.gameId)) histories.set(step.gameId, []);
      histories.get(step.gameId).push({ playerId: player.id, ...step });
    }
  }
  for (const game of data.games) {
    const steps = histories.get(game.id) ?? [];
    const eligible = eligibleEvents.has(game.tournamentId);
    if (!eligible && steps.length) errors.push({ code: 'ELO_INELIGIBLE', detail: game.id });
    if (!eligible) continue;
    if (steps.length !== 2 || !steps.some((step) => step.playerId === game.whiteId) ||
      !steps.some((step) => step.playerId === game.blackId)) {
      errors.push({ code: 'ELO_BILATERAL', detail: game.id }); continue;
    }
    const [first, second] = steps;
    if (!close((first.after - first.before) + (second.after - second.before), 0))
      errors.push({ code: 'ELO_BILATERAL', detail: game.id });
  }
  const sum = data.players.reduce((total, player) => total + (elo[player.id]?.rating ?? 0), 0);
  if (!close(sum, data.players.length * 1400)) errors.push({ code: 'ELO_SUM', detail: 'La suma de Elo no se conserva.' });
}

function validateAnnual(data, errors) {
  for (const season of data.seasons) {
    const expected = new Map();
    for (const event of data.tournaments.filter((row) => row.seasonId === season.id && row.annualEligible))
      for (const row of event.standings ?? []) {
        const value = expected.get(row.playerId) ?? { points: 0, tournaments: 0 };
        value.points += row.points;
        value.tournaments++;
        expected.set(row.playerId, value);
      }
    let annual;
    try { annual = getAnnualStandings(data, season.id); } catch (error) {
      errors.push({ code: 'ANNUAL_ENGINE', detail: `${season.id}: ${error.message}` }); continue;
    }
    if (annual.standings.length !== expected.size) errors.push({ code: 'ANNUAL_TOTAL', detail: season.id });
    for (const row of annual.standings) {
      const value = expected.get(row.playerId);
      if (!value || !close(row.points, value.points) || row.tournaments !== value.tournaments)
        errors.push({ code: 'ANNUAL_TOTAL', detail: `${season.id}/${row.playerId}` });
    }
  }
}

function validateProfiles(data, errors) {
  for (const player of data.players) {
    const profile = getPlayerProfile(data, player.id);
    const boardGames = data.games.filter((game) => game.whiteId === player.id || game.blackId === player.id);
    const record = profile.record;
    if (record.played !== boardGames.length || record.played !== profile.colors.white.played + profile.colors.black.played ||
      record.wins !== profile.colors.white.wins + profile.colors.black.wins ||
      record.draws !== profile.colors.white.draws + profile.colors.black.draws ||
      record.losses !== profile.colors.white.losses + profile.colors.black.losses)
      errors.push({ code: 'PROFILE_RECORD', detail: player.id });
    const official = data.tournaments.reduce((total, event) => total +
      (event.standings ?? []).filter((row) => row.playerId === player.id).reduce((sum, row) => sum + row.points, 0), 0);
    if (!close(profile.officialPoints, official)) errors.push({ code: 'PROFILE_OFFICIAL_POINTS', detail: player.id });
    if (record.played && (!close(record.winRate, 100 * record.wins / record.played) ||
      !close(record.scoreRate, 100 * (record.wins + record.draws * 0.5) / record.played)))
      errors.push({ code: 'PROFILE_RATES', detail: player.id });
  }
}

function validateViews(data, errors, deps) {
  const totals = { players: data.players.length, tournaments: data.tournaments.length, games: data.games.length };
  const homeTotals = getHomeTotals(data);
  if (Object.keys(totals).some((key) => homeTotals[key] !== totals[key]))
    errors.push({ code: 'HOME_ENGINE_TOTAL', detail: 'Los totales del motor difieren del dataset.' });
  const homeHtml = deps.renderHome(data, { today: '2999-01-01' }).html;
  const section = homeHtml.match(/<section\s+class="home-totals"[^>]*>([\s\S]*?)<\/section>/)?.[1] ?? '';
  for (const [key, label] of [['players', 'jugadores'], ['tournaments', 'torneos'], ['games', 'partidas']])
    if (!section.includes(`<strong>${formatNumber(totals[key])}</strong> ${label}`))
      errors.push({ code: 'HOME_VIEW_TOTAL', detail: key });
  const directory = deps.renderPlayersDirectory(data).html;
  if (!directory.includes(`${formatNumber(totals.players)} jugadores en el padrón`))
    errors.push({ code: 'DIRECTORY_VIEW_TOTAL', detail: 'jugadores' });
  const tournamentList = deps.renderTournamentList(data).html;
  if (!tournamentList.includes(`${formatNumber(totals.tournaments)} de ${formatNumber(totals.tournaments)} torneos`))
    errors.push({ code: 'TOURNAMENT_VIEW_TOTAL', detail: 'torneos' });
}

function validateOfficialRecords(data, errors, deps) {
  const boards = new Map(deps.getLeaderboards(data).map((board) => [board.id, board]));
  for (const player of data.players) {
    const ranks = data.tournaments.flatMap((event) => (event.standings ?? [])
      .filter((row) => row.playerId === player.id).map((row) => row.rank));
    const firstPlaces = ranks.filter((rank) => rank === 1).length;
    const podiums = ranks.filter((rank) => Number.isInteger(rank) && rank >= 1 && rank <= 3).length;
    for (const [boardId, expected, code] of [
      ['tournamentsWon', firstPlaces, 'RECORD_TOURNAMENT_WINS'],
      ['podiums', podiums, 'RECORD_PODIUMS'],
    ]) {
      const entry = boards.get(boardId)?.entries.find((row) => row.playerId === player.id);
      if ((entry?.value ?? 0) !== expected || Boolean(entry) !== (expected > 0))
        errors.push({ code, detail: player.id });
    }
    const html = deps.renderPlayerProfile(data, player.slug).html;
    for (const [label, expected, code] of [
      ['Primeros puestos oficiales', firstPlaces, 'PROFILE_FIRST_PLACES_VIEW'],
      ['Podios oficiales', podiums, 'PROFILE_PODIUMS_VIEW'],
    ]) {
      if (!html.includes(`${label}</dt><dd>${formatNumber(expected)}</dd>`))
        errors.push({ code, detail: player.id });
    }
  }
}

function rawPair(games, firstId, secondId) {
  const counts = { wins: 0, draws: 0, losses: 0, played: 0, white: 0, black: 0 };
  for (const game of games) {
    if (!((game.whiteId === firstId && game.blackId === secondId) ||
      (game.whiteId === secondId && game.blackId === firstId))) continue;
    counts.played++;
    counts[game.whiteId === firstId ? 'white' : 'black']++;
    if (game.result === '1/2-1/2') counts.draws++;
    else if ((game.whiteId === firstId && game.result === '1-0') ||
      (game.blackId === firstId && game.result === '0-1')) counts.wins++;
    else counts.losses++;
  }
  return counts;
}

function validateClassics(data, errors, deps) {
  for (let i = 0; i < data.players.length; i++) {
    for (let j = i + 1; j < data.players.length; j++) {
      const first = data.players[i];
      const second = data.players[j];
      const expected = rawPair(data.games, first.id, second.id);
      if (expected.played < 4) continue;
      for (const [left, right, raw] of [[first, second, expected],
        [second, first, rawPair(data.games, second.id, first.id)]]) {
        const pair = deps.getHeadToHead(data, left.id, right.id);
        const detail = `${left.id}/${right.id}`;
        if (!pair || pair.games.length !== raw.played ||
          ['wins', 'draws', 'losses', 'played'].some((key) => pair.record[key] !== raw[key])) {
          errors.push({ code: 'CLASSIC_RECORD', detail }); continue;
        }
        if (pair.colors.white.played !== raw.white || pair.colors.black.played !== raw.black)
          errors.push({ code: 'CLASSIC_COLORS', detail });
        const points = raw.wins + raw.draws / 2;
        if (!close(pair.record.points, points) ||
          !close(pair.record.winRate, 100 * raw.wins / raw.played) ||
          !close(pair.record.scoreRate, 100 * points / raw.played))
          errors.push({ code: 'CLASSIC_RATES', detail });
        const html = deps.renderClassic(data, left.slug, right.slug).html;
        if (!html.includes(`G-E-P: ${raw.wins}-${raw.draws}-${raw.losses}`) ||
          !html.includes(`Rendimiento por puntos: ${formatNumber(points)} / ${raw.played} (${Math.round(100 * points / raw.played)} %)`) ||
          !html.includes(`Porcentaje de victorias: ${Math.round(100 * raw.wins / raw.played)} %`))
          errors.push({ code: 'CLASSIC_VIEW', detail });
      }
    }
  }
}

export function verifyData(data, overrides = {}) {
  const errors = [];
  const counts = { players: data.players.length, tournaments: data.tournaments.length,
    games: data.games.length, byes: data.byes.length };
  for (const [name, rows] of [['jugadores', data.players], ['torneos', data.tournaments],
    ['partidas', data.games], ['descansos', data.byes], ['títulos', data.titles], ['temporadas', data.seasons]])
    unique(rows, name, errors);
  validateOfficialFields(data, errors);
  validateForeignKeys(data, errors);
  if (!errors.length) {
    validateStandings(data, errors);
    validateElo(data, errors, overrides.calculateElo ?? calculateElo);
    validateAnnual(data, errors);
    validateProfiles(data, errors);
    validateOfficialRecords(data, errors, {
      getLeaderboards: overrides.getLeaderboards ?? getLeaderboards,
      renderPlayerProfile: overrides.renderPlayerProfile ?? renderPlayerProfile,
    });
    validateClassics(data, errors, {
      getHeadToHead: overrides.getHeadToHead ?? getHeadToHead,
      renderClassic: overrides.renderClassic ?? renderClassic,
    });
    validateViews(data, errors, {
      renderHome: overrides.renderHome ?? renderHome,
      renderPlayersDirectory: overrides.renderPlayersDirectory ?? renderPlayersDirectory,
      renderTournamentList: overrides.renderTournamentList ?? renderTournamentList,
    });
  }
  return { ok: errors.length === 0, counts, errors };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = verifyData(demo);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

import { randomUUID } from 'node:crypto';
import { calendarDate } from '../dist/domain/official-integrity.js';
import { rankStandings } from './admin-game.mjs';
import { slugFrom } from './admin-player.mjs';
import { decodeDemoSnapshot, encodeDemoSnapshot } from './demo-snapshot.mjs';
import { applyDemoStore, correctDemoStore, statusDemoStore } from './demo-store.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const fields = (input, names) => input && !Array.isArray(input) && typeof input === 'object' &&
  Object.keys(input).sort().join(',') === [...names].sort().join(',');

function label(value, caption, max = 120) {
  if (typeof value !== 'string') fail(`${caption} inválido`);
  const result = value.trim().replace(/\s+/gu, ' ');
  if (!result || result.length > max || /[\x00-\x1f\x7f]/.test(result)) fail(`${caption} inválido`);
  return result;
}

function seasonInput(input) {
  if (!fields(input, ['expectedSha', 'label', 'start', 'end']) || !hash(input.expectedSha))
    fail('Temporada o hash inválidos');
  const value = { label: label(input.label, 'Nombre de temporada', 80),
    start: input.start, end: input.end };
  if (!calendarDate(value.start) || !calendarDate(value.end) || value.start > value.end)
    fail('Fechas de temporada inválidas');
  return { expectedSha: input.expectedSha, value };
}

function tournamentInput(input) {
  const keys = ['expectedSha', 'name', 'seasonId', 'date', 'type', 'format',
    'annualEligible', 'eloEligible', 'playerIds'];
  if (!fields(input, keys) && !fields(input, [...keys, 'modality']) || !hash(input?.expectedSha))
    fail('Torneo o hash inválidos');
  const value = { name: label(input.name, 'Nombre de torneo'),
    seasonId: input.seasonId, date: input.date,
    type: label(input.type, 'Tipo de torneo', 80),
    format: label(input.format, 'Formato de torneo', 80),
    annualEligible: input.annualEligible, eloEligible: input.eloEligible };
  if (typeof value.seasonId !== 'string' || !value.seasonId || !calendarDate(value.date) ||
      typeof value.annualEligible !== 'boolean' || typeof value.eloEligible !== 'boolean')
    fail('Datos de torneo inválidos');
  if (Object.hasOwn(input, 'modality')) {
    if (typeof input.modality !== 'string') fail('Modalidad inválida');
    const modality = input.modality.trim();
    if (modality.length > 80 || /[\x00-\x1f\x7f]/.test(modality)) fail('Modalidad inválida');
    if (modality) value.modality = modality;
  }
  if (!Array.isArray(input.playerIds) || input.playerIds.length < 2 ||
      input.playerIds.length > 256 || input.playerIds.some((id) => typeof id !== 'string' || !id) ||
      new Set(input.playerIds).size !== input.playerIds.length)
    fail('Elegí al menos dos participantes distintos');
  return { expectedSha: input.expectedSha, value, playerIds: input.playerIds };
}

async function current(store, expectedSha) {
  const state = await statusDemoStore(store);
  if (state.snapshot.sha256 !== expectedSha) fail('CAS rechazado: hash vigente obsoleto', 409);
  return { state, data: decodeDemoSnapshot(state.data) };
}

export async function createAdminSeason(store, input) {
  const { expectedSha, value } = seasonInput(input);
  const { data } = await current(store, expectedSha);
  if (data.seasons.some((row) => row.label === value.label)) fail('La temporada ya existe', 409);
  const id = `admin-season-${randomUUID()}`;
  data.seasons.push({ id, ...value });
  return { id, state: await applyDemoStore(store, encodeDemoSnapshot(data), { expectedSha }) };
}

export async function updateAdminSeason(store, id, input) {
  const { expectedSha, value } = seasonInput(input);
  const { state, data } = await current(store, expectedSha);
  const season = data.seasons.find((row) => row.id === id);
  if (!season) fail('Temporada inexistente', 404);
  if (data.seasons.some((row) => row.id !== id && row.label === value.label))
    fail('La temporada ya existe', 409);
  if (same({ label: season.label, start: season.start, end: season.end }, value)) return { id, state };
  Object.assign(season, value);
  return { id, state: await correctDemoStore(store, encodeDemoSnapshot(data), expectedSha,
    [{ collection: 'seasons', id }]) };
}

function knownRoster(data, playerIds) {
  const known = new Set(data.players.map((row) => row.id));
  if (playerIds.some((id) => !known.has(id))) fail('Participante inexistente', 404);
}

const zeroStanding = (playerId, order) => ({ playerId, order, rank: 1,
  points: 0, wins: 0, draws: 0, losses: 0 });

export async function createAdminTournament(store, input) {
  const { expectedSha, value, playerIds } = tournamentInput(input);
  const { data } = await current(store, expectedSha);
  if (!data.seasons.some((row) => row.id === value.seasonId)) fail('Temporada inexistente', 404);
  knownRoster(data, playerIds);
  const slug = `${slugFrom(value.name)}-${value.date}`;
  if (data.tournaments.some((row) => row.slug === slug)) fail('El torneo ya existe', 409);
  const id = `admin-tournament-${randomUUID()}`;
  const event = { id, slug, ...value, rounds: 0,
    standings: playerIds.map((playerId, index) => zeroStanding(playerId, index + 1)) };
  data.tournaments.push(event);
  return { id, state: await applyDemoStore(store, encodeDemoSnapshot(data), { expectedSha }) };
}

export async function updateAdminTournament(store, id, input) {
  const { expectedSha, value, playerIds } = tournamentInput(input);
  const { state, data } = await current(store, expectedSha);
  const event = data.tournaments.find((row) => row.id === id);
  if (!event) fail('Torneo inexistente', 404);
  if (!data.seasons.some((row) => row.id === value.seasonId)) fail('Temporada inexistente', 404);
  knownRoster(data, playerIds);
  const existing = new Set(event.standings.map((row) => row.playerId));
  if ([...existing].some((playerId) => !playerIds.includes(playerId)))
    fail('No se pueden quitar participantes existentes');
  if (event.standings.some((row) => ['wins', 'draws', 'losses'].some((key) => row[key] === null)) &&
      playerIds.length > existing.size) fail('La tabla histórica requiere una corrección explícita');
  const before = JSON.stringify(event);
  for (const key of ['name', 'seasonId', 'date', 'type', 'format', 'annualEligible', 'eloEligible'])
    event[key] = value[key];
  if (value.modality) event.modality = value.modality;
  else delete event.modality;
  for (const playerId of playerIds)
    if (!existing.has(playerId)) event.standings.push(zeroStanding(playerId, event.standings.length + 1));
  if (playerIds.length > existing.size) rankStandings(event);
  if (JSON.stringify(event) === before) return { id, state };
  return { id, state: await correctDemoStore(store, encodeDemoSnapshot(data), expectedSha,
    [{ collection: 'tournaments', id }]) };
}

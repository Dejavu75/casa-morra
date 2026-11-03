import { randomUUID } from 'node:crypto';
import { rankStandings } from './admin-game.mjs';
import { decodeDemoSnapshot, encodeDemoSnapshot } from './demo-snapshot.mjs';
import { applyDemoStore, correctDemoStore, recordAdminRecord, statusDemoStore } from './demo-store.mjs';
import { verifyData } from './verify-data.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const positive = (value) => Number.isInteger(value) && value > 0;
const points = (value) => Number.isFinite(value) && value >= 0 && value <= 1 && value * 2 === Math.round(value * 2);
const label = (value, name) => {
  if (typeof value !== 'string' || !value.trim() || value.length > 120 || /[\x00-\x1f\x7f]/u.test(value))
    fail(`${name} inválido`);
  return value.trim().replace(/\s+/gu, ' ');
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const current = async (store, sha) => {
  if (!hash(sha)) fail('Hash inválido');
  const state = await statusDemoStore(store);
  if (state.snapshot.sha256 !== sha) fail('CAS rechazado: hash vigente obsoleto', 409);
  return { state, data: decodeDemoSnapshot(state.data) };
};

function byeInput(input) {
  if (!input || !hash(input.expectedSha) || typeof input.tournamentId !== 'string' ||
      typeof input.playerId !== 'string' || !positive(input.round) || !points(input.points))
    fail('Descanso inválido');
  return { tournamentId: input.tournamentId, playerId: input.playerId,
    round: input.round, points: input.points };
}

/** Valida y aplica un descanso nuevo dentro del bloqueo del almacén. */
export function prepareAdminRecord(data, request) {
  if (request?.mode !== 'bye-create') fail('Operación de registro inválida');
  const next = decodeDemoSnapshot(encodeDemoSnapshot(data));
  const bye = request.bye;
  if (!bye || !label(bye.id, 'ID de descanso') || !positive(bye.round) || !points(bye.points))
    fail('Descanso inválido');
  if (next.byes.some((row) => row.id === bye.id)) fail('El descanso ya existe', 409);
  const event = next.tournaments.find((row) => row.id === bye.tournamentId);
  if (!event) fail('Torneo inexistente', 404);
  const row = event.standings.find((item) => item.playerId === bye.playerId);
  if (!row) fail('Participante inexistente', 404);
  if (event.standings.some((item) => ['wins', 'draws', 'losses'].some((key) => item[key] === null)))
    fail('La tabla histórica requiere una corrección explícita');
  if (next.byes.some((item) => item.tournamentId === bye.tournamentId &&
      item.round === bye.round && item.playerId === bye.playerId) ||
      next.games.some((item) => item.tournamentId === bye.tournamentId &&
      item.round === bye.round && [item.whiteId, item.blackId].includes(bye.playerId)))
    fail('El jugador ya tiene resultado en la ronda', 409);
  next.byes.push({ id: bye.id, tournamentId: bye.tournamentId, round: bye.round,
    playerId: bye.playerId, points: bye.points });
  row.points += bye.points;
  event.rounds = Math.max(event.rounds, bye.round);
  rankStandings(event);
  const report = verifyData(next);
  if (!report.ok) fail(`El descanso no concilia con las estadísticas (${report.errors[0].code})`);
  return next;
}

export async function createAdminBye(store, input) {
  const value = byeInput(input);
  const id = `admin-bye-${randomUUID()}`;
  return { id, state: await recordAdminRecord(store,
    { mode: 'bye-create', bye: { id, ...value } }, input.expectedSha) };
}

export async function updateAdminBye(store, id, input) {
  const value = byeInput(input);
  const { state, data } = await current(store, input.expectedSha);
  const bye = data.byes.find((row) => row.id === id);
  if (!bye) fail('Descanso inexistente', 404);
  if (bye.tournamentId !== value.tournamentId || bye.playerId !== value.playerId)
    fail('No se puede cambiar la identidad del descanso');
  if (same({ tournamentId: bye.tournamentId, playerId: bye.playerId,
    round: bye.round, points: bye.points }, value)) return { id, state };
  const event = data.tournaments.find((row) => row.id === bye.tournamentId);
  const row = event?.standings.find((item) => item.playerId === bye.playerId);
  if (!row || event.standings.some((item) => ['wins', 'draws', 'losses'].some((key) => item[key] === null)))
    fail('La tabla histórica requiere una corrección explícita');
  if (data.byes.some((item) => item.id !== id && item.tournamentId === bye.tournamentId &&
      item.round === value.round && item.playerId === bye.playerId) ||
      data.games.some((item) => item.tournamentId === bye.tournamentId &&
      item.round === value.round && [item.whiteId, item.blackId].includes(bye.playerId)))
    fail('El jugador ya tiene resultado en la ronda', 409);
  const beforeEvent = JSON.stringify(event);
  row.points += value.points - bye.points;
  bye.points = value.points;
  bye.round = value.round;
  event.rounds = Math.max(event.rounds, bye.round);
  rankStandings(event);
  return { id, state: await correctDemoStore(store, encodeDemoSnapshot(data), input.expectedSha,
    [{ collection: 'byes', id }, ...(JSON.stringify(event) === beforeEvent ? [] :
      [{ collection: 'tournaments', id: event.id }])]) };
}

function titleInput(input) {
  if (!input || !hash(input.expectedSha) || typeof input.playerId !== 'string' ||
      typeof input.tournamentId !== 'string') fail('Título inválido');
  return { playerId: input.playerId, tournamentId: input.tournamentId,
    kind: label(input.kind, 'Clase de título'), label: label(input.label, 'Nombre de título') };
}

export async function createAdminTitle(store, input) {
  const value = titleInput(input);
  const { data } = await current(store, input.expectedSha);
  if (!data.players.some((row) => row.id === value.playerId)) fail('Jugador inexistente', 404);
  if (!data.tournaments.some((row) => row.id === value.tournamentId)) fail('Torneo inexistente', 404);
  const id = `admin-title-${randomUUID()}`;
  data.titles.push({ id, ...value });
  return { id, state: await applyDemoStore(store, encodeDemoSnapshot(data),
    { expectedSha: input.expectedSha }) };
}

export async function updateAdminTitle(store, id, input) {
  const value = titleInput(input);
  const { state, data } = await current(store, input.expectedSha);
  const title = data.titles.find((row) => row.id === id);
  if (!title) fail('Título inexistente', 404);
  if (!data.players.some((row) => row.id === value.playerId)) fail('Jugador inexistente', 404);
  if (!data.tournaments.some((row) => row.id === value.tournamentId)) fail('Torneo inexistente', 404);
  if (same({ playerId: title.playerId, tournamentId: title.tournamentId,
    kind: title.kind, label: title.label }, value)) return { id, state };
  Object.assign(title, value);
  return { id, state: await correctDemoStore(store, encodeDemoSnapshot(data), input.expectedSha,
    [{ collection: 'titles', id }]) };
}

export async function updateHistoricalStanding(store, tournamentId, playerId, input) {
  const { state, data } = await current(store, input?.expectedSha);
  const event = data.tournaments.find((row) => row.id === tournamentId);
  if (!event) fail('Torneo inexistente', 404);
  if (data.games.some((row) => row.tournamentId === tournamentId))
    fail('Solo se puede corregir una tabla histórica sin partidas');
  const row = event.standings.find((item) => item.playerId === playerId);
  if (!row) fail('Participante inexistente', 404);
  if (!Number.isFinite(input.points) || input.points < 0 || input.points * 2 !== Math.round(input.points * 2) ||
      !positive(input.rank) || input.rank > event.standings.length)
    fail('Puntos o puesto inválidos');
  if (row.points === input.points && row.rank === input.rank) return { id: tournamentId, state };
  row.points = input.points;
  row.rank = input.rank;
  return { id: tournamentId, state: await correctDemoStore(store, encodeDemoSnapshot(data),
    input.expectedSha, [{ collection: 'tournaments', id: tournamentId }]) };
}

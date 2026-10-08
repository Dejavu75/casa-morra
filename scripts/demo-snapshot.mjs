import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as demo from '../dist/data/demo.js';
import { validateOfficialFields } from './data-integrity.mjs';

export const SNAPSHOT_FORMAT = 'casa-morra.demo-snapshot';
export const SNAPSHOT_VERSION = 1;
const PROVENANCE = 'casa-morra-original-demo';
const CLASSIFICATION = 'public-demo';

const DATA_KEYS = ['byes', 'editorial', 'games', 'players', 'seasons', 'titles', 'tournaments'];
const ROW_KEYS = DATA_KEYS.filter((key) => key !== 'editorial');
const SHAPES = Object.freeze({
  seasons: { id: 'string', label: 'string', start: 'string', end: 'string' },
  players: { id: 'string', slug: 'string', name: 'string', membership: 'string', demo: 'boolean' },
  tournaments: {
    id: 'string', slug: 'string', name: 'string', seasonId: 'string', date: 'string',
    type: 'string', format: 'string', rounds: 'number', annualEligible: 'boolean',
    eloEligible: 'boolean', standings: 'standings',
  },
  standings: {
    playerId: 'string', order: 'number', rank: 'number', points: 'number',
    wins: 'nullable-number', draws: 'nullable-number', losses: 'nullable-number',
  },
  games: {
    id: 'string', tournamentId: 'string', round: 'number', date: 'string',
    whiteId: 'string', blackId: 'string', result: 'string', moves: 'moves', finish: 'nullable-string',
  },
  byes: { id: 'string', tournamentId: 'string', round: 'number', playerId: 'string', points: 'number' },
  titles: { id: 'string', playerId: 'string', tournamentId: 'string', kind: 'string', label: 'string' },
  club: { name: 'string', description: 'string', history: 'string', contactNote: 'string' },
  news: { id: 'string', slug: 'string', date: 'string', title: 'string', excerpt: 'string', body: 'string' },
  classes: { id: 'string', day: 'string', time: 'string', name: 'string', teacher: 'string', level: 'string', place: 'string' },
});

const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const problem = (errors, code, detail) => errors.push({ code, detail });

function checkFields(value, shape, path, errors) {
  if (!record(value)) { problem(errors, 'INVALID_SHAPE', path); return; }
  for (const key of Object.keys(value)) {
    if (!Object.hasOwn(shape, key)) problem(errors, 'UNEXPECTED_FIELD', `${path}.${key}`);
  }
  for (const [key, type] of Object.entries(shape)) {
    const field = value[key];
    const place = `${path}.${key}`;
    if (!Object.hasOwn(value, key)) { problem(errors, 'MISSING_FIELD', place); continue; }
    if (type === 'standings') { checkRows(field, SHAPES.standings, place, errors); continue; }
    if (type === 'moves') {
      if (field !== null && (!Array.isArray(field) || !field.every((move) => typeof move === 'string')))
        problem(errors, 'INVALID_FIELD', place);
      continue;
    }
    const optional = type.startsWith('nullable-');
    const baseType = optional ? type.slice('nullable-'.length) : type;
    const valid = optional && field === null ||
      (baseType === 'number' ? typeof field === 'number' && Number.isFinite(field) : typeof field === baseType);
    if (!valid) problem(errors, 'INVALID_FIELD', place);
  }
}

function checkRows(value, shape, path, errors) {
  if (!Array.isArray(value)) { problem(errors, 'INVALID_SHAPE', path); return; }
  value.forEach((row, index) => checkFields(row, shape, `${path}[${index}]`, errors));
}

function checkUnique(rows, field, path, errors) {
  const seen = new Set();
  for (const row of rows) {
    const value = row[field];
    if (seen.has(value)) problem(errors, field === 'id' ? 'DUPLICATE_ID' : 'DUPLICATE_KEY', `${path}.${field}: ${value}`);
    seen.add(value);
  }
}

function checkReferences(data, errors) {
  const playerIds = new Set(data.players.map((row) => row.id));
  const seasonIds = new Set(data.seasons.map((row) => row.id));
  const eventIds = new Set(data.tournaments.map((row) => row.id));
  const rosters = new Map(data.tournaments.map((event) =>
    [event.id, new Set(event.standings.map((row) => row.playerId))]));
  for (const event of data.tournaments) {
    if (!seasonIds.has(event.seasonId)) problem(errors, 'UNKNOWN_SEASON', event.id);
    checkUnique(event.standings, 'playerId', `${event.id}.standings`, errors);
    event.standings.forEach((row, index) => {
      if (!playerIds.has(row.playerId)) problem(errors, 'UNKNOWN_PLAYER', `${event.id}/${row.playerId}`);
      if (row.order !== index + 1) problem(errors, 'STANDING_ORDER', `${event.id}/${row.playerId}`);
    });
  }
  for (const game of data.games) {
    if (!eventIds.has(game.tournamentId)) problem(errors, 'UNKNOWN_TOURNAMENT', game.id);
    if (!playerIds.has(game.whiteId)) problem(errors, 'UNKNOWN_PLAYER', `${game.id}/${game.whiteId}`);
    if (!playerIds.has(game.blackId)) problem(errors, 'UNKNOWN_PLAYER', `${game.id}/${game.blackId}`);
    for (const id of [game.whiteId, game.blackId])
      if (rosters.has(game.tournamentId) && !rosters.get(game.tournamentId).has(id))
        problem(errors, 'UNKNOWN_PARTICIPANT', `${game.id}/${id}`);
    if (game.whiteId === game.blackId) problem(errors, 'SELF_GAME', game.id);
    if (!['1-0', '0-1', '1/2-1/2'].includes(game.result)) problem(errors, 'INVALID_RESULT', game.id);
  }
  for (const bye of data.byes) {
    if (!eventIds.has(bye.tournamentId)) problem(errors, 'UNKNOWN_TOURNAMENT', bye.id);
    if (!playerIds.has(bye.playerId)) problem(errors, 'UNKNOWN_PLAYER', `${bye.id}/${bye.playerId}`);
    if (rosters.has(bye.tournamentId) && !rosters.get(bye.tournamentId).has(bye.playerId))
      problem(errors, 'UNKNOWN_PARTICIPANT', `${bye.id}/${bye.playerId}`);
  }
  for (const title of data.titles) {
    if (!eventIds.has(title.tournamentId)) problem(errors, 'UNKNOWN_TOURNAMENT', title.id);
    if (!playerIds.has(title.playerId)) problem(errors, 'UNKNOWN_PLAYER', `${title.id}/${title.playerId}`);
  }
}

export function validateDemoSnapshot(snapshot) {
  const errors = [];
  if (!record(snapshot)) return { ok: false, errors: [{ code: 'INVALID_SHAPE', detail: 'snapshot' }] };
  for (const key of Object.keys(snapshot))
    if (!['format', 'version', 'provenance', 'classification', 'data'].includes(key))
      problem(errors, 'UNEXPECTED_FIELD', `snapshot.${key}`);
  if (snapshot.format !== SNAPSHOT_FORMAT) problem(errors, 'UNSUPPORTED_FORMAT', 'snapshot.format');
  if (snapshot.version !== SNAPSHOT_VERSION) problem(errors, 'UNSUPPORTED_VERSION', 'snapshot.version');
  if (snapshot.provenance !== PROVENANCE) problem(errors, 'INVALID_PROVENANCE', 'snapshot.provenance');
  if (snapshot.classification !== CLASSIFICATION) problem(errors, 'INVALID_CLASSIFICATION', 'snapshot.classification');
  const data = snapshot.data;
  if (!record(data)) { problem(errors, 'INVALID_SHAPE', 'snapshot.data'); return { ok: false, errors }; }
  for (const key of Object.keys(data))
    if (!DATA_KEYS.includes(key)) problem(errors, 'UNEXPECTED_FIELD', `data.${key}`);
  for (const key of ROW_KEYS) checkRows(data[key], SHAPES[key], `data.${key}`, errors);
  if (!record(data.editorial)) problem(errors, 'INVALID_SHAPE', 'data.editorial');
  else {
    for (const key of Object.keys(data.editorial))
      if (!['club', 'news', 'classes'].includes(key)) problem(errors, 'UNEXPECTED_FIELD', `data.editorial.${key}`);
    checkFields(data.editorial.club, SHAPES.club, 'data.editorial.club', errors);
    checkRows(data.editorial.news, SHAPES.news, 'data.editorial.news', errors);
    checkRows(data.editorial.classes, SHAPES.classes, 'data.editorial.classes', errors);
  }
  if (errors.length) return { ok: false, errors };
  validateOfficialFields(data, errors);
  for (const key of ROW_KEYS) checkUnique(data[key], 'id', key, errors);
  for (const key of ['players', 'tournaments']) checkUnique(data[key], 'slug', key, errors);
  for (const key of ['news', 'classes']) checkUnique(data.editorial[key], 'id', `editorial.${key}`, errors);
  checkUnique(data.editorial.news, 'slug', 'editorial.news', errors);
  checkReferences(data, errors);
  return { ok: errors.length === 0, errors };
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (record(value)) return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function requireValid(snapshot) {
  const report = validateDemoSnapshot(snapshot);
  if (!report.ok) throw new Error(`Snapshot inválido: ${report.errors.map((error) => error.code).join(', ')}`);
  return snapshot;
}

export function encodeDemoSnapshot(data) {
  for (const key of Object.keys(data ?? {}))
    if (!DATA_KEYS.includes(key)) throw new Error(`Snapshot inválido: UNEXPECTED_FIELD data.${key}`);
  const payload = {
    format: SNAPSHOT_FORMAT,
    version: SNAPSHOT_VERSION,
    provenance: PROVENANCE,
    classification: CLASSIFICATION,
    data: Object.fromEntries(DATA_KEYS.map((key) => [key, data?.[key]])),
  };
  requireValid(payload);
  return canonical(payload);
}

export function decodeDemoSnapshot(json) {
  let snapshot;
  try { snapshot = JSON.parse(json); }
  catch { throw new Error('Snapshot inválido: INVALID_JSON'); }
  return requireValid(snapshot).data;
}

export function snapshotMetadata(json) {
  const data = decodeDemoSnapshot(json);
  if (encodeDemoSnapshot(data) !== json) throw new Error('Snapshot inválido: NON_CANONICAL');
  const bytes = Buffer.from(json, 'utf8');
  return { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const json = encodeDemoSnapshot(demo);
  console.log(JSON.stringify({ format: SNAPSHOT_FORMAT, version: SNAPSHOT_VERSION,
    ...snapshotMetadata(json), counts: Object.fromEntries(ROW_KEYS
      .map((key) => [key, demo[key].length])) }, null, 2));
}

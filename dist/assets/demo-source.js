// Contrato público del exportador. El hash prueba integridad, no vigencia del almacén privado.
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const invalid = () => new Error('Exportación pública inválida o alterada');
const shapes = {
  seasons: { id: 'string', label: 'string', start: 'string', end: 'string' },
  players: { id: 'string', slug: 'string', name: 'string', membership: 'string', demo: 'boolean' },
  tournaments: { id: 'string', slug: 'string', name: 'string', seasonId: 'string', date: 'string',
    type: 'string', format: 'string', rounds: 'number', annualEligible: 'boolean',
    eloEligible: 'boolean', standings: 'standings' },
  standings: { playerId: 'string', order: 'number', rank: 'number', points: 'number',
    wins: 'nullable-number', draws: 'nullable-number', losses: 'nullable-number' },
  games: { id: 'string', tournamentId: 'string', round: 'number', date: 'string',
    whiteId: 'string', blackId: 'string', result: 'string', moves: 'moves', finish: 'nullable-string' },
  byes: { id: 'string', tournamentId: 'string', round: 'number', playerId: 'string', points: 'number' },
  titles: { id: 'string', playerId: 'string', tournamentId: 'string', kind: 'string', label: 'string' },
  club: { name: 'string', description: 'string', history: 'string', contactNote: 'string' },
  news: { id: 'string', slug: 'string', date: 'string', title: 'string', excerpt: 'string', body: 'string' },
  classes: { id: 'string', day: 'string', time: 'string', name: 'string', teacher: 'string', level: 'string', place: 'string' },
};
const collections = ['byes', 'games', 'players', 'seasons', 'titles', 'tournaments'];
const dataKeys = [...collections, 'editorial'];

function fields(row, shape) {
  if (!exact(row, Object.keys(shape))) throw invalid();
  for (const [key, type] of Object.entries(shape)) {
    const value = row[key];
    if (type === 'standings') { rows(value, shapes.standings); continue; }
    if (type === 'moves') {
      if (value !== null && (!Array.isArray(value) || !value.every((move) => typeof move === 'string')))
        throw invalid();
      continue;
    }
    if (type.startsWith('nullable-') && value === null) continue;
    const base = type.replace('nullable-', '');
    if (typeof value !== base || (base === 'number' && !Number.isFinite(value))) throw invalid();
  }
}

function rows(value, shape) {
  if (!Array.isArray(value)) throw invalid();
  value.forEach((row) => fields(row, shape));
}

function unique(rows, key) {
  const values = rows.map((row) => row[key]);
  if (new Set(values).size !== values.length) throw invalid();
}

function validateSnapshot(snapshot) {
  if (!exact(snapshot, ['format', 'version', 'provenance', 'classification', 'data']) ||
      snapshot.format !== 'casa-morra.demo-snapshot' || snapshot.version !== 1 ||
      snapshot.provenance !== 'casa-morra-original-demo' || snapshot.classification !== 'public-demo')
    throw invalid();
  const data = snapshot.data;
  if (!exact(data, dataKeys)) throw invalid();
  for (const key of collections) {
    rows(data[key], shapes[key]);
    unique(data[key], 'id');
  }
  if (!exact(data.editorial, ['club', 'news', 'classes'])) throw invalid();
  fields(data.editorial.club, shapes.club);
  rows(data.editorial.news, shapes.news);
  rows(data.editorial.classes, shapes.classes);
  for (const key of ['news', 'classes']) unique(data.editorial[key], 'id');
  for (const key of ['players', 'tournaments']) unique(data[key], 'slug');
  unique(data.editorial.news, 'slug');

  const ids = (key) => new Set(data[key].map((row) => row.id));
  const players = ids('players');
  const tournaments = ids('tournaments');
  const seasons = ids('seasons');
  const rosters = new Map(data.tournaments.map((event) =>
    [event.id, new Set(event.standings.map((row) => row.playerId))]));
  for (const event of data.tournaments) {
    if (!seasons.has(event.seasonId)) throw invalid();
    unique(event.standings, 'playerId');
    event.standings.forEach((row, index) => {
      if (!players.has(row.playerId) || row.order !== index + 1) throw invalid();
    });
  }
  for (const game of data.games) {
    if (!tournaments.has(game.tournamentId) || !players.has(game.whiteId) ||
        !players.has(game.blackId) || game.whiteId === game.blackId ||
        !rosters.get(game.tournamentId).has(game.whiteId) ||
        !rosters.get(game.tournamentId).has(game.blackId) ||
        !['1-0', '0-1', '1/2-1/2'].includes(game.result)) throw invalid();
  }
  for (const bye of data.byes) {
    if (!tournaments.has(bye.tournamentId) || !players.has(bye.playerId) ||
        !rosters.get(bye.tournamentId).has(bye.playerId)) throw invalid();
  }
  for (const title of data.titles) {
    if (!tournaments.has(title.tournamentId) || !players.has(title.playerId)) throw invalid();
  }
  return data;
}

export async function validatePublicDemo(value, crypto) {
  if (!crypto?.subtle?.digest) throw new Error('WebCrypto no disponible');
  if (!exact(value, ['format', 'version', 'source', 'snapshot']) ||
      value.format !== 'casa-morra.demo-public' || value.version !== 1 ||
      !exact(value.source, ['bytes', 'sha256']) ||
      !Number.isSafeInteger(value.source.bytes) || value.source.bytes <= 0 ||
      !/^[a-f0-9]{64}$/.test(value.source.sha256)) throw invalid();
  const data = validateSnapshot(value.snapshot);
  const bytes = new TextEncoder().encode(JSON.stringify(value.snapshot));
  if (bytes.length !== value.source.bytes) throw invalid();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  if (sha256 !== value.source.sha256) throw invalid();
  return data;
}

export function createDemoSource({ fixture, fetch, crypto, onChange }) {
  let generation = 0;
  return {
    async refresh() {
      const current = ++generation;
      let state;
      try {
        const response = await fetch('/demo/snapshot.json', { cache: 'no-store' });
        if (!response.ok) throw new Error('Exportación ausente');
        state = { kind: 'export', data: await validatePublicDemo(await response.json(), crypto), warning: null };
      } catch {
        state = { kind: 'fixture', data: fixture, warning: 'demo.fallback' };
      }
      if (current === generation) onChange(state);
      return current === generation ? state : null;
    },
  };
}

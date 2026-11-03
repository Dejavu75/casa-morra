import { writableTournaments } from './tournament-eligibility.js';

const es = Object.freeze({
  loading: 'Cargando estado administrativo…',
  saved: 'Partida guardada y estadísticas públicas actualizadas.',
  pending: 'Partida guardada. La publicación pública está pendiente; usá «Reintentar publicación».',
  modalitySaved: 'Modalidad guardada y estadísticas públicas actualizadas.',
  modalityPending: 'Modalidad guardada. La publicación pública está pendiente; usá «Reintentar publicación».',
  published: 'Estadísticas públicas actualizadas.',
  login: 'Acceso administrativo habilitado.',
  logout: 'Sesión cerrada.',
  missingTournament: 'Elegí un torneo.',
  samePlayer: 'Blancas y negras deben ser jugadores distintos.',
  missingMoves: 'Ingresá jugadas o elegí «Solo resultado».',
  count: (games) => `${games} partidas registradas`,
  game: (game, names, event) => `${names.get(game.whiteId)} — ${names.get(game.blackId)} · ${event?.name ?? game.tournamentId} · ${game.result}${game.moves?.length ? ' · con jugadas' : ' · pendiente de jugadas'}`,
});

const $ = (id) => document.getElementById(id);
const status = $('status');
let current = null;
const localDate = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

function message(text, kind = '') {
  status.textContent = text;
  status.className = `status ${kind}`;
}

async function api(path, method = 'GET', value) {
  const response = await fetch(path, { method, credentials: 'same-origin',
    ...(value === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) }) });
  const result = response.status === 204 ? null : await response.json();
  if (!response.ok && response.status !== 202) throw new Error(result?.error ?? `Error HTTP ${response.status}`);
  return result;
}

function fill(select, rows, label, selected) {
  select.replaceChildren();
  for (const row of rows) {
    const option = document.createElement('option');
    option.value = row.id;
    option.textContent = label(row);
    select.append(option);
  }
  if (selected && rows.some((row) => row.id === selected)) select.value = selected;
}

function render() {
  $('login-panel').hidden = true;
  $('workspace').hidden = false;
  $('summary').textContent = es.count(current.games.length);
  const previousEvent = $('tournament').value;
  fill($('tournament'), writableTournaments(current.tournaments), (event) => event.name, previousEvent);
  updateRoster();
  const previousMetadataEvent = $('metadata-tournament').value;
  fill($('metadata-tournament'), current.tournaments, (event) => event.name, previousMetadataEvent);
  updateModality();
  const names = new Map(current.players.map((player) => [player.id, player.name]));
  const selectedPlayer = $('player-edit').value;
  fill($('player-edit'), [{ id: '', name: 'Nuevo jugador' }, ...current.players],
    (player) => player.name, selectedPlayer);
  updatePlayerForm();
  const selectedSeason = $('season-edit').value;
  fill($('season-edit'), [{ id: '', label: 'Nueva temporada' }, ...current.seasons],
    (season) => season.label, selectedSeason);
  updateSeasonForm();
  const selectedTournament = $('tournament-edit').value;
  fill($('tournament-edit'), [{ id: '', name: 'Nuevo torneo' }, ...current.tournaments],
    (event) => event.name, selectedTournament);
  fill($('tournament-season'), current.seasons, (season) => season.label);
  updateTournamentForm();
  const events = new Map(current.tournaments.map((event) => [event.id, event]));
  const previousGame = $('game').value;
  const games = [...current.games].sort((a, b) => Number(Boolean(a.moves)) - Number(Boolean(b.moves)) ||
    b.date.localeCompare(a.date));
  fill($('game'), games, (game) => es.game(game, names, events.get(game.tournamentId)), previousGame);
}

function updateModality() {
  const event = current?.tournaments.find((row) => row.id === $('metadata-tournament').value);
  $('modality').value = event?.modality ?? '';
}

function updatePlayerForm() {
  const player = current?.players.find((row) => row.id === $('player-edit').value);
  $('player-name').value = player?.name ?? '';
  $('player-membership').value = player?.membership ?? 'socio';
}

function updateSeasonForm() {
  const season = current?.seasons.find((row) => row.id === $('season-edit').value);
  $('season-label').value = season?.label ?? '';
  $('season-start').value = season?.start ?? '';
  $('season-end').value = season?.end ?? '';
}

function updateTournamentForm() {
  const event = current?.tournaments.find((row) => row.id === $('tournament-edit').value);
  $('tournament-name').value = event?.name ?? '';
  $('tournament-season').value = event?.seasonId ?? current?.seasons.at(-1)?.id ?? '';
  $('tournament-date').value = event?.date ?? localDate();
  $('tournament-type').value = event?.type ?? 'interno';
  $('tournament-format').value = event?.format ?? 'round-robin';
  $('tournament-modality').value = event?.modality ?? '';
  $('tournament-annual').checked = event?.annualEligible ?? true;
  $('tournament-elo').checked = event?.eloEligible ?? true;
  const existing = new Set(event?.standings.map((row) => row.playerId) ?? []);
  const list = $('participant-list');
  list.replaceChildren();
  for (const player of current?.players ?? []) {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = player.id;
    checkbox.checked = existing.has(player.id);
    checkbox.disabled = existing.has(player.id);
    label.append(checkbox, document.createTextNode(player.name));
    list.append(label);
  }
}

function updateRoster() {
  const event = current?.tournaments.find((row) => row.id === $('tournament').value);
  if (!event) { message(es.missingTournament, 'error'); return; }
  const players = new Map(current.players.map((player) => [player.id, player]));
  const roster = event.standings.map((row) => players.get(row.playerId)).filter(Boolean);
  fill($('white'), roster, (player) => player.name, $('white').value);
  fill($('black'), roster, (player) => player.name, $('black').value);
  if ($('white').value === $('black').value && roster.length > 1) $('black').value = roster[1].id;
  $('round').value = String(event.rounds + 1);
  $('date').value = localDate();
}

async function refresh() {
  current = await api('/api/state');
  render();
}

async function save(path, method, payload, messages = { saved: es.saved, pending: es.pending }) {
  const result = await api(path, method, { expectedSha: current.sha256, ...payload });
  await refresh();
  message(result.published ? messages.saved : messages.pending, result.published ? 'success' : 'warning');
  return result;
}

$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api('/api/login', 'POST', { password: $('password').value });
    $('password').value = '';
    await refresh();
    message(es.login, 'success');
  } catch (error) { message(error.message, 'error'); }
});

$('tournament').addEventListener('change', updateRoster);
$('player-edit').addEventListener('change', updatePlayerForm);
$('player-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = $('player-edit').value;
  try {
    const result = await save(id ? `/api/players/${encodeURIComponent(id)}` : '/api/players',
      id ? 'PUT' : 'POST',
      { name: $('player-name').value, membership: $('player-membership').value },
      { saved: 'Jugador guardado y publicado.', pending: 'Jugador guardado; publicación pendiente.' });
    $('player-edit').value = result.id;
    updatePlayerForm();
  } catch (error) { message(error.message, 'error'); }
});
$('season-edit').addEventListener('change', updateSeasonForm);
$('season-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = $('season-edit').value;
  try {
    const result = await save(id ? `/api/seasons/${encodeURIComponent(id)}` : '/api/seasons',
      id ? 'PUT' : 'POST', { label: $('season-label').value,
        start: $('season-start').value, end: $('season-end').value },
      { saved: 'Temporada guardada y publicada.', pending: 'Temporada guardada; publicación pendiente.' });
    $('season-edit').value = result.id;
    updateSeasonForm();
  } catch (error) { message(error.message, 'error'); }
});
$('tournament-edit').addEventListener('change', updateTournamentForm);
$('tournament-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = $('tournament-edit').value;
  const playerIds = [...$('participant-list').querySelectorAll('input:checked')]
    .map((input) => input.value);
  if (playerIds.length < 2) { message('Elegí al menos dos participantes.', 'error'); return; }
  const payload = { name: $('tournament-name').value, seasonId: $('tournament-season').value,
    date: $('tournament-date').value, type: $('tournament-type').value,
    format: $('tournament-format').value, modality: $('tournament-modality').value,
    annualEligible: $('tournament-annual').checked, eloEligible: $('tournament-elo').checked,
    playerIds };
  try {
    const result = await save(id ? `/api/tournaments/${encodeURIComponent(id)}` : '/api/tournaments',
      id ? 'PUT' : 'POST', payload,
      { saved: 'Torneo guardado y publicado.', pending: 'Torneo guardado; publicación pendiente.' });
    $('tournament-edit').value = result.id;
    updateTournamentForm();
  } catch (error) { message(error.message, 'error'); }
});
$('metadata-tournament').addEventListener('change', updateModality);
$('modality-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const tournamentId = $('metadata-tournament').value;
  try {
    await save(`/api/tournaments/${encodeURIComponent(tournamentId)}/modality`, 'PUT',
      { modality: $('modality').value }, { saved: es.modalitySaved, pending: es.modalityPending });
  } catch (error) { message(error.message, 'error'); }
});
$('create-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if ($('white').value === $('black').value) { message(es.samePlayer, 'error'); return; }
  const format = $('create-format').value;
  const text = $('create-text').value.trim();
  if (format && !text || !format && text) { message(es.missingMoves, 'error'); return; }
  const game = { id: `admin-${crypto.randomUUID()}`, tournamentId: $('tournament').value,
    round: Number($('round').value), date: $('date').value,
    whiteId: $('white').value, blackId: $('black').value,
    result: $('result').value, moves: null, finish: null };
  try {
    await save('/api/games', 'POST', { game, ...(format ? { format, text } : {}) });
    $('create-text').value = '';
    $('create-format').value = '';
    $('game').value = game.id;
  } catch (error) { message(error.message, 'error'); }
});

$('complete-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const gameId = $('game').value;
  try {
    await save(`/api/games/${encodeURIComponent(gameId)}/moves`, 'PUT',
      { format: $('complete-format').value, text: $('complete-text').value.trim() });
    $('complete-text').value = '';
    $('game').value = gameId;
  } catch (error) { message(error.message, 'error'); }
});

$('publish').addEventListener('click', async () => {
  try { await api('/api/publish', 'POST'); message(es.published, 'success'); }
  catch (error) { message(error.message, 'error'); }
});

$('logout').addEventListener('click', async () => {
  try { await api('/api/logout', 'POST');
    current = null; $('workspace').hidden = true; $('login-panel').hidden = false;
    message(es.logout); $('password').focus(); }
  catch (error) { message(error.message, 'error'); }
});

message(es.loading);
refresh().catch(() => { $('login-panel').hidden = false; $('workspace').hidden = true; message(''); });

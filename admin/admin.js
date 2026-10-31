const es = Object.freeze({
  loading: 'Cargando estado administrativo…',
  saved: 'Partida guardada y estadísticas públicas actualizadas.',
  pending: 'Partida guardada. La publicación pública está pendiente; usá «Reintentar publicación».',
  published: 'Estadísticas públicas actualizadas.',
  login: 'Acceso administrativo habilitado.',
  logout: 'Sesión cerrada.',
  missingTournament: 'Elegí un torneo.',
  samePlayer: 'Blancas y negras deben ser jugadores distintos.',
  missingMoves: 'Ingresá jugadas o elegí «Solo resultado».',
  count: (games) => `${games} partidas registradas en la muestra`,
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
  fill($('tournament'), current.tournaments, (event) => event.name, previousEvent);
  updateRoster();
  const names = new Map(current.players.map((player) => [player.id, player.name]));
  const events = new Map(current.tournaments.map((event) => [event.id, event]));
  const previousGame = $('game').value;
  const games = [...current.games].sort((a, b) => Number(Boolean(a.moves)) - Number(Boolean(b.moves)) ||
    b.date.localeCompare(a.date));
  fill($('game'), games, (game) => es.game(game, names, events.get(game.tournamentId)), previousGame);
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

async function save(path, method, payload) {
  const result = await api(path, method, { expectedSha: current.sha256, ...payload });
  await refresh();
  message(result.published ? es.saved : es.pending, result.published ? 'success' : 'warning');
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

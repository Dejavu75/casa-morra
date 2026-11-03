import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { createAdminServer } from '../scripts/admin-server.mjs';
import { initDemoStore, statusDemoStore } from '../scripts/demo-store.mjs';
import { decodeDemoSnapshot } from '../scripts/demo-snapshot.mjs';

test('solo una sesión admin puede crear y completar una partida; exporta sin doble conteo', async (t) => {
  const id = randomUUID();
  const stateDir = join(process.cwd(), '.demo-state', `test-admin-http-${id}`);
  const publicDir = join(process.cwd(), '.demo-public', `test-admin-http-${id}`);
  await mkdir(stateDir, { recursive: true });
  await mkdir(publicDir, { recursive: true });
  t.after(() => Promise.all([rm(stateDir, { recursive: true, force: true }),
    rm(publicDir, { recursive: true, force: true })]));
  const store = join(stateDir, 'store.json');
  const output = join(publicDir, 'snapshot.json');
  const initial = await initDemoStore(store);
  const server = createAdminServer({ password: 'clave-de-prueba', store, output });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const page = await fetch(origin);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /default-src 'none'/);
  assert.match(page.headers.get('content-security-policy'), /img-src 'self'/);
  const html = await page.text();
  assert.match(html, /Cargar partida|Centro de estadísticas/);
  assert.match(html, /id="tournament" aria-describedby="tournament-note"/);
  const logo = await fetch(`${origin}/rook-small.png`);
  assert.equal(logo.status, 200);
  assert.match(logo.headers.get('content-type'), /image\/png/);
  assert.deepEqual([...new Uint8Array(await logo.arrayBuffer()).subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10]);
  const coloredLogo = await fetch(`${origin}/rook-large.png`);
  assert.equal(coloredLogo.status, 200);
  assert.match(coloredLogo.headers.get('content-type'), /image\/png/);
  assert.deepEqual([...new Uint8Array(await coloredLogo.arrayBuffer()).subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10]);
  const eligibilityModule = await fetch(`${origin}/tournament-eligibility.js`);
  assert.equal(eligibilityModule.status, 200);
  assert.match(eligibilityModule.headers.get('content-type'), /text\/javascript/);
  assert.match(await eligibilityModule.text(), /writableTournaments/);
  const post = (path, payload, headers = {}) => fetch(`${origin}${path}`, { method: 'POST',
    headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(payload) });

  assert.equal((await fetch(`${origin}/api/state`)).status, 401);
  assert.equal((await post('/api/games', {})).status, 401);
  assert.equal((await statusDemoStore(store)).snapshot.sha256, initial.snapshot.sha256);
  assert.equal((await post('/api/login', { password: 'incorrecta' })).status, 401);
  const login = await post('/api/login', { password: 'clave-de-prueba' });
  assert.equal(login.status, 200);
  assert.match(login.headers.get('set-cookie'), /HttpOnly.*SameSite=Strict/i);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const state = await fetch(`${origin}/api/state`, { headers: { cookie } });
  assert.equal(state.status, 200);
  const { sha256, tournaments } = await state.json();
  const event = tournaments.find((row) => row.id === 'patio-2025');
  const game = { id: 'admin-http-1', tournamentId: event.id, round: event.rounds + 1,
    date: event.date, whiteId: event.standings[0].playerId,
    blackId: event.standings[1].playerId, result: '1-0', moves: null, finish: null };
  assert.equal((await post('/api/games', { expectedSha: sha256, game }, { cookie })).status, 403);
  const createdResponse = await post('/api/games', { expectedSha: sha256, game },
    { cookie, origin });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  assert.equal(created.published, true);
  const saved = await statusDemoStore(store);
  assert.equal(saved.snapshot.sha256, created.sha256);
  assert.equal(JSON.parse(await readFile(output, 'utf8')).source.sha256, created.sha256);
  const completedResponse = await fetch(`${origin}/api/games/${game.id}/moves`, {
    method: 'PUT', headers: { 'content-type': 'application/json', cookie, origin },
    body: JSON.stringify({ expectedSha: created.sha256, format: 'manual', text: 'e4 e5' }),
  });
  assert.equal(completedResponse.status, 200);
  const completed = await statusDemoStore(store);
  assert.equal(decodeDemoSnapshot(completed.data).games.length,
    decodeDemoSnapshot(saved.data).games.length);
  assert.deepEqual(decodeDemoSnapshot(completed.data).games.find((row) => row.id === game.id).moves,
    ['e2e4', 'e7e5']);
  assert.equal((await post('/api/games', { expectedSha: completed.snapshot.sha256, game },
    { cookie, origin })).status, 409);
  assert.equal((await statusDemoStore(store)).snapshot.sha256, completed.snapshot.sha256);
  const forgedHostStatus = await new Promise((resolve, reject) => {
    const request = httpRequest(`${origin}/api/state`, { headers: { cookie,
      host: 'sitio-ajeno.invalid:8090' } }, (response) => {
      response.resume(); response.on('end', () => resolve(response.statusCode));
    });
    request.on('error', reject); request.end();
  });
  assert.equal(forgedHostStatus, 403);
  assert.equal((await fetch(`${origin}/api/logout`, { method: 'POST', headers: { cookie, origin } })).status, 204);
  assert.equal((await fetch(`${origin}/api/state`, { headers: { cookie } })).status, 401);
});

test('informa alta guardada con exportación pendiente y permite reintentar publicación', async (t) => {
  const id = randomUUID();
  const stateDir = join(process.cwd(), '.demo-state', `test-admin-publish-${id}`);
  const publicDir = join(process.cwd(), '.demo-public', `test-admin-publish-${id}`);
  await mkdir(stateDir, { recursive: true });
  t.after(() => Promise.all([rm(stateDir, { recursive: true, force: true }),
    rm(publicDir, { recursive: true, force: true })]));
  const store = join(stateDir, 'store.json');
  const output = join(publicDir, 'snapshot.json');
  const initial = await initDemoStore(store);
  const server = createAdminServer({ password: 'clave-de-prueba', store, output });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(`${origin}/api/login`, { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'clave-de-prueba' }) });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const data = decodeDemoSnapshot(initial.data);
  const event = data.tournaments.find((row) => row.id === 'patio-2025');
  const game = { id: 'admin-publication-retry', tournamentId: event.id, round: event.rounds + 1,
    date: event.date, whiteId: event.standings[0].playerId, blackId: event.standings[1].playerId,
    result: '1-0', moves: null, finish: null };
  const response = await fetch(`${origin}/api/games`, { method: 'POST',
    headers: { 'content-type': 'application/json', cookie, origin },
    body: JSON.stringify({ expectedSha: initial.snapshot.sha256, game }) });
  assert.equal(response.status, 202);
  const result = await response.json();
  assert.equal(result.saved, true);
  assert.equal(result.published, false);
  assert.equal((await statusDemoStore(store)).snapshot.sha256, result.sha256);
  await mkdir(publicDir);
  const retry = await fetch(`${origin}/api/publish`, { method: 'POST', headers: { cookie, origin } });
  assert.equal(retry.status, 200);
  assert.equal(JSON.parse(await readFile(output, 'utf8')).source.sha256, result.sha256);
});

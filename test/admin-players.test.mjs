import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { once } from 'node:events';
import { createAdminServer } from '../scripts/admin-server.mjs';
import { initDemoStore, statusDemoStore } from '../scripts/demo-store.mjs';
import { decodeDemoSnapshot } from '../scripts/demo-snapshot.mjs';

test('solo el administrador agrega y corrige jugadores sin sobrescribir otros datos', async (t) => {
  const id = randomUUID();
  const stateDir = join(process.cwd(), '.demo-state', `test-players-${id}`);
  const publicDir = join(process.cwd(), '.demo-public', `test-players-${id}`);
  await mkdir(stateDir, { recursive: true });
  await mkdir(publicDir, { recursive: true });
  t.after(() => Promise.all([rm(stateDir, { recursive: true, force: true }),
    rm(publicDir, { recursive: true, force: true })]));
  const store = join(stateDir, 'store.json');
  const output = join(publicDir, 'snapshot.json');
  const initial = await initDemoStore(store);
  const server = createAdminServer({ password: 'prueba', store, output });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const page = await fetch(origin);
  const html = await page.text();
  assert.match(html, /id="player-form"/);
  assert.match(html, /id="player-edit"/);
  assert.match(html, /id="player-membership"/);
  const send = (path, method, body, cookie) => fetch(`${origin}${path}`, {
    method, headers: { origin, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
  const payload = { expectedSha: initial.snapshot.sha256, name: 'María Pérez', membership: 'socia' };
  assert.equal((await send('/api/players', 'POST', payload)).status, 401);
  const login = await send('/api/login', 'POST', { password: 'prueba' });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const beforePublic = await readFile(output).catch(() => null);
  const created = await send('/api/players', 'POST', payload, cookie);
  assert.equal(created.status, 201);
  assert.equal((await created.json()).published, true);
  const afterCreate = await statusDemoStore(store);
  const data = decodeDemoSnapshot(afterCreate.data);
  const player = data.players.find((row) => row.name === 'María Pérez');
  assert.ok(player);
  assert.equal(player.slug, 'maria-perez');
  assert.equal(player.demo, false);
  assert.equal(data.players.length, 7);
  assert.equal(data.games.length, 70);
  assert.notDeepEqual(await readFile(output), beforePublic);

  const publicAfterCreate = await readFile(output);
  const rejected = await send('/api/players', 'POST', payload, cookie);
  assert.equal(rejected.status, 409);
  assert.equal((await statusDemoStore(store)).snapshot.sha256, afterCreate.snapshot.sha256);
  assert.deepEqual(await readFile(output), publicAfterCreate);
  const updated = await send(`/api/players/${player.id}`, 'PUT',
    { expectedSha: afterCreate.snapshot.sha256, name: 'María Pérez García', membership: 'socia' }, cookie);
  assert.equal(updated.status, 200);
  const final = decodeDemoSnapshot((await statusDemoStore(store)).data);
  assert.equal(final.players.find((row) => row.id === player.id).name, 'María Pérez García');
  assert.equal(final.players.find((row) => row.id === player.id).slug, 'maria-perez');
  assert.equal(final.tournaments.length, data.tournaments.length);
  const stale = await send(`/api/players/${player.id}`, 'PUT', payload, cookie);
  assert.equal(stale.status, 409);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { once } from 'node:events';
import { createAdminServer } from '../scripts/admin-server.mjs';
import { initDemoStore, statusDemoStore } from '../scripts/demo-store.mjs';
import { decodeDemoSnapshot } from '../scripts/demo-snapshot.mjs';

test('admin crea temporada y torneo, conserva participantes sin jugar y permite mantenerlos', async (t) => {
  const uid = randomUUID();
  const stateDir = join(process.cwd(), '.demo-state', `test-tournaments-${uid}`);
  const publicDir = join(process.cwd(), '.demo-public', `test-tournaments-${uid}`);
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
  const send = (path, method, body, cookie) => fetch(`${origin}${path}`, { method,
    headers: { origin, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body) });
  const html = await (await fetch(origin)).text();
  assert.match(html, /id="season-form"/);
  assert.match(html, /id="tournament-form"/);
  assert.equal((await send('/api/seasons', 'POST', {}, null)).status, 401);
  const login = await send('/api/login', 'POST', { password: 'prueba' });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const state = await (await fetch(`${origin}/api/state`, { headers: { cookie } })).json();
  assert.equal(state.seasons.length, 3);
  const createdSeason = await send('/api/seasons', 'POST', {
    expectedSha: initial.snapshot.sha256, label: '2027–2028',
    start: '2027-08-01', end: '2028-07-31',
  }, cookie);
  assert.equal(createdSeason.status, 201);
  const season = await createdSeason.json();
  const afterSeason = await statusDemoStore(store);
  const players = decodeDemoSnapshot(afterSeason.data).players.map((row) => row.id);
  const tournamentInput = { name: 'Nuevo torneo', seasonId: season.id,
    date: '2027-09-01', type: 'interno', format: 'round-robin', modality: "20'+3",
    annualEligible: true, eloEligible: true, playerIds: players.slice(0, 3) };
  const createdEvent = await send('/api/tournaments', 'POST',
    { expectedSha: afterSeason.snapshot.sha256, ...tournamentInput }, cookie);
  assert.equal(createdEvent.status, 201);
  const eventId = (await createdEvent.json()).id;
  const afterEvent = await statusDemoStore(store);
  const created = decodeDemoSnapshot(afterEvent.data).tournaments.find((row) => row.id === eventId);
  assert.equal(created.standings.length, 3);
  assert.ok(created.standings.every((row) => row.points === 0 && row.wins === 0 &&
    row.draws === 0 && row.losses === 0));
  const game = { id: 'first-new-event', tournamentId: eventId, round: 1,
    date: created.date, whiteId: players[0], blackId: players[1],
    result: '1-0', moves: null, finish: null };
  assert.equal((await send('/api/games', 'POST', { expectedSha: afterEvent.snapshot.sha256, game }, cookie)).status, 201);
  const afterGame = await statusDemoStore(store);
  const updatedEvent = await send(`/api/tournaments/${eventId}`, 'PUT',
    { expectedSha: afterGame.snapshot.sha256, ...tournamentInput,
      name: 'Nuevo torneo corregido', playerIds: players.slice(0, 4) }, cookie);
  assert.equal(updatedEvent.status, 200);
  const afterUpdate = await statusDemoStore(store);
  const result = decodeDemoSnapshot(afterUpdate.data);
  assert.equal(result.tournaments.find((row) => row.id === eventId).standings.length, 4);
  assert.equal(result.games.find((row) => row.id === game.id).result, '1-0');
  const published = await readFile(output);
  assert.equal((await send(`/api/tournaments/${eventId}`, 'PUT',
    { expectedSha: afterUpdate.snapshot.sha256, ...tournamentInput,
      playerIds: players.slice(1, 4) }, cookie)).status, 400);
  assert.equal((await statusDemoStore(store)).snapshot.sha256, afterUpdate.snapshot.sha256);
  assert.deepEqual(await readFile(output), published);
  const changedSeason = await send(`/api/seasons/${season.id}`, 'PUT',
    { expectedSha: afterUpdate.snapshot.sha256, label: 'Temporada 2027/28',
      start: '2027-08-01', end: '2028-07-31' }, cookie);
  assert.equal(changedSeason.status, 200);
  const final = decodeDemoSnapshot((await statusDemoStore(store)).data);
  assert.equal(final.seasons.find((row) => row.id === season.id).label, 'Temporada 2027/28');
  assert.equal(final.games.find((row) => row.id === game.id).result, '1-0');
});

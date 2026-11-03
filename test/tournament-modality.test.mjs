import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, webcrypto } from 'node:crypto';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { once } from 'node:events';
import * as demo from '../dist/data/demo.js';
import { encodeDemoSnapshot, decodeDemoSnapshot, validateDemoSnapshot } from '../scripts/demo-snapshot.mjs';
import { validatePublicDemo } from '../dist/assets/demo-source.js';
import { renderTournamentList, renderTournamentDetail } from '../dist/views/tournaments.js';
import { createAdminServer } from '../scripts/admin-server.mjs';
import { initDemoStore, statusDemoStore } from '../scripts/demo-store.mjs';

const eventId = 'primavera-2026';
const eventSlug = 'encuentro-de-primavera-2026';

test('modalidad opcional conserva snapshots anteriores y valida texto libre sin admitir otros campos', async () => {
  const original = encodeDemoSnapshot(demo);
  assert.equal(encodeDemoSnapshot(decodeDemoSnapshot(original)), original);
  const data = structuredClone({ ...demo });
  data.tournaments.find((event) => event.id === eventId).modality = "20'+3";
  const encoded = encodeDemoSnapshot(data);
  assert.equal(decodeDemoSnapshot(encoded).tournaments.find((event) => event.id === eventId).modality, "20'+3");
  const publicValue = { format: 'casa-morra.demo-public', version: 1,
    source: { bytes: Buffer.byteLength(encoded), sha256: await cryptoDigest(encoded) },
    snapshot: JSON.parse(encoded) };
  assert.equal((await validatePublicDemo(publicValue, webcrypto)).tournaments.find((event) => event.id === eventId).modality, "20'+3");
  for (const value of [12, null, {}, 'x'.repeat(81)]) {
    const invalid = structuredClone(publicValue);
    invalid.snapshot.data.tournaments.find((event) => event.id === eventId).modality = value;
    assert.equal(validateDemoSnapshot(invalid.snapshot).ok, false);
    await assert.rejects(validatePublicDemo(invalid, webcrypto), /inválida|alterada/);
  }
  const extra = structuredClone(publicValue);
  extra.snapshot.data.tournaments.find((event) => event.id === eventId).unknown = 'x';
  assert.equal(validateDemoSnapshot(extra.snapshot).ok, false);
});

async function cryptoDigest(text) {
  const bytes = new TextEncoder().encode(text);
  return Buffer.from(await webcrypto.subtle.digest('SHA-256', bytes)).toString('hex');
}

test('lista y detalle muestran fecha breve y modalidad escapada sin hueco cuando falta', () => {
  const data = structuredClone({ ...demo });
  const event = data.tournaments.find((row) => row.id === eventId);
  event.modality = "20'+3 <rápido>";
  const list = renderTournamentList(data).html;
  const detail = renderTournamentDetail(data, event.slug).html;
  assert.match(list, /03\/10\/2026 · 5 participantes · 5 rondas · Modalidad: 20&#39;\+3 &lt;rápido&gt;/);
  assert.match(detail, /03\/10\/2026[^<]*Modalidad: 20&#39;\+3 &lt;rápido&gt;/);
  assert.doesNotMatch(list + detail, /<rápido>|3 de octubre de 2026/);
  delete event.modality;
  assert.match(renderTournamentList(data).html, /03\/10\/2026 · 5 participantes · 5 rondas<\/p>/);
  assert.equal(event.slug, eventSlug);
});

test('solo admin actualiza modalidad con CAS sin alterar resultados y permite borrarla', async (t) => {
  const id = randomUUID();
  const stateDir = join(process.cwd(), '.demo-state', `test-modality-${id}`);
  const publicDir = join(process.cwd(), '.demo-public', `test-modality-${id}`);
  await mkdir(stateDir, { recursive: true });
  await mkdir(publicDir, { recursive: true });
  t.after(() => Promise.all([rm(stateDir, { recursive: true, force: true }), rm(publicDir, { recursive: true, force: true })]));
  const store = join(stateDir, 'store.json');
  const output = join(publicDir, 'snapshot.json');
  const initial = await initDemoStore(store);
  const server = createAdminServer({ password: 'clave-de-prueba', store, output });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const url = `${origin}/api/tournaments/${eventId}/modality`;
  const put = (body, headers = {}) => fetch(url, { method: 'PUT',
    headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const payload = { expectedSha: initial.snapshot.sha256, modality: " 20'+3 " };
  assert.equal((await put(payload)).status, 401);
  const login = await fetch(`${origin}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ password: 'clave-de-prueba' }) });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.equal((await put(payload, { cookie })).status, 403);
  assert.equal((await put({ ...payload, modality: 3 }, { cookie, origin })).status, 400);
  assert.equal((await put({ ...payload, extra: true }, { cookie, origin })).status, 400);
  assert.equal((await fetch(`${origin}/api/tournaments/inexistente/modality`, { method: 'PUT',
    headers: { 'content-type': 'application/json', cookie, origin }, body: JSON.stringify(payload) })).status, 404);
  assert.equal((await statusDemoStore(store)).snapshot.sha256, initial.snapshot.sha256);
  assert.equal((await put(payload, { cookie, origin })).status, 200);
  const saved = await statusDemoStore(store);
  const before = decodeDemoSnapshot(initial.data);
  const after = decodeDemoSnapshot(saved.data);
  assert.equal(after.tournaments.find((event) => event.id === eventId).modality, "20'+3");
  assert.deepEqual(after.games, before.games);
  assert.deepEqual(after.byes, before.byes);
  assert.deepEqual(after.tournaments.find((event) => event.id === eventId).standings,
    before.tournaments.find((event) => event.id === eventId).standings);
  assert.equal(saved.audit.at(-1).operation, 'correct');
  assert.equal(JSON.parse(await readFile(output, 'utf8')).source.sha256, saved.snapshot.sha256);
  assert.equal((await put(payload, { cookie, origin })).status, 409);
  assert.equal((await statusDemoStore(store)).snapshot.sha256, saved.snapshot.sha256);
  assert.equal((await put({ expectedSha: saved.snapshot.sha256, modality: "20'+3" }, { cookie, origin })).status, 200);
  assert.equal((await statusDemoStore(store)).audit.length, saved.audit.length);
  assert.equal((await put({ expectedSha: saved.snapshot.sha256, modality: '' }, { cookie, origin })).status, 200);
  const cleared = await statusDemoStore(store);
  assert.equal(Object.hasOwn(decodeDemoSnapshot(cleared.data).tournaments.find((event) => event.id === eventId), 'modality'), false);
  const historical = await fetch(`${origin}/api/tournaments/archivo-2025/modality`, { method: 'PUT',
    headers: { 'content-type': 'application/json', cookie, origin },
    body: JSON.stringify({ expectedSha: cleared.snapshot.sha256, modality: "10'+5" }) });
  assert.equal(historical.status, 200);
  assert.equal(decodeDemoSnapshot((await statusDemoStore(store)).data).tournaments.find((event) => event.id === 'archivo-2025').modality, "10'+5");
});

test('el panel ofrece modalidad de texto para cualquier torneo sin filtrar por tabla', async () => {
  const html = await readFile(new URL('../admin/index.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../admin/admin.js', import.meta.url), 'utf8');
  assert.match(html, /<select id="metadata-tournament"/);
  assert.match(html, /<input id="modality"[^>]*type="text"[^>]*maxlength="80"/);
  assert.match(html, /20'\+3/);
  assert.match(script, /fill\(\$\('metadata-tournament'\), current\.tournaments/);
  assert.match(script, /\/api\/tournaments\/\$\{encodeURIComponent\(tournamentId\)\}\/modality/);
});

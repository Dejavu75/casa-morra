import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import * as demo from '../dist/data/demo.js';
import { createDemoSource, validatePublicDemo } from '../dist/assets/demo-source.js';
import { validateDemoSnapshot } from '../scripts/demo-snapshot.mjs';

const snapshot = { format: 'casa-morra.demo-snapshot', version: 1,
  provenance: 'casa-morra-original-demo', classification: 'public-demo',
  data: Object.fromEntries(['byes', 'editorial', 'games', 'players', 'seasons', 'titles', 'tournaments']
    .map((key) => [key, demo[key]])) };
const raw = JSON.stringify(snapshot);
const exported = () => ({ format: 'casa-morra.demo-public', version: 1,
  source: { bytes: Buffer.byteLength(raw), sha256: createHash('sha256').update(raw).digest('hex') }, snapshot });
const signedMutation = (mutate) => {
  const value = structuredClone(exported());
  mutate(value.snapshot.data);
  const json = JSON.stringify(value.snapshot);
  value.source = { bytes: Buffer.byteLength(json), sha256: createHash('sha256').update(json).digest('hex') };
  return value;
};

test('rechaza rango y calendario inválidos aunque bytes y SHA-256 coincidan', async () => {
  for (const [mutate, code] of [
    [(data) => { data.tournaments[0].standings[0].rank = -1; }, 'STANDING_RANK'],
    [(data) => { data.tournaments[0].date = '2026-02-30'; }, 'INVALID_DATE'],
  ]) {
    const value = signedMutation(mutate);
    assert.ok(validateDemoSnapshot(value.snapshot).errors.some((error) => error.code === code));
    await assert.rejects(validatePublicDemo(value, webcrypto), /inválid|alterad/i);
    const events = [];
    const source = createDemoSource({ fixture: demo, crypto: webcrypto,
      fetch: async () => ({ ok: true, json: async () => value }), onChange: (state) => events.push(state) });
    await source.refresh();
    assert.equal(events.at(-1).kind, 'fixture');
    assert.equal(events.at(-1).warning, 'demo.fallback');
  }
});

test('el sobre público íntegro carga datos antes del primer render', async () => {
  const events = [];
  const source = createDemoSource({ fixture: demo, crypto: webcrypto,
    fetch: async (url, options) => {
      assert.equal(url, '/demo/snapshot.json');
      assert.equal(options.cache, 'no-store');
      return { ok: true, json: async () => exported() };
    }, onChange: (state) => events.push(state) });
  assert.equal(events.length, 0);
  await source.refresh();
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, 'export');
  assert.equal(events[0].data.games.length, demo.games.length);
});

test('la validación rechaza metadatos, hash, bytes, forma y referencias alteradas', async () => {
  const mutations = [
    (v) => { v.format = 'otra'; },
    (v) => { v.source.sha256 = '0'.repeat(64); },
    (v) => { v.source.bytes += 1; },
    (v) => { v.snapshot.classification = 'private'; },
    (v) => { v.snapshot.data.players[0].name = 3; },
    (v) => { v.snapshot.data.games[0].whiteId = 'desconocido'; },
    (v) => { v.audit = []; },
  ];
  for (const mutate of mutations) {
    const value = structuredClone(exported());
    mutate(value);
    await assert.rejects(validatePublicDemo(value, webcrypto), /inválid|alterad/i);
  }
  await assert.rejects(validatePublicDemo(exported(), null), /WebCrypto/i);
});

test('respuesta ausente o corrupta usa fixture con aviso, y actualización posterior reemplaza', async () => {
  let response = { ok: false, status: 404 };
  const events = [];
  const source = createDemoSource({ fixture: demo, crypto: webcrypto,
    fetch: async () => response, onChange: (state) => events.push(state) });
  await source.refresh();
  assert.equal(events.at(-1).kind, 'fixture');
  assert.ok(events.at(-1).warning);
  response = { ok: true, json: async () => ({ ...exported(), source: { ...exported().source, bytes: 1 } }) };
  await source.refresh();
  assert.equal(events.at(-1).kind, 'fixture');
  response = { ok: true, json: async () => exported() };
  await source.refresh();
  assert.equal(events.at(-1).kind, 'export');
  assert.equal(events.at(-1).warning, null);
});

test('respuestas asíncronas viejas nunca sobrescriben la última recarga', async () => {
  let release;
  let calls = 0;
  const events = [];
  const source = createDemoSource({ fixture: demo, crypto: webcrypto,
    fetch: async () => ++calls === 1 ? new Promise((resolve) => { release = resolve; }) :
      { ok: true, json: async () => exported() },
    onChange: (state) => events.push(state) });
  const old = source.refresh();
  await source.refresh();
  release({ ok: false, status: 404 });
  await old;
  assert.deepEqual(events.map((event) => event.kind), ['export']);
});

test('una consulta que nunca termina usa el fixture y una respuesta tardía no lo reemplaza', async () => {
  let release;
  const events = [];
  const source = createDemoSource({ fixture: demo, crypto: webcrypto, timeoutMs: 10,
    fetch: async () => new Promise((resolve) => { release = resolve; }),
    onChange: (state) => events.push(state) });
  const state = await Promise.race([source.refresh(),
    new Promise((resolve) => setTimeout(() => resolve({ kind: 'pending' }), 50))]);
  assert.equal(state.kind, 'fixture');
  assert.equal(events.length, 1);
  assert.ok(events[0].warning);
  release({ ok: true, json: async () => exported() });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(events.map((event) => event.kind), ['fixture']);
});

test('la recarga posterior gana aunque la consulta anterior expire después', async () => {
  let calls = 0;
  const events = [];
  const source = createDemoSource({ fixture: demo, crypto: webcrypto, timeoutMs: 10,
    fetch: async () => ++calls === 1 ? new Promise(() => {}) :
      { ok: true, json: async () => exported() },
    onChange: (state) => events.push(state) });
  const pending = source.refresh();
  await source.refresh();
  assert.equal(await Promise.race([pending,
    new Promise((resolve) => setTimeout(() => resolve('pending'), 50))]), null);
  assert.deepEqual(events.map((event) => event.kind), ['export']);
});

test('la aplicación inicia desde exportación y ofrece recarga explícita accesible', async () => {
  const app = await readFile(new URL('../dist/assets/app.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  assert.match(app, /renderLocation\(\);\s*void source\.refresh\(\)/);
  assert.match(app, /renderRoute\(route, activeData/);
  assert.match(app, /attachGameReplay\([^,]+, activeData/);
  assert.match(html, /data-demo-refresh/);
  assert.match(html, /data-demo-warning[^>]+role="status"/);
});

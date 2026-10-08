import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import * as demo from '../dist/data/demo.js';
import { decodeDemoSnapshot, encodeDemoSnapshot } from '../scripts/demo-snapshot.mjs';
import { applyDemoStore, correctDemoStore, initDemoStore, restoreDemoStore, backupDemoStore,
  rollbackDemoStore } from '../scripts/demo-store.mjs';
import { publishPublicDemo, statusPublicDemo } from '../scripts/demo-public.mjs';

const root = process.cwd();

async function sandbox(t) {
  const id = randomUUID();
  const state = join(root, '.demo-state', id);
  const outputDir = join(root, '.demo-public', id);
  await mkdir(state, { recursive: true });
  await mkdir(outputDir, { recursive: true });
  t.after(async () => { await rm(state, { recursive: true, force: true });
    await rm(outputDir, { recursive: true, force: true }); });
  return { store: join(state, 'store.json'), backup: join(state, 'backup.json'),
    output: join(outputDir, 'snapshot.json'), outputDir };
}

function newNews() {
  const data = decodeDemoSnapshot(encodeDemoSnapshot(demo));
  data.editorial.news.push({ id: 'publicacion-demo', slug: 'publicacion-demo',
    date: '2026-10-08', title: 'Novedad ficticia', excerpt: 'Resumen ficticio',
    body: 'Contenido ficticio' });
  return encodeDemoSnapshot(data);
}

test('publica solo snapshot demo validado y metadatos públicos, sin auditoría', async (t) => {
  const { store, output } = await sandbox(t);
  await initDemoStore(store);
  const before = await readFile(store, 'utf8');
  const published = await publishPublicDemo(store, output);
  const raw = await readFile(output, 'utf8');
  const value = JSON.parse(raw);
  assert.deepEqual(Object.keys(value), ['format', 'version', 'source', 'snapshot']);
  assert.equal(value.format, 'casa-morra.demo-public');
  assert.equal(value.version, 1);
  assert.deepEqual(value.snapshot.data, decodeDemoSnapshot(encodeDemoSnapshot(demo)));
  assert.equal(value.source.sha256, JSON.parse(before).snapshot.sha256);
  assert.equal(value.source.bytes, JSON.parse(before).snapshot.bytes);
  assert.doesNotMatch(raw, /"audit"|"afterSnapshot"|"beforeSnapshot"|"backup"|"lock"/);
  assert.equal(await readFile(store, 'utf8'), before);
  assert.deepEqual(await statusPublicDemo(store, output), { exists: true, fresh: true,
    source: value.source });
  assert.deepEqual(published.source, value.source);
  await publishPublicDemo(store, output);
  assert.equal(await readFile(output, 'utf8'), raw);
  if (process.platform !== 'win32') {
    assert.equal((await stat(output)).mode & 0o777, 0o644);
    await chmod(output, 0o600);
    await publishPublicDemo(store, output);
    assert.equal((await stat(output)).mode & 0o777, 0o644);
    assert.equal(await readFile(output, 'utf8'), raw);
  }
});

test('detecta exportación ausente y obsoleta después de importar, restaurar y revertir', async (t) => {
  const { store, backup, output } = await sandbox(t);
  await initDemoStore(store);
  assert.deepEqual(await statusPublicDemo(store, output), { exists: false, fresh: false,
    source: null });
  assert.equal((await statusPublicDemo(store, join(root, '.demo-public', 'no-existe', 'archivo.json'))).exists, false);
  await backupDemoStore(store, backup);
  await publishPublicDemo(store, output);
  const first = await readFile(output, 'utf8');
  await applyDemoStore(store, newNews());
  assert.equal((await statusPublicDemo(store, output)).fresh, false);
  await publishPublicDemo(store, output);
  assert.equal((await statusPublicDemo(store, output)).fresh, true);
  await restoreDemoStore(store, backup);
  assert.equal((await statusPublicDemo(store, output)).fresh, false);
  await publishPublicDemo(store, output);
  assert.equal(await readFile(output, 'utf8'), first);
  await rollbackDemoStore(store);
  assert.equal((await statusPublicDemo(store, output)).fresh, false);
});

test('detecta corrección obsoleta y la CLI publica sin tocar el almacén', async (t) => {
  const { store, output } = await sandbox(t);
  await initDemoStore(store);
  const command = spawnSync(process.execPath, ['scripts/demo-public.mjs', 'publish',
    '--store', store, '--output', output], { cwd: root, encoding: 'utf8' });
  assert.equal(command.status, 0, command.stderr);
  assert.equal(JSON.parse(command.stdout).operation, 'publish');
  const current = JSON.parse(await readFile(store, 'utf8'));
  const data = decodeDemoSnapshot(current.data);
  data.editorial.news[0].title = 'Título ficticio corregido';
  await correctDemoStore(store, encodeDemoSnapshot(data), current.snapshot.sha256,
    [{ collection: 'editorial.news', id: data.editorial.news[0].id }]);
  assert.equal((await statusPublicDemo(store, output)).fresh, false);
  const check = spawnSync(process.execPath, ['scripts/demo-public.mjs', 'status',
    '--store', store, '--output', output], { cwd: root, encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  assert.equal(JSON.parse(check.stdout).fresh, false);
});

test('rechaza corrupción, ruta cruzada y symlink sin alterar almacén ni exportación previa', async (t) => {
  const { store, output, outputDir } = await sandbox(t);
  await initDemoStore(store);
  await publishPublicDemo(store, output);
  const beforePublic = await readFile(output, 'utf8');
  await assert.rejects(publishPublicDemo(store, join(root, '.demo-state', 'escape.json')),
    /\.demo-public|ruta/i);
  await assert.rejects(publishPublicDemo(store, store), /\.demo-public|ruta/i);
  await assert.rejects(publishPublicDemo(join(root, '.demo-public', 'wrong.json'), output),
    /\.demo-state|ruta/i);
  await applyDemoStore(store, newNews());
  const changedStore = await readFile(store, 'utf8');
  await assert.rejects(publishPublicDemo(store, output,
    { beforeRename: () => { throw new Error('fallo simulado'); } }), /fallo simulado/);
  assert.equal(await readFile(output, 'utf8'), beforePublic);
  await writeFile(output, '{"invalid":true}');
  await assert.rejects(publishPublicDemo(store, output), /exportaci.n|formato|inv.lid/i);
  await writeFile(output, beforePublic);
  const link = join(outputDir, 'link.json');
  await symlink(output, link);
  await assert.rejects(publishPublicDemo(store, link), /enlace|simb.lico/i);
  const corrupted = JSON.parse(changedStore);
  corrupted.source = 'otro';
  await writeFile(store, JSON.stringify(corrupted));
  await assert.rejects(publishPublicDemo(store, output), /almac.n|sobre|inv.lid/i);
  assert.equal(await readFile(output, 'utf8'), beforePublic);
  assert.equal(await readFile(store, 'utf8'), JSON.stringify(corrupted));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDemoStore } from '../scripts/demo-store.mjs';
import { snapshotMetadata } from '../scripts/demo-snapshot.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const compose = spawnSync('docker', ['compose', 'version'], { encoding: 'utf8' });
const skipCompose = compose.error || compose.status !== 0 ? 'Docker Compose no está disponible' : undefined;

function fixture(t) {
  const id = randomUUID();
  const store = join(root, '.demo-state', `docker-prepare-${id}.json`);
  const output = join(root, '.demo-public', `docker-prepare-${id}.json`);
  t.after(async () => {
    for (const file of [store, output]) {
      await unlink(file).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    }
  });
  return { store, output };
}

function prepare({ store, output }) {
  return spawnSync(process.execPath, ['scripts/docker-prepare.mjs', '--store', store,
    '--output', output], { cwd: root, encoding: 'utf8' });
}

test('prepara datos demo nuevos y repetir no modifica almacén ni exportación', async (t) => {
  const paths = fixture(t);
  const first = prepare(paths);
  assert.equal(first.status, 0, first.stderr);
  assert.deepEqual(JSON.parse(first.stdout), { created: true, published: true });
  const before = await Promise.all([readFile(paths.store), readFile(paths.output)]);
  const second = prepare(paths);
  assert.equal(second.status, 0, second.stderr);
  assert.deepEqual(JSON.parse(second.stdout), { created: false, published: false });
  const after = await Promise.all([readFile(paths.store), readFile(paths.output)]);
  assert.deepEqual(after, before);
});

test('publica desde un almacén existente sin reiniciar su auditoría', async (t) => {
  const paths = fixture(t);
  await initDemoStore(paths.store);
  const before = await readFile(paths.store);
  const result = prepare(paths);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { created: false, published: true });
  assert.deepEqual(await readFile(paths.store), before);
});

test('rechaza exportación huérfana sin reemplazarla por el fixture', async (t) => {
  const paths = fixture(t);
  assert.equal(prepare(paths).status, 0);
  await unlink(paths.store);
  const before = await readFile(paths.output);
  const result = prepare(paths);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /exportación existente sin almacén/);
  assert.deepEqual(await readFile(paths.output), before);
});

test('rechaza exportación válida pero distinta sin alterar datos', async (t) => {
  const paths = fixture(t);
  assert.equal(prepare(paths).status, 0);
  const exportValue = JSON.parse(await readFile(paths.output, 'utf8'));
  exportValue.snapshot.data.players[0].name += ' QA';
  exportValue.source = snapshotMetadata(JSON.stringify(exportValue.snapshot));
  await writeFile(paths.output, JSON.stringify(exportValue));
  const before = await Promise.all([readFile(paths.store), readFile(paths.output)]);
  const result = prepare(paths);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /exportación distinta del almacén/);
  const after = await Promise.all([readFile(paths.store), readFile(paths.output)]);
  assert.deepEqual(after, before);
});

test('Compose prepara sin red, puertos ni contraseña administrativa', { skip: skipCompose }, () => {
  const result = spawnSync('docker', ['compose', '-f', 'compose.bootstrap.yaml',
    'config', '--format', 'json'], { cwd: root, encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    assert.fail(result.stderr || result.error?.message || 'Docker Compose no disponible');
  }
  const service = JSON.parse(result.stdout).services.prepare;
  assert.equal(service.network_mode, 'none');
  assert.ok(!service.ports);
  assert.ok(!service.environment?.CASA_MORRA_ADMIN_PASSWORD);
  assert.equal(service.volumes.length, 2);
  assert.ok(service.volumes.every((volume) => volume.bind?.create_host_path === false));
});

test('rechaza opciones desconocidas, repetidas, incompletas y sueltas sin crear datos', async (t) => {
  const cases = [
    (paths) => ['--store', paths.store, '--outpu', paths.output],
    (paths) => ['--store', paths.store, '--output', paths.output, '--output', paths.output],
    (paths) => ['--store', '--output', paths.output],
    (paths) => ['--store', paths.store, '--output', paths.output, 'suelto']
  ];
  for (const makeArgs of cases) {
    const paths = fixture(t);
    const args = makeArgs(paths);
    const result = spawnSync(process.execPath, ['scripts/docker-prepare.mjs', ...args],
      { cwd: root, encoding: 'utf8' });
    assert.notEqual(result.status, 0, args.join(' '));
    assert.match(result.stderr, /Opción desconocida|Opción repetida|Falta valor|Argumento inesperado/);
    for (const path of [paths.store, paths.output]) {
      await assert.rejects(stat(path), { code: 'ENOENT' });
    }
  }
});

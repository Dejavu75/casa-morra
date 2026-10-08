import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, symlinkSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import * as demo from '../dist/data/demo.js';
import { decodeDemoSnapshot, encodeDemoSnapshot, snapshotMetadata } from '../scripts/demo-snapshot.mjs';
import { applyDemoStore, backupDemoStore, initDemoStore, restoreDemoStore,
  rollbackDemoStore, statusDemoStore, correctDemoStore } from '../scripts/demo-store.mjs';

const root = join(process.cwd(), '.demo-state');
const fixture = encodeDemoSnapshot(demo);
const sample = () => {
  const data = decodeDemoSnapshot(fixture);
  data.editorial.news.push({ id: 'noticia-local', slug: 'noticia-local', date: '2026-10-08',
    title: 'Noticia ficticia', excerpt: 'Resumen', body: 'Contenido' });
  return encodeDemoSnapshot(data);
};

const correction = () => {
  const data = decodeDemoSnapshot(fixture);
  const game = data.games[0];
  game.result = '1-0';
  game.moves = null;
  game.finish = 'resultado oficial corregido';
  const event = data.tournaments.find((row) => row.id === game.tournamentId);
  const white = event.standings.find((row) => row.playerId === game.whiteId);
  const black = event.standings.find((row) => row.playerId === game.blackId);
  white.wins += 1; white.draws -= 1; white.points += 0.5;
  black.losses += 1; black.draws -= 1; black.points -= 0.5;
  return { data, allowlist: [
    { collection: 'games', id: game.id },
    { collection: 'tournaments', id: event.id },
  ] };
};

test('corrige resultado y tabla oficial juntos, audita y revierte la última corrección', async (t) => {
  const { store } = await sandbox(t);
  await initDemoStore(store);
  const { data, allowlist } = correction();
  const expected = snapshotMetadata(fixture).sha256;
  const changed = await correctDemoStore(store, encodeDemoSnapshot(data), expected, allowlist);
  assert.equal(changed.audit[1].operation, 'correct');
  assert.deepEqual(changed.audit[1].corrected, allowlist);
  assert.equal(changed.audit[1].before.sha256, expected);
  assert.deepEqual(await statusDemoStore(store), changed);
  const raw = await readFile(store, 'utf8');
  assert.deepEqual(await correctDemoStore(store, encodeDemoSnapshot(data), expected, allowlist), changed);
  assert.equal(await readFile(store, 'utf8'), raw);
  const undone = await rollbackDemoStore(store);
  assert.equal(undone.snapshot.sha256, expected);
  assert.equal(undone.audit[2].reverses, changed.audit[1].id);
  assert.deepEqual(await statusDemoStore(store), undone);
});

test('rechaza partida aislada, CAS obsoleto, diferencia no autorizada y slug ocupado sin escribir', async (t) => {
  const { store } = await sandbox(t);
  await initDemoStore(store);
  const before = await readFile(store, 'utf8');
  const { data, allowlist } = correction();
  const expected = snapshotMetadata(fixture).sha256;
  await assert.rejects(correctDemoStore(store, encodeDemoSnapshot(data), '0'.repeat(64), allowlist), /hash|CAS|obsoleto/i);
  const alone = decodeDemoSnapshot(fixture);
  alone.games[0] = data.games[0];
  await assert.rejects(correctDemoStore(store, encodeDemoSnapshot(alone), expected, [allowlist[0]]), /STANDING|tabla|verificación/i);
  const unlisted = decodeDemoSnapshot(encodeDemoSnapshot(data));
  unlisted.editorial.news[0].title = 'Cambio omitido en lista';
  await assert.rejects(correctDemoStore(store, encodeDemoSnapshot(unlisted), expected, allowlist), /autorizad|lista/i);
  const changedId = decodeDemoSnapshot(fixture);
  changedId.games[0].id = 'id-distinto';
  await assert.rejects(correctDemoStore(store, encodeDemoSnapshot(changedId), expected,
    [{ collection: 'games', id: 'id-distinto' }]), /ID nuevo/i);
  await assert.rejects(correctDemoStore(store, encodeDemoSnapshot(data), expected,
    [...allowlist, allowlist[0]]), /duplicada/i);
  const slug = JSON.parse(fixture);
  slug.data.players[0].slug = slug.data.players[1].slug;
  await assert.rejects(correctDemoStore(store, JSON.stringify(slug), expected,
    [{ collection: 'players', id: slug.data.players[0].id }]), /DUPLICATE_KEY|slug/i);
  assert.equal(await readFile(store, 'utf8'), before);
});

test('corrige conservando omitidos y orden, rechaza auditoría alterada y fallo previo al rename', async (t) => {
  const { store } = await sandbox(t);
  await initDemoStore(store);
  const expected = snapshotMetadata(fixture).sha256;
  const incoming = decodeDemoSnapshot(fixture);
  incoming.editorial.news[0].title = 'Título corregido de demostración';
  const allowed = [{ collection: 'editorial.news', id: incoming.editorial.news[0].id }];
  incoming.editorial.news.splice(1);
  const before = await readFile(store, 'utf8');
  await assert.rejects(correctDemoStore(store, encodeDemoSnapshot(incoming), expected, allowed,
    { beforeRename: () => { throw new Error('fallo simulado'); } }), /fallo simulado/);
  assert.equal(await readFile(store, 'utf8'), before);
  const changed = await correctDemoStore(store, encodeDemoSnapshot(incoming), expected, allowed);
  const output = decodeDemoSnapshot(changed.data);
  assert.equal(output.editorial.news.length, demo.editorial.news.length);
  assert.deepEqual(output.editorial.news.map((row) => row.id), demo.editorial.news.map((row) => row.id));
  const tampered = JSON.parse(await readFile(store, 'utf8'));
  tampered.audit[1].corrected[0].id = 'no-corregido';
  await writeFile(store, JSON.stringify(tampered));
  await assert.rejects(statusDemoStore(store), /auditoría|corrección/i);
});

test('CLI exige snapshot, hash y lista; una corrección no imprime los registros', async (t) => {
  const { dir, store } = await sandbox(t);
  const input = join(dir, 'correccion.json');
  const list = join(dir, 'lista.json');
  const run = (...args) => spawnSync(process.execPath, ['scripts/demo-store.mjs', ...args],
    { cwd: process.cwd(), encoding: 'utf8' });
  const { data, allowlist } = correction();
  assert.equal(run('init', '--store', store).status, 0);
  await writeFile(input, encodeDemoSnapshot(data));
  await writeFile(list, JSON.stringify(allowlist));
  const expected = snapshotMetadata(fixture).sha256;
  assert.notEqual(run('correct', '--store', store, '--input', input, '--allowlist', list).status, 0);
  const args = ['correct', '--store', store, '--input', input, '--expected-sha', expected,
    '--allowlist', list];
  const first = run(...args);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(JSON.parse(first.stdout).auditEvents, 2);
  assert.equal(first.stdout.includes('resultado oficial'), false);
  assert.equal(JSON.parse(run(...args).stdout).auditEvents, 2);
});

async function sandbox(t) {
  const dir = join(root, `test-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  t.after(() => rm(dir, { recursive: true, force: true }));
  return { dir, store: join(dir, 'store.json') };
}

test('inicia desde fixture explícito y reabre el estado validado', async (t) => {
  const { store } = await sandbox(t);
  await assert.rejects(statusDemoStore(store), /no existe/i);
  const first = await initDemoStore(store);
  assert.equal(first.snapshot.sha256, snapshotMetadata(fixture).sha256);
  assert.equal(first.audit.length, 1);
  assert.equal(first.audit[0].operation, 'init');
  assert.equal(first.audit[0].source, 'local-demo');
  assert.deepEqual(await statusDemoStore(store), first);
  await assert.rejects(initDemoStore(store), /existe/i);
});

test('aplica altas, reabre, repite sin evento y revierte solo el último cambio', async (t) => {
  const { store } = await sandbox(t);
  await initDemoStore(store);
  const applied = await applyDemoStore(store, sample());
  assert.equal(applied.audit.length, 2);
  assert.deepEqual(applied.audit[1].added, [{ collection: 'editorial.news', id: 'noticia-local' }]);
  assert.deepEqual(applied.audit[1].affectedViews, ['home', 'news', 'news-detail']);
  assert.equal(applied.audit[1].before.sha256, snapshotMetadata(fixture).sha256);
  assert.equal(applied.audit[1].after.sha256, snapshotMetadata(sample()).sha256);
  assert.deepEqual(await statusDemoStore(store), applied);
  const same = await applyDemoStore(store, sample());
  assert.deepEqual(same, applied);
  assert.deepEqual(await statusDemoStore(store), applied);
  const reverted = await rollbackDemoStore(store);
  assert.equal(reverted.audit.length, 3);
  assert.equal(reverted.audit[2].operation, 'rollback');
  assert.equal(reverted.audit[2].reverses, applied.audit[1].id);
  assert.equal(reverted.snapshot.sha256, snapshotMetadata(fixture).sha256);
  assert.deepEqual(await statusDemoStore(store), reverted);
  await assert.rejects(rollbackDemoStore(store), /última operación/i);
});

test('rechaza conflictos y preserva exactamente los bytes previos', async (t) => {
  const { store } = await sandbox(t);
  await initDemoStore(store);
  const before = await readFile(store, 'utf8');
  const changed = decodeDemoSnapshot(fixture);
  changed.players[0].name = 'Cambio ficticio';
  await assert.rejects(applyDemoStore(store, encodeDemoSnapshot(changed)), /conflictos/i);
  assert.equal(await readFile(store, 'utf8'), before);
});

test('no persiste una partida adicional incompatible con la tabla oficial', async (t) => {
  const { store } = await sandbox(t);
  await initDemoStore(store);
  const before = await readFile(store, 'utf8');
  const inconsistent = decodeDemoSnapshot(fixture);
  inconsistent.games.push({ ...inconsistent.games[0], id: 'partida-demo-extra' });
  await assert.rejects(applyDemoStore(store, encodeDemoSnapshot(inconsistent)),
    /STANDING_POINTS|STANDING_WDL/);
  assert.equal(await readFile(store, 'utf8'), before);
  assert.equal((await statusDemoStore(store)).audit.length, 1);
});

test('falla cerrado ante sobre alterado, lock o deriva del snapshot', async (t) => {
  const { dir, store } = await sandbox(t);
  await initDemoStore(store);
  const baseline = await readFile(store, 'utf8');
  await writeFile(`${store}.lock`, 'ocupado');
  await assert.rejects(applyDemoStore(store, sample()), /bloquead|lock/i);
  assert.equal(await readFile(store, 'utf8'), baseline);
  await rm(`${store}.lock`);
  const tampered = JSON.parse(baseline);
  tampered.snapshot.sha256 = '0'.repeat(64);
  await writeFile(store, JSON.stringify(tampered));
  await assert.rejects(statusDemoStore(store), /integridad|hash|snapshot/i);
  await assert.rejects(applyDemoStore(store, sample()), /integridad|hash|snapshot/i);
  assert.equal((await readFile(store, 'utf8')).includes('0'.repeat(64)), true);
  await writeFile(store, baseline);
  const drifted = JSON.parse(baseline);
  drifted.data = sample();
  await writeFile(store, JSON.stringify(drifted));
  await assert.rejects(statusDemoStore(store), /integridad|hash|snapshot/i);
  assert.ok(existsSync(dir));
});

test('rechaza auditoría de altas falsificada aunque sus snapshots sean válidos', async (t) => {
  const { store } = await sandbox(t);
  await initDemoStore(store);
  await applyDemoStore(store, sample());
  const value = JSON.parse(await readFile(store, 'utf8'));
  value.audit[1].added[0].id = 'otra-noticia';
  await writeFile(store, JSON.stringify(value));
  await assert.rejects(statusDemoStore(store), /auditoría/i);
  await assert.rejects(rollbackDemoStore(store), /auditoría/i);
});

test('rechaza rutas externas y enlaces simbólicos de almacén', async (t) => {
  const { dir, store } = await sandbox(t);
  await assert.rejects(initDemoStore(join(process.cwd(), 'outside.json')), /demo-state|ruta/i);
  await initDemoStore(store);
  const link = join(dir, 'link.json');
  try { symlinkSync(store, link, 'file'); }
  catch (error) { if (error.code === 'EPERM') { t.skip('Windows no permite symlinks'); return; } throw error; }
  await assert.rejects(statusDemoStore(link), /enlace|simbólico/i);
  await assert.rejects(applyDemoStore(link, sample()), /enlace|simbólico/i);
});

test('un fallo antes de la sustitución atómica conserva estado y libera lock', async (t) => {
  const { store } = await sandbox(t);
  await initDemoStore(store);
  const before = await readFile(store, 'utf8');
  await assert.rejects(applyDemoStore(store, sample(), { beforeRename: () => { throw new Error('fallo simulado'); } }), /fallo simulado/);
  assert.equal(await readFile(store, 'utf8'), before);
  assert.equal(existsSync(`${store}.lock`), false);
  assert.equal((await applyDemoStore(store, sample())).audit.length, 2);
});

test('detecta cambio concurrente aun cuando el sobre externo es válido', async (t) => {
  const { store } = await sandbox(t);
  await initDemoStore(store);
  const external = await readFile(store, 'utf8');
  await assert.rejects(applyDemoStore(store, sample(), {
    beforeRename: () => writeFile(store, `${external}\n`),
  }), /deriva/i);
  assert.equal(await readFile(store, 'utf8'), `${external}\n`);
  assert.equal(existsSync(`${store}.lock`), false);
});

test('CLI exige comando y ruta; init/status operan sin publicar datos', async (t) => {
  const { store } = await sandbox(t);
  const run = (...args) => spawnSync(process.execPath, ['scripts/demo-store.mjs', ...args],
    { cwd: process.cwd(), encoding: 'utf8' });
  assert.notEqual(run('init').status, 0);
  assert.equal(run('init', '--store', store).status, 0);
  const result = run('status', '--store', store);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).sha256, snapshotMetadata(fixture).sha256);
  const input = join(store, '..', 'incoming.json');
  await writeFile(input, sample());
  assert.equal(run('apply', '--store', store, '--input', input).status, 0);
  assert.equal(JSON.parse(run('status', '--store', store).stdout).auditEvents, 2);
  assert.equal(run('rollback', '--store', store).status, 0);
  assert.equal(JSON.parse(run('status', '--store', store).stdout).auditEvents, 3);
});

test('respalda con destino exclusivo, restaura un ancestro y revierte la restauración', async (t) => {
  const { dir, store } = await sandbox(t);
  const backup = join(dir, 'backup.json');
  const initial = await initDemoStore(store);
  const saved = await backupDemoStore(store, backup);
  assert.equal(saved.snapshot.sha256, initial.snapshot.sha256);
  assert.equal((await readFile(backup, 'utf8')).includes('casa-morra.demo-backup'), true);
  await assert.rejects(backupDemoStore(store, backup), /existe|destino/i);
  const applied = await applyDemoStore(store, sample());
  const restored = await restoreDemoStore(store, backup);
  assert.equal(restored.audit.length, 3);
  assert.equal(restored.audit[2].operation, 'restore');
  assert.equal(restored.audit[2].restores, initial.audit[0].id);
  assert.equal(restored.snapshot.sha256, initial.snapshot.sha256);
  assert.equal((await statusDemoStore(store)).audit.length, 3);
  const reversed = await rollbackDemoStore(store);
  assert.equal(reversed.audit[3].operation, 'rollback');
  assert.equal(reversed.audit[3].reverses, restored.audit[2].id);
  assert.equal(reversed.snapshot.sha256, applied.snapshot.sha256);
  assert.equal((await readFile(backup, 'utf8')).includes(restored.audit[2].id), false);
  const repeated = await restoreDemoStore(store, backup);
  assert.equal(repeated.audit.length, 5);
  assert.deepEqual(await restoreDemoStore(store, backup), repeated);
});

test('restauración falla cerrada ante respaldo alterado o linaje ajeno', async (t) => {
  const { dir, store } = await sandbox(t);
  const backup = join(dir, 'backup.json');
  await initDemoStore(store);
  await backupDemoStore(store, backup);
  await applyDemoStore(store, sample());
  const before = await readFile(store, 'utf8');
  const valid = await readFile(backup, 'utf8');
  const tampered = JSON.parse(valid);
  tampered.storeMeta.sha256 = '0'.repeat(64);
  await writeFile(backup, JSON.stringify(tampered));
  await assert.rejects(restoreDemoStore(store, backup), /integridad|hash/i);
  assert.equal(await readFile(store, 'utf8'), before);
  await writeFile(backup, valid);
  const other = join(dir, 'other.json');
  const foreign = join(dir, 'foreign.json');
  await initDemoStore(other);
  await backupDemoStore(other, foreign);
  await assert.rejects(restoreDemoStore(store, foreign), /linaje|ancestro/i);
  assert.equal(await readFile(store, 'utf8'), before);
});

test('rechaza rama divergente aunque comparta el evento inicial', async (t) => {
  const { dir, store } = await sandbox(t);
  const other = join(dir, 'other.json');
  const backup = join(dir, 'backup.json');
  await initDemoStore(store);
  await writeFile(other, await readFile(store, 'utf8'));
  await applyDemoStore(store, sample());
  const alternate = decodeDemoSnapshot(fixture);
  alternate.editorial.news.push({ id: 'otra-local', slug: 'otra-local', date: '2026-10-08',
    title: 'Otra noticia ficticia', excerpt: 'Resumen', body: 'Contenido' });
  await applyDemoStore(other, encodeDemoSnapshot(alternate));
  await backupDemoStore(other, backup);
  const before = await readFile(store, 'utf8');
  await assert.rejects(restoreDemoStore(store, backup), /linaje|ancestro/i);
  assert.equal(await readFile(store, 'utf8'), before);
});

test('CLI ejecuta backup y restore sin imprimir los datos', async (t) => {
  const { dir, store } = await sandbox(t);
  const backup = join(dir, 'backup.json');
  const input = join(dir, 'incoming.json');
  const run = (...args) => spawnSync(process.execPath, ['scripts/demo-store.mjs', ...args],
    { cwd: process.cwd(), encoding: 'utf8' });
  assert.equal(run('init', '--store', store).status, 0);
  assert.equal(run('backup', '--store', store, '--backup', backup).status, 0);
  assert.notEqual(run('backup', '--store', store, '--backup', backup).status, 0);
  await writeFile(input, sample());
  assert.equal(run('apply', '--store', store, '--input', input).status, 0);
  const restored = run('restore', '--store', store, '--backup', backup);
  assert.equal(restored.status, 0, restored.stderr);
  assert.equal(JSON.parse(restored.stdout).auditEvents, 3);
  assert.equal(restored.stdout.includes('Noticia ficticia'), false);
  assert.equal(run('rollback', '--store', store).status, 0);
});

test('respaldo/restauración rechazan rutas inseguras, lock y fallos de escritura', async (t) => {
  const { dir, store } = await sandbox(t);
  const backup = join(dir, 'backup.json');
  await initDemoStore(store);
  await assert.rejects(backupDemoStore(store, store), /misma ruta|origen/i);
  await assert.rejects(backupDemoStore(store, join(process.cwd(), 'fuera.json')), /demo-state|ruta/i);
  await writeFile(`${store}.lock`, 'ocupado');
  await assert.rejects(backupDemoStore(store, backup), /bloquead|lock/i);
  await assert.rejects(restoreDemoStore(store, backup), /bloquead|lock/i);
  await rm(`${store}.lock`);
  await assert.rejects(backupDemoStore(store, backup, { beforeWrite: () => { throw new Error('fallo simulado'); } }), /fallo simulado/);
  assert.equal(existsSync(backup), false);
  await backupDemoStore(store, backup);
  const link = join(dir, 'backup-link.json');
  try { symlinkSync(backup, link, 'file'); }
  catch (error) { if (error.code === 'EPERM') { t.skip('Windows no permite symlinks'); return; } throw error; }
  await assert.rejects(restoreDemoStore(store, link), /enlace|simbólico/i);
  await assert.rejects(backupDemoStore(store, link), /enlace|simbólico/i);
});

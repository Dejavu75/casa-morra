import { randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as demo from '../dist/data/demo.js';
import { decodeDemoSnapshot, encodeDemoSnapshot, snapshotMetadata } from './demo-snapshot.mjs';
import { prepareDemoSnapshotImport } from './import-apply.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stateRoot = join(projectRoot, '.demo-state');
const FORMAT = 'casa-morra.demo-store';
const VERSION = 1;
const SOURCE = 'local-demo';
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const sameMeta = (a, b) => object(a) && a.sha256 === b.sha256 && a.bytes === b.bytes;
const validMeta = (value) => object(value) && Number.isSafeInteger(value.bytes) && value.bytes > 0 &&
  typeof value.sha256 === 'string' && /^[a-f0-9]{64}$/.test(value.sha256);

async function statOrNull(path) {
  try { return await lstat(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function checkedPath(path, { createRoot = false } = {}) {
  if (typeof path !== 'string' || !path.trim()) throw new Error('Ruta de almacén obligatoria');
  const target = resolve(path);
  const beneath = relative(stateRoot, target);
  if (!beneath || beneath === '..' || beneath.startsWith(`..${sep}`) || isAbsolute(beneath))
    throw new Error('La ruta del almacén debe estar dentro de .demo-state/');
  if (createRoot && !(await statOrNull(stateRoot))) await mkdir(stateRoot);
  let cursor = stateRoot;
  for (const segment of ['', ...beneath.split(sep)]) {
    if (segment) cursor = join(cursor, segment);
    const stat = await statOrNull(cursor);
    if (stat?.isSymbolicLink()) throw new Error('Enlace simbólico rechazado en ruta del almacén');
    if (cursor !== target && (!stat || !stat.isDirectory()))
      throw new Error('Directorio del almacén inexistente o inválido');
    if (cursor === target && stat && !stat.isFile())
      throw new Error('Almacén existente no es archivo regular');
  }
  return target;
}

function validateEnvelope(value) {
  if (!object(value) || value.format !== FORMAT || value.version !== VERSION ||
      value.source !== SOURCE || typeof value.data !== 'string' ||
      !object(value.snapshot) || !Array.isArray(value.audit) || !value.audit.length ||
      Object.keys(value).sort().join(',') !== 'audit,data,format,snapshot,source,version')
    throw new Error('Sobre de almacén inválido');
  const current = snapshotMetadata(value.data);
  if (!sameMeta(current, value.snapshot)) throw new Error('Integridad del snapshot alterada');
  const ids = new Set();
  let previous = null;
  for (const [index, event] of value.audit.entries()) {
    if (!object(event) || typeof event.id !== 'string' || !event.id || ids.has(event.id) ||
        event.source !== SOURCE || !['init', 'apply', 'rollback'].includes(event.operation) ||
        !validMeta(event.after) || typeof event.afterSnapshot !== 'string' ||
        !sameMeta(snapshotMetadata(event.afterSnapshot), event.after))
      throw new Error('Auditoría del almacén inválida');
    ids.add(event.id);
    if (index === 0) {
      if (event.operation !== 'init' || event.before !== null)
        throw new Error('Auditoría inicial inválida');
    } else {
      if (!sameMeta(event.before, previous.after)) throw new Error('Cadena de auditoría alterada');
      if (event.operation === 'apply') {
        if (typeof event.beforeSnapshot !== 'string' ||
            !sameMeta(snapshotMetadata(event.beforeSnapshot), event.before) ||
            event.beforeSnapshot !== previous.afterSnapshot ||
            !Array.isArray(event.added) || !event.added.length || !Array.isArray(event.affectedViews))
          throw new Error('Auditoría de importación inválida');
        const prepared = prepareDemoSnapshotImport(event.afterSnapshot,
          decodeDemoSnapshot(event.beforeSnapshot));
        if (prepared.afterSnapshot !== event.afterSnapshot ||
            JSON.stringify(prepared.journal.added) !== JSON.stringify(event.added) ||
            JSON.stringify(prepared.journal.affectedViews) !== JSON.stringify(event.affectedViews))
          throw new Error('Auditoría de importación no coincide con las altas');
      } else if (event.operation === 'rollback') {
        if (previous.operation !== 'apply' || event.reverses !== previous.id ||
            !sameMeta(event.after, previous.before) ||
            event.afterSnapshot !== previous.beforeSnapshot)
          throw new Error('Reversión de auditoría inválida');
      } else throw new Error('Inicialización repetida en auditoría');
    }
    previous = event;
  }
  if (!sameMeta(previous.after, current) || previous.afterSnapshot !== value.data)
    throw new Error('Auditoría no coincide con el snapshot actual');
  return value;
}

async function readStore(target) {
  let raw;
  try { raw = await readFile(target, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') throw new Error('El almacén no existe'); throw error; }
  let value;
  try { value = JSON.parse(raw); }
  catch { throw new Error('Sobre de almacén inválido: JSON'); }
  return { raw, value: validateEnvelope(value) };
}

async function lockStore(target, action) {
  const lockPath = `${target}.lock`;
  let lock;
  try { lock = await open(lockPath, 'wx', 0o600); }
  catch (error) { if (error.code === 'EEXIST') throw new Error('Almacén bloqueado: lock existente'); throw error; }
  try {
    await lock.writeFile(`${process.pid}\n`);
    await lock.sync();
    return await action();
  } finally {
    await lock.close();
    await unlink(lockPath);
  }
}

async function writeAtomic(target, envelope, expectedRaw, hooks = {}) {
  const temp = `${target}.${randomUUID()}.tmp`;
  let handle;
  try {
    handle = await open(temp, 'wx', 0o600);
    await handle.writeFile(JSON.stringify(envelope));
    await handle.sync();
    await handle.close();
    handle = null;
    await hooks.beforeRename?.();
    const current = await statOrNull(target);
    if (current?.isSymbolicLink()) throw new Error('Enlace simbólico rechazado en almacén');
    if (expectedRaw === null) {
      if (current) throw new Error('El almacén ya existe');
    } else if (!current || (await readFile(target, 'utf8')) !== expectedRaw) {
      throw new Error('Deriva detectada: el almacén cambió antes de guardar');
    }
    await rename(temp, target);
    // En plataformas que no permiten abrir directorios (Windows), el fsync del directorio no está disponible.
    try { const directory = await open(dirname(target), 'r'); try { await directory.sync(); } finally { await directory.close(); } }
    catch { /* La sustitución ya ocurrió; una falla de fsync de directorio no puede deshacerse aquí. */ }
  } catch (error) {
    if (handle) await handle.close();
    await unlink(temp).catch((cleanup) => { if (cleanup.code !== 'ENOENT') throw cleanup; });
    throw error;
  }
}

/** Inicia un almacén local explícito a partir del fixture comprometido. */
export async function initDemoStore(path, hooks) {
  const target = await checkedPath(path, { createRoot: true });
  return lockStore(target, async () => {
    const data = encodeDemoSnapshot(demo);
    const snapshot = snapshotMetadata(data);
    const value = { format: FORMAT, version: VERSION, source: SOURCE, data, snapshot,
      audit: [{ id: randomUUID(), operation: 'init', source: SOURCE, before: null,
        after: snapshot, afterSnapshot: data }] };
    await writeAtomic(target, value, null, hooks);
    return value;
  });
}

export async function statusDemoStore(path) {
  const target = await checkedPath(path);
  return (await readStore(target)).value;
}

/** Solo altas sin conflictos; una importación idéntica no escribe ni agrega evento. */
export async function applyDemoStore(path, incoming, hooks) {
  const target = await checkedPath(path);
  return lockStore(target, async () => {
    const { raw, value } = await readStore(target);
    const prepared = prepareDemoSnapshotImport(incoming, decodeDemoSnapshot(value.data));
    if (!prepared.journal.added.length) return value;
    const next = { ...value, data: prepared.afterSnapshot, snapshot: prepared.journal.after,
      audit: [...value.audit, { id: randomUUID(), operation: 'apply', source: SOURCE,
        beforeSnapshot: prepared.beforeSnapshot, before: prepared.journal.before,
        after: prepared.journal.after, afterSnapshot: prepared.afterSnapshot, added: prepared.journal.added,
        affectedViews: prepared.journal.affectedViews }] };
    await writeAtomic(target, next, raw, hooks);
    return next;
  });
}

/** Revierte solo la última aplicación, sin borrar el historial. */
export async function rollbackDemoStore(path, hooks) {
  const target = await checkedPath(path);
  return lockStore(target, async () => {
    const { raw, value } = await readStore(target);
    const last = value.audit.at(-1);
    if (last.operation !== 'apply') throw new Error('La última operación no admite reversión');
    if (!sameMeta(value.snapshot, last.after)) throw new Error('Deriva detectada antes de revertir');
    const data = last.beforeSnapshot;
    const snapshot = snapshotMetadata(data);
    if (!sameMeta(snapshot, last.before)) throw new Error('Integridad del estado anterior alterada');
    const next = { ...value, data, snapshot, audit: [...value.audit,
      { id: randomUUID(), operation: 'rollback', source: SOURCE,
        reverses: last.id, before: value.snapshot, after: snapshot, afterSnapshot: data }] };
    await writeAtomic(target, next, raw, hooks);
    return next;
  });
}

function option(args, flag) {
  const index = args.indexOf(flag);
  if (index < 0 || !args[index + 1]) throw new Error(`Falta ${flag}`);
  return args[index + 1];
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [, , operation, ...args] = process.argv;
  try {
    const store = option(args, '--store');
    let state;
    if (operation === 'init') state = await initDemoStore(store);
    else if (operation === 'status') state = await statusDemoStore(store);
    else if (operation === 'apply') state = await applyDemoStore(store, await readFile(option(args, '--input'), 'utf8'));
    else if (operation === 'rollback') state = await rollbackDemoStore(store);
    else throw new Error('Uso: init|status|apply|rollback --store .demo-state/archivo.json [--input snapshot.json]');
    console.log(JSON.stringify({ operation, sha256: state.snapshot.sha256,
      bytes: state.snapshot.bytes, auditEvents: state.audit.length }));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

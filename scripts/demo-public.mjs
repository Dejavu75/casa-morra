import { randomUUID } from 'node:crypto';
import { chmod, lstat, mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { snapshotMetadata } from './demo-snapshot.mjs';
import { statusDemoStore } from './demo-store.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.demo-public');
const FORMAT = 'casa-morra.demo-public';
const VERSION = 1;
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) &&
  Object.keys(value).sort().join(',') === keys.slice().sort().join(',');

async function statOrNull(path) {
  try { return await lstat(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function checkedOutput(path, createRoot = false) {
  if (typeof path !== 'string' || !path.trim()) throw new Error('Ruta de exportación obligatoria');
  const target = resolve(path);
  const beneath = relative(root, target);
  if (!beneath || beneath === '..' || beneath.startsWith(`..${sep}`) || isAbsolute(beneath))
    throw new Error('La ruta de exportación debe estar dentro de .demo-public/');
  if (createRoot && !(await statOrNull(root))) await mkdir(root);
  let cursor = root;
  for (const segment of ['', ...beneath.split(sep)]) {
    if (segment) cursor = join(cursor, segment);
    const stat = await statOrNull(cursor);
    if (stat?.isSymbolicLink()) throw new Error('Enlace simbólico rechazado en exportación');
    if (cursor !== target && !stat && !createRoot) return target;
    if (cursor !== target && (!stat || !stat.isDirectory()))
      throw new Error('Directorio de exportación inexistente o inválido');
    if (cursor === target && stat && !stat.isFile())
      throw new Error('Exportación existente no es archivo regular');
  }
  return target;
}

function validateExport(raw) {
  let value;
  try { value = JSON.parse(raw); }
  catch { throw new Error('Exportación inválida: JSON'); }
  if (!exact(value, ['format', 'version', 'source', 'snapshot']) ||
      value.format !== FORMAT || value.version !== VERSION ||
      !exact(value.source, ['bytes', 'sha256']) ||
      !Number.isSafeInteger(value.source.bytes) || value.source.bytes <= 0 ||
      typeof value.source.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.source.sha256) ||
      !object(value.snapshot)) throw new Error('Exportación inválida: formato');
  let meta;
  try { meta = snapshotMetadata(JSON.stringify(value.snapshot)); }
  catch { throw new Error('Exportación inválida: snapshot'); }
  if (meta.sha256 !== value.source.sha256 || meta.bytes !== value.source.bytes)
    throw new Error('Exportación inválida: origen alterado');
  return value;
}

async function currentExport(target) {
  let raw;
  try { raw = await readFile(target, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  return { raw, value: validateExport(raw) };
}

/** Estado explícito de un archivo público; no publica ni modifica el almacén. */
export async function statusPublicDemo(store, output) {
  const target = await checkedOutput(output);
  const state = await statusDemoStore(store);
  const current = await currentExport(target);
  return current ? { exists: true, fresh: current.value.source.sha256 === state.snapshot.sha256 &&
    current.value.source.bytes === state.snapshot.bytes, source: current.value.source } :
    { exists: false, fresh: false, source: null };
}

/** Publicación manual de un único JSON ficticio, sin sobre privado ni auditoría. */
export async function publishPublicDemo(store, output, hooks = {}) {
  const state = await statusDemoStore(store);
  const target = await checkedOutput(output, true);
  const snapshot = JSON.parse(state.data);
  const source = snapshotMetadata(state.data);
  const value = { format: FORMAT, version: VERSION, source, snapshot };
  const raw = JSON.stringify(value);
  validateExport(raw);
  const previous = await currentExport(target);
  if (previous?.raw === raw) {
    await chmod(target, 0o644);
    return value;
  }

  const temp = `${target}.${randomUUID()}.tmp`;
  let handle;
  try {
    handle = await open(temp, 'wx', 0o600);
    await handle.writeFile(raw);
    await handle.chmod(0o644);
    await handle.sync();
    await handle.close();
    handle = null;
    await hooks.beforeRename?.();
    const latest = await statusDemoStore(store);
    if (latest.snapshot.sha256 !== source.sha256 || latest.snapshot.bytes !== source.bytes)
      throw new Error('El almacén cambió antes de publicar');
    await checkedOutput(target);
    const current = await currentExport(target);
    if (current?.raw !== (previous?.raw ?? undefined))
      throw new Error('La exportación cambió antes de sustituirla');
    await rename(temp, target);
    if ((await readFile(target, 'utf8')) !== raw) throw new Error('Lectura de exportación no coincide');
    return value;
  } catch (error) {
    if (handle) await handle.close();
    await unlink(temp).catch((cleanup) => { if (cleanup.code !== 'ENOENT') throw cleanup; });
    throw error;
  }
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
    const output = option(args, '--output');
    let result;
    if (operation === 'publish') {
      const published = await publishPublicDemo(store, output);
      result = { operation, source: published.source };
    } else if (operation === 'status') result = { operation, ...await statusPublicDemo(store, output) };
    else throw new Error('Uso: publish|status --store .demo-state/archivo.json --output .demo-public/snapshot.json');
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

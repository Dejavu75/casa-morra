import { lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { initDemoStore, statusDemoStore } from './demo-store.mjs';
import { publishPublicDemo, statusPublicDemo } from './demo-public.mjs';

async function exists(path) {
  try { await lstat(path); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

function options(args) {
  const values = { '--store': '.demo-state/admin.json',
    '--output': '.demo-public/snapshot.json' };
  const seen = new Set();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    if (!flag.startsWith('--')) throw new Error(`Argumento inesperado: ${flag}`);
    if (!(flag in values)) throw new Error(`Opción desconocida: ${flag}`);
    if (seen.has(flag)) throw new Error(`Opción repetida: ${flag}`);
    const value = args[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Falta valor para ${flag}`);
    seen.add(flag);
    values[flag] = value;
  }
  return values;
}

try {
  const values = options(process.argv.slice(2));
  const store = resolve(values['--store']);
  const output = resolve(values['--output']);
  const hasStore = await exists(store);
  const hasOutput = await exists(output);
  if (!hasStore && hasOutput) throw new Error('Rechazada exportación existente sin almacén');
  if (!hasStore) await initDemoStore(store);
  else await statusDemoStore(store);
  if (hasOutput) {
    const state = await statusPublicDemo(store, output);
    if (!state.fresh) throw new Error('Rechazada exportación distinta del almacén');
  } else await publishPublicDemo(store, output);
  console.log(JSON.stringify({ created: !hasStore, published: !hasOutput }));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

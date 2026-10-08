import { isDeepStrictEqual } from 'node:util';
import * as demo from '../dist/data/demo.js';
import { decodeDemoSnapshot, encodeDemoSnapshot } from './demo-snapshot.mjs';

const COLLECTIONS = Object.freeze([
  'byes', 'games', 'players', 'seasons', 'titles', 'tournaments',
  'editorial.classes', 'editorial.news',
]);

const rowsAt = (data, collection) => collection.startsWith('editorial.')
  ? data.editorial[collection.slice('editorial.'.length)]
  : data[collection];

const byIdentity = (a, b) => {
  const left = `${a.collection}\u0000${a.id}`;
  const right = `${b.collection}\u0000${b.id}`;
  return left < right ? -1 : left > right ? 1 : 0;
};

/** Previsualiza altas y cambios sin modificar registros, datos ni archivos. */
export function planDemoSnapshotImport(json, currentData = demo) {
  const incoming = decodeDemoSnapshot(json);
  const current = decodeDemoSnapshot(encodeDemoSnapshot(currentData));
  const plan = { added: [], unchanged: [], conflicting: [] };

  for (const collection of COLLECTIONS) {
    const existing = new Map(rowsAt(current, collection).map((row) => [row.id, row]));
    // Una omisión en el snapshot entrante no elimina al dueño actual del slug.
    const slugOwners = ['players', 'tournaments', 'editorial.news'].includes(collection)
      ? new Map(rowsAt(current, collection).map((row) => [row.slug, row])) : null;
    for (const record of rowsAt(incoming, collection)) {
      const { id } = record;
      const owner = slugOwners?.get(record.slug);
      if (owner && owner.id !== id) plan.conflicting.push({
        collection, id, reason: 'DUPLICATE_SLUG', slugOwnerId: owner.id,
        current: existing.get(id) ?? owner, incoming: record,
      });
      else if (!existing.has(id)) plan.added.push({ collection, id, incoming: record });
      else if (isDeepStrictEqual(existing.get(id), record)) plan.unchanged.push({ collection, id });
      else plan.conflicting.push({ collection, id, current: existing.get(id), incoming: record });
    }
  }

  // El club es un documento único sin ID; su clave lógica es fija.
  const club = { collection: 'editorial.club', id: 'club' };
  if (isDeepStrictEqual(current.editorial.club, incoming.editorial.club)) plan.unchanged.push(club);
  else plan.conflicting.push({ ...club, current: current.editorial.club, incoming: incoming.editorial.club });

  for (const status of Object.keys(plan)) plan[status].sort(byIdentity);
  return { counts: Object.fromEntries(Object.keys(plan).map((status) => [status, plan[status].length])), ...plan };
}

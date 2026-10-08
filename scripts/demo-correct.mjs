import { decodeDemoSnapshot, encodeDemoSnapshot, snapshotMetadata } from './demo-snapshot.mjs';
import { AFFECTED_VIEWS } from './import-apply.mjs';
import { verifyData } from './verify-data.mjs';

const collections = Object.keys(AFFECTED_VIEWS);
const rowsAt = (data, collection) => collection.startsWith('editorial.')
  ? data.editorial[collection.slice('editorial.'.length)] : data[collection];
const identity = ({ collection, id }) => `${collection}\u0000${id}`;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function normalizeCorrectionAllowlist(allowlist) {
  if (!Array.isArray(allowlist) || !allowlist.length) throw new Error('Lista explícita de correcciones obligatoria');
  const seen = new Set();
  return allowlist.map((entry) => {
    if (!entry || Array.isArray(entry) || Object.keys(entry).sort().join(',') !== 'collection,id' ||
        !collections.includes(entry.collection) || typeof entry.id !== 'string' || !entry.id ||
        (entry.collection === 'editorial.club' && entry.id !== 'club'))
      throw new Error('Identidad de corrección inválida');
    const key = identity(entry);
    if (seen.has(key)) throw new Error('Identidad de corrección duplicada');
    seen.add(key);
    return { collection: entry.collection, id: entry.id };
  }).sort((a, b) => identity(a).localeCompare(identity(b)));
}

/** Una corrección se prepara íntegramente en memoria; el operador aporta la tabla oficial. */
export function prepareDemoSnapshotCorrection(incoming, currentData, expectedSha, allowlist) {
  snapshotMetadata(incoming); // También exige JSON canónico y versión pública de demostración.
  const corrected = normalizeCorrectionAllowlist(allowlist);
  const allowed = new Set(corrected.map(identity));
  const beforeSnapshot = encodeDemoSnapshot(currentData);
  const before = snapshotMetadata(beforeSnapshot);
  if (!/^[a-f0-9]{64}$/.test(expectedSha ?? '') || before.sha256 !== expectedSha)
    throw new Error('CAS rechazado: hash vigente obsoleto');
  const proposed = decodeDemoSnapshot(incoming);
  const next = decodeDemoSnapshot(beforeSnapshot);
  const changed = new Set();

  for (const collection of collections) {
    if (collection === 'editorial.club') {
      if (!same(next.editorial.club, proposed.editorial.club)) {
        const key = identity({ collection, id: 'club' });
        if (!allowed.has(key)) throw new Error('Diferencia no autorizada por la lista explícita');
        next.editorial.club = proposed.editorial.club;
        changed.add(key);
      }
      continue;
    }
    const current = rowsAt(next, collection);
    const known = new Map(current.map((row, index) => [row.id, index]));
    for (const row of rowsAt(proposed, collection)) {
      if (!known.has(row.id)) throw new Error(`Corrección rechazada: ID nuevo en ${collection}/${row.id}`);
      const index = known.get(row.id);
      if (!same(current[index], row)) {
        const key = identity({ collection, id: row.id });
        if (!allowed.has(key)) throw new Error('Diferencia no autorizada por la lista explícita');
        current[index] = row; // Conserva posiciones y registros omitidos.
        changed.add(key);
      }
    }
  }
  if (corrected.some((entry) => !changed.has(identity(entry))))
    throw new Error('La lista incluye una identidad sin cambios');
  const afterSnapshot = encodeDemoSnapshot(next); // Slugs, referencias y forma tras la mezcla.
  const report = verifyData(next);
  if (report.errors.length)
    throw new Error(`Corrección rechazada: verificación estadística (${[...new Set(report.errors.map((error) => error.code))].join(', ')})`);
  return { beforeSnapshot, afterSnapshot, journal: { before, after: snapshotMetadata(afterSnapshot),
    corrected, affectedViews: [...new Set(corrected.flatMap(({ collection }) => AFFECTED_VIEWS[collection]))].sort() } };
}

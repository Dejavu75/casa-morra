import * as demo from '../dist/data/demo.js';
import { decodeDemoSnapshot, encodeDemoSnapshot, snapshotMetadata } from './demo-snapshot.mjs';
import { planDemoSnapshotImport } from './import-plan.mjs';
import { verifyData } from './verify-data.mjs';

const OFFICIAL_STANDING_ERRORS = new Set([
  'MISSING_STANDING', 'UNEXPLAINED_STANDING', 'STANDING_POINTS', 'STANDING_WDL',
]);

// Nombres de renderRoute; la lista es conservadora y no dispara invalidación real.
const AFFECTED_VIEWS = Object.freeze({
  byes: ['tournament'],
  games: ['home', 'tournament', 'player', 'statistics', 'classics', 'classic', 'game'],
  players: ['home', 'tournaments', 'tournament', 'annual', 'players', 'player',
    'statistics', 'classics', 'classic', 'game'],
  seasons: ['home', 'tournaments', 'tournament', 'annual'],
  titles: ['player', 'statistics'],
  tournaments: ['home', 'tournaments', 'tournament', 'annual', 'player',
    'statistics', 'classics', 'classic', 'game'],
  'editorial.classes': ['classes'],
  'editorial.news': ['home', 'news', 'news-detail'],
});

const rowsAt = (data, collection) => collection.startsWith('editorial.')
  ? data.editorial[collection.slice('editorial.'.length)]
  : data[collection];

/** Prepara un snapshot nuevo en memoria; no escribe ni cambia el fixture. */
export function prepareDemoSnapshotImport(json, currentData = demo) {
  const plan = planDemoSnapshotImport(json, currentData);
  if (plan.conflicting.length) {
    const error = new Error(`Importación rechazada: ${plan.conflicting.length} conflictos pendientes`);
    error.conflicting = plan.conflicting;
    throw error;
  }

  const beforeSnapshot = encodeDemoSnapshot(currentData);
  const next = decodeDemoSnapshot(beforeSnapshot);
  for (const { collection, incoming } of plan.added) rowsAt(next, collection).push(incoming);
  // La codificación valida también la unión, sin recalcular el orden de tablas oficiales.
  const afterSnapshot = encodeDemoSnapshot(next);
  const inconsistent = verifyData(next).errors.filter(({ code }) => OFFICIAL_STANDING_ERRORS.has(code));
  if (inconsistent.length) {
    const error = new Error(`Importación rechazada: tabla oficial inconsistente (${[...new Set(inconsistent.map(({ code }) => code))].join(', ')})`);
    error.inconsistent = inconsistent;
    throw error;
  }
  const added = plan.added.map(({ collection, id }) => ({ collection, id }));
  const affectedViews = [...new Set(added.flatMap(({ collection }) => AFFECTED_VIEWS[collection]))].sort();

  return {
    beforeSnapshot,
    afterSnapshot,
    journal: {
      before: snapshotMetadata(beforeSnapshot),
      after: snapshotMetadata(afterSnapshot),
      added,
      affectedViews,
    },
  };
}

/** Revierte solo si el estado vigente coincide con el resultado preparado. */
export function restorePreparedDemoSnapshotImport(prepared, currentData) {
  const before = snapshotMetadata(prepared.beforeSnapshot);
  const after = snapshotMetadata(prepared.afterSnapshot);
  if (before.sha256 !== prepared.journal?.before?.sha256 ||
      after.sha256 !== prepared.journal?.after?.sha256)
    throw new Error('Preparación inválida: el diario no coincide con los snapshots');
  if (encodeDemoSnapshot(currentData) !== prepared.afterSnapshot)
    throw new Error('Reversión rechazada: el estado vigente cambió');
  return prepared.beforeSnapshot;
}

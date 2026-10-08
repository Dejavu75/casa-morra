import assert from 'node:assert/strict';
import test from 'node:test';
import * as demo from '../dist/data/demo.js';
import { decodeDemoSnapshot, encodeDemoSnapshot } from '../scripts/demo-snapshot.mjs';
import {
  prepareDemoSnapshotImport,
  restorePreparedDemoSnapshotImport,
} from '../scripts/import-apply.mjs';

const original = () => encodeDemoSnapshot(demo);

const withNews = () => {
  const data = decodeDemoSnapshot(original());
  data.editorial.news.push({
    id: 'nueva-demo', slug: 'nueva-demo', date: '2026-10-08',
    title: 'Noticia ficticia', excerpt: 'Resumen ficticio', body: 'Contenido ficticio',
  });
  return encodeDemoSnapshot(data);
};

test('prepara altas y conserva datos vigentes omitidos sin mutar las entradas', () => {
  const before = original();
  const incoming = withNews();
  const prepared = prepareDemoSnapshotImport(incoming);
  const after = decodeDemoSnapshot(prepared.afterSnapshot);
  assert.equal(prepared.beforeSnapshot, before);
  assert.equal(after.editorial.news.at(-1).id, 'nueva-demo');
  assert.equal(after.editorial.news.length, demo.editorial.news.length + 1);
  assert.deepEqual(after.tournaments, demo.tournaments);
  assert.deepEqual(prepared.journal.added, [{ collection: 'editorial.news', id: 'nueva-demo' }]);
  assert.deepEqual(prepared.journal.affectedViews, ['home', 'news', 'news-detail']);
  assert.equal(prepared.journal.before.sha256.length, 64);
  assert.equal(prepared.journal.after.sha256.length, 64);
  assert.equal(original(), before);
  assert.equal(incoming, withNews());
});

test('la carga repetida no duplica y la reversión recupera exactamente el snapshot anterior', () => {
  const first = prepareDemoSnapshotImport(withNews());
  const afterData = decodeDemoSnapshot(first.afterSnapshot);
  const second = prepareDemoSnapshotImport(withNews(), afterData);
  assert.deepEqual(second.journal.added, []);
  assert.deepEqual(second.journal.affectedViews, []);
  assert.equal(second.beforeSnapshot, first.afterSnapshot);
  assert.equal(second.afterSnapshot, first.afterSnapshot);
  assert.equal(restorePreparedDemoSnapshotImport(first, afterData), first.beforeSnapshot);
  assert.throws(() => restorePreparedDemoSnapshotImport(first, demo), /estado vigente/i);
});

test('conserva el orden oficial al incorporar un torneo y señala vistas competitivas', () => {
  const incoming = decodeDemoSnapshot(original());
  const originalEvent = incoming.tournaments.find(({ standings }) => standings.length > 1);
  const newEvent = {
    ...originalEvent, id: 'torneo-nuevo-demo', slug: 'torneo-nuevo-demo',
    name: 'Torneo ficticio nuevo',
  };
  incoming.tournaments.push(newEvent);
  const prepared = prepareDemoSnapshotImport(encodeDemoSnapshot(incoming));
  const after = decodeDemoSnapshot(prepared.afterSnapshot);
  assert.deepEqual(after.tournaments.slice(0, -1), demo.tournaments);
  assert.deepEqual(after.tournaments.at(-1).standings, originalEvent.standings);
  assert.ok(prepared.journal.affectedViews.includes('annual'));
  assert.ok(prepared.journal.affectedViews.includes('statistics'));
  assert.equal(restorePreparedDemoSnapshotImport(prepared, after), original());
});

test('no aplica un cambio de fila ni un slug ocupado por una fila omitida', () => {
  const changed = decodeDemoSnapshot(original());
  changed.players[0].name = 'Otro nombre ficticio';
  assert.throws(() => prepareDemoSnapshotImport(encodeDemoSnapshot(changed)), /conflictos/i);

  const current = decodeDemoSnapshot(original());
  current.editorial.news.push({
    id: 'noticia-vigente', slug: 'slug-ocupado', date: '2026-10-08',
    title: 'Vigente', excerpt: 'Resumen', body: 'Contenido',
  });
  const incoming = decodeDemoSnapshot(original());
  incoming.editorial.news.push({
    id: 'noticia-nueva', slug: 'slug-ocupado', date: '2026-10-08',
    title: 'Nueva', excerpt: 'Resumen', body: 'Contenido',
  });
  assert.throws(() => prepareDemoSnapshotImport(encodeDemoSnapshot(incoming), current), /conflictos/i);
});

test('rechaza entradas inválidas antes de preparar o restaurar', () => {
  assert.throws(() => prepareDemoSnapshotImport('{'), /INVALID_JSON/);
  const prepared = prepareDemoSnapshotImport(withNews());
  assert.throws(() => restorePreparedDemoSnapshotImport({ ...prepared, beforeSnapshot: '{}' },
    decodeDemoSnapshot(prepared.afterSnapshot)), /snapshot|INVALID_SHAPE|UNSUPPORTED_FORMAT/i);
  assert.throws(() => restorePreparedDemoSnapshotImport({
    ...prepared, journal: { ...prepared.journal, after: { sha256: '0'.repeat(64) } },
  }, decodeDemoSnapshot(prepared.afterSnapshot)), /diario/i);
});

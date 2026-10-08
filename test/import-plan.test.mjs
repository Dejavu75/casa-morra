import assert from 'node:assert/strict';
import test from 'node:test';
import * as demo from '../dist/data/demo.js';
import { decodeDemoSnapshot, encodeDemoSnapshot } from '../scripts/demo-snapshot.mjs';
import { planDemoSnapshotImport } from '../scripts/import-plan.mjs';

const snapshot = (change = () => {}) => {
  const data = decodeDemoSnapshot(encodeDemoSnapshot(demo));
  change(data);
  return encodeDemoSnapshot(data);
};

test('un snapshot repetido es idempotente y no altera los datos vigentes', () => {
  const before = encodeDemoSnapshot(demo);
  const first = planDemoSnapshotImport(before);
  const second = planDemoSnapshotImport(before);
  assert.deepEqual(first, second);
  assert.deepEqual(first.counts, { added: 0, unchanged: 97, conflicting: 0 });
  assert.deepEqual(first.added, []);
  assert.deepEqual(first.conflicting, []);
  assert.equal(encodeDemoSnapshot(demo), before);
});

test('un cambio de fila conserva ambos valores para revisión y nunca lo aplica', () => {
  const before = encodeDemoSnapshot(demo);
  const json = snapshot((data) => { data.players[0].name = 'Nombre propuesto'; });
  const plan = planDemoSnapshotImport(json);
  assert.deepEqual(plan.counts, { added: 0, unchanged: 96, conflicting: 1 });
  assert.equal(plan.conflicting[0].collection, 'players');
  assert.equal(plan.conflicting[0].id, demo.players[0].id);
  assert.equal(plan.conflicting[0].current.name, demo.players[0].name);
  assert.equal(plan.conflicting[0].incoming.name, 'Nombre propuesto');
  assert.equal(encodeDemoSnapshot(demo), before);
});

test('ordena incorporaciones y conflictos por colección e ID, no por orden de entrada', () => {
  const current = decodeDemoSnapshot(encodeDemoSnapshot(demo));
  current.editorial.news = [];
  const json = snapshot((data) => {
    data.players.reverse();
    data.players[0].name = 'Nombre actualizado';
    data.editorial.news.reverse();
  });
  const plan = planDemoSnapshotImport(json, current);
  assert.deepEqual(plan.added.map(({ collection, id }) => `${collection}/${id}`),
    [...demo.editorial.news.map(({ id }) => `editorial.news/${id}`)].sort());
  assert.deepEqual(plan.conflicting.map(({ collection, id }) => `${collection}/${id}`),
    [`players/${demo.players.at(-1).id}`]);
});

test('una alta propuesta se vuelve sin cambios si ya está en los datos vigentes', () => {
  const json = snapshot((data) => {
    data.editorial.news.push({
      id: 'noticia-adicional', slug: 'noticia-adicional', date: '2026-10-08',
      title: 'Noticia adicional', excerpt: 'Resumen ficticio', body: 'Texto ficticio',
    });
  });
  const first = planDemoSnapshotImport(json);
  assert.deepEqual(first.added.map(({ collection, id }) => `${collection}/${id}`),
    ['editorial.news/noticia-adicional']);
  const alreadyPresent = JSON.parse(json).data;
  const second = planDemoSnapshotImport(json, alreadyPresent);
  assert.deepEqual(second.counts, { added: 0, unchanged: 98, conflicting: 0 });
  assert.deepEqual(first.added[0].incoming, alreadyPresent.editorial.news.at(-1));
});

test('la omisión no libera un slug vigente en jugadores, torneos ni novedades', () => {
  const before = encodeDemoSnapshot(demo);
  for (const collection of ['players', 'tournaments', 'editorial.news']) {
    const current = decodeDemoSnapshot(before);
    const currentRows = collection === 'editorial.news' ? current.editorial.news : current[collection];
    const owner = { ...currentRows[0], id: `vigente-${collection}`, slug: `slug-vigente-${collection}` };
    if (collection === 'tournaments') owner.standings = [];
    currentRows.push(owner);
    const json = snapshot((data) => {
      const rows = collection === 'editorial.news' ? data.editorial.news : data[collection];
      rows.push({ ...owner, id: `nuevo-${collection}` });
    });
    const plan = planDemoSnapshotImport(json, current);
    assert.equal(plan.added.some(({ id }) => id.startsWith('nuevo-')), false, collection);
    const conflict = plan.conflicting.find(({ id }) => id.startsWith('nuevo-'));
    assert.equal(conflict?.reason, 'DUPLICATE_SLUG', collection);
    assert.equal(conflict?.slugOwnerId, owner.id, collection);
    assert.equal(conflict?.incoming.slug, conflict?.current.slug, collection);
    assert.deepEqual(plan, planDemoSnapshotImport(json, current), collection);
  }
  assert.equal(encodeDemoSnapshot(demo), before);
});

test('editar un ID no libera el slug de otro ID vigente', () => {
  const current = decodeDemoSnapshot(encodeDemoSnapshot(demo));
  const owner = { ...current.players[0], id: 'vigente-adicional', slug: 'slug-vigente-adicional' };
  current.players.push(owner);
  const json = snapshot((data) => {
    data.players[0].slug = owner.slug;
  });
  const plan = planDemoSnapshotImport(json, current);
  const conflict = plan.conflicting.find(({ id }) => id === demo.players[0].id);
  assert.equal(conflict?.reason, 'DUPLICATE_SLUG');
  assert.equal(conflict?.slugOwnerId, owner.id);
  assert.equal(conflict?.current.id, demo.players[0].id);
});

test('un registro omitido no implica eliminación y el club se informa como conflicto independiente', () => {
  const json = snapshot((data) => {
    data.editorial.news.pop();
    data.editorial.club.description = 'Descripción propuesta';
  });
  const plan = planDemoSnapshotImport(json);
  assert.equal(plan.added.length, 0);
  assert.equal(plan.conflicting.length, 1);
  assert.deepEqual(plan.conflicting[0].collection, 'editorial.club');
  assert.equal(plan.conflicting[0].id, 'club');
  assert.equal(plan.unchanged.some(({ id }) => id === demo.editorial.news.at(-1).id), false);
});

test('compara tablas oficiales en su orden original sin recomputar desempates', () => {
  const original = demo.tournaments.find((event) => event.standings.length > 1);
  const json = snapshot((data) => {
    const event = data.tournaments.find(({ id }) => id === original.id);
    const first = event.standings[0];
    const second = event.standings[1];
    [first.playerId, second.playerId] = [second.playerId, first.playerId];
    [first.rank, second.rank] = [second.rank, first.rank];
  });
  const plan = planDemoSnapshotImport(json);
  const conflict = plan.conflicting.find(({ collection, id }) => collection === 'tournaments' && id === original.id);
  assert.ok(conflict);
  assert.deepEqual(conflict.current.standings, original.standings);
  assert.notDeepEqual(conflict.incoming.standings, original.standings);
  assert.deepEqual(conflict.incoming.standings.map(({ order }) => order),
    original.standings.map(({ order }) => order));
});

test('rechaza versión, JSON malformado y referencias inválidas antes de producir un plan', () => {
  const wrongVersion = JSON.parse(snapshot());
  wrongVersion.version = 2;
  assert.throws(() => planDemoSnapshotImport(JSON.stringify(wrongVersion)), /UNSUPPORTED_VERSION/);
  assert.throws(() => planDemoSnapshotImport('{'), /INVALID_JSON/);
  const brokenReference = JSON.parse(snapshot());
  brokenReference.data.games[0].whiteId = 'no-existe';
  assert.throws(() => planDemoSnapshotImport(JSON.stringify(brokenReference)), /UNKNOWN_PLAYER/);
});

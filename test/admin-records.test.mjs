import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { initDemoStore, rollbackDemoStore, statusDemoStore } from '../scripts/demo-store.mjs';
import { decodeDemoSnapshot } from '../scripts/demo-snapshot.mjs';
import { createAdminBye, updateAdminBye, createAdminTitle, updateAdminTitle,
  updateHistoricalStanding } from '../scripts/admin-records.mjs';

test('altas y correcciones de descansos y títulos conservan integridad y rechazos no escriben', async (t) => {
  const dir = join(process.cwd(), '.demo-state', `test-admin-records-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = join(dir, 'store.json');
  const initial = await initDemoStore(store);
  const data = decodeDemoSnapshot(initial.data);
  const event = data.tournaments.find((row) => row.id === 'patio-2025');
  const playerId = event.standings[0].playerId;
  const nextRound = event.rounds + 1;
  const bye = await createAdminBye(store, { expectedSha: initial.snapshot.sha256,
    tournamentId: event.id, playerId, round: nextRound, points: 1 });
  let changed = decodeDemoSnapshot(bye.state.data);
  assert.equal(changed.byes.find((row) => row.id === bye.id).points, 1);
  assert.equal(changed.tournaments.find((row) => row.id === event.id).standings
    .find((row) => row.playerId === playerId).points,
  event.standings[0].points + 1);
  const updated = await updateAdminBye(store, bye.id, { expectedSha: bye.state.snapshot.sha256,
    tournamentId: event.id, playerId, round: nextRound, points: 0.5 });
  changed = decodeDemoSnapshot(updated.state.data);
  assert.equal(changed.byes.find((row) => row.id === bye.id).points, 0.5);
  const moved = await updateAdminBye(store, bye.id, { expectedSha: updated.state.snapshot.sha256,
    tournamentId: event.id, playerId, round: nextRound + 1, points: 0.5 });
  assert.equal(decodeDemoSnapshot(moved.state.data).byes.find((row) => row.id === bye.id).round,
    nextRound + 1);
  const title = await createAdminTitle(store, { expectedSha: moved.state.snapshot.sha256,
    playerId, tournamentId: event.id, kind: 'distincion', label: 'Premio especial' });
  const edited = await updateAdminTitle(store, title.id, { expectedSha: title.state.snapshot.sha256,
    playerId, tournamentId: event.id, kind: 'distincion', label: 'Premio actualizado' });
  assert.equal(decodeDemoSnapshot(edited.state.data).titles.find((row) => row.id === title.id).label,
    'Premio actualizado');
  const raw = await readFile(store, 'utf8');
  await assert.rejects(createAdminBye(store, { expectedSha: edited.state.snapshot.sha256,
    tournamentId: event.id, playerId: 'inexistente', round: nextRound + 1, points: 1 }), /jugador|participante/i);
  assert.equal(await readFile(store, 'utf8'), raw);
});

test('el alta auditada de descanso puede revertirse sin alterar la tabla previa', async (t) => {
  const dir = join(process.cwd(), '.demo-state', `test-admin-bye-rollback-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = join(dir, 'store.json');
  const initial = await initDemoStore(store);
  const data = decodeDemoSnapshot(initial.data);
  const event = data.tournaments.find((row) => row.id === 'patio-2025');
  const created = await createAdminBye(store, { expectedSha: initial.snapshot.sha256,
    tournamentId: event.id, playerId: event.standings[0].playerId,
    round: event.rounds + 1, points: 1 });
  assert.equal(created.state.audit.at(-1).operation, 'record');
  const rolled = await rollbackDemoStore(store);
  assert.equal(rolled.snapshot.sha256, initial.snapshot.sha256);
  assert.deepEqual(decodeDemoSnapshot(rolled.data), data);
});

test('la tabla histórica aislada admite corrección explícita sin inventar partidas', async (t) => {
  const dir = join(process.cwd(), '.demo-state', `test-admin-table-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = join(dir, 'store.json');
  const initial = await initDemoStore(store);
  const data = decodeDemoSnapshot(initial.data);
  const event = data.tournaments.find((row) => row.format === 'table-only');
  const row = event.standings[0];
  const updated = await updateHistoricalStanding(store, event.id, row.playerId, {
    expectedSha: initial.snapshot.sha256, points: row.points + 0.5, rank: row.rank });
  const after = decodeDemoSnapshot(updated.state.data);
  assert.equal(after.games.filter((game) => game.tournamentId === event.id).length, 0);
  assert.equal(after.tournaments.find((item) => item.id === event.id).standings[0].points,
    row.points + 0.5);
  const raw = await readFile(store, 'utf8');
  await assert.rejects(updateHistoricalStanding(store, 'patio-2025', data.tournaments[0].standings[0].playerId,
    { expectedSha: updated.state.snapshot.sha256, points: 99, rank: 1 }), /histórica|partidas/i);
  assert.equal(await readFile(store, 'utf8'), raw);
});

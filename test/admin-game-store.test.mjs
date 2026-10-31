import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { decodeDemoSnapshot } from '../scripts/demo-snapshot.mjs';
import { initDemoStore, recordAdminGame, rollbackDemoStore, statusDemoStore } from '../scripts/demo-store.mjs';

test('el almacén audita alta y completado con CAS y revierte la última operación', async (t) => {
  const dir = join(process.cwd(), '.demo-state', `test-admin-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = join(dir, 'store.json');
  const initial = await initDemoStore(store);
  const data = decodeDemoSnapshot(initial.data);
  const event = data.tournaments.find((row) => row.id === 'patio-2025');
  const game = { id: 'admin-nueva-2', tournamentId: event.id, round: event.rounds + 1,
    date: event.date, whiteId: event.standings[0].playerId, blackId: event.standings[1].playerId,
    result: '1-0', moves: null, finish: null };
  const created = await recordAdminGame(store, { mode: 'create', game }, initial.snapshot.sha256);
  assert.equal(created.audit.at(-1).operation, 'game');
  assert.equal((await statusDemoStore(store)).snapshot.sha256, created.snapshot.sha256);
  const raw = await readFile(store, 'utf8');
  await assert.rejects(recordAdminGame(store, { mode: 'complete', gameId: game.id,
    format: 'manual', text: 'e4 e5' }, initial.snapshot.sha256), /CAS|obsoleto/i);
  assert.equal(await readFile(store, 'utf8'), raw);
  await assert.rejects(recordAdminGame(store, { mode: 'complete', gameId: game.id,
    format: 'pgn', text: '[Result "1-0"]\n[SetUp "1"]\n[FEN "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"]\n\n1... e5 1-0' },
  created.snapshot.sha256), /posición inicial|FEN|SetUp/i);
  assert.equal(await readFile(store, 'utf8'), raw);
  await assert.rejects(recordAdminGame(store, { mode: 'complete', gameId: game.id,
    format: 'pgn', text: '[Result "1-0"]\n\n1. e4 (1. d4) e5 1-0' },
  created.snapshot.sha256), /variante|alternativa/i);
  assert.equal(await readFile(store, 'utf8'), raw);
  const completed = await recordAdminGame(store, { mode: 'complete', gameId: game.id,
    format: 'manual', text: 'e4 e5' }, created.snapshot.sha256);
  assert.equal(decodeDemoSnapshot(completed.data).games.find((row) => row.id === game.id).moves.length, 2);
  assert.equal(decodeDemoSnapshot(completed.data).games.length, decodeDemoSnapshot(created.data).games.length);
  const undone = await rollbackDemoStore(store);
  assert.equal(undone.snapshot.sha256, created.snapshot.sha256);
  assert.equal(decodeDemoSnapshot(undone.data).games.find((row) => row.id === game.id).moves, null);
});

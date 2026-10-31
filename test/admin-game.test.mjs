import test from 'node:test';
import assert from 'node:assert/strict';
import * as demo from '../dist/data/demo.js';
import { encodeDemoSnapshot, decodeDemoSnapshot } from '../scripts/demo-snapshot.mjs';
import { parseAdminMoves, prepareAdminGame } from '../scripts/admin-game.mjs';

const data = () => decodeDemoSnapshot(encodeDemoSnapshot(demo));

test('las jugadas manuales legales se convierten a UCI y se rechazan las ilegales', () => {
  assert.deepEqual(parseAdminMoves('manual', 'e4 e5 Nf3 Nc6', '1-0'),
    ['e2e4', 'e7e5', 'g1f3', 'b8c6']);
  assert.throws(() => parseAdminMoves('manual', 'e4 e4', '1-0'), /jugada/i);
});

test('el PGN se valida y su resultado debe coincidir', () => {
  assert.deepEqual(parseAdminMoves('pgn', '[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 1-0', '1-0'),
    ['e2e4', 'e7e5', 'g1f3', 'b8c6']);
  assert.throws(() => parseAdminMoves('pgn', '[Result "0-1"]\n\n1. e4 e5 0-1', '1-0'),
    /resultado/i);
});

test('rechaza PGN con posición inicial o variante fuera del ajedrez estándar', () => {
  assert.throws(() => parseAdminMoves('pgn',
    '[Result "1-0"]\n[SetUp "1"]\n[FEN "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"]\n\n1... e5 1-0',
    '1-0'), /posición inicial|FEN|SetUp/i);
  assert.throws(() => parseAdminMoves('pgn',
    '[Result "1-0"]\n[Variant "Crazyhouse"]\n\n1. e4 e5 1-0', '1-0'), /variante/i);
});

test('rechaza variantes de análisis PGN sin confundir paréntesis de comentarios', () => {
  assert.throws(() => parseAdminMoves('pgn',
    '[Result "1-0"]\n\n1. e4 (1. d4 d5) e5 1-0', '1-0'), /variante|alternativa/i);
  assert.deepEqual(parseAdminMoves('pgn',
    '[Result "1-0"]\n\n1. e4 {nota (no variante)} e5 1-0', '1-0'),
  ['e2e4', 'e7e5']);
});

test('se crea un resultado sin jugadas y se completa la misma partida sin duplicarla', () => {
  const initial = data();
  const event = initial.tournaments.find((row) => row.id === 'patio-2025');
  const whiteId = event.standings[0].playerId;
  const blackId = event.standings[1].playerId;
  const game = { id: 'admin-nueva-1', tournamentId: event.id, round: event.rounds + 1,
    date: event.date, whiteId, blackId, result: '1-0', moves: null, finish: null };
  const created = prepareAdminGame(initial, { mode: 'create', game });
  assert.equal(created.next.games.length, initial.games.length + 1);
  assert.equal(created.next.games.find((row) => row.id === game.id).moves, null);
  assert.equal(created.next.tournaments.find((row) => row.id === event.id).standings.find((row) => row.playerId === whiteId).points,
    event.standings[0].points + 1);
  assert.equal(created.next.tournaments.find((row) => row.id === event.id).standings.find((row) => row.playerId === blackId).losses,
    event.standings[1].losses + 1);
  const completed = prepareAdminGame(created.next, { mode: 'complete', gameId: game.id,
    format: 'manual', text: 'e4 e5 Nf3 Nc6' });
  assert.equal(completed.next.games.length, created.next.games.length);
  assert.deepEqual(completed.next.games.find((row) => row.id === game.id).moves,
    ['e2e4', 'e7e5', 'g1f3', 'b8c6']);
  assert.deepEqual(completed.next.tournaments, created.next.tournaments);
  assert.throws(() => prepareAdminGame(completed.next, { mode: 'create', game }), /existe/i);
});

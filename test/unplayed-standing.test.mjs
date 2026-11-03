import test from 'node:test';
import assert from 'node:assert/strict';
import * as demo from '../dist/data/demo.js';
import { validateOfficialStandings } from '../dist/domain/official-integrity.js';
import { decodeDemoSnapshot, encodeDemoSnapshot } from '../scripts/demo-snapshot.mjs';

test('un participante sin partida conserva cero puntos sin inventar resultados', () => {
  const data = decodeDemoSnapshot(encodeDemoSnapshot(demo));
  const event = data.tournaments.find((row) => row.id === 'primavera-2026');
  event.standings.push({ playerId: 'felipe-rivas', order: 6, rank: 6,
    points: 0, wins: 0, draws: 0, losses: 0 });
  const errors = [];
  validateOfficialStandings(data, errors);
  assert.deepEqual(errors, []);
});

test('una fila sin partida con puntos sigue siendo inconsistente', () => {
  const data = decodeDemoSnapshot(encodeDemoSnapshot(demo));
  const event = data.tournaments.find((row) => row.id === 'primavera-2026');
  event.standings.push({ playerId: 'felipe-rivas', order: 6, rank: 6,
    points: 1, wins: 0, draws: 0, losses: 0 });
  const errors = [];
  validateOfficialStandings(data, errors);
  assert.ok(errors.some((row) => row.code === 'UNEXPLAINED_STANDING'));
});

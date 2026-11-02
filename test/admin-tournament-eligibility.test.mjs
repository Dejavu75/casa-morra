import test from 'node:test';
import assert from 'node:assert/strict';
import * as demo from '../dist/data/demo.js';
import { writableTournaments } from '../admin/tournament-eligibility.js';

test('el alta ofrece solo torneos cuyas tablas admiten sumar una partida', () => {
  const available = writableTournaments(demo.tournaments);
  assert.equal(available.length, 5);
  assert.equal(available[0].id, 'patio-2025');
  assert.ok(!available.some((event) => event.id === 'archivo-2025'));

  const incomplete = structuredClone(available[0]);
  incomplete.standings[0].draws = null;
  assert.deepEqual(writableTournaments([incomplete]), []);
});

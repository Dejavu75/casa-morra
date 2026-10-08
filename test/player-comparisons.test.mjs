import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPlayerProfile } from '../dist/views/players.js';

function comparisonsFixture() {
  const people = ['ana', 'bea', 'cora', 'dora'].map((id) => ({ id, slug: id, name: id.toUpperCase(), membership: 'socia' }));
  const events = [
    ['tabla', 'Tabla aislada', '2024-12-01'],
    ['breve', 'Victoria breve', '2025-01-01'],
    ['doble', 'Victoria doble', '2025-02-01'],
    ['caida', 'Dos derrotas', '2025-03-01'],
  ].map(([id, name, date]) => ({ id, slug: id, name, date, seasonId: '24-25', annualEligible: true,
    eloEligible: false, standings: [{ playerId: 'ana', rank: 1, order: 1, points: id === 'tabla' ? 50 : 2,
      wins: id === 'tabla' ? null : 0, draws: id === 'tabla' ? null : 0, losses: id === 'tabla' ? null : 0 }] }));
  const game = (id, tournamentId, whiteId, blackId, result) => ({ id, tournamentId, whiteId, blackId,
    result, date: events.find((event) => event.id === tournamentId).date, round: 1 });
  return {
    players: people, seasons: [{ id: '24-25', start: '2024-08-01', end: '2025-07-31' }],
    tournaments: events, titles: [],
    byes: [{ id: 'descanso', tournamentId: 'caida', playerId: 'ana', round: 2, points: 9 }],
    games: [
      game('g1', 'breve', 'ana', 'bea', '1-0'),
      game('g2', 'doble', 'bea', 'ana', '0-1'),
      game('g3', 'doble', 'ana', 'bea', '1-0'),
      game('g4', 'caida', 'ana', 'cora', '0-1'),
      game('g5', 'caida', 'cora', 'ana', '1-0'),
      game('g6', 'caida', 'ana', 'dora', '1/2-1/2'),
      game('g7', 'caida', 'dora', 'ana', '1/2-1/2'),
    ],
  };
}

test('mejor y peor evento usan solo rendimiento al tablero, con N, desempate y sin byes ni tabla aislada', () => {
  const html = renderPlayerProfile(comparisonsFixture(), 'ana').html;
  assert.match(html, /Comparativos propios de demostración/);
  assert.match(html, /Mejor evento al tablero[\s\S]*?Victoria doble[\s\S]*?100 %[\s\S]*?2 partidas/);
  assert.match(html, /Peor evento al tablero[\s\S]*?Dos derrotas[\s\S]*?25 %[\s\S]*?4 partidas/);
  assert.doesNotMatch(html, /Mejor evento al tablero[\s\S]*?Tabla aislada[\s\S]*?Peor evento/);
  assert.match(html, /igual rendimiento[^<]*mayor muestra/i);
});

test('igual rendimiento y muestra se resuelven por fecha e ID sin usar puntos oficiales', () => {
  const fixture = comparisonsFixture();
  const baseline = fixture.tournaments.find((event) => event.id === 'doble');
  fixture.tournaments.push({ ...baseline, id: 'zeta', slug: 'zeta', name: 'Victoria Zeta' });
  fixture.games.push(
    { ...fixture.games[1], id: 'z1', tournamentId: 'zeta' },
    { ...fixture.games[2], id: 'z2', tournamentId: 'zeta' },
  );
  const html = renderPlayerProfile(fixture, 'ana').html;
  assert.match(html, /Mejor evento al tablero[\s\S]*?Victoria doble[\s\S]*?100 % · 2 partidas/);
  assert.doesNotMatch(html, /Mejor evento al tablero[\s\S]*?Victoria Zeta[\s\S]*?Peor evento/);
});

test('rivales favorables y adversos usan H2H al tablero, umbral 2 y perspectiva correcta', () => {
  const fixture = comparisonsFixture();
  const ana = renderPlayerProfile(fixture, 'ana').html;
  assert.match(ana, /Balance favorable[\s\S]*?BEA[\s\S]*?3–0–0[\s\S]*?3 partidas/);
  assert.match(ana, /Balance adverso[\s\S]*?CORA[\s\S]*?0–0–2[\s\S]*?2 partidas/);
  assert.doesNotMatch(ana, /Balance favorable[\s\S]*?DORA[\s\S]*?Balance adverso/);
  const bea = renderPlayerProfile(fixture, 'bea').html;
  assert.match(bea, /Balance adverso[\s\S]*?ANA[\s\S]*?0–0–3[\s\S]*?3 partidas/);
  assert.match(bea, /Sin rival con balance favorable/);
});

test('comparativos con cero partidas quedan vacíos aunque existan tabla y byes', () => {
  const fixture = comparisonsFixture();
  fixture.games = [];
  const html = renderPlayerProfile(fixture, 'ana').html;
  assert.match(html, /Sin eventos con partidas al tablero/);
  assert.match(html, /Sin rivales con al menos dos partidas al tablero/);
  assert.doesNotMatch(html, /50 %|100 %/);
});

test('una sola partida frente a un rival no crea balance favorable o adverso', () => {
  const fixture = comparisonsFixture();
  fixture.games = [fixture.games[0]];
  const html = renderPlayerProfile(fixture, 'ana').html;
  assert.match(html, /Sin rivales con al menos dos partidas al tablero/);
  assert.match(html, /Sin rival con balance favorable/);
  assert.match(html, /Sin rival con balance adverso/);
});

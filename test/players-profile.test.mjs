import test from 'node:test';
import assert from 'node:assert/strict';
import { players, tournaments, games, byes, titles, seasons } from '../dist/data/demo.js';
import { getPlayerProfile } from '../dist/domain/statistics.js';
import { renderPlayerProfile } from '../dist/views/players.js';

const data = { players, tournaments, games, byes, titles, seasons };

test('el perfil separa partidas, puntos, colores, Elo e historial oficial', () => {
  const profile = getPlayerProfile(data, 'celia-montiel');
  const view = renderPlayerProfile(data, 'celia-montiel');
  assert.equal(view.title, 'Celia Montiel — Casa Morra');
  assert.match(view.html, /Datos ficticios de demostración/);
  assert.match(view.html, /Elo de Casa Morra/);
  assert.match(view.html, /Mejor Elo/);
  assert.match(view.html, /Provisorio|Consolidado/);
  assert.match(view.html, /Victorias\/partidas/);
  assert.match(view.html, /Puntos\/partidas/);
  assert.match(view.html, /G–E–P/);
  assert.match(view.html, /Con blancas/);
  assert.match(view.html, /Con negras/);
  assert.match(view.html, /Historial oficial de torneos/);
  assert.match(view.html, /Archivo de Verano/);
  assert.match(view.html, /Sin detalle/);
  assert.match(view.html, /Historial Elo/);
  assert.match(view.html, /<table/);
  assert.match(view.html, /<meter /);
  assert.equal(profile.record.played, profile.colors.white.played + profile.colors.black.played);
  assert.equal(profile.record.wins, profile.colors.white.wins + profile.colors.black.wins);
  assert.equal(profile.elo.history.length, profile.elo.played);
});

test('el estado de socio se declara demo y no se sugiere una cuenta autenticada', () => {
  const view = renderPlayerProfile(data, 'dante-arce').html;
  assert.match(view, /No socio · dato demo/);
  assert.doesNotMatch(view, /[Mm]i cuenta|[Ee]ditar foto|[Ii]niciar sesión/);
});

test('un slug desconocido es 404 seguro y los datos maliciosos se escapan', () => {
  const missing = renderPlayerProfile(data, '<img src=x>').html;
  assert.match(missing, /Jugador no encontrado/);
  assert.doesNotMatch(missing, /<img src=x>/);

  const unsafe = {
    ...data,
    players: data.players.map((person) => person.id === 'celia-montiel'
      ? { ...person, name: '<img src=x onerror=alert(1)>' } : person),
    tournaments: data.tournaments.map((event) => event.id === 'archivo-2025'
      ? { ...event, name: '<svg onload=alert(1)>' } : event),
  };
  const detail = renderPlayerProfile(unsafe, 'celia-montiel').html;
  assert.doesNotMatch(detail, /<img src=x|<svg onload/);
  assert.match(detail, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(detail, /&lt;svg onload=alert\(1\)&gt;/);
});

test('trayectoria personal usa tablas oficiales sin convertirlas en partidas o títulos', () => {
  const fixture = {
    players: [
      { id: 'ana', slug: 'ana', name: 'Ana', membership: 'socia' },
      { id: 'bea', slug: 'bea', name: 'Bea', membership: 'socia' },
    ],
    seasons: [{ id: '25-26', start: '2025-08-01', end: '2026-07-31' }],
    games: [], byes: [], titles: [{ id: 'explicit', playerId: 'ana', label: 'Título explícito' }],
    tournaments: [
      { id: 'archivo', slug: 'archivo', name: 'Archivo', date: '2025-09-01', seasonId: '25-26', annualEligible: true, eloEligible: false,
        standings: [
          { playerId: 'ana', rank: 1, order: 1, points: 2, wins: null, draws: null, losses: null },
          { playerId: 'bea', rank: 1, order: 2, points: 2, wins: null, draws: null, losses: null },
        ] },
      { id: 'otro', slug: 'otro', name: 'Otro', date: '2026-03-01', seasonId: '25-26', annualEligible: true, eloEligible: false,
        standings: [{ playerId: 'ana', rank: 3, order: 3, points: 1.5, wins: null, draws: null, losses: null }] },
    ],
  };
  const html = renderPlayerProfile(fixture, 'ana').html;
  assert.match(html, /Puntos oficiales acumulados<\/dt><dd>3,5<\/dd>/);
  assert.match(html, /Primeros puestos oficiales<\/dt><dd>1<\/dd>/);
  assert.match(html, /Podios oficiales<\/dt><dd>2<\/dd>/);
  assert.match(html, /Racha máxima de victorias<\/dt><dd>0<\/dd>/);
  assert.match(html, /Racha máxima sin perder<\/dt><dd>0<\/dd>/);
  assert.match(html, /Títulos registrados<\/dt><dd>1<\/dd>/);
  assert.match(html, /Título explícito/);
  assert.match(html, /Sin detalle/);
  assert.match(html, /Las rachas cuentan solo partidas al tablero/);
  const withoutTitle = renderPlayerProfile({ ...fixture, titles: [] }, 'ana').html;
  assert.match(withoutTitle, /Títulos registrados<\/dt><dd>0<\/dd>/);
  assert.match(withoutTitle, /Primeros puestos oficiales<\/dt><dd>1<\/dd>/);
});

test('trayectoria sin torneos ni partidas presenta ceros y vacíos explícitos', () => {
  const fixture = { players: [{ id: 'ana', slug: 'ana', name: 'Ana', membership: 'socia' }],
    seasons: [], tournaments: [], games: [], byes: [], titles: [] };
  const html = renderPlayerProfile(fixture, 'ana').html;
  for (const title of ['Puntos oficiales acumulados', 'Primeros puestos oficiales', 'Podios oficiales',
    'Racha máxima de victorias', 'Racha máxima sin perder', 'Títulos registrados']) {
    assert.match(html, new RegExp(`${title}</dt><dd>0</dd>`));
  }
  assert.match(html, /Todavía no hay torneos oficiales/);
  assert.match(html, /Todavía no hay partidas elegibles/);
});

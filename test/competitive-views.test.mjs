import test from 'node:test';
import assert from 'node:assert/strict';
import { players, tournaments, games, byes, titles, seasons } from '../dist/data/demo.js';
import { parseRoute } from '../dist/router.js';
import { renderTournamentList } from '../dist/views/tournaments.js';
import { renderTournamentDetail } from '../dist/views/tournaments.js';
import { renderAnnual } from '../dist/views/annual.js';

const data = { players, tournaments, games, byes, titles, seasons };

test('el listado ofrece filtros GET compartibles y distingue sus resultados del total', () => {
  const view = renderTournamentList(data, { tipo: 'interno', temporada: '25-26' });
  assert.equal(view.title, 'Torneos — Casa Morra');
  assert.match(view.html, /<form[^>]*method="get"[^>]*action="\/torneos"/);
  assert.match(view.html, /name="tipo"/);
  assert.match(view.html, /name="temporada"/);
  assert.match(view.html, /Ronda de Invierno/);
  assert.doesNotMatch(view.html, /Tableros de Otoño/);
  assert.match(view.html, /1 de 6 torneos/);
  assert.match(view.html, /href="\/torneos\/ronda-de-invierno-2025"/);
  assert.equal(parseRoute('/torneos', '?tipo=interno&temporada=25-26').query.tipo, 'interno');
  assert.match(renderTournamentList(data, { tipo: 'candidatos' }).html, /No hay torneos/);
});

test('el detalle conserva tabla oficial, resultados y byes sin inventar jugadas', () => {
  const tableOnly = renderTournamentDetail(data, 'archivo-de-verano-2025');
  assert.match(tableOnly.html, /<caption>Clasificación oficial/);
  assert.match(tableOnly.html, /Sin detalle/);
  assert.match(tableOnly.html, /No se registraron partidas individuales/);
  assert.doesNotMatch(tableOnly.html, /\/partidas\//);

  const spring = renderTournamentDetail(data, 'encuentro-de-primavera-2026');
  assert.match(spring.html, /<caption>Clasificación oficial/);
  assert.match(spring.html, /Resultados al tablero/);
  assert.match(spring.html, /Descansos \(byes\)/);
  assert.match(spring.html, /Sin jugadas registradas/);
  assert.doesNotMatch(spring.html, /\/partidas\//);
  const patio = renderTournamentDetail(data, 'apertura-del-patio-2025');
  assert.match(patio.html, /href="\/partidas\/patio-2025-r1-p1"/);
  assert.match(patio.html, /Ver secuencia UCI/);
  assert.doesNotMatch(patio.html, /visor en preparación/);
  assert.equal(renderTournamentDetail(data, 'desconocido').title, 'Torneo no encontrado — Casa Morra');
});

test('la anual muestra puestos compartidos, movimiento y exclusiones de la demo', () => {
  const view = renderAnnual(data, '25-26');
  assert.match(view.html, /<caption>Tabla anual/);
  assert.match(view.html, /Respecto del torneo anterior de la misma temporada/);
  assert.match(view.html, /No se incluyen torneos marcados como no elegibles/);
  assert.match(view.html, /la tabla no otorga cupos ni inscripciones/);
  assert.match(view.html, /href="\/torneos\/ronda-de-invierno-2025"/);
  assert.equal(renderAnnual(data, 'no-existe').title, 'Temporada no encontrada — Casa Morra');

  const tied = {
    players: [{ id: 'ana', name: 'Ana' }, { id: 'bea', name: 'Bea' }, { id: 'cesar', name: 'César' }],
    seasons: [{ id: '25-26', label: '2025–2026' }], games: [], byes: [], titles: [],
    tournaments: [{ id: 'uno', slug: 'uno', name: 'Uno', seasonId: '25-26', date: '2026-01-01', annualEligible: true,
      standings: [
        { playerId: 'ana', points: 2, rank: 1, order: 1 },
        { playerId: 'bea', points: 2, rank: 1, order: 2 },
        { playerId: 'cesar', points: 1, rank: 3, order: 3 },
      ] }],
  };
  assert.match(renderAnnual(tied, '25-26').html, /<td>1<\/td><th scope="row">Ana<\/th>/);
  assert.match(renderAnnual(tied, '25-26').html, /<td>1<\/td><th scope="row">Bea<\/th>/);
});

test('los nombres del fixture se escapan y el texto visible es español', () => {
  const unsafe = {
    ...data,
    players: data.players.map((person) => person.id === 'celia-montiel' ? { ...person, name: '<img src=x onerror=alert(1)>' } : person),
    tournaments: data.tournaments.map((event) => event.id === 'archivo-2025' ? { ...event, name: '<svg onload=alert(1)>' } : event),
  };
  const detail = renderTournamentDetail(unsafe, 'archivo-de-verano-2025').html;
  assert.doesNotMatch(detail, /<svg onload/);
  assert.doesNotMatch(detail, /<img src=x/);
  assert.match(detail, /&lt;svg onload=alert\(1\)&gt;/);
  assert.match(detail, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('las etiquetas competitivas admiten otro catálogo sin cambiar los datos del dominio', () => {
  const labels = {
    tournaments: 'Events', annual: 'Season table',
    tournamentIntro: 'Demo events', eventTypes: { interno: 'Internal' },
  };
  const view = renderTournamentList(data, { tipo: 'interno' }, labels);
  assert.equal(view.title, 'Events — Casa Morra');
  assert.match(view.html, /<h1>Events<\/h1>/);
  assert.match(view.html, /<p>Demo events<\/p>/);
  assert.match(view.html, /Internal/);
  assert.match(view.html, /Apertura del Patio/);
});

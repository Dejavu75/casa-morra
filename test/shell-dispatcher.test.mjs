import test from 'node:test';
import assert from 'node:assert/strict';
import * as demo from '../dist/data/demo.js';
import { parseRoute } from '../dist/router.js';
import { getClassics } from '../dist/domain/statistics.js';
import { es, resolveViewMessages } from '../dist/i18n/index.js';
import { renderRoute } from '../dist/assets/app.js';

const data = { ...demo };

test('el dispatcher conserva título y encabezado para las quince rutas históricas', () => {
  const classic = getClassics(data)[0];
  const first = data.players.find((player) => player.id === classic.firstId).slug;
  const second = data.players.find((player) => player.id === classic.secondId).slug;
  const game = data.games.find((row) => Array.isArray(row.moves) && row.moves.length);
  const paths = [
    '/', '/torneos', `/torneos/${data.tournaments[0].slug}`, '/anual/25-26',
    '/jugadores', `/jugadores/${data.players[0].slug}`, '/estadisticas', '/clasicos',
    `/clasicos/${first}/${second}`, '/nosotros', '/novedades',
    `/novedades/${data.editorial.news[0].slug}`, '/clases', '/socios', `/partidas/${game.id}`,
  ];
  assert.equal(paths.length, 15);
  for (const pathname of paths) {
    const page = renderRoute(parseRoute(pathname), data);
    assert.ok(page.title && page.html, pathname);
    assert.match(page.html, /<h1\b/, pathname);
  }
});

test('una ruta no reconocida devuelve 404 sin reflejar el identificador peligroso', () => {
  const missing = renderRoute(parseRoute('/jugadores/%3Cscript%3E'), data);
  assert.equal(missing.title, 'Página no encontrada');
  assert.match(missing.html, /Página no encontrada/);
  assert.doesNotMatch(missing.html, /script/);
});

test('los catálogos por vista cambian textos sin cambiar cifras, IDs ni enlaces', () => {
  const catalogs = { es, en: { views: {
    home: { headline: 'Every game starts with an idea' },
    competitive: { tournaments: 'Events', eventTypes: { interno: 'Internal' } },
    records: { statisticsTitle: 'Records' },
    editorial: { about: 'About' },
  } } };
  const options = { locale: 'en-US', catalogs };
  const home = renderRoute(parseRoute('/'), data, options).html;
  assert.match(home, /<h1>Records<\/h1>/);
  assert.doesNotMatch(home, /href="\/torneos"/);
  const tournament = renderRoute(parseRoute('/torneos'), data, options).html;
  assert.match(tournament, /<h1>Events<\/h1>/);
  assert.match(tournament, /Internal/);
  assert.match(tournament, /href="\/torneos\/apertura-del-patio-2025"/);
  assert.match(renderRoute(parseRoute('/estadisticas'), data, options).html, /<h1>Records<\/h1>/);
  assert.match(renderRoute(parseRoute('/nosotros'), data, options).html, /<h1>About<\/h1>/);
});

test('el respaldo español conserva objetos anidados y títulos de rutas desconocidas', () => {
  const catalogs = { es, en: { views: { records: { statisticsTitle: undefined,
    boardTitles: { gamesPlayed: 'Games played' } } } } };
  const records = resolveViewMessages('records', 'en', catalogs);
  assert.equal(records.boardTitles.gamesPlayed, 'Games played');
  assert.equal(records.boardTitles.gamesWon, es.views.records.boardTitles.gamesWon);
  assert.equal(records.statisticsTitle, es.views.records.statisticsTitle);
  assert.equal(renderRoute(parseRoute('/'), data, { locale: 'fr', catalogs }).title,
    renderRoute(parseRoute('/'), data).title);
  assert.equal(renderRoute(parseRoute('/ruta-inexistente'), data, { locale: 'fr', catalogs }).title,
    'Página no encontrada');
});

test('el 404 traduce etiquetas y escapa contenido de un catálogo externo', () => {
  const catalogs = { es, en: {
    'notFound.title': 'Missing page',
    'notFound.body': '<img src=x onerror=alert(1)>',
    'notFound.home': 'Back home',
  } };
  const page = renderRoute(parseRoute('/no-existe'), data, { locale: 'en', catalogs });
  assert.equal(page.title, 'Missing page');
  assert.match(page.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(page.html, /<img/);
  assert.match(page.html, /href="\/">Back home<\/a>/);
});

test('la portada estadística no carga el problema de ajedrez', () => {
  const catalogs = { es, en: { views: { puzzle: {
    title: 'Mate in one', instructions: 'Enter a UCI move.',
    initialFeedback: 'Choose a move.',
    correctFeedback: (notation) => `Solved: ${notation}`,
  } } } };
  const html = renderRoute(parseRoute('/'), data, { locale: 'en', catalogs }).html;
  assert.doesNotMatch(html, /data-puzzle-host|Mate in one|Enter a UCI move/);
  assert.match(html, /<h1>Estadísticas y récords<\/h1>/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, routeHref } from '../dist/router.js';

test('reconoce rutas públicas de listado, detalle y contenido', () => {
  const cases = [
    ['/', 'home', {}], ['/torneos', 'tournaments', {}],
    ['/torneos/torneo-de-primavera', 'tournament', { slug: 'torneo-de-primavera' }],
    ['/anual/26-27', 'annual', { seasonId: '26-27' }],
    ['/jugadores', 'players', {}], ['/jugadores/ana-silva', 'player', { slug: 'ana-silva' }],
    ['/estadisticas', 'statistics', {}], ['/clasicos', 'classics', {}],
    ['/clasicos/ana-silva/leo-ríos', 'classic', { first: 'ana-silva', second: 'leo-ríos' }],
    ['/nosotros', 'about', {}], ['/novedades', 'news', {}],
    ['/novedades/primera-ronda', 'news-detail', { slug: 'primera-ronda' }],
    ['/clases', 'classes', {}], ['/socios', 'membership', {}],
    ['/partidas/p-1', 'game', { id: 'p-1' }],
  ];
  for (const [pathname, name, params] of cases) {
    const actual = parseRoute(pathname);
    assert.equal(actual.name, name, pathname);
    assert.deepEqual(actual.params, params, pathname);
  }
});

test('búsqueda GET de jugadores y query codificada', () => {
  assert.deepEqual(parseRoute('/jugadores', '?q=Ana+Silva').query, { q: 'Ana Silva' });
  assert.deepEqual(parseRoute('/jugadores', '?q=%20%20').query, { q: '' });
  assert.equal(routeHref('players', {}, { q: 'Ana & Leo' }), '/jugadores?q=Ana+%26+Leo');
  assert.equal(routeHref('players', {}, { q: '' }), '/jugadores');
  assert.equal(parseRoute('/torneos', '?q=Ana').query.q, undefined);
});

test('los filtros de torneos tipo/temporada hacen roundtrip en URL compartible', () => {
  const query = { tipo: 'interno', temporada: '25-26' };
  assert.deepEqual(parseRoute('/torneos', '?tipo=interno&temporada=25-26').query, query);
  const url = routeHref('tournaments', {}, query);
  assert.equal(url, '/torneos?tipo=interno&temporada=25-26');
  const [pathname, search] = url.split('?');
  assert.deepEqual(parseRoute(pathname, `?${search}`).query, query);
  assert.equal(routeHref('tournaments', {}, { tipo: '', temporada: '' }), '/torneos');
});

test('filtros inválidos o excesivos nunca se reflejan y enlaces inválidos se rechazan', () => {
  assert.deepEqual(parseRoute('/torneos', '?tipo=%3Cscript%3E&temporada=../../').query, { tipo: '', temporada: '' });
  assert.deepEqual(parseRoute('/torneos', `?tipo=${'a'.repeat(49)}&temporada=${'2'.repeat(49)}`).query, { tipo: '', temporada: '' });
  assert.throws(() => routeHref('tournaments', {}, { tipo: '<script>' }), TypeError);
  assert.throws(() => routeHref('tournaments', {}, { temporada: 'a'.repeat(49) }), TypeError);
  assert.throws(() => routeHref('tournaments', {}, { tipo: '../otro' }), TypeError);
});

test('URLs generadas hacen roundtrip y codifican identificadores Unicode', () => {
  for (const [name, params] of [
    ['tournament', { slug: 'copa-morra' }],
    ['annual', { seasonId: '26-27' }],
    ['player', { slug: 'leo-ríos' }],
    ['classic', { first: 'leo-ríos', second: 'ana-silva' }],
    ['news-detail', { slug: 'crónica-de-otoño' }],
    ['game', { id: 'p-1' }],
  ]) {
    const url = routeHref(name, params);
    assert.equal(parseRoute(url).name, name);
    assert.deepEqual(parseRoute(url).params, params);
  }
  assert.equal(routeHref('player', { slug: 'leo-ríos' }), '/jugadores/leo-r%C3%ADos');
});

test('rutas desconocidas y segmentos peligrosos dan 404 sin reflejar entrada', () => {
  for (const pathname of [
    '/desconocida', '/torneos/', '/torneos/a/b', '/jugadores/%2F',
    '/jugadores/%252F', '/jugadores/%2E%2E', '/jugadores/%00',
    '/jugadores/NOMBRE', '/jugadores/nombre%20otro', '/jugadores/%E0%A4%A',
  ]) {
    assert.deepEqual(parseRoute(pathname), { name: 'not-found', params: {}, query: {} }, pathname);
  }
  for (const slug of ['../admin', 'dos palabras', 'MAYUSCULA', 'a%2Fb', '']) {
    assert.throws(() => routeHref('player', { slug }), TypeError);
  }
  assert.throws(() => routeHref('missing'), TypeError);
});

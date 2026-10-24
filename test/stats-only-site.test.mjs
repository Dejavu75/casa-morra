import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as demo from '../dist/data/demo.js';
import { parseRoute } from '../dist/router.js';
import { renderRoute, resolvePublicRoute } from '../dist/assets/app.js';

const read = (path) => readFile(new URL(`../dist/${path}`, import.meta.url), 'utf8');

test('la portada pública presenta las diez estadísticas y ningún acceso a otras secciones', () => {
  const home = renderRoute(parseRoute('/'), demo);
  const statistics = renderRoute(parseRoute('/estadisticas'), demo);
  assert.equal(home.title, statistics.title);
  assert.equal((home.html.match(/data-record-id=/g) ?? []).length, 10);
  assert.match(home.html, /<h1>Estadísticas y récords<\/h1>/);
  assert.doesNotMatch(home.html, /href="\/(?:torneos|jugadores|clasicos|novedades|clases|nosotros|socios|partidas)/);
});

test('el shell publica solo navegación estadística sin descartar rutas históricas', async () => {
  const html = await read('index.html');
  const nav = html.match(/<nav\b[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? '';
  assert.match(nav, /href="\/estadisticas"/);
  assert.equal((nav.match(/<a\b/g) ?? []).length, 1);
  assert.doesNotMatch(html, /Para consultar torneos, jugadores y partidas/);
  assert.match(renderRoute(parseRoute('/torneos'), demo).html, /<h1\b/);
});

test('las rutas históricas conocidas abren estadísticas y las desconocidas mantienen 404', () => {
  for (const path of ['/torneos', '/jugadores/ayla-neri', '/clasicos', '/novedades', '/clases', '/socios', '/partidas/demo']) {
    const result = resolvePublicRoute(parseRoute(path));
    assert.equal(result.route.name, 'statistics', path);
    assert.equal(result.redirect, true, path);
  }
  for (const path of ['/', '/estadisticas', '/ruta-desconocida', '/jugadores/%3Cscript%3E']) {
    const route = parseRoute(path);
    const result = resolvePublicRoute(route);
    assert.equal(result.route.name, route.name, path);
    assert.equal(result.redirect, false, path);
  }
});

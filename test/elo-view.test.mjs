import test from 'node:test';
import assert from 'node:assert/strict';
import * as demo from '../dist/data/demo.js';
import { parseRoute, routeHref } from '../dist/router.js';
import { renderRoute, resolvePublicRoute } from '../dist/assets/app.js';

test('Elo tiene listado, evolución individual y comparación de jugadores', () => {
  const first = demo.players[0];
  const second = demo.players[1];
  const path = routeHref('elo', {}, { jugador: [first.slug, second.slug] });
  const [pathname, search] = path.split('?');
  const route = parseRoute(pathname, `?${search}`);
  assert.deepEqual(route.query.jugador, [first.slug, second.slug]);
  assert.equal(resolvePublicRoute(route).redirect, false);
  const html = renderRoute(route, demo).html;
  assert.match(html, /<h1>Evolución Elo<\/h1>/);
  assert.match(html, /<svg[^>]+role="img"/);
  assert.match(html, new RegExp(first.name));
  assert.match(html, new RegExp(second.name));
  assert.match(html, /<table/);
  assert.match(html, /Elo interno de demostración/);
  assert.doesNotMatch(html, /\d[.,]\d{1,2}\s*Elo/);
});

test('Elo ignora selecciones ajenas al plantel y muestra un estado sin partidas', () => {
  const route = parseRoute('/elo', '?jugador=inexistente&jugador=%3Cscript%3E');
  const html = renderRoute(route, { ...demo, games: [] }).html;
  assert.doesNotMatch(html, /<svg/);
  assert.match(html, /Todavía no hay partidas elegibles/);
  assert.doesNotMatch(html, /<script>/);
});

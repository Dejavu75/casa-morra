import test from 'node:test';
import assert from 'node:assert/strict';
import * as demo from '../dist/data/demo.js';
import { parseRoute, routeHref } from '../dist/router.js';
import { renderRoute, resolvePublicRoute } from '../dist/assets/app.js';
import { gamePgn } from '../dist/views/encyclopedia.js';

const source = { ...demo };

test('Enciclopedia filtra partidas por jugador y torneo y ofrece PGN solo con jugadas', () => {
  const player = demo.players[0];
  const event = demo.tournaments.find((item) => item.slug === 'apertura-del-patio-2025');
  const url = routeHref('encyclopedia', {}, { jugador: player.slug, torneo: event.slug });
  const [pathname, search] = url.split('?');
  const route = parseRoute(pathname, `?${search}`);
  assert.equal(resolvePublicRoute(route).redirect, false);
  const html = renderRoute(route, source).html;
  assert.match(html, /<h1>Enciclopedia de partidas<\/h1>/);
  for (const heading of ['Rival', 'Torneo', 'Fecha', 'Resultado', 'Archivo PGN']) {
    assert.match(html, new RegExp(`<th scope="col">${heading}`));
  }
  const expected = demo.games.filter((game) => game.tournamentId === event.id &&
    (game.whiteId === player.id || game.blackId === player.id));
  assert.equal((html.match(/data-game-id=/g) ?? []).length, expected.length);
  assert.match(html, /download="[^"]+\.pgn"/);
  assert.match(html, /PGN pendiente/);
  const annotated = expected.find((game) => game.moves?.length);
  const pgn = gamePgn(source, annotated);
  assert.match(pgn, /\[White "[^"]+"\]/);
  assert.match(pgn, /\[Result "(?:1-0|0-1|1\/2-1\/2)"\]/);
  assert.match(pgn, /1\. [A-Za-z]/);
});

test('Enciclopedia nombra la pareja sin filtro y explica la perspectiva del resultado', () => {
  const all = renderRoute(parseRoute('/enciclopedia'), source).html;
  const selected = renderRoute(parseRoute('/enciclopedia', `?jugador=${demo.players[0].slug}`), source).html;
  assert.match(all, /<th scope="col">Blancas — Negras<\/th>/);
  assert.match(selected, /<th scope="col">Rival<\/th>/);
  for (const html of [all, selected]) {
    assert.match(html, /1–0: ganan las blancas; 0–1: ganan las negras/);
  }
  const first = demo.players[0];
  const second = demo.players[1];
  const compared = renderRoute(parseRoute('/comparar', `?primero=${first.slug}&segundo=${second.slug}`), source).html;
  assert.match(compared, /1–0: ganan las blancas; 0–1: ganan las negras/);
});

test('la comparación permite cualquier pareja conocida sin umbral de clásicos', () => {
  const first = demo.players[0];
  const second = demo.players[1];
  const path = routeHref('compare', {}, { primero: first.slug, segundo: second.slug });
  const [pathname, search] = path.split('?');
  const route = parseRoute(pathname, `?${search}`);
  const html = renderRoute(route, source).html;
  assert.equal(resolvePublicRoute(route).redirect, false);
  assert.match(html, /Comparar jugadores/);
  assert.match(html, new RegExp(first.name));
  assert.match(html, new RegExp(second.name));
  assert.match(html, /Blancas/);
  assert.match(html, /Negras/);
  assert.match(html, /Partidas/);
});

test('filtros desconocidos no filtran ni se imprimen como HTML', () => {
  const route = parseRoute('/enciclopedia', '?jugador=%3Cscript%3E&torneo=inexistente');
  const html = renderRoute(route, source).html;
  assert.doesNotMatch(html, /<script>/);
  assert.equal((html.match(/data-game-id=/g) ?? []).length, demo.games.length);
});

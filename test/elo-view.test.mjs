import test from 'node:test';
import assert from 'node:assert/strict';
import * as demo from '../dist/data/demo.js';
import { parseRoute, routeHref } from '../dist/router.js';
import { renderRoute, resolvePublicRoute } from '../dist/assets/app.js';
import { renderElo } from '../dist/views/elo.js';

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

test('cada partida del mismo día ocupa un punto distinguible en la línea Elo', () => {
  const html = renderElo(demo, { jugador: [demo.players[0].slug] }).html;
  const markers = [...html.matchAll(/<circle data-game-id="([^"]+)" data-date="2025-03-15" cx="([^"]+)"/g)];
  assert.equal(markers.length, 5);
  assert.equal(new Set(markers.map(([, , x]) => x)).size, markers.length);
  assert.deepEqual(markers.map(([, , x]) => Number(x)),
    markers.map(([, , x]) => Number(x)).toSorted((a, b) => a - b));
  assert.match(html, /<th scope="col">Partida<\/th>/);
});

test('partidas del mismo día respetan el orden por torneo antes que por ronda', () => {
  const player = demo.players[0];
  const rival = demo.players[1];
  const event = demo.tournaments.find((row) => row.eloEligible);
  const game = demo.games.find((row) => row.tournamentId === event.id);
  const fixture = {
    ...demo,
    tournaments: [{ ...event, id: 'a' }, { ...event, id: 'b' }],
    games: [
      { ...game, id: 'a-r5', tournamentId: 'a', date: '2025-03-15', round: 5,
        whiteId: player.id, blackId: rival.id, result: '1-0' },
      { ...game, id: 'b-r1', tournamentId: 'b', date: '2025-03-15', round: 1,
        whiteId: player.id, blackId: rival.id, result: '0-1' },
    ],
    byes: [], titles: [],
  };
  const html = renderElo(fixture, { jugador: [player.slug] }).html;
  const positions = [...html.matchAll(/<circle data-game-id="(a-r5|b-r1)"[^>]* cx="([^"]+)"/g)]
    .map(([, gameId, x]) => [gameId, Number(x)]);
  assert.deepEqual(positions.map(([gameId]) => gameId), ['a-r5', 'b-r1']);
  assert.ok(positions[0][1] < positions[1][1], 'la línea no debe retroceder en el tiempo');
});

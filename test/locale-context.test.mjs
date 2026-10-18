import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as demo from '../dist/data/demo.js';
import { catalogs as defaults } from '../dist/i18n/index.js';
import { parseRoute } from '../dist/router.js';
import { routeHref } from '../dist/router.js';
import { createViewContext, renderRoute } from '../dist/assets/app.js';
import { attachGameReplay } from '../dist/views/game.js';
import { attachPuzzle } from '../dist/views/puzzle.js';

const catalogs = { ...defaults, en: { 'nav.home': 'Home', views: {
  competitive: { tournaments: 'Events' },
  players: { players: 'Players', noDetail: 'Unavailable', emptyLetter: (letter) => `No players under ${letter}` },
  game: { next: 'Next move', movesCount: (ply, total) => `${ply} of ${total} moves` },
  puzzle: { initialFeedback: 'Choose a move', illegalFeedback: 'Illegal move' },
} } };
const route = (path) => parseRoute(path, '');

test('el locale inyectado atraviesa vistas, fechas, números y fallback español', () => {
  const tournament = renderRoute(route('/torneos'), demo, { locale: 'en-US', catalogs });
  assert.match(tournament.html, /<h1>Events<\/h1>/);
  assert.match(tournament.html, /October 3, 2026/);
  const annual = renderRoute(route('/anual/26-27'), demo, { locale: 'en-US', catalogs });
  assert.match(annual.html, /6\.5/);
  const players = renderRoute(route('/jugadores'), demo, { locale: 'en-US', catalogs });
  assert.match(players.html, /<h1>Players<\/h1>/);
  assert.match(players.html, /No players under G/);
  const spanish = renderRoute(route('/torneos'), demo, { locale: 'fr-FR', catalogs });
  assert.match(spanish.html, /3 de octubre de 2026/);
  assert.match(spanish.html, /<h1>Torneos<\/h1>/);
  assert.match(renderRoute(route('/'), demo, { locale: 'en-US', catalogs }).html, /October 4, 2026/);
  assert.match(renderRoute(route('/novedades'), demo, { locale: 'en-US', catalogs }).html, /October 4, 2026/);
  assert.match(renderRoute(route('/jugadores/ayla-neri'), demo, { locale: 'en-US', catalogs }).html, /October 3, 2026/);
  assert.match(renderRoute(route('/estadisticas'), demo, { locale: 'en-US', catalogs }).html, /Estadísticas y récords/);
  const featured = demo.games.find((row) => row.moves?.length);
  const game = renderRoute(route(routeHref('game', { id: featured.id })), demo, { locale: 'en-US', catalogs });
  assert.match(game.html, /Next move/);
  assert.match(game.html, /[A-Z][a-z]+ \d{1,2}, 2025/);
  const pair = demo.players.slice(0, 2);
  const classic = renderRoute(route(routeHref('classic', { first: pair[0].slug, second: pair[1].slug })), demo, { locale: 'en-US', catalogs });
  assert.match(classic.html, /March 15, 2025/);
  assert.match(classic.html, /G-E-P/);
});

test('el contexto mantiene los mensajes inyectados en puzzle y replay interactivos', () => {
  const context = createViewContext('en-US', catalogs);
  const puzzleHandlers = new Map();
  const host = {
    innerHTML: '',
    addEventListener(name, handler) { puzzleHandlers.set(name, handler); },
    removeEventListener(name) { puzzleHandlers.delete(name); },
    querySelector(selector) { return selector === '[data-puzzle-input]'
      ? { value: 'e2e2', focus() {} } : { focus() {} }; },
  };
  const detachPuzzle = attachPuzzle(host, { messages: context.messages('puzzle') });
  assert.match(host.innerHTML, /Choose a move/);
  puzzleHandlers.get('submit')({ target: { matches: () => true }, preventDefault() {} });
  assert.match(host.innerHTML, /Illegal move/);
  detachPuzzle();

  const game = demo.games.find((row) => row.moves?.length);
  let replayHandler;
  const root = {
    dataset: { gameId: game.id, ply: '0' }, innerHTML: '',
    addEventListener(_name, handler) { replayHandler = handler; },
    removeEventListener() { replayHandler = null; },
    querySelector() { return { focus() {} }; },
  };
  const detachReplay = attachGameReplay(root, demo, game.id, context.messages('game'));
  replayHandler({ target: { closest: () => ({ dataset: { replayAction: 'next' } }) } });
  assert.match(root.innerHTML, /1 of 16 moves/);
  assert.match(root.innerHTML, />Next move<\/button>/);
  detachReplay();
  const app = readFileSync(fileURLToPath(new URL('../dist/assets/app.js', import.meta.url)), 'utf8');
  assert.match(app, /attachGameReplay\([^;]+messages\('game'\)/);
  assert.match(app, /attachPuzzle\([^;]+messages\('puzzle'\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as demo from '../dist/data/demo.js';
import { hasDemoReplay, renderGame } from '../dist/views/game.js';

test('Escape cierra un disclosure abierto y devuelve foco al botón', async () => {
  const { closeMenuOnEscape } = await import('../dist/assets/app.js');
  let expanded = true;
  let focused = false;
  let prevented = false;
  const link = {};
  const button = {
    getAttribute: (name) => name === 'aria-expanded' ? String(expanded) : null,
    focus: () => { focused = true; },
  };
  const navigation = { contains: (target) => target === link };
  const event = { key: 'Escape', target: link, preventDefault: () => { prevented = true; } };
  const closed = closeMenuOnEscape(event, button, navigation, () => { expanded = false; });
  assert.equal(closed, true);
  assert.equal(expanded, false);
  assert.equal(focused, true);
  assert.equal(prevented, true);
});

test('Escape no roba foco cuando menú está cerrado o foco fuera del disclosure', async () => {
  const { closeMenuOnEscape } = await import('../dist/assets/app.js');
  let focused = 0;
  let closed = 0;
  const button = { getAttribute: () => 'false', focus: () => { focused++; } };
  const navigation = { contains: () => false };
  const event = { key: 'Escape', target: {}, preventDefault: () => {} };
  assert.equal(closeMenuOnEscape(event, button, navigation, () => { closed++; }), false);
  button.getAttribute = () => 'true';
  assert.equal(closeMenuOnEscape(event, button, navigation, () => { closed++; }), false);
  assert.equal(closeMenuOnEscape({ ...event, key: 'Enter', target: button }, button, navigation, () => { closed++; }), false);
  assert.equal(focused, 0);
  assert.equal(closed, 0);
});

test('controles de reproducción tienen grupo semántico con nombre accesible', () => {
  const data = { ...demo };
  const game = data.games.find(hasDemoReplay);
  assert.ok(game);
  const page = renderGame(data, game.id);
  assert.match(page.html, /<div class="game-controls" role="group" aria-label="[^"]+">/);
});

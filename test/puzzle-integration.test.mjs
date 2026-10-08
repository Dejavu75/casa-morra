import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as demo from '../dist/data/demo.js';
import { renderHome } from '../dist/views/home.js';

const read = (path) => readFile(new URL(`../dist/${path}`, import.meta.url), 'utf8');

test('la portada incorpora el problema original después de la galería', () => {
  const html = renderHome(demo, { today: '2026-10-07' }).html;
  assert.match(html, /<div data-puzzle-host><section class="puzzle"/);
  assert.match(html, /Mate en una/);
  assert.ok(html.indexOf('class="home-gallery"') < html.indexOf('data-puzzle-host'));
  assert.ok(html.indexOf('data-puzzle-host') < html.indexOf('class="home-grid"'));
});

test('el shell carga estilo del problema y adjunta y libera sus eventos en navegación', async () => {
  const index = await read('index.html');
  const app = await read('assets/app.js');
  assert.match(index, /<link rel="stylesheet" href="\/views\/puzzle.css">/);
  assert.ok(index.indexOf('/views/content.css') < index.indexOf('/views/puzzle.css'));
  assert.match(app, /import \{ attachPuzzle \} from '\.\.\/views\/puzzle\.js';/);
  assert.match(app, /detachPuzzle\(\);[\s\S]*main\.innerHTML = page\.html/);
  assert.match(app, /route\.name === 'home'[\s\S]*attachPuzzle\(main\.querySelector\('\[data-puzzle-host\]'\),\s*\{/);
});

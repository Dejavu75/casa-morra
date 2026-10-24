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

test('el shell conserva el estilo del problema histórico sin montarlo en portada', async () => {
  const index = await read('index.html');
  const app = await read('assets/app.js');
  assert.match(index, /<link rel="stylesheet" href="\/views\/puzzle.css">/);
  assert.ok(index.indexOf('/views/content.css') < index.indexOf('/views/puzzle.css'));
  assert.doesNotMatch(app, /attachPuzzle\(/);
  assert.match(app, /case 'home': return renderStatistics\(/);
});

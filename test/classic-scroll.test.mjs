import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as demo from '../dist/data/demo.js';
import { renderClassic } from '../dist/views/records.js';

const css = readFileSync(new URL('../dist/assets/site.css', import.meta.url), 'utf8');
const first = demo.players[0];
const second = demo.players[1];

test('la tabla de un clásico conserva caption y encabezados dentro de una región accesible', () => {
  const html = renderClassic(demo, first.slug, second.slug).html;
  assert.match(html, /<div class="classic-table-scroll" role="region" aria-label="Partidas al tablero: [^"]+" tabindex="0"><table><caption>[^<]+: Partidas al tablero<\/caption><thead>/);
  assert.match(html, /<\/tbody><\/table><\/div><a href="\/clasicos">/);
  assert.match(html, /<th scope="col">Fecha<\/th>/);
});

test('la región desplaza la tabla ancha y muestra el foco de teclado', () => {
  assert.match(css, /\.classic-table-scroll\s*\{[^}]*max-width:\s*100%;[^}]*overflow-x:\s*auto;/);
  assert.match(css, /\.classic-table-scroll:focus-visible\s*\{[^}]*outline:/);
  assert.match(css, /\.classic-detail table\s*\{[^}]*min-width:\s*37rem;/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { es } from '../dist/i18n/index.js';
import { renderStatistics } from '../dist/views/records.js';
import * as demo from '../dist/data/demo.js';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('la identidad visible y accesible anuncia Centro de estadísticas', async () => {
  const [publicHtml, adminHtml, app] = await Promise.all([
    read('dist/index.html'), read('admin/index.html'), read('dist/assets/app.js'),
  ]);
  for (const html of [publicHtml, adminHtml]) {
    assert.match(html, /Centro de estadísticas/);
    assert.doesNotMatch(html, /Casa Morra|>CM</);
  }
  assert.match(publicHtml, /aria-label="Centro de estadísticas, ir al inicio"/);
  assert.equal(es['brand.home'], 'Centro de estadísticas, ir al inicio');
  assert.match(app, /Centro de estadísticas/);
  assert.doesNotMatch(app, /Casa Morra/);
});

test('la torre usa barras de color en cabeceras, favicon y emblema grande', async () => {
  const [publicHtml, adminHtml, statsCss] = await Promise.all([
    read('dist/index.html'), read('admin/index.html'), read('dist/assets/stats.css'),
  ]);
  const hero = renderStatistics(demo).html;
  assert.match(publicHtml, /assets\/rook-large\.png/);
  assert.match(adminHtml, /rook-large\.png/);
  assert.match(hero, /assets\/rook-large\.png/);
  assert.match(statsCss, /records-brand-art/);
  for (const name of ['rook-small.png', 'rook-large.png']) {
    const asset = new URL(`../dist/assets/${name}`, import.meta.url);
    const bytes = await readFile(asset);
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.ok((await stat(asset)).size > 10_000);
  }
});

test('la identidad documenta el orden rojo, gris y azul de las barras', async () => {
  const guide = await read('docs/identidad-visual.md');
  assert.match(guide, /partidas perdidas, empatadas y ganadas[^\n]*rojo, gris y azul/i);
  assert.doesNotMatch(guide, /rojo, azul y dorado|barra de ganadas[^\n]*dorado/i);
});

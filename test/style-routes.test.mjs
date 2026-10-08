import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const cssPath = fileURLToPath(new URL('../dist/assets/site.css', import.meta.url));
const heroPath = fileURLToPath(new URL('../dist/assets/hero-ajedrez.png', import.meta.url));

test('la portada usa un hero propio con ilustración PNG local', () => {
  const css = readFileSync(cssPath, 'utf8');
  assert.match(css, /\.content-home \.content-hero\s*\{[^}]*hero-ajedrez\.png/);
  assert.match(css, /\.content-home \.content-hero::before\s*\{[^}]*linear-gradient/);
  const image = readFileSync(heroPath);
  assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.ok(image.readUInt32BE(16) >= 1200);
  assert.ok(image.readUInt32BE(20) >= 800);
});

test('récords y clásicos tienen tablas desplazables y ancho móvil', () => {
  const css = readFileSync(cssPath, 'utf8');
  assert.match(css, /\.records-page,\s*\.classics-page,\s*\.classic-detail\s*\{[^}]*width:/);
  assert.match(css, /\.record-board,\s*\.classic-pair\s*\{[^}]*overflow-x: auto/);
  assert.match(css, /\.record-board table,\s*\.classic-detail table\s*\{[^}]*min-width: 37rem/);
  assert.match(css, /@media \(max-width: 560px\)\s*\{[\s\S]*\.records-page,\s*\.classics-page,\s*\.classic-detail/);
});

test('el CSS de rutas no reintroduce el hero ni el roadmap inactivos', () => {
  const css = readFileSync(cssPath, 'utf8');
  assert.doesNotMatch(css, /(?:^|\n)\.hero\s*\{|\.roadmap-section\s*\{/);
});

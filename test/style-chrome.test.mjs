import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const cssPath = fileURLToPath(new URL('../dist/assets/site.css', import.meta.url));

test('encabezado, navegación y foco de contenido comparten el tema', () => {
  const css = readFileSync(cssPath, 'utf8');
  assert.match(css, /\.site-header\s*\{[\s\S]*background: var\(--indigo-deep\)/);
  assert.match(css, /\.site-nav a\[aria-current="page"\]/);
  assert.match(css, /#contenido:focus\s*\{[\s\S]*outline:/);
});

test('menú y pie responden a pantalla estrecha sin estilos de vistas', () => {
  const css = readFileSync(cssPath, 'utf8');
  assert.match(css, /\.site-footer\s*\{[\s\S]*background: var\(--indigo-deep\)/);
  assert.match(css, /@media \(max-width: 1180px\)\s*\{[\s\S]*\.site-nav\.is-open\s*\{\s*display: flex/);
  assert.match(css, /@media \(max-width: 560px\)\s*\{[\s\S]*\.brand-name\s*\{[\s\S]*font-size: 1\.25rem/);
  assert.doesNotMatch(css, /\.content-home|\.records-page|\.classics-page/);
});

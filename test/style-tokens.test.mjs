import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const cssPath = fileURLToPath(new URL('../dist/assets/site.css', import.meta.url));

test('la base establece paleta y temas sin depender de vistas', () => {
  const css = readFileSync(cssPath, 'utf8');
  assert.match(css, /:root\s*\{[\s\S]*--font-serif:/);
  assert.match(css, /:root\[data-theme="oscuro"\]\s*\{[\s\S]*--surface:/);
  assert.match(css, /body\s*\{[\s\S]*background: var\(--surface\)/);
});

test('tipografía, foco y movimiento reducido son globales', () => {
  const css = readFileSync(cssPath, 'utf8');
  assert.match(css, /h2,\s*h3\s*\{[\s\S]*font-family: var\(--font-serif\)/);
  assert.match(css, /h2 em\s*\{[\s\S]*color: var\(--accent-text\)/);
  assert.match(css, /\.skip-link:focus\s*\{[\s\S]*top: 1rem/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*scroll-behavior: auto/);
});

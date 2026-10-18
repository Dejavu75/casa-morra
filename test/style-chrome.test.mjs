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
});

test('el menú conserva su nombre accesible en pantallas de 320 píxeles', () => {
  const css = readFileSync(cssPath, 'utf8');
  const html = readFileSync(fileURLToPath(new URL('../dist/index.html', import.meta.url)), 'utf8');
  assert.match(html, /<span data-i18n="nav\.menu">Menú<\/span>/);
  const compact = css.match(/@media \(max-width: 350px\)\s*\{\s*\.menu-toggle \[data-i18n="nav\.menu"\]\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(compact, /position:\s*absolute/);
  assert.match(compact, /clip-path:\s*inset\(50%\)/);
});

test('el botón de actualización conserva su estilo y los controles nativos comparten foco visible', () => {
  const css = readFileSync(cssPath, 'utf8');
  const control = css.match(/\.demo-source-controls \[data-demo-refresh\]\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(control, /background:\s*var\(--indigo\)/);
  assert.match(control, /color:\s*var\(--paper\)/);
  assert.match(control, /border:\s*1px solid var\(--accent-text\)/);
  assert.match(control, /min-block-size:\s*2\.75rem/);
  assert.match(css, /a:focus-visible,\s*button:focus-visible,\s*input:focus-visible,\s*select:focus-visible,\s*summary:focus-visible\s*\{\s*outline:\s*3px solid var\(--focus\)/);
});

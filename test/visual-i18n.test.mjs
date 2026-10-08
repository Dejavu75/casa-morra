import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');

test('el catálogo español cubre etiquetas visibles y conserva un fallback', async () => {
  const { es, translate, resolveLocale } = await import('../dist/i18n/index.js');
  const html = await read('dist/index.html');
  const keys = [...html.matchAll(/data-i18n(?:-aria|-placeholder)?="([^"]+)"/g)].map((match) => match[1]);

  assert.ok(keys.length >= 12, 'la portada debe declarar sus etiquetas traducibles');
  for (const key of keys) assert.ok(es[key], `falta traducción: ${key}`);
  assert.equal(resolveLocale('en'), 'es');
  assert.equal(translate('nav.home', 'en'), es['nav.home']);
  assert.equal(translate('not.available', 'en'), 'not.available');
  assert.match(html, /<html lang="es">/);
  assert.match(html, /<title>Casa Morra/);
  assert.match(html, /Datos de demostración/);
});

test('el selector de tema persiste una preferencia propia y tolera almacenamiento indisponible', async () => {
  const { THEME_KEY, readTheme, nextTheme } = await import('../dist/assets/theme.js');
  assert.equal(THEME_KEY, 'casa-morra:tema');
  assert.equal(nextTheme('claro'), 'oscuro');
  assert.equal(nextTheme('oscuro'), 'claro');
  assert.equal(readTheme({ getItem: () => 'oscuro' }), 'oscuro');
  assert.equal(readTheme({ getItem: () => 'invalido' }), null);
  assert.equal(readTheme({ getItem: () => { throw new Error('bloqueado'); } }), null);
  const html = await read('dist/index.html');
  const css = await read('dist/assets/site.css');
  assert.match(html, /data-theme-toggle/);
  assert.match(css, /data-theme="oscuro"/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /:focus-visible/);
});

test('los pares principales de texto y fondo cumplen 4,5:1 sin usar cobre como texto', async () => {
  const css = await read('dist/assets/site.css');
  assert.match(css, /--surface-light:\s*#f5f0e6/i);
  assert.match(css, /--surface-dark:\s*#17213a/i);
  assert.match(css, /--text-light:\s*#202633/i);
  assert.match(css, /--text-dark:\s*#fffdf8/i);
  const luminance = (hex) => {
    const channels = hex.match(/[\da-f]{2}/gi).map((part) => parseInt(part, 16) / 255);
    const [r, g, b] = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => {
    const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (values[0] + 0.05) / (values[1] + 0.05);
  };
  assert.ok(contrast('202633', 'f5f0e6') >= 4.5);
  assert.ok(contrast('fffdf8', '17213a') >= 4.5);
  assert.ok(contrast('fffdf8', '111a2c') >= 4.5);
  assert.doesNotMatch(css, /color:\s*var\(--copper\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const text = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('el documento inicial identifica los datos incluidos aunque no haya JavaScript', async () => {
  const html = await text('../dist/index.html');
  assert.match(html, /data-demo-status[^>]+role="status"[^>]*>Datos de ejemplo del sitio<\/p>/);
  assert.match(html, /data-demo-warning[^>]+hidden/);
  assert.match(html, /<summary[^>]+data-i18n="demo\.sourceDetails"/);
  assert.match(html, /<main id="contenido">[\s\S]*se necesita JavaScript/);
});

test('el estado de la fuente usa el catálogo y conserva el aviso completo', async () => {
  const [app, catalog] = await Promise.all([
    text('../dist/assets/app.js'), text('../dist/i18n/index.js'),
  ]);
  assert.match(catalog, /'demo\.status\.fixture':/);
  assert.match(catalog, /'demo\.status\.export':/);
  assert.match(catalog, /'demo\.status\.unavailable': 'Actualización fallida; datos de ejemplo'/);
  assert.match(catalog, /'demo\.sourceDetails':/);
  assert.match(app, /state\.warning\s*\?\s*'demo\.status\.unavailable'/);
  assert.match(app, /warning\.hidden = !state\.warning/);
  assert.match(app, /renderLocation\(\);\s*void source\.refresh\(\)/);
});

test('los controles reservan espacio para el aviso sin desplazar la página al fallar', async () => {
  const css = await text('../dist/assets/site.css');
  assert.match(css, /\.demo-source-controls\s*\{[^}]*display:\s*grid;/);
  assert.match(css, /\.demo-source-controls\s*\{[^}]*grid-template-rows:\s*[^;]*minmax\(/);
  assert.match(css, /\.demo-source-controls \[role="status"\]\s*\{[^}]*min-block-size:/);
  assert.match(css, /\.demo-source-controls \[data-demo-warning\]\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/);
});

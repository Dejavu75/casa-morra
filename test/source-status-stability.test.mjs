import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const text = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('el documento inicial no ocupa espacio con un estado de fuente normal', async () => {
  const html = await text('../dist/index.html');
  assert.match(html, /data-demo-alert hidden/);
  assert.doesNotMatch(html, /data-demo-status|Exportación pública verificada|Datos de demostración/);
  assert.match(html, /data-demo-warning[^>]+role="status"[^>]+hidden/);
  assert.match(html, /<summary[^>]+data-i18n="demo\.sourceDetails"/);
  assert.match(html, /<main id="contenido">[\s\S]*se necesita JavaScript/);
});

test('la falla de actualización mantiene un aviso sin etiquetas de demostración', async () => {
  const [app, catalog] = await Promise.all([
    text('../dist/assets/app.js'), text('../dist/i18n/index.js'),
  ]);
  assert.match(catalog, /'demo\.status\.unavailable': 'No se pudo actualizar la información'/);
  assert.match(catalog, /'demo\.sourceDetails':/);
  assert.match(app, /sourceAlert\.hidden = !state\.warning/);
  assert.match(app, /warning\.hidden = !state\.warning/);
  assert.match(app, /renderLocation\(\);\s*void source\.refresh\(\)/);
});

test('la interfaz carga los datos sin barra permanente ni recarga manual', async () => {
  const app = await text('../dist/assets/app.js');
  assert.doesNotMatch(app, /sourceStatus|onPending\(\)/);
  assert.doesNotMatch(app, /refreshButton|data-demo-refresh/);
  assert.match(app, /void source\.refresh\(\)/);
});

test('el aviso oculto no reserva espacio en la página', async () => {
  const css = await text('../dist/assets/stats.css');
  assert.match(css, /\.stats-only \.demo-source-controls\[hidden\]\s*\{\s*display:\s*none;/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../dist/${path}`, import.meta.url), 'utf8');

test('el Centro de estadísticas usa azul marino y blanco sin el verde anterior', async () => {
  const css = await read('assets/stats.css');
  assert.match(css, /--indigo:\s*#1d2a5f/i);
  assert.match(css, /--indigo-deep:\s*#17213a/i);
  assert.match(css, /--paper:\s*#ffffff/i);
  assert.match(css, /linear-gradient\([^)]*#1d2a5f/i);
  assert.doesNotMatch(css, /#193a36|#102c2a|#29584d|#4d6b58/i);
});

test('la navegación completa usa menú accesible en pantallas estrechas', async () => {
  const html = await read('index.html');
  const css = await read('assets/stats.css');
  assert.match(html, /data-menu-toggle[^>]*aria-expanded="false"/);
  assert.match(css, /@media \(max-width: 1180px\)[\s\S]*\.stats-only \.site-nav\.is-open/);
  assert.doesNotMatch(css, /@media \(max-width: 1180px\)[\s\S]*\.stats-only \.site-nav\s*\{[^}]*display:\s*flex/);
});

test('las páginas de datos limitan los encabezados secundarios para mantener la tabla visible', async () => {
  for (const file of ['views/elo.css', 'views/encyclopedia.css'])
    assert.match(await read(file), /h2\s*\{[^}]*font-size:\s*clamp\(1\.5rem, 3vw, 2\.5rem\)/);
});

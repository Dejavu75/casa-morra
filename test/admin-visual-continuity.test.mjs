import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../admin/${path}`, import.meta.url), 'utf8');

test('el administrador comparte la paleta y los controles del Centro de estadísticas público', async () => {
  const css = await read('admin.css');
  assert.match(css, /--indigo:\s*#1d2a5f/i);
  assert.match(css, /--indigo-deep:\s*#17213a/i);
  assert.match(css, /--surface:\s*#f7f8fb/i);
  assert.match(css, /--paper:\s*#ffffff/i);
  assert.match(css, /\.masthead\s*\{[^}]*background:\s*var\(--indigo-deep\)/);
  assert.match(css, /\.panel\s*\{[^}]*background:\s*var\(--paper\)/);
  assert.match(css, /button\s*\{[^}]*background:\s*var\(--indigo\)/);
  assert.doesNotMatch(css, /#203e40|#25595a|#f2f0e9|#ba7259|#f1b28e/i);
});

test('la cabecera administrativa utiliza la misma torre coloreada y nombre de marca', async () => {
  const html = await read('index.html');
  assert.match(html, /class="brand-mark"[^>]*src="\/rook-large\.png\?v=0\.10\.3-rgb"/);
  assert.match(html, /class="brand-name"[^>]*>Centro de estadísticas<\/span>/);
  assert.match(html, /Administración local/);
  assert.match(html, /id="login-form"/);
  assert.match(html, /id="create-form"/);
  assert.match(html, /id="complete-form"/);
});

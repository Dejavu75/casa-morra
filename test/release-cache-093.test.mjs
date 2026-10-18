import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('la entrega 0.9.3 identifica las entradas y hojas de estilo modificadas', async () => {
  const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  for (const asset of ['assets/site.css', 'views/players.css', 'views/content.css', 'assets/app.js']) {
    assert.match(html, new RegExp(`(?:href|src)="/${asset.replace('.', '\\.') }\\?v=0\\.9\\.3-demo"`), asset);
  }
  assert.match(html, /href="\/favicon\.svg"/);
});

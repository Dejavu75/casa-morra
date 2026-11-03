import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('la identidad propia anuncia la torre de barras coloreadas como favicon real', () => {
  const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  const admin = readFileSync(new URL('../admin/index.html', import.meta.url), 'utf8');
  const png = readFileSync(new URL('../dist/assets/rook-large.png', import.meta.url));
  assert.match(html, /<link rel="icon" type="image\/png" href="\/assets\/rook-large\.png">/);
  assert.match(admin, /<link rel="icon" type="image\/png" href="\/rook-large\.png">/);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.doesNotMatch(html, /favicon\.svg|\bCM\b/);
});

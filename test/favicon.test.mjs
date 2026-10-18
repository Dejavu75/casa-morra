import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('la identidad propia anuncia un favicon SVG servido como recurso real', () => {
  const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  const svg = readFileSync(new URL('../dist/favicon.svg', import.meta.url), 'utf8');
  assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="\/favicon\.svg">/);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 48 48"/);
  assert.match(svg, /Casa Morra/);
  assert.match(svg, /#111a2c/);
  assert.match(svg, /#f5f0e6/);
  assert.doesNotMatch(svg, /<script|(?:href|xlink:href)="https?:/i);
});

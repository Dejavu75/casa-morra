import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const artifacts = new Map([
  ['dist/data/demo.js', '321C96B848642A63FE59CE0210FAB1054DC796B6949FDC24843539C2BA4345F6'],
  ['dist/assets/hero-ajedrez.png', '17FD0E195F23D3E83E463880899EBE99ACC931B7E948F1CFCD4E33774614E11F'],
  ['dist/assets/galeria-estudio.png', '6F4879D1DC92FBD354C14DB0F7D971EFB4538C99889CBD661C3F619801103429'],
  ['dist/assets/galeria-sala.png', '7AA62F2D1CA5233418E1C95B66F9DBB75375740A6B844AC677F996FE0D9FB36D'],
]);

test('la procedencia publicada identifica exactamente los cuatro artefactos demo', async () => {
  const document = await readFile('docs/procedencia-demo.md', 'utf8');
  const rows = [...document.matchAll(/^\| `([^`]+)` \| `([A-F0-9]{64})` \|/gm)];
  assert.equal(rows.length, artifacts.size);

  for (const [path, expected] of artifacts) {
    const matches = rows.filter((row) => row[1] === path);
    assert.equal(matches.length, 1, `falta o se duplicó ${path}`);
    assert.equal(matches[0][2], expected, `el manifiesto cambió para ${path}`);
    const bytes = await readFile(path);
    assert.equal(createHash('sha256').update(bytes).digest('hex').toUpperCase(), expected,
      `el archivo cambió para ${path}`);
  }

  const readme = await readFile('README.md', 'utf8');
  assert.match(readme, /\[procedencia de los datos y recursos demo\]\(docs\/procedencia-demo\.md\)/);
  assert.match(document, /comparación acotada/i);
  assert.match(document, /metadatos de Git/i);
});

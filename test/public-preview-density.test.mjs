import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as demo from '../dist/data/demo.js';
import { encodeDemoSnapshot } from '../scripts/demo-snapshot.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => readFile(path.join(root, name), 'utf8');

test('la vista pública conserva cifras sin avisos de datos ficticios', async () => {
  const files = [
    'dist/index.html', 'dist/i18n/index.js', 'dist/views/common.js',
    'dist/views/players.js', 'dist/views/records.js', 'dist/views/tournaments.js',
    'dist/views/annual.js', 'dist/views/elo.js', 'dist/views/encyclopedia.js',
    'dist/views/game.js', 'admin/index.html',
  ];
  for (const name of files) {
    const source = await read(name);
    assert.doesNotMatch(source, /exportación pública verificada|datos? (?:ficticios?|de demostración|de ejemplo|demo)|(?:cifras|contenido|torneos?|padrón|perfil) fictici[oa]s?|elo demo/i, name);
  }
  const snapshot = JSON.parse(encodeDemoSnapshot(demo));
  assert.equal(snapshot.classification, 'public-demo');
  assert.ok(snapshot.data.players.length > 0);
  assert.ok(snapshot.data.games.length > 0);
});

test('las páginas de consulta usan una escala compacta y clásicos en grilla adaptable', async () => {
  const css = await read('dist/assets/stats.css');
  assert.match(css, /\.stats-only #contenido\s*\{[^}]*min-height:\s*0/);
  assert.match(css, /\.stats-only \.classics-page[^\{]*\{[^}]*padding-block:\s*clamp\(/);
  assert.match(css, /\.stats-only \.classics-list\s*\{[^}]*display:\s*grid/);
  assert.match(css, /@media \(max-width:\s*\d+px\)[\s\S]*?\.stats-only \.classics-list\s*\{[^}]*grid-template-columns:\s*1fr/);
});

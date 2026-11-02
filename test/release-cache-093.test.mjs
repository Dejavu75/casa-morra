import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('la entrega actual identifica las entradas nuevas y conserva hojas versionadas anteriores', async () => {
  const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  for (const asset of ['assets/site.css', 'assets/stats.css', 'assets/app.js'])
    assert.match(html, new RegExp(`(?:href|src)="/${asset.replace('.', '\\.') }\\?v=0\\.10\\.0-demo"`), asset);
  for (const asset of ['views/players.css', 'views/content.css'])
    assert.match(html, new RegExp(`href="/${asset.replace('.', '\\.') }\\?v=0\\.9\\.3-demo"`), asset);
  assert.match(html, /href="\/favicon\.svg"/);
});

test('la entrega 0.9.3 versiona todo el grafo de módulos modificados', async () => {
  const imports = {
    'assets/app.js': [
      '../i18n/index.js', '../views/annual.js', '../views/players.js',
      '../views/records.js', '../views/editorial.js',
    ],
    'i18n/index.js': [
      '../views/players.js', '../views/records.js', '../views/home.js', '../views/editorial.js',
    ],
    'views/annual.js': ['../domain/statistics.js'],
    'views/home.js': ['../domain/statistics.js'],
    'views/players.js': ['../domain/statistics.js'],
    'views/records.js': ['../domain/statistics.js'],
  };
  for (const [module, dependencies] of Object.entries(imports)) {
    const source = await readFile(new URL(`../dist/${module}`, import.meta.url), 'utf8');
    for (const dependency of dependencies) {
      assert.ok(source.includes(`from '${dependency}?v=0.9.3-demo'`), `${module} → ${dependency}`);
    }
  }
});

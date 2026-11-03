import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('la identidad nueva versiona las entradas y conserva hojas no modificadas', async () => {
  const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  for (const asset of ['assets/site.css', 'assets/stats.css'])
    assert.match(html, new RegExp(`href="/${asset.replace('.', '\\.') }\\?v=0\\.10\\.2-red"`), asset);
  assert.match(html, /src="\/assets\/app\.js\?v=0\.10\.3-rgb"/);
  for (const asset of ['views/players.css', 'views/content.css'])
    assert.match(html, new RegExp(`href="/${asset.replace('.', '\\.') }\\?v=0\\.9\\.3-demo"`), asset);
  assert.match(html, /href="\/assets\/rook-large\.png\?v=0\.10\.3-rgb"/);
});

test('la identidad nueva versiona todo el grafo de módulos modificados', async () => {
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
      const version = dependency.startsWith('../domain/') ? '0.9.3-demo' :
        module === 'assets/app.js' && dependency === '../views/records.js' ? '0.10.3-rgb' : '0.10.1-brand';
      assert.ok(source.includes(`from '${dependency}?v=${version}'`), `${module} → ${dependency}`);
    }
  }
});

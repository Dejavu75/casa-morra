import test from 'node:test';
import assert from 'node:assert/strict';
import { get } from 'node:http';
import { gunzipSync } from 'node:zlib';

const baseUrl = process.env.CASA_MORRA_TEST_URL;
const runtimeTest = baseUrl ? test : test.skip;

function request(path, acceptEncoding = 'identity') {
  return new Promise((resolve, reject) => {
    get(new URL(path, baseUrl), { headers: { 'Accept-Encoding': acceptEncoding } }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks),
      }));
      response.on('error', reject);
    }).on('error', reject);
  });
}

runtimeTest('HTML, CSS y JavaScript se sirven comprimidos sin alterar sus bytes', async () => {
  for (const path of ['/', '/assets/site.css', '/assets/app.js', '/data/demo.js']) {
    const [identity, compressed] = await Promise.all([
      request(path), request(path, 'gzip'),
    ]);
    assert.equal(identity.status, 200, `${path} sin compresión`);
    assert.equal(compressed.status, 200, `${path} con gzip`);
    assert.equal(identity.headers['content-encoding'], undefined, path);
    assert.equal(compressed.headers['content-encoding'], 'gzip', path);
    assert.match(compressed.headers.vary ?? '', /Accept-Encoding/i, path);
    assert.deepEqual(gunzipSync(compressed.body), identity.body, path);
    assert.ok(compressed.body.length < identity.body.length, path);
  }
});

runtimeTest('PNG conserva su codificación y no recibe gzip', async () => {
  const image = await request('/assets/hero-ajedrez.png', 'gzip');
  assert.equal(image.status, 200);
  assert.match(image.headers['content-type'] ?? '', /image\/png/);
  assert.equal(image.headers['content-encoding'], undefined);
  assert.ok(image.body.length > 0);
});

runtimeTest('HTML y módulos usados por la entrega exigen revalidación de caché', async () => {
  for (const path of ['/', '/assets/site.css?v=0.9.3-demo',
    '/views/players.css?v=0.9.3-demo', '/views/content.css?v=0.9.3-demo',
    '/assets/app.js?v=0.9.3-demo', '/i18n/index.js?v=0.9.3-demo',
    '/views/annual.js?v=0.9.3-demo', '/views/players.js?v=0.9.3-demo',
    '/views/records.js?v=0.9.3-demo', '/views/home.js?v=0.9.3-demo',
    '/views/editorial.js?v=0.9.3-demo', '/domain/statistics.js?v=0.9.3-demo',
    '/views/records.js?v=0.9.2-demo',
    '/assets/site.css?v=0.9.2-demo', '/assets/app.js?v=0.9.2-demo']) {
    const response = await request(path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers['cache-control'] ?? '', /(?:^|,)\s*no-cache\s*(?:,|$)/i, path);
    assert.equal(response.headers['x-content-type-options'], 'nosniff', path);
  }
  const entry = await request('/estadisticas?entrega=0.9.3-demo');
  assert.equal(entry.status, 200);
  assert.match(entry.headers['cache-control'] ?? '', /no-cache/i);
  assert.match(entry.body.toString('utf8'), /src="\/assets\/app\.js\?v=0\.9\.3-demo"/);
});

runtimeTest('rutas profundas, 404 y cabeceras de seguridad permanecen intactos', async () => {
  const [root, deep, missingAsset, missingModule] = await Promise.all([
    request('/', 'gzip'),
    request('/torneos/demo', 'gzip'),
    request('/assets/no-existe.js', 'gzip'),
    request('/data/no-existe.js', 'gzip'),
  ]);
  assert.equal(deep.status, 200);
  assert.equal(deep.headers['content-encoding'], 'gzip');
  assert.deepEqual(gunzipSync(deep.body), gunzipSync(root.body));
  assert.equal(missingAsset.status, 404);
  assert.equal(missingModule.status, 404);
  for (const response of [root, deep, missingAsset, missingModule]) {
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    assert.equal(response.headers['x-frame-options'], 'DENY');
    assert.match(response.headers['content-security-policy'] ?? '', /default-src 'none'/);
  }
});

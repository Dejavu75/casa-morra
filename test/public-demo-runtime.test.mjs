import assert from 'node:assert/strict';
import { get } from 'node:http';
import test from 'node:test';

const baseUrl = process.env.CASA_MORRA_TEST_URL;
const expected = process.env.CASA_MORRA_PUBLIC_EXPECT;
const runtimeTest = baseUrl && ['missing', 'present'].includes(expected) ? test : test.skip;

function request(path) {
  return new Promise((resolve, reject) => {
    get(new URL(path, baseUrl), (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode,
        headers: response.headers, body: Buffer.concat(chunks) }));
      response.on('error', reject);
    }).on('error', reject);
  });
}

runtimeTest('solo la ruta exacta publica el snapshot y nunca expone el almacén privado', async () => {
  const publicResponse = await request('/demo/snapshot.json');
  assert.equal(publicResponse.status, expected === 'present' ? 200 : 404);
  assert.equal(publicResponse.headers['cache-control'], 'no-store');
  assert.equal(publicResponse.headers['x-content-type-options'], 'nosniff');
  assert.equal(publicResponse.headers['x-frame-options'], 'DENY');
  assert.match(publicResponse.headers['content-security-policy'] ?? '', /default-src 'none'/);

  if (expected === 'present') {
    assert.match(publicResponse.headers['content-type'] ?? '', /application\/json/);
    const value = JSON.parse(publicResponse.body.toString('utf8'));
    assert.deepEqual(Object.keys(value), ['format', 'version', 'source', 'snapshot']);
    assert.equal(value.format, 'casa-morra.demo-public');
    assert.equal(value.version, 1);
    assert.ok(value.snapshot.data);
    assert.doesNotMatch(publicResponse.body.toString('utf8'), /"audit"|"afterSnapshot"|"beforeSnapshot"/);
  }

  for (const path of ['/demo/otro.json', '/demo/snapshot.json/otra',
    '/.demo-state/casa-morra.json', '/.demo-public/snapshot.json']) {
    const response = await request(path);
    assert.equal(response.status, 404, path);
    assert.equal(response.headers['x-content-type-options'], 'nosniff', path);
  }
});

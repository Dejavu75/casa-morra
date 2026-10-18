import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);

test('la red host escucha directamente en 8088 y el modo local mantiene la misma URL', async () => {
  const [base, host, nginx, dockerfile] = await Promise.all([
    'compose.yaml', 'compose.host.yaml', 'nginx.conf', 'Dockerfile'
  ].map((path) => readFile(new URL(path, root), 'utf8')));
  assert.match(base, /127\.0\.0\.1:\$\{CASA_MORRA_HTTP_PORT:-8088\}:8088/);
  assert.match(base, /127\.0\.0\.1:8088\/health/);
  assert.match(host, /network_mode:\s*host/);
  assert.match(host, /ports:\s*!reset\s*\[\]/);
  assert.match(nginx, /^\s*listen 8088;/m);
  assert.match(dockerfile, /^EXPOSE 8088$/m);
});

test('la variante host elimina la publicación de puertos sin cambiar la variante local', async () => {
  const base = await readFile(new URL('compose.yaml', root), 'utf8');
  const host = await readFile(new URL('compose.host.yaml', root), 'utf8');
  assert.match(base, /127\.0\.0\.1:\$\{CASA_MORRA_HTTP_PORT:-8088\}:8088/);
  assert.match(host, /network_mode:\s*host/);
  assert.match(host, /ports:\s*!reset\s*\[\]/);
});

const available = spawnSync('docker', ['compose', 'version'], { encoding: 'utf8' });
test('el modelo Compose combinado conserva protecciones y carece de mapeos',
  { skip: available.error ? 'Docker Compose no está disponible' : undefined }, () => {
    const result = spawnSync('docker', ['compose', '-f', 'compose.yaml', '-f', 'compose.host.yaml',
      'config', '--format', 'json'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const web = JSON.parse(result.stdout).services.web;
    assert.equal(web.network_mode, 'host');
    assert.ok(!web.ports?.length);
    assert.match(web.healthcheck.test.join(' '), /127\.0\.0\.1:8088\/health/);
    assert.equal(web.read_only, true);
    assert.deepEqual(web.cap_drop, ['ALL']);
    assert.ok(web.volumes.some((volume) => volume.target === '/srv/casa-morra-public' && volume.read_only));
  });

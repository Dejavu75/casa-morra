import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const composeAvailable = spawnSync('docker', ['compose', 'version'], { encoding: 'utf8' });
const skipCompose = composeAvailable.error || composeAvailable.status !== 0
  ? 'Docker Compose no está disponible'
  : undefined;

function resolvedWeb(files) {
  const result = spawnSync('docker', ['compose', ...files.flatMap((file) => ['-f', file]),
    'config', '--format', 'json'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return JSON.parse(result.stdout).services.web;
}

test('la variante LAN publica únicamente 192.168.0.52:8088',
  { skip: skipCompose }, async () => {
    const override = await readFile(new URL('compose.lan.yaml', root), 'utf8');
    assert.match(override, /ports:\s*!override/);
    const web = resolvedWeb(['compose.yaml', 'compose.lan.yaml']);
    assert.ok(!web.network_mode || web.network_mode !== 'host');
    assert.deepEqual(web.ports, [{
      mode: 'ingress', host_ip: '192.168.0.52', published: '8088', target: 8088,
      protocol: 'tcp'
    }]);
    assert.equal(web.read_only, true);
    assert.deepEqual(web.cap_drop, ['ALL']);
    assert.ok(web.volumes.some((volume) =>
      volume.target === '/srv/casa-morra-public' && volume.read_only));
  });

test('la variante base conserva únicamente el acceso por bucle local',
  { skip: skipCompose }, () => {
    const web = resolvedWeb(['compose.yaml']);
    assert.deepEqual(web.ports, [{
      mode: 'ingress', host_ip: '127.0.0.1', published: '8088', target: 8088,
      protocol: 'tcp'
    }]);
  });

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const domain = 'ingenieros.deyzone.com.ar';
const env = { ...process.env, CASA_MORRA_LAN_IP: '192.0.2.52',
  CASA_MORRA_CERT_ROOT: 'C:/certificados-de-prueba' };
const docker = spawnSync('docker', ['compose', 'version'], { encoding: 'utf8' });
const skipCompose = docker.error || docker.status !== 0 ? 'Docker Compose no está disponible' : undefined;

test('el proxy TLS expone solo 8080 LAN y monta solo el certificado exacto', { skip: skipCompose }, () => {
  const result = spawnSync('docker', ['compose', '-f', 'compose.tls.yaml', 'config', '--format', 'json'],
    { cwd: root, env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const config = JSON.parse(result.stdout);
  const proxy = config.services.proxy;
  assert.deepEqual(proxy.ports, [{ mode: 'ingress', host_ip: '192.0.2.52',
    published: '8080', target: 8443, protocol: 'tcp' }]);
  assert.equal(config.networks.casa_morra.name, 'casa-morra_default');
  assert.equal(config.networks.casa_morra.external, true);
  assert.equal(proxy.read_only, true);
  assert.deepEqual(proxy.cap_drop, ['ALL']);
  assert.deepEqual(proxy.cap_add, ['CHOWN', 'SETGID', 'SETUID']);
  assert.ok(proxy.security_opt.includes('no-new-privileges:true'));
  assert.deepEqual(proxy.volumes.map(({ source, target, read_only }) => ({
    source: source.replaceAll('\\', '/'), target, read_only,
  })), [
    { source: `C:/certificados-de-prueba/live/${domain}`, target: `/etc/letsencrypt/live/${domain}`,
      read_only: true },
    { source: `C:/certificados-de-prueba/archive/${domain}`, target: `/etc/letsencrypt/archive/${domain}`,
      read_only: true },
  ]);
  const source = readFileSync(new URL('../compose.tls.yaml', import.meta.url), 'utf8');
  assert.equal((source.match(/create_host_path:\s*false/g) ?? []).length, 2);
});

test('el activador TLS rechaza direcciones comodín', { skip: skipCompose }, () => {
  for (const ip of ['0.0.0.0', '::']) {
    const result = spawnSync(process.execPath, ['scripts/compose-tls.mjs', 'config'], {
      cwd: root, env: { ...env, CASA_MORRA_LAN_IP: ip }, encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /IP LAN concreta/);
  }
});

test('Nginx usa TLS con el certificado existente y solo enlaza a la web', () => {
  const config = readFileSync(new URL('../tls-proxy.conf', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../nginx-tls-main.conf', import.meta.url), 'utf8');
  const dockerfile = readFileSync(new URL('../Dockerfile.tls', import.meta.url), 'utf8');
  assert.match(config, /listen 8443 ssl;/);
  assert.match(config, /server_name ingenieros\.deyzone\.com\.ar;/);
  assert.match(config, /ssl_certificate \/etc\/letsencrypt\/live\/ingenieros\.deyzone\.com\.ar\/fullchain\.pem;/);
  assert.match(config, /ssl_certificate_key \/etc\/letsencrypt\/live\/ingenieros\.deyzone\.com\.ar\/privkey\.pem;/);
  assert.match(config, /resolver 127\.0\.0\.11 valid=10s ipv6=off;/);
  assert.match(config, /set \$casa_morra_web web:8088;/);
  assert.match(config, /proxy_pass http:\/\/\$casa_morra_web;/);
  assert.doesNotMatch(config, /admin:8090|Strict-Transport-Security/);
  assert.match(main, /^user nginx;/m);
  assert.doesNotMatch(dockerfile, /COPY .*\.pem|ADD .*\.pem/);
});

import { spawnSync } from 'node:child_process';
import { isIP } from 'node:net';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const args = ['compose', '-p', 'casa-morra-tls', '-f', 'compose.tls.yaml'];
const check = spawnSync('docker', [...args, 'config', '--format', 'json'],
  { cwd, encoding: 'utf8' });
if (check.status !== 0) {
  process.stderr.write(check.stderr || check.error?.message || 'Compose no disponible\n');
  process.exit(1);
}
const config = JSON.parse(check.stdout);
const ports = config.services?.proxy?.ports;
const ip = ports?.[0]?.host_ip;
if (ports?.length !== 1 || !isIP(ip) || ip === '0.0.0.0' || ip === '::' ||
    ports[0].published !== '8080' || ports[0].target !== 8443) {
  process.stderr.write('Definir una IP LAN concreta para HTTPS en 8080; no se permiten direcciones comodín.\n');
  process.exit(1);
}
const run = spawnSync('docker', [...args, ...process.argv.slice(2)], { cwd, stdio: 'inherit' });
process.exit(run.status ?? 1);

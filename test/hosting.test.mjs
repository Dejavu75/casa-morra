import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

test('la imagen sirve el sitio como usuario sin privilegios desde una base inmutable', () => {
  const dockerfile = read('Dockerfile');
  const main = read('nginx-main.conf');
  assert.match(dockerfile, /^FROM nginx:stable-alpine@sha256:[a-f0-9]{64}$/m);
  assert.match(dockerfile, /^USER nginx$/m);
  assert.match(dockerfile, /^EXPOSE 8080$/m);
  assert.match(main, /^pid\s+\/tmp\/nginx\.pid;/m);
  assert.match(main, /client_body_temp_path\s+\/tmp\/client_temp;/);
});

test('Compose restringe el servicio al bucle local y a un sistema de archivos de solo lectura', () => {
  const compose = read('compose.yaml');
  assert.match(compose, /127\.0\.0\.1:8088:8080/);
  assert.match(compose, /read_only:\s*true/);
  assert.match(compose, /cap_drop:\s*\n\s*-\s*ALL/);
  assert.match(compose, /no-new-privileges:true/);
  assert.match(compose, /tmpfs:/);
  assert.match(compose, /wget.*127\.0\.0\.1:8080\/health/);
});

test('Nginx entrega rutas SPA, no confunde activos ausentes con HTML y restringe recursos', () => {
  const nginx = read('nginx.conf');
  assert.match(nginx, /listen\s+8080;/);
  assert.match(nginx, /location\s+\^~\s+\/assets\/\s*\{\s*try_files\s+\$uri\s+=404;/);
  assert.match(nginx, /location\s+\/\s*\{\s*try_files\s+\$uri\s+\$uri\/\s+\/index\.html;/);
  for (const directive of ["default-src 'none'", "script-src 'self'", "style-src 'self'", "img-src 'self'", "form-action 'self'"])
    assert.ok(nginx.includes(directive));
  assert.match(nginx, /location\s+=\s+\/health/);
});

test('los módulos y archivos estáticos ausentes no reciben el fallback de la SPA', () => {
  const nginx = read('nginx.conf');
  assert.match(nginx, /location\s+~\s+\^\/\(\?:views\|data\|domain\|i18n\)\/\s*\{\s*try_files\s+\$uri\s+=404;/);
  assert.match(nginx, /location\s+~\*\s+.*js.*css.*\$\s*\{\s*try_files\s+\$uri\s+=404;/);
});

test('el contexto Docker excluye archivos internos y credenciales locales', () => {
  const ignore = read('.dockerignore');
  for (const path of ['.git', '.codegraph', 'test', 'scripts', 'docs', '.env*', 'node_modules'])
    assert.ok(ignore.split(/\r?\n/).includes(path), `falta excluir ${path}`);
});

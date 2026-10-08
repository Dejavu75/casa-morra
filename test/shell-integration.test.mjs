import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { shouldClientNavigate } from '../dist/assets/app.js';

const read = (path) => readFile(new URL(`../dist/${path}`, import.meta.url), 'utf8');

test('el shell ofrece navegación pública y estilos de todas las vistas', async () => {
  const html = await read('index.html');
  for (const href of ['/torneos', '/jugadores', '/estadisticas', '/clasicos', '/novedades', '/clases', '/nosotros', '/socios']) {
    assert.ok(html.includes(`href="${href}"`), href);
  }
  for (const css of ['competitive.css', 'players.css', 'content.css', 'puzzle.css']) {
    assert.ok(html.includes(`/views/${css}`), css);
  }
  assert.match(html, /<main id="contenido"/);
  assert.match(html, /<html lang="es">/);
  assert.doesNotMatch(html, /En preparación|Próximamente/);
});

test('solo intercepta clic principal sin modificadores en enlace interno', () => {
  const anchor = (href, options = {}) => ({
    href: new URL(href, 'http://localhost:8088/').href,
    target: options.target ?? '',
    hasAttribute: (name) => name === 'download' && !!options.download,
    getAttribute: (name) => name === 'href' ? href : null,
  });
  const click = (overrides = {}) => ({ button: 0, defaultPrevented: false,
    metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...overrides });
  const origin = 'http://localhost:8088';
  assert.equal(shouldClientNavigate(click(), anchor('/torneos'), origin), true);
  for (const event of [click({ button: 1 }), click({ ctrlKey: true }), click({ metaKey: true }), click({ shiftKey: true }), click({ altKey: true }), click({ defaultPrevented: true })]) {
    assert.equal(shouldClientNavigate(event, anchor('/torneos'), origin), false);
  }
  assert.equal(shouldClientNavigate(click(), anchor('/torneos', { target: '_blank' }), origin), false);
  assert.equal(shouldClientNavigate(click(), anchor('/torneos', { download: true }), origin), false);
  assert.equal(shouldClientNavigate(click(), anchor('#contenido'), origin), false);
  assert.equal(shouldClientNavigate(click(), anchor('https://example.org/'), origin), false);
});

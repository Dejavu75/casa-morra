import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../dist/${path}`, import.meta.url), 'utf8');

function contrast(foreground, background) {
  const luminance = (hex) => {
    const channels = hex.match(/[\da-f]{2}/gi).map((part) => parseInt(part, 16) / 255);
    const [red, green, blue] = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

test('el shell conserva contenido útil sin JavaScript y reserva la altura visible antes de hidratar', async () => {
  const html = await read('index.html');
  const css = await read('assets/site.css');
  assert.match(html, /<main id="contenido">[\s\S]*<h1 id="fallback-title">Casa Morra<\/h1>/);
  assert.match(html, /Datos de demostración\. Para consultar torneos, jugadores y partidas se necesita JavaScript\./);
  assert.match(css, /#contenido\s*\{[^}]*min-height:\s*100vh;[^}]*min-height:\s*100svh;/);
});

test('el aviso de exportación conserva contraste de texto normal en ambos temas', async () => {
  const css = await read('assets/site.css');
  const light = css.match(/\.demo-source-controls \[role="status"\]\s*\{[^}]*color:\s*(#[\da-f]{6})/i)?.[1];
  const dark = css.match(/:root\[data-theme="oscuro"\] \.demo-source-controls \[role="status"\]\s*\{[^}]*color:\s*(#[\da-f]{6})/i)?.[1];
  assert.ok(light && dark, 'el aviso necesita colores explícitos para los dos fondos');
  assert.ok(contrast(light.slice(1), 'f5f0e6') >= 4.5, 'contraste claro inferior a 4,5:1');
  assert.ok(contrast(dark.slice(1), '1d2b43') >= 4.5, 'contraste oscuro inferior a 4,5:1');
});

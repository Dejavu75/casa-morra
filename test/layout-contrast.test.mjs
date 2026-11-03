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

test('el shell conserva contenido útil sin JavaScript sin forzar un viewport vacío', async () => {
  const html = await read('index.html');
  const css = await read('assets/stats.css');
  assert.match(html, /<main id="contenido">[\s\S]*<h1 id="fallback-title">Centro de estadísticas<\/h1>/);
  assert.match(html, /Para consultar las estadísticas se necesita JavaScript\./);
  assert.match(css, /\.stats-only #contenido\s*\{[^}]*min-height:\s*0/);
});

test('el aviso de exportación conserva contraste de texto normal en ambos temas', async () => {
  const css = await read('assets/site.css');
  const light = css.match(/\.demo-source-controls \[role="status"\]\s*\{[^}]*color:\s*(#[\da-f]{6})/i)?.[1];
  const dark = css.match(/:root\[data-theme="oscuro"\] \.demo-source-controls \[role="status"\]\s*\{[^}]*color:\s*(#[\da-f]{6})/i)?.[1];
  assert.ok(light && dark, 'el aviso necesita colores explícitos para los dos fondos');
  assert.ok(contrast(light.slice(1), 'f5f0e6') >= 4.5, 'contraste claro inferior a 4,5:1');
  assert.ok(contrast(dark.slice(1), '1d2b43') >= 4.5, 'contraste oscuro inferior a 4,5:1');
});

test('el realce rojo sustituye al mostaza sin perder contraste de lectura', async () => {
  const [site, stats, admin] = await Promise.all([
    read('assets/site.css'), read('assets/stats.css'),
    readFile(new URL('../admin/admin.css', import.meta.url), 'utf8'),
  ]);
  assert.match(site, /--copper:\s*#b84f55/i);
  assert.match(stats, /--copper:\s*#b84f55/i);
  assert.match(stats, /\.stats-only \.records-eyebrow\s*\{[^}]*color:\s*#f0a5a7/i);
  assert.match(admin, /\.eyebrow, \.step\s*\{[^}]*color:\s*#8b3038/i);
  assert.doesNotMatch(site + stats + admin, /#d4a766|#efc991|#f1ce87|#765020|#b46f42/i);
  assert.ok(contrast('f0a5a7', '2b417b') >= 4.5, 'el rojo claro necesita 4,5:1 sobre el hero');
  assert.ok(contrast('8b3038', 'f7f8fb') >= 4.5, 'el rojo oscuro necesita 4,5:1 en el panel');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { players, tournaments, games, byes, titles, seasons } from '../dist/data/demo.js';
import { parseRoute } from '../dist/router.js';
import { renderPlayersDirectory } from '../dist/views/players.js';

const data = { players, tournaments, games, byes, titles, seasons };

test('el directorio distingue el padrón completo de los resultados y permite búsqueda GET', () => {
  const view = renderPlayersDirectory(data, { q: 'Lujan' });
  assert.equal(view.title, 'Jugadores — Casa Morra');
  assert.match(view.html, /<form[^>]*method="get"[^>]*action="\/jugadores"/);
  assert.match(view.html, /name="q"[^>]*value="Lujan"/);
  assert.match(view.html, /1 coincidencia de 6 jugadores/);
  assert.match(view.html, /Bautista Luján/);
  assert.doesNotMatch(view.html, /Ayla Neri/);
  assert.match(view.html, /href="\/jugadores\/bautista-lujan"/);
  assert.match(view.html, /href="\/jugadores"[^>]*>Ver todos/);
  assert.equal(parseRoute('/jugadores', '?q=Lujan').query.q, 'Lujan');
});

test('el índice ofrece navegación A–Z y estado vacío honesto', () => {
  const all = renderPlayersDirectory(data).html;
  assert.match(all, /aria-label="Índice alfabético"/);
  assert.match(all, /href="#letra-a"/);
  assert.match(all, /id="letra-a"/);
  assert.match(all, /6 jugadores en el padrón/);
  const empty = renderPlayersDirectory(data, { q: 'inexistente' }).html;
  assert.match(empty, /0 coincidencias de 6 jugadores/);
  assert.match(empty, /No encontramos jugadores para esa búsqueda/);
});

test('las letras sin jugadores comunican su estado como texto y no como etiqueta de un span genérico', () => {
  const html = renderPlayersDirectory(data).html;
  assert.doesNotMatch(html, /<span aria-label="Sin jugadores con [A-Z]"/);
  for (const letter of 'GHIJKLMNOPQRSTUVWXYZ') {
    assert.match(html, new RegExp(`<span class="players-letter-empty"><span aria-hidden="true">${letter}</span><span class="players-visually-hidden">Sin jugadores con ${letter}</span></span>`));
  }
  assert.match(html, /<a href="#letra-a">A<\/a>/);
});

test('las letras inactivas mantienen contraste de texto en ambos temas sin opacidad', () => {
  const playersCss = readFileSync(new URL('../dist/views/players.css', import.meta.url), 'utf8');
  const siteCss = readFileSync(new URL('../dist/assets/site.css', import.meta.url), 'utf8');
  const tile = playersCss.match(/\.players-alphabet > \.players-letter-empty\s*\{([^}]*)\}/)?.[1];
  assert.ok(tile, 'estilo de las letras inactivas');
  assert.match(tile, /color:\s*var\(--muted\)/);
  assert.doesNotMatch(tile, /opacity\s*:/);

  const root = siteCss.match(/:root\s*\{([^}]*)\}/)?.[1];
  const dark = siteCss.match(/:root\[data-theme="oscuro"\]\s*\{([^}]*)\}/)?.[1];
  const color = (block, token) => {
    const value = block?.match(new RegExp(`${token}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1];
    assert.ok(value, `token ${token}`);
    return value.match(/[0-9a-f]{2}/gi).map((hex) => parseInt(hex, 16) / 255);
  };
  const luminance = (rgb) => rgb.map((channel) => channel <= 0.04045
    ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const ratio = (foreground, background) => {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  };
  assert.ok(ratio(color(root, '--muted'), color(root, '--surface-light')) >= 4.5);
  assert.ok(ratio(color(dark, '--muted'), color(dark, '--surface')) >= 4.5);
});

test('el directorio escapa el texto de búsqueda y los nombres de la muestra', () => {
  const unsafe = { ...data, players: data.players.map((person) => person.id === 'celia-montiel'
    ? { ...person, name: '<img src=x onerror=alert(1)>' } : person) };
  const result = renderPlayersDirectory(unsafe, { q: '" autofocus onfocus=alert(1)' }).html;
  assert.doesNotMatch(result, /value="" autofocus/);
  assert.match(result, /&quot; autofocus onfocus/);
  const all = renderPlayersDirectory(unsafe).html;
  assert.doesNotMatch(all, /<img src=x/);
  assert.match(all, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

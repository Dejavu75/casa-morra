import test from 'node:test';
import assert from 'node:assert/strict';
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

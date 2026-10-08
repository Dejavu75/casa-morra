import { routeHref } from '../router.js';
import { escapeHtml as h, formatNumber, safeRouteHref } from './common.js';

export const playersEs = Object.freeze({
  players: 'Jugadores', demo: 'Datos ficticios de demostración',
  directoryIntro: 'Explorá el padrón ficticio y sus perfiles estadísticos.',
  searchLabel: 'Buscar jugador por nombre o apellido', searchButton: 'Buscar', clear: 'Ver todos',
  alphabet: 'Índice alfabético', rosterTotal: (total) => `${formatNumber(total)} jugadores en el padrón`,
  resultsTotal: (shown, total) => `${formatNumber(shown)} coincidencia${shown === 1 ? '' : 's'} de ${formatNumber(total)} jugadores`,
  noResults: 'No encontramos jugadores para esa búsqueda.',
});

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const titleFor = (title) => `${title} — Casa Morra`;
const message = (messages, key) => messages?.[key] ?? playersEs[key];
const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR');
const initial = (name) => normalize(name).trim().charAt(0).toUpperCase();

function playerUrl(player) {
  return player && safeRouteHref(routeHref, 'player', { slug: player.slug });
}
export function renderPlayersDirectory(data, { q = '' } = {}, messages = playersEs) {
  const query = String(q ?? '').trim();
  const roster = [...(data.players ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name, 'es-AR') || a.id.localeCompare(b.id));
  const selected = query ? roster.filter((player) => normalize(player.name).includes(normalize(query))) : roster;
  const sections = new Map();
  for (const person of selected) {
    const letter = initial(person.name);
    if (!sections.has(letter)) sections.set(letter, []);
    sections.get(letter).push(person);
  }
  const index = [...alphabet].map((letter) => sections.has(letter)
    ? `<a href="#letra-${letter.toLowerCase()}">${letter}</a>`
    : `<span aria-label="Sin jugadores con ${letter}">${letter}</span>`).join('');
  const groups = [...sections].map(([letter, people]) => {
    const items = people.map((person) => {
      const url = playerUrl(person);
      const name = h(person.name);
      return `<li>${url ? `<a href="${h(url)}">${name}</a>` : name}</li>`;
    }).join('');
    return `<section class="players-letter" id="letra-${h(letter.toLowerCase())}" aria-labelledby="titulo-${h(letter.toLowerCase())}"><h2 id="titulo-${h(letter.toLowerCase())}">${h(letter)}</h2><ul>${items}</ul></section>`;
  }).join('');
  const resultLabel = query
    ? message(messages, 'resultsTotal')(selected.length, roster.length)
    : message(messages, 'rosterTotal')(roster.length);
  const html = `<div class="players-page container"><p class="players-eyebrow">${h(message(messages, 'demo'))}</p><h1>${h(message(messages, 'players'))}</h1>
    <p>${h(message(messages, 'directoryIntro'))}</p><form class="players-search" method="get" action="${h(routeHref('players'))}" role="search">
      <label for="players-q">${h(message(messages, 'searchLabel'))}</label><input id="players-q" name="q" type="search" value="${h(query)}" maxlength="120" autocomplete="off">
      <button type="submit">${h(message(messages, 'searchButton'))}</button><a href="${h(routeHref('players'))}">${h(message(messages, 'clear'))}</a>
    </form><p class="players-count" aria-live="polite">${h(resultLabel)}</p>
    ${selected.length ? `<nav class="players-alphabet" aria-label="${h(message(messages, 'alphabet'))}">${index}</nav><div class="players-groups">${groups}</div>` : `<p class="players-empty">${h(message(messages, 'noResults'))}</p>`}
    </div>`;
  return { title: titleFor(message(messages, 'players')), html };
}

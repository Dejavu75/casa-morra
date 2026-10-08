import { routeHref } from '../router.js';
import { competitiveEs, escapeHtml as h, formatDate, formatNumber, playerLink, playerName, safeRouteHref, typeName } from './common.js';
import { hasDemoReplay } from './game.js';

const titleFor = (title) => `${title} — Casa Morra`;
const label = (messages, key) => messages?.[key] ?? competitiveEs[key];

function tournamentUrl(event) {
  return safeRouteHref(routeHref, 'tournament', { slug: event.slug });
}

function seasonUrl(seasonId) {
  return safeRouteHref(routeHref, 'annual', { seasonId });
}

function filterSelect(name, caption, choices, selected) {
  return `<label>${h(caption)}<select name="${h(name)}">${choices.map(([value, text]) =>
    `<option value="${h(value)}"${selected === value ? ' selected' : ''}>${h(text)}</option>`).join('')}</select></label>`;
}

export function renderTournamentList(data, { tipo = '', temporada = '' } = {}, messages = competitiveEs) {
  const events = data.tournaments ?? [];
  const seasons = data.seasons ?? [];
  const types = [...new Set(events.map((event) => event.type))].sort();
  const selected = events.filter((event) => (!tipo || event.type === tipo) && (!temporada || event.seasonId === temporada))
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const typeChoices = [['', label(messages, 'allTypes')], ...types.map((type) => [type, typeName(type, messages)])];
  const seasonChoices = [['', label(messages, 'allSeasons')], ...seasons.map((season) => [season.id, season.label])];
  const cards = selected.map((event) => {
    const url = tournamentUrl(event);
    const season = seasons.find((item) => item.id === event.seasonId);
    const detail = url ? `<a href="${h(url)}" aria-label="${h(label(messages, 'tournamentDetailAccessible')(event.name))}">${h(label(messages, 'tournamentDetailLink'))}</a>` : `<span>${h(label(messages, 'unavailableDetail'))}</span>`;
    return `<li class="competition-card"><article><p class="competition-meta">${h(typeName(event.type, messages))} · ${h(season?.label ?? event.seasonId)}</p>
      <h2>${h(event.name)}</h2><p>${h(formatDate(event.date))} · ${h(formatNumber(event.standings?.length ?? 0))} ${h(label(messages, 'participants'))} · ${h(formatNumber(event.rounds))} ${h(label(messages, 'rounds'))}</p>
      ${detail}</article></li>`;
  }).join('');
  const html = `<div class="competition-page container"><p class="competition-eyebrow">${h(label(messages, 'demo'))}</p><h1>${h(label(messages, 'tournaments'))}</h1>
    <p>${h(label(messages, 'tournamentIntro'))}</p>
    <form class="competition-filters" method="get" action="${h(routeHref('tournaments'))}" role="search" aria-label="${h(label(messages, 'filterTournaments'))}">
      ${filterSelect('tipo', label(messages, 'type'), typeChoices, tipo)}${filterSelect('temporada', label(messages, 'season'), seasonChoices, temporada)}
      <button type="submit">${h(label(messages, 'search'))}</button><a href="${h(routeHref('tournaments'))}">${h(label(messages, 'clear'))}</a>
    </form><p class="competition-count" aria-live="polite">${h(label(messages, 'eventsCount')(formatNumber(selected.length), formatNumber(events.length)))}</p>
    ${selected.length ? `<ul class="competition-list">${cards}</ul>` : `<p class="competition-empty">${h(label(messages, 'noTournaments'))}</p>`}
    </div>`;
  return { title: titleFor(label(messages, 'tournaments')), html };
}

function standingsTable(data, event, messages) {
  const standings = [...(event.standings ?? [])].sort((a, b) => a.order - b.order);
  if (!standings.length) return `<p>${h(label(messages, 'noStandings'))}</p>`;
  const rows = standings.map((entry) => {
    const personHtml = playerLink(data, entry.playerId, routeHref);
    const resultCells = [entry.wins, entry.draws, entry.losses]
      .map((value) => `<td>${value == null ? h(label(messages, 'noDetail')) : h(formatNumber(value))}</td>`).join('');
    return `<tr><td>${h(formatNumber(entry.rank))}</td><th scope="row">${personHtml}</th><td>${h(formatNumber(entry.points))}</td>${resultCells}</tr>`;
  }).join('');
  return `<div class="competition-table-wrap"><table><caption>${h(label(messages, 'officialStanding'))} ${h(event.name)}</caption>
    <thead><tr><th scope="col">${h(label(messages, 'rank'))}</th><th scope="col">${h(label(messages, 'player'))}</th><th scope="col">${h(label(messages, 'points'))}</th><th scope="col"><abbr title="${h(label(messages, 'wins'))}">G</abbr></th><th scope="col"><abbr title="${h(label(messages, 'draws'))}">E</abbr></th><th scope="col"><abbr title="${h(label(messages, 'losses'))}">P</abbr></th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

function gameResult(game) {
  return ({ '1-0': '1–0', '0-1': '0–1', '1/2-1/2': '½–½' })[game.result] ?? game.result;
}

function moveAvailability(game, messages) {
  if (!game.moves?.length) return h(label(messages, 'noMoves'));
  const href = hasDemoReplay(game) && safeRouteHref(routeHref, 'game', { id: game.id });
  return href ? `<a href="${h(href)}">${h(messages?.replayLink ?? 'Ver secuencia UCI')}</a>`
    : h(label(messages, 'movesPending'));
}

function eventResults(data, event, messages) {
  const games = (data.games ?? []).filter((game) => game.tournamentId === event.id)
    .sort((a, b) => a.round - b.round || a.id.localeCompare(b.id));
  const byes = (data.byes ?? []).filter((bye) => bye.tournamentId === event.id)
    .sort((a, b) => a.round - b.round || a.id.localeCompare(b.id));
  const gamesHtml = games.length ? `<ol class="competition-results">${games.map((game) => `<li><span>${h(label(messages, 'round'))} ${h(formatNumber(game.round))}: ${h(playerName(data, game.whiteId))} (${h(label(messages, 'whites'))}) — ${h(playerName(data, game.blackId))} (${h(label(messages, 'blacks'))})</span>
    <strong>${h(gameResult(game))}</strong><small>${moveAvailability(game, messages)}</small></li>`).join('')}</ol>` : `<p>${h(label(messages, 'noGames'))}</p>`;
  const byesHtml = byes.length ? `<ul class="competition-byes">${byes.map((bye) => `<li>${h(label(messages, 'round'))} ${h(formatNumber(bye.round))}: ${h(playerName(data, bye.playerId))} · ${h(formatNumber(bye.points))} ${h(label(messages, 'byePoint')(bye.points))}</li>`).join('')}</ul>`
    : `<p>${h(label(messages, 'noByes'))}</p>`;
  return `<section aria-labelledby="event-games"><h2 id="event-games">${h(label(messages, 'boardResults'))}</h2>${gamesHtml}</section>
    <section aria-labelledby="event-byes"><h2 id="event-byes">${h(label(messages, 'byes'))}</h2>${byesHtml}</section>`;
}

export function renderTournamentDetail(data, slug, messages = competitiveEs) {
  const event = data.tournaments?.find((item) => item.slug === slug);
  if (!event) return { title: titleFor(label(messages, 'notFoundTournament')),
    html: `<div class="competition-page container"><h1>${h(label(messages, 'notFoundTournament'))}</h1><p>${h(label(messages, 'unknownTournament'))}</p><a href="${h(routeHref('tournaments'))}">${h(label(messages, 'viewTournaments'))}</a></div>` };
  const season = data.seasons?.find((item) => item.id === event.seasonId);
  const annualUrl = seasonUrl(event.seasonId);
  return { title: titleFor(event.name), html: `<div class="competition-page container"><nav class="competition-back" aria-label="${h(label(messages, 'backTournaments'))}"><a href="${h(routeHref('tournaments'))}">${h(label(messages, 'backTournaments'))}</a></nav>
    <p class="competition-eyebrow">${h(label(messages, 'demo'))} · ${h(typeName(event.type, messages))}</p><h1>${h(event.name)}</h1>
    <p>${h(formatDate(event.date))} · ${h(season?.label ?? event.seasonId)} · ${h(formatNumber(event.rounds))} ${h(label(messages, 'rounds'))}</p>
    ${annualUrl ? `<p><a href="${h(annualUrl)}">${h(label(messages, 'annualLink'))} ${h(season?.label ?? event.seasonId)}</a></p>` : ''}
    <section aria-labelledby="event-standings"><h2 id="event-standings">${h(label(messages, 'tournamentTable'))}</h2>${standingsTable(data, event, messages)}</section>
    ${eventResults(data, event, messages)}</div>` };
}

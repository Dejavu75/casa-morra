import { getAnnualStandings } from '../domain/statistics.js';
import { routeHref } from '../router.js';
import { competitiveEs, escapeHtml as h, formatDate, formatNumber, playerLink, safeRouteHref } from './common.js';

const label = (messages, key) => messages?.[key] ?? competitiveEs[key];

function movementText(value, messages) {
  if (value == null) return label(messages, 'newAnnual');
  if (value === 0) return label(messages, 'unchanged');
  return value > 0 ? label(messages, 'rises')(formatNumber(value)) : label(messages, 'falls')(formatNumber(-value));
}

export function renderAnnual(data, seasonId, messages = competitiveEs) {
  const season = data.seasons?.find((item) => item.id === seasonId);
  if (!season) return { title: `${label(messages, 'notFoundSeason')} — Casa Morra`,
    html: `<div class="competition-page container"><h1>${h(label(messages, 'notFoundSeason'))}</h1><p>${h(label(messages, 'unknownSeason'))}</p><a href="${h(routeHref('tournaments'))}">${h(label(messages, 'viewTournaments'))}</a></div>` };
  const annual = getAnnualStandings(data, seasonId);
  const seasonLinks = (data.seasons ?? []).map((item) => {
    const href = safeRouteHref(routeHref, 'annual', { seasonId: item.id });
    return href ? `<li><a href="${h(href)}"${item.id === seasonId ? ' aria-current="page"' : ''}>${h(item.label)}</a></li>` : '';
  }).join('');
  const rows = annual.standings.map((row) => {
    return `<tr><td>${h(formatNumber(row.rank))}</td><th scope="row">${playerLink(data, row.playerId, routeHref)}</th>
      <td>${h(formatNumber(row.points))}</td><td>${h(formatNumber(row.tournaments))}</td><td>${h(movementText(row.movement, messages))}</td></tr>`;
  }).join('');
  const table = rows ? `<div class="competition-table-wrap"><table><caption>${h(label(messages, 'seasonAnnual'))} ${h(season.label)}</caption>
    <thead><tr><th scope="col">${h(label(messages, 'rank'))}</th><th scope="col">${h(label(messages, 'player'))}</th><th scope="col">${h(label(messages, 'points'))}</th><th scope="col">${h(label(messages, 'tournamentsColumn'))}</th><th scope="col">${h(label(messages, 'movement'))}</th></tr></thead>
    <tbody>${rows}</tbody></table></div>` : `<p class="competition-empty">${h(label(messages, 'noAnnual'))}</p>`;
  const events = annual.events.map((event) => {
    const href = safeRouteHref(routeHref, 'tournament', { slug: event.slug });
    return `<li>${href ? `<a href="${h(href)}">${h(event.name)}</a>` : h(event.name)} <span>· ${h(formatDate(event.date))}</span></li>`;
  }).join('');
  return { title: `${label(messages, 'annual')} ${season.label} — Casa Morra`,
    html: `<div class="competition-page container"><p class="competition-eyebrow">${h(label(messages, 'demo'))}</p>
      <h1>${h(label(messages, 'annual'))} ${h(season.label)}</h1><p>${h(label(messages, 'annualIntro'))}</p>
      <nav aria-label="${h(label(messages, 'seasons'))}"><ul class="competition-season-links">${seasonLinks}</ul></nav>
      <p>${h(label(messages, 'annualComparison'))} ${h(label(messages, 'annualTies'))}</p>${table}
      <section aria-labelledby="annual-events"><h2 id="annual-events">${h(label(messages, 'annualEvents'))}</h2>${events ? `<ul>${events}</ul>` : `<p>${h(label(messages, 'noAnnual'))}</p>`}</section>
      <aside class="competition-note"><h2>${h(label(messages, 'demoRules'))}</h2><p>${h(label(messages, 'annualExclusions'))}</p><p>${h(label(messages, 'circuitNotice'))}</p></aside>
    </div>` };
}

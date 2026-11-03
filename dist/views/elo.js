import { calculateElo } from '../domain/statistics.js';
import { routeHref } from '../router.js';
import { escapeHtml as h, formatDate, formatNumber } from './common.js';

export const eloEs = Object.freeze({
  title: 'Evolución Elo', intro: 'Clasificación y trayectoria de los jugadores.',
  method: 'Elo interno de demostración; no es Elo FIDE. Se calcula tras cada partida elegible y se muestra redondeado a enteros. Los puntos del mismo día se separan para distinguir cada partida.',
  ranking: 'Jugadores por Elo actual', player: 'Jugador', rating: 'Elo actual', games: 'Partidas elegibles',
  open: 'Ver evolución', compare: 'Comparar evolución', choose: 'Elegí jugadores para comparar',
  draw: 'Mostrar comparación', reset: 'Ver un jugador', date: 'Fecha', chart: 'Gráfico de evolución Elo',
  table: 'Valores de la evolución', empty: 'Todavía no hay partidas elegibles para el Elo.',
  selected: 'Jugadores seleccionados', initial: 'Valor inicial', game: 'Partida',
});

const round = (value, locale) => formatNumber(Math.round(value), locale);

function chart(series, labels, locale, games) {
  const points = series.flatMap(({ history }) => history.map((step) => step));
  if (!points.length) return `<p>${h(labels.empty)}</p>`;
  const dates = points.map((step) => Date.parse(`${step.date}T00:00:00Z`));
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const ratings = [1400, ...points.map((step) => step.after)];
  const minRating = Math.floor((Math.min(...ratings) - 20) / 25) * 25;
  const maxRating = Math.ceil((Math.max(...ratings) + 20) / 25) * 25;
  const dateX = (date) => 58 + (maxDate === minDate ? 0.5 : (Date.parse(`${date}T00:00:00Z`) - minDate) / (maxDate - minDate)) * 682;
  const gamesById = new Map(games.map((game) => [game.id, game]));
  const eventsByDate = new Map();
  for (const step of points) {
    if (!eventsByDate.has(step.date)) eventsByDate.set(step.date, new Map());
    const game = gamesById.get(step.gameId);
    eventsByDate.get(step.date).set(step.gameId, { tournamentId: game.tournamentId, round: step.round });
  }
  const days = [...eventsByDate.keys()].sort();
  const eventX = new Map();
  days.forEach((date, dayIndex) => {
    const center = dateX(date);
    const left = dayIndex ? (dateX(days[dayIndex - 1]) + center) / 2 : 58;
    const right = dayIndex < days.length - 1 ? (center + dateX(days[dayIndex + 1])) / 2 : 740;
    const gameIds = [...eventsByDate.get(date)].sort(([idA, eventA], [idB, eventB]) =>
      eventA.tournamentId.localeCompare(eventB.tournamentId) || eventA.round - eventB.round ||
      idA.localeCompare(idB)).map(([gameId]) => gameId);
    gameIds.forEach((gameId, gameIndex) => {
      eventX.set(`${date}|${gameId}`, gameIds.length === 1 ? center :
        left + (gameIndex + 1) * (right - left) / (gameIds.length + 1));
    });
  });
  const x = (step) => eventX.get(`${step.date}|${step.gameId}`);
  const y = (rating) => 266 - (rating - minRating) / (maxRating - minRating) * 226;
  const grid = Array.from({ length: 5 }, (_, index) => {
    const value = minRating + (maxRating - minRating) * index / 4;
    const vertical = y(value);
    return `<g><line x1="58" y1="${vertical}" x2="740" y2="${vertical}" stroke="#c5ccdc"/><text x="50" y="${vertical + 4}" text-anchor="end">${h(round(value, locale))}</text></g>`;
  }).join('');
  const lines = series.map(({ player, history }, index) => {
    if (!history.length) return '';
    const path = [`58,${y(1400)}`, ...history.map((step) => `${x(step)},${y(step.after)}`)].join(' ');
    const markers = history.map((step) => `<circle data-game-id="${h(step.gameId)}" data-date="${h(step.date)}" cx="${x(step)}" cy="${y(step.after)}" r="4" fill="currentColor"><title>${h(player.name)} · ${h(step.gameId)} · ${h(formatDate(step.date, locale))}: ${h(round(step.after, locale))}</title></circle>`).join('');
    return `<g class="elo-series-${index % 6}"><polyline points="${path}" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>${markers}</g>`;
  }).join('');
  const legend = series.map(({ player }, index) => `<li><span class="elo-series-${index % 6}"></span>${h(player.name)}</li>`).join('');
  const rows = series.flatMap(({ player, history }) => history.map((step) => ({ player, ...step })))
    .sort((a, b) => a.date.localeCompare(b.date) || a.gameId.localeCompare(b.gameId))
    .map((step) => `<tr><td>${h(formatDate(step.date, locale))}</td><td>${h(step.gameId)}</td><th scope="row">${h(step.player.name)}</th><td>${h(round(step.after, locale))}</td></tr>`).join('');
  return `<div class="elo-chart-wrap"><svg class="elo-chart" viewBox="0 0 790 310" role="img" aria-label="${h(labels.chart)}" preserveAspectRatio="xMidYMid meet"><g class="elo-chart-grid">${grid}<text x="58" y="296">${h(formatDate(new Date(minDate).toISOString().slice(0, 10), locale))}</text><text x="740" y="296" text-anchor="end">${h(formatDate(new Date(maxDate).toISOString().slice(0, 10), locale))}</text></g>${lines}</svg></div>
    <ul class="elo-legend" aria-label="${h(labels.selected)}">${legend}</ul>
    <div class="elo-table-wrap" role="region" aria-label="${h(labels.table)}" tabindex="0"><table><caption>${h(labels.table)}</caption><thead><tr><th scope="col">${h(labels.date)}</th><th scope="col">${h(labels.game)}</th><th scope="col">${h(labels.player)}</th><th scope="col">${h(labels.rating)}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

export function renderElo(data, { jugador = [] } = {}, labels = eloEs, locale = 'es-AR') {
  const ratings = calculateElo(data);
  const roster = [...data.players].sort((a, b) => Math.round(ratings[b.id].rating) - Math.round(ratings[a.id].rating) || a.name.localeCompare(b.name, locale));
  const requested = new Set(jugador);
  const selected = roster.filter((player) => requested.has(player.slug));
  if (!selected.length && roster.length) selected.push(roster[0]);
  const selectedSet = new Set(selected.map((player) => player.slug));
  const choices = roster.map((player) => `<label><input type="checkbox" name="jugador" value="${h(player.slug)}"${selectedSet.has(player.slug) ? ' checked' : ''}> ${h(player.name)}</label>`).join('');
  const ranking = roster.map((player) => {
    const value = Math.round(ratings[player.id].rating);
    const rank = roster.findIndex((item) => Math.round(ratings[item.id].rating) === value) + 1;
    return `<tr><th scope="row">${h(formatNumber(rank, locale))}</th><td><a href="${h(routeHref('player', { slug: player.slug }))}">${h(player.name)}</a></td><td>${h(round(value, locale))}</td><td>${h(formatNumber(ratings[player.id].played, locale))}</td><td><a href="${h(routeHref('elo', {}, { jugador: [player.slug] }))}">${h(labels.open)}</a></td></tr>`;
  }).join('');
  const series = selected.map((player) => ({ player, history: ratings[player.id].history }));
  return { title: labels.title, html: `<div class="elo-page container"><p class="elo-eyebrow">Centro de estadísticas · datos demo</p><h1>${h(labels.title)}</h1><p>${h(labels.intro)}</p><p class="elo-method">${h(labels.method)}</p>
    <section aria-labelledby="elo-ranking"><h2 id="elo-ranking">${h(labels.ranking)}</h2><div class="elo-table-wrap" role="region" aria-label="${h(labels.ranking)}" tabindex="0"><table><caption>${h(labels.ranking)}</caption><thead><tr><th scope="col">#</th><th scope="col">${h(labels.player)}</th><th scope="col">${h(labels.rating)}</th><th scope="col">${h(labels.games)}</th><th scope="col">${h(labels.open)}</th></tr></thead><tbody>${ranking}</tbody></table></div></section>
    <section aria-labelledby="elo-compare"><h2 id="elo-compare">${h(labels.compare)}</h2><form method="get" action="${h(routeHref('elo'))}" class="elo-select"><fieldset><legend>${h(labels.choose)}</legend><div>${choices}</div></fieldset><button type="submit">${h(labels.draw)}</button></form>${chart(series, labels, locale, data.games)}</section></div>` };
}

import { getClassics, getHeadToHead, getLeaderboards } from '../domain/statistics.js?v=0.9.3-demo';
import { routeHref } from '../router.js';
import { escapeHtml, formatDate, formatNumber, safeRouteHref } from './common.js';
import { hasDemoReplay } from './game.js';

// Diccionario inyectable: el catálogo global puede incorporar estas claves al ampliar idiomas.
export const recordsEs = Object.freeze({
  statisticsTitle: 'Estadísticas y récords', classicsTitle: 'Clásicos',
  missingClassic: 'Clásico no encontrado',
  demo: 'Cifras ficticias de demostración. Las reglas de cálculo son propias de Casa Morra.',
  metric: 'Métrica', position: 'Puesto', player: 'Jugador', value: 'Valor',
  noEligible: 'Sin jugadores elegibles para esta clasificación.',
  more: 'Ver clasificación completa',
  classicsIntro: 'Se muestran parejas con al menos cuatro partidas al tablero. Los descansos no cuentan.',
  noClassics: 'Todavía no hay enfrentamientos con cuatro partidas al tablero.',
  perspective: 'Resultados desde la perspectiva del primer jugador.',
  scoreAbbrev: 'G-E-P',
  pointsRate: 'Rendimiento por puntos', winsRate: 'Porcentaje de victorias',
  colorWhite: 'Blancas', colorBlack: 'Negras', games: 'Partidas al tablero',
  points: 'puntos', wins: 'ganadas', draws: 'empatadas', losses: 'perdidas',
  date: 'Fecha', white: 'Blancas', black: 'Negras', result: 'Resultado', sheet: 'Jugadas',
  viewGame: 'Reproducir jugadas', noMoves: 'Sin jugadas registradas',
  movesUnavailable: 'Jugadas registradas; enlace no disponible',
  backClassics: 'Volver a clásicos',
  boardTitles: Object.freeze({
    tournamentsWon: 'Torneos ganados', championships: 'Campeonatos del club',
    gamesPlayed: 'Partidas jugadas', gamesWon: 'Partidas ganadas',
    winRate: 'Porcentaje de victorias', winningStreak: 'Racha ganadora',
    unbeatenStreak: 'Racha invicta', peakElo: 'Mayor Elo demo',
    tournamentsPlayed: 'Torneos jugados', podiums: 'Podios',
  }),
  boardRules: Object.freeze({
    tournamentsWon: 'Población: participantes de tablas oficiales. Valor: primeros puestos registrados, sin reconstruir desempates.',
    championships: 'Población: jugadores con títulos del club registrados. Valor: títulos de campeonato del club.',
    gamesPlayed: 'Población: jugadores con partidas individuales. Valor: partidas al tablero; se excluyen descansos.',
    gamesWon: 'Población: jugadores con victorias individuales. Valor: victorias al tablero; se excluyen descansos.',
    winRate: 'Población: jugadores con al menos 15 partidas al tablero. Valor: victorias / partidas al tablero × 100; no es rendimiento por puntos.',
    winningStreak: 'Población: jugadores con racha ganadora. Valor: victorias consecutivas al tablero; los descansos no son partidas.',
    unbeatenStreak: 'Población: jugadores con racha invicta. Valor: partidas al tablero consecutivas sin derrota; los descansos no son partidas.',
    peakElo: 'Población: jugadores con partidas elegibles para Elo demo. Valor: máximo calculado con fórmula propia; no es Elo FIDE.',
    tournamentsPlayed: 'Población: participantes de tablas oficiales. Valor: torneos con una posición oficial registrada.',
    podiums: 'Población: participantes de tablas oficiales. Valor: puestos primero, segundo o tercero registrados.',
  }),
});

const e = escapeHtml;

function playerLink(data, playerId, fallbackName) {
  const player = data.players.find((row) => row.id === playerId);
  const name = e(player?.name ?? fallbackName ?? playerId);
  const href = player && safeRouteHref(routeHref, 'player', { slug: player.slug });
  return href ? `<a href="${e(href)}">${name}</a>` : name;
}

function boardValueFormatter(board, locale) {
  if (board.id !== 'peakElo') return (value) => formatNumber(value, locale);
  for (let digits = 1; digits <= 20; digits += 1) {
    const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: digits });
    const valuesByLabel = new Map();
    const ambiguous = board.entries.some(({ value }) => {
      const label = formatter.format(value);
      const previous = valuesByLabel.get(label);
      valuesByLabel.set(label, value);
      return previous !== undefined && previous !== value;
    });
    if (!ambiguous) return (value) => formatter.format(value);
  }
  return (value) => new Intl.NumberFormat(locale, { maximumFractionDigits: 20 }).format(value);
}

function boardValue(board, value, formatValue) {
  return `${e(formatValue(value))}${board.id === 'winRate' ? ' %' : ''}`;
}

function boardTable(data, board, entries, caption, labels, locale, formatValue) {
  return `<table class="record-table"><caption>${e(caption)}</caption><thead><tr><th scope="col">${e(labels.position)}</th><th scope="col">${e(labels.player)}</th><th scope="col">${e(labels.value)}</th></tr></thead><tbody>${entries.map((entry) => `<tr><th scope="row">${e(formatNumber(entry.rank, locale))}</th><td>${playerLink(data, entry.playerId, entry.name)}</td><td>${boardValue(board, entry.value, formatValue)}</td></tr>`).join('')}</tbody></table>`;
}

export function renderStatistics(data, labels = recordsEs, locale = 'es-AR') {
  const boards = getLeaderboards(data);
  const sections = boards.map((board) => {
    const title = labels.boardTitles?.[board.id] ?? board.label;
    const description = labels.boardRules?.[board.id] ?? '';
    const visible = board.entries.slice(0, 10);
    const extra = board.entries.slice(10);
    const formatValue = boardValueFormatter(board, locale);
    const table = visible.length ? boardTable(data, board, visible, title, labels, locale, formatValue) : `<p>${e(labels.noEligible)}</p>`;
    const more = extra.length ? `<details><summary>${e(labels.more)}</summary>${boardTable(data, board, extra, title, labels, locale, formatValue)}</details>` : '';
    return `<section class="record-board" data-record-id="${e(board.id)}" aria-labelledby="record-${e(board.id)}"><h2 id="record-${e(board.id)}">${e(title)}</h2><p>${e(description)}</p>${table}${more}</section>`;
  }).join('');
  return { title: labels.statisticsTitle, html: `<section class="records-page"><h1>${e(labels.statisticsTitle)}</h1><p>${e(labels.demo)}</p>${sections}</section>` };
}

function scoreSummary(record, locale) {
  return `${formatNumber(record.wins, locale)}-${formatNumber(record.draws, locale)}-${formatNumber(record.losses, locale)}`;
}

function scorePoints(record, locale) {
  return `${formatNumber(record.points, locale)} / ${formatNumber(record.played, locale)}`;
}

function scorePercent(record, locale) {
  return record.scoreRate === null ? '—' : `${formatNumber(Math.round(record.scoreRate), locale)} %`;
}

export function renderClassics(data, labels = recordsEs, locale = 'es-AR') {
  const pairs = getClassics(data);
  const cards = pairs.map((pair) => {
    const first = data.players.find((player) => player.id === pair.firstId);
    const second = data.players.find((player) => player.id === pair.secondId);
    const href = first && second && safeRouteHref(routeHref, 'classic', { first: first.slug, second: second.slug });
    const names = `${e(first?.name ?? pair.firstId)} — ${e(second?.name ?? pair.secondId)}`;
    const heading = href ? `<a href="${e(href)}">${names}</a>` : names;
    return `<article class="classic-pair"><h2>${heading}</h2><p>${e(labels.perspective)}</p><p>${e(labels.scoreAbbrev)}: ${scoreSummary(pair.record, locale)} · ${e(labels.pointsRate)}: ${e(scorePoints(pair.record, locale))} (${e(scorePercent(pair.record, locale))})</p></article>`;
  }).join('');
  return { title: labels.classicsTitle, html: `<section class="classics-page"><h1>${e(labels.classicsTitle)}</h1><p>${e(labels.classicsIntro)}</p>${cards || `<p>${e(labels.noClassics)}</p>`}</section>` };
}

function colorLine(label, record, locale) {
  return `<li><strong>${e(label)}:</strong> ${scoreSummary(record, locale)} · ${e(scorePoints(record, locale))}</li>`;
}

function gameRows(data, games, labels, locale) {
  return games.map((game) => {
    const hasMoves = Array.isArray(game.moves) && game.moves.length > 0;
    const href = hasDemoReplay(game) ? safeRouteHref(routeHref, 'game', { id: game.id }) : null;
    const moves = href ? `<a href="${e(href)}">${e(labels.viewGame)}</a>`
      : hasMoves ? e(labels.movesUnavailable) : e(labels.noMoves);
    return `<tr><td>${e(formatDate(game.date, locale))}</td><td>${playerLink(data, game.whiteId)}</td><td>${playerLink(data, game.blackId)}</td><td>${e(game.result)}</td><td>${moves}</td></tr>`;
  }).join('');
}

export function renderClassic(data, firstSlug, secondSlug, labels = recordsEs, locale = 'es-AR') {
  const first = data.players.find((player) => player.slug === firstSlug);
  const second = data.players.find((player) => player.slug === secondSlug);
  const pair = first && second ? getHeadToHead(data, first.id, second.id) : null;
  if (!pair || pair.record.played < 4) return {
    title: labels.missingClassic,
    html: `<section class="classic-detail"><h1>${e(labels.missingClassic)}</h1><a href="${routeHref('classics')}">${e(labels.backClassics)}</a></section>`,
  };
  const title = `${first.name} — ${second.name}`;
  const record = pair.record;
  const rows = gameRows(data, pair.games, labels, locale);
  return {
    title,
    html: `<article class="classic-detail"><h1>${e(title)}</h1><p>${e(labels.perspective)}</p><p><strong>${e(labels.scoreAbbrev)}: ${scoreSummary(record, locale)}</strong> · ${e(labels.pointsRate)}: ${e(scorePoints(record, locale))} (${e(scorePercent(record, locale))}) · ${e(labels.winsRate)}: ${e(`${formatNumber(Math.round(record.winRate), locale)} %`)}</p><ul>${colorLine(labels.colorWhite, pair.colors.white, locale)}${colorLine(labels.colorBlack, pair.colors.black, locale)}</ul><h2>${e(labels.games)}</h2><div class="classic-table-scroll" role="region" aria-label="${e(`${labels.games}: ${title}`)}" tabindex="0"><table><caption>${e(title)}: ${e(labels.games)}</caption><thead><tr><th scope="col">${e(labels.date)}</th><th scope="col">${e(labels.white)}</th><th scope="col">${e(labels.black)}</th><th scope="col">${e(labels.result)}</th><th scope="col">${e(labels.sheet)}</th></tr></thead><tbody>${rows}</tbody></table></div><a href="${routeHref('classics')}">${e(labels.backClassics)}</a></article>`,
  };
}

import { Chess } from '../vendor/chess.js';
import { getHeadToHead } from '../domain/statistics.js';
import { routeHref } from '../router.js';
import { escapeHtml as h, formatDate, formatNumber } from './common.js';

export const encyclopediaEs = Object.freeze({
  title: 'Enciclopedia de partidas', intro: 'Buscá resultados por jugador y torneo. Las planillas se incorporan cuando están disponibles.',
  player: 'Jugador', allPlayers: 'Todos los jugadores', tournament: 'Torneo', allTournaments: 'Todos los torneos',
  search: 'Buscar partidas', clear: 'Limpiar filtros', rival: 'Rival', pairing: 'Blancas — Negras', date: 'Fecha', result: 'Resultado',
  resultPerspective: '1–0: ganan las blancas; 0–1: ganan las negras; ½–½: tablas.',
  pgn: 'Archivo PGN', pending: 'PGN pendiente', download: 'Descargar PGN', view: 'Ver partida',
  games: 'Partidas', empty: 'No hay partidas para estos filtros.', demo: 'Datos ficticios de demostración',
});

export const comparisonEs = Object.freeze({
  title: 'Comparar jugadores', intro: 'Balance directo entre dos jugadores, con resultados y colores.',
  first: 'Primer jugador', second: 'Segundo jugador', choose: 'Elegí un jugador', compare: 'Comparar',
  games: 'Partidas', wins: 'Ganadas', draws: 'Empatadas', losses: 'Perdidas',
  white: 'Blancas', black: 'Negras', date: 'Fecha', tournament: 'Torneo', result: 'Resultado',
  resultPerspective: '1–0: ganan las blancas; 0–1: ganan las negras; ½–½: tablas.',
  empty: 'Elegí dos jugadores diferentes para ver la comparación.', noGames: 'Todavía no jugaron entre sí.',
});

const sortName = (left, right, locale) => left.name.localeCompare(right.name, locale) || left.id.localeCompare(right.id);
const resultLabel = (result) => ({ '1-0': '1–0', '0-1': '0–1', '1/2-1/2': '½–½' })[result] ?? result;

export function gamePgn(data, game) {
  if (!Array.isArray(game?.moves) || !game.moves.length) return null;
  try {
    const chess = new Chess();
    const event = data.tournaments.find((item) => item.id === game.tournamentId);
    const white = data.players.find((item) => item.id === game.whiteId);
    const black = data.players.find((item) => item.id === game.blackId);
    chess.setHeader('Event', event?.name ?? '?');
    chess.setHeader('Date', game.date.replaceAll('-', '.'));
    chess.setHeader('Round', String(game.round));
    chess.setHeader('White', white?.name ?? '?');
    chess.setHeader('Black', black?.name ?? '?');
    chess.setHeader('Result', game.result);
    for (const move of game.moves) {
      if (typeof move !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) return null;
      chess.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] });
    }
    return chess.pgn({ newline: '\n' });
  } catch { return null; }
}

function options(items, current, emptyLabel, locale) {
  return `<option value="">${h(emptyLabel)}</option>${[...items].sort((a, b) => sortName(a, b, locale))
    .map((item) => `<option value="${h(item.slug)}"${item.slug === current ? ' selected' : ''}>${h(item.name)}</option>`).join('')}`;
}

export function renderEncyclopedia(data, { jugador = '', torneo = '' } = {}, labels = encyclopediaEs, locale = 'es-AR') {
  const player = data.players.find((item) => item.slug === jugador);
  const event = data.tournaments.find((item) => item.slug === torneo);
  const matches = [...data.games].filter((game) => (!player || game.whiteId === player.id || game.blackId === player.id) &&
    (!event || game.tournamentId === event.id)).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const rows = matches.map((game) => {
    const white = data.players.find((item) => item.id === game.whiteId);
    const black = data.players.find((item) => item.id === game.blackId);
    const opponent = player ? (game.whiteId === player.id ? black : white)?.name : `${white?.name ?? game.whiteId} — ${black?.name ?? game.blackId}`;
    const tournament = data.tournaments.find((item) => item.id === game.tournamentId);
    const pgn = gamePgn(data, game);
    const file = pgn ? `<a href="data:application/x-chess-pgn;charset=utf-8,${encodeURIComponent(pgn)}" download="${h(game.id)}.pgn">${h(labels.download)}</a>` : h(labels.pending);
    return `<tr data-game-id="${h(game.id)}"><th scope="row">${h(opponent ?? '—')}</th><td>${tournament ? `<a href="${h(routeHref('tournament', { slug: tournament.slug }))}">${h(tournament.name)}</a>` : '—'}</td><td>${h(formatDate(game.date, locale))}</td><td><a href="${h(routeHref('game', { id: game.id }))}">${h(resultLabel(game.result))} · ${h(labels.view)}</a></td><td>${file}</td></tr>`;
  }).join('');
  return { title: labels.title, html: `<div class="lookup-page container"><p class="lookup-eyebrow">${h(labels.demo)}</p><h1>${h(labels.title)}</h1><p>${h(labels.intro)}</p>
    <form class="lookup-filters" method="get" action="${h(routeHref('encyclopedia'))}" role="search"><label>${h(labels.player)}<select name="jugador">${options(data.players, player?.slug, labels.allPlayers, locale)}</select></label><label>${h(labels.tournament)}<select name="torneo">${options(data.tournaments, event?.slug, labels.allTournaments, locale)}</select></label><button type="submit">${h(labels.search)}</button><a href="${h(routeHref('encyclopedia'))}">${h(labels.clear)}</a></form>
    <h2>${h(labels.games)}: ${h(formatNumber(matches.length, locale))}</h2>${rows ? `<p class="lookup-result-note">${h(labels.resultPerspective)}</p><div class="lookup-table-wrap" role="region" aria-label="${h(labels.games)}" tabindex="0"><table><caption>${h(labels.title)}</caption><thead><tr><th scope="col">${h(player ? labels.rival : labels.pairing)}</th><th scope="col">${h(labels.tournament)}</th><th scope="col">${h(labels.date)}</th><th scope="col">${h(labels.result)}</th><th scope="col">${h(labels.pgn)}</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<p>${h(labels.empty)}</p>`}</div>` };
}

const countLine = (record, labels, locale) => `${formatNumber(record.played, locale)} ${labels.games} · ${formatNumber(record.wins, locale)} ${labels.wins} · ${formatNumber(record.draws, locale)} ${labels.draws} · ${formatNumber(record.losses, locale)} ${labels.losses}`;

export function renderComparison(data, { primero = '', segundo = '' } = {}, labels = comparisonEs, locale = 'es-AR') {
  const first = data.players.find((item) => item.slug === primero);
  const second = data.players.find((item) => item.slug === segundo);
  const pair = first && second ? getHeadToHead(data, first.id, second.id) : null;
  const firstOptions = options(data.players, first?.slug, labels.choose, locale);
  const secondOptions = options(data.players, second?.slug, labels.choose, locale);
  const games = pair?.games.map((game) => {
    const event = data.tournaments.find((item) => item.id === game.tournamentId);
    return `<tr><td>${h(formatDate(game.date, locale))}</td><td>${h(event?.name ?? '—')}</td><td><a href="${h(routeHref('game', { id: game.id }))}">${h(resultLabel(game.result))}</a></td></tr>`;
  }).join('') ?? '';
  const result = pair ? `<section aria-label="${h(labels.games)}"><h2>${h(first.name)} — ${h(second.name)}</h2><p>${h(countLine(pair.record, labels, locale))}</p><p class="lookup-result-note">${h(labels.resultPerspective)}</p><div class="lookup-splits"><p><strong>${h(labels.white)}:</strong> ${h(countLine(pair.colors.white, labels, locale))}</p><p><strong>${h(labels.black)}:</strong> ${h(countLine(pair.colors.black, labels, locale))}</p></div>${games ? `<div class="lookup-table-wrap" role="region" aria-label="${h(labels.games)}" tabindex="0"><table><caption>${h(labels.games)}</caption><thead><tr><th scope="col">${h(labels.date)}</th><th scope="col">${h(labels.tournament)}</th><th scope="col">${h(labels.result)}</th></tr></thead><tbody>${games}</tbody></table></div>` : `<p>${h(labels.noGames)}</p>`}</section>` : `<p>${h(labels.empty)}</p>`;
  return { title: labels.title, html: `<div class="lookup-page container"><h1>${h(labels.title)}</h1><p>${h(labels.intro)}</p><form class="lookup-filters" method="get" action="${h(routeHref('compare'))}"><label>${h(labels.first)}<select name="primero">${firstOptions}</select></label><label>${h(labels.second)}<select name="segundo">${secondOptions}</select></label><button type="submit">${h(labels.compare)}</button></form>${result}</div>` };
}

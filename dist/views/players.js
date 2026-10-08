import { routeHref } from '../router.js';
import { getHeadToHead, getPlayerProfile } from '../domain/statistics.js';
import { escapeHtml as h, formatDate, formatNumber, playerName, safeRouteHref } from './common.js';

// Las etiquetas se inyectan en vez de mezclarse con datos o lógica de cálculo.
export const playersEs = Object.freeze({
  players: 'Jugadores', demo: 'Datos ficticios de demostración',
  directoryIntro: 'Explorá el padrón ficticio y sus perfiles estadísticos.',
  searchLabel: 'Buscar jugador por nombre o apellido', searchButton: 'Buscar', clear: 'Ver todos',
  alphabet: 'Índice alfabético', rosterTotal: (total) => `${formatNumber(total)} jugadores en el padrón`,
  resultsTotal: (shown, total) => `${formatNumber(shown)} coincidencia${shown === 1 ? '' : 's'} de ${formatNumber(total)} jugadores`,
  noResults: 'No encontramos jugadores para esa búsqueda.',
  profile: 'Perfil de jugador', notFound: 'Jugador no encontrado',
  unknownPlayer: 'El identificador no coincide con ningún jugador de la muestra.',
  back: '← Jugadores', member: 'Socio · dato demo', memberFemale: 'Socia · dato demo',
  nonMember: 'No socio · dato demo', membershipUnknown: 'Estado de socio no disponible · dato demo',
  accountNotice: 'Este perfil muestra datos ficticios; no representa una cuenta iniciada.',
  elo: 'Elo de Casa Morra', peakElo: 'Mejor Elo', provisional: 'Provisorio',
  consolidated: 'Consolidado', eloMethod: 'Elo interno de demostración; no es Elo FIDE. Provisorio con menos de 10 partidas elegibles.',
  games: 'Partidas al tablero', record: 'G–E–P', winsRate: 'Victorias/partidas',
  scoreRate: 'Puntos/partidas', rateExplanation: 'Victorias/partidas cuenta solo triunfos. Puntos/partidas también incorpora medio punto por empate.',
  white: 'Con blancas', black: 'Con negras',
  officialHistory: 'Historial oficial de torneos', officialHistoryInfo: 'La clasificación oficial conserva puntos y puesto aun cuando no haya resultados individuales.',
  scrollHint: 'Desplace la tabla con las flechas del teclado o con un gesto horizontal para ver todas las columnas.',
  tournament: 'Torneo', date: 'Fecha', rank: 'Puesto', points: 'Puntos',
  wins: 'Ganadas', draws: 'Empatadas', losses: 'Perdidas', noDetail: 'Sin detalle',
  noEvents: 'Todavía no hay torneos oficiales para este jugador.',
  eloHistory: 'Historial Elo', eloHistoryInfo: 'Cada fila corresponde a una partida elegible; los torneos que solo tienen tabla no modifican el Elo.',
  game: 'Partida', opponent: 'Rival', before: 'Antes', after: 'Después',
  noEloHistory: 'Todavía no hay partidas elegibles para el Elo.',
  titles: 'Reconocimientos de la muestra', noTitles: 'No hay reconocimientos registrados.',
  career: 'Trayectoria oficial de la muestra', officialPoints: 'Puntos oficiales acumulados',
  firstPlaces: 'Primeros puestos oficiales', podiums: 'Podios oficiales',
  winningStreak: 'Racha máxima de victorias', unbeatenStreak: 'Racha máxima sin perder',
  titleCount: 'Títulos registrados',
  careerExplanation: 'Puntos y puestos provienen de tablas oficiales, aun sin partidas detalladas. Las rachas cuentan solo partidas al tablero; los byes no son partidas. Los títulos se registran por separado y no se infieren de un puesto.',
  comparisons: 'Comparativos propios de demostración',
  comparisonsRule: 'Reglas propias de Casa Morra, no una réplica de otro club. Rendimiento = (G + 0,5 × E) / partidas al tablero; no se suman descansos ni tablas sin partidas. Ante igual rendimiento prevalece la mayor muestra, luego la fecha más antigua y el ID ascendente del torneo.',
  bestEvent: 'Mejor evento al tablero', worstEvent: 'Peor evento al tablero',
  noBoardEvents: 'Sin eventos con partidas al tablero.',
  favorable: 'Balance favorable', adverse: 'Balance adverso',
  rivalRule: 'Balance = victorias menos derrotas frente a cada rival. Solo se comparan parejas con al menos dos partidas al tablero; los empates son neutros. No son categorías por Elo.',
  noEligibleRivals: 'Sin rivales con al menos dos partidas al tablero.',
  noFavorable: 'Sin rival con balance favorable.', noAdverse: 'Sin rival con balance adverso.',
  gamesSample: (played) => `${formatNumber(played)} partida${played === 1 ? '' : 's'}`,
});

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const titleFor = (title) => `${title} — Casa Morra`;
const message = (messages, key) => messages?.[key] ?? playersEs[key];
const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR');
const initial = (name) => normalize(name).trim().charAt(0).toUpperCase();

function playerUrl(player) {
  return player && safeRouteHref(routeHref, 'player', { slug: player.slug });
}

function recordText(record) {
  return `${formatNumber(record.wins)}–${formatNumber(record.draws)}–${formatNumber(record.losses)}`;
}

function percentage(value) {
  return value == null ? 'Sin detalle' : `${formatNumber(value)} %`;
}

function membershipText(player, messages) {
  return message(messages, ({ socio: 'member', socia: 'memberFemale', no_socio: 'nonMember' })[player.membership] ?? 'membershipUnknown');
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

function officialHistory(data, profile, messages) {
  if (!profile.tournaments.length) return `<p>${h(message(messages, 'noEvents'))}</p>`;
  const events = new Map((data.tournaments ?? []).map((event) => [event.id, event]));
  const rows = [...profile.tournaments].reverse().map((standing) => {
    const event = events.get(standing.tournamentId);
    const url = event && safeRouteHref(routeHref, 'tournament', { slug: event.slug });
    const eventName = h(event?.name ?? standing.tournamentId);
    const linked = url ? `<a href="${h(url)}">${eventName}</a>` : eventName;
    const results = [standing.wins, standing.draws, standing.losses].map((value) =>
      `<td>${value == null ? h(message(messages, 'noDetail')) : h(formatNumber(value))}</td>`).join('');
    return `<tr><th scope="row">${linked}</th><td>${h(formatDate(standing.date))}</td><td>${h(formatNumber(standing.rank))}</td><td>${h(formatNumber(standing.points))}</td>${results}</tr>`;
  }).join('');
  return `<p id="players-official-scroll-hint" class="players-scroll-hint">${h(message(messages, 'scrollHint'))}</p><div class="players-table-wrap" role="region" aria-labelledby="players-official" aria-describedby="players-official-scroll-hint" tabindex="0"><table><caption>${h(message(messages, 'officialHistory'))}</caption><thead><tr>
    <th scope="col">${h(message(messages, 'tournament'))}</th><th scope="col">${h(message(messages, 'date'))}</th><th scope="col">${h(message(messages, 'rank'))}</th><th scope="col">${h(message(messages, 'points'))}</th>
    <th scope="col"><abbr title="${h(message(messages, 'wins'))}">G</abbr></th><th scope="col"><abbr title="${h(message(messages, 'draws'))}">E</abbr></th><th scope="col"><abbr title="${h(message(messages, 'losses'))}">P</abbr></th>
    </tr></thead><tbody>${rows}</tbody></table></div>`;
}

function ratingHistory(data, profile, messages) {
  if (!profile.elo.history.length) return `<p>${h(message(messages, 'noEloHistory'))}</p>`;
  const max = Math.max(2000, Math.ceil(profile.elo.peak / 100) * 100);
  const rows = profile.elo.history.map((step) => {
    const after = Math.round(step.after);
    return `<tr><th scope="row">${h(step.gameId)}</th><td>${h(formatDate(step.date))}</td><td>${h(playerName(data, step.opponentId))}</td>
      <td>${h(formatNumber(Math.round(step.before)))}</td><td><meter min="0" max="${h(max)}" value="${h(after)}">${h(formatNumber(after))}</meter> <span>${h(formatNumber(after))}</span></td></tr>`;
  }).join('');
  return `<p id="players-elo-scroll-hint" class="players-scroll-hint">${h(message(messages, 'scrollHint'))}</p><div class="players-table-wrap" role="region" aria-labelledby="players-elo" aria-describedby="players-elo-scroll-hint" tabindex="0"><table><caption>${h(message(messages, 'eloHistory'))}</caption><thead><tr>
    <th scope="col">${h(message(messages, 'game'))}</th><th scope="col">${h(message(messages, 'date'))}</th><th scope="col">${h(message(messages, 'opponent'))}</th><th scope="col">${h(message(messages, 'before'))}</th><th scope="col">${h(message(messages, 'after'))}</th>
    </tr></thead><tbody>${rows}</tbody></table></div>`;
}

function officialAchievements(profile, titleCount, messages) {
  const ranks = profile.tournaments.reduce((counts, row) => {
    if (row.rank === 1) counts.firstPlaces += 1;
    if (row.rank >= 1 && row.rank <= 3) counts.podiums += 1;
    return counts;
  }, { firstPlaces: 0, podiums: 0 });
  const entries = [
    ['officialPoints', profile.officialPoints], ['firstPlaces', ranks.firstPlaces],
    ['podiums', ranks.podiums], ['winningStreak', profile.streaks.winning],
    ['unbeatenStreak', profile.streaks.unbeaten], ['titleCount', titleCount],
  ];
  const items = entries.map(([key, value]) => `<div><dt>${h(message(messages, key))}</dt><dd>${h(formatNumber(value))}</dd></div>`).join('');
  return `<section aria-labelledby="players-career"><h2 id="players-career">${h(message(messages, 'career'))}</h2>
    <p>${h(message(messages, 'careerExplanation'))}</p><dl class="players-achievements">${items}</dl></section>`;
}

function eventCandidates(data, playerId) {
  const byEvent = new Map((data.tournaments ?? []).map((event) => [event.id, {
    event, wins: 0, draws: 0, losses: 0, played: 0,
  }]));
  for (const game of data.games ?? []) {
    if (game.whiteId !== playerId && game.blackId !== playerId) continue;
    const row = byEvent.get(game.tournamentId);
    if (!row) continue;
    if (game.result === '1/2-1/2') row.draws += 1;
    else if ((game.whiteId === playerId && game.result === '1-0') ||
             (game.blackId === playerId && game.result === '0-1')) row.wins += 1;
    else if (game.result === '1-0' || game.result === '0-1') row.losses += 1;
    else continue;
    row.played += 1;
  }
  return [...byEvent.values()].filter((row) => row.played > 0);
}

function compareEventRate(a, b) {
  return (2 * a.wins + a.draws) * b.played - (2 * b.wins + b.draws) * a.played;
}

function compareEventTie(a, b) {
  return b.played - a.played || a.event.date.localeCompare(b.event.date) || a.event.id.localeCompare(b.event.id);
}

function eventComparison(row, messages) {
  if (!row) return `<p>${h(message(messages, 'noBoardEvents'))}</p>`;
  const href = safeRouteHref(routeHref, 'tournament', { slug: row.event.slug });
  const name = h(row.event.name);
  const linked = href ? `<a href="${h(href)}">${name}</a>` : name;
  const rate = 100 * (row.wins + row.draws * 0.5) / row.played;
  return `<p>${linked} · ${h(formatNumber(rate))} % · ${h(message(messages, 'gamesSample')(row.played))} · G–E–P ${h(recordText(row))}</p>`;
}

function rivalCandidates(data, playerId) {
  return (data.players ?? []).filter((person) => person.id !== playerId).map((person) => {
    const pair = getHeadToHead(data, playerId, person.id);
    return pair && { person, ...pair.record, balance: pair.record.wins - pair.record.losses };
  }).filter((row) => row && row.played >= 2);
}

function rivalComparison(row, emptyKey, messages) {
  if (!row) return `<p>${h(message(messages, emptyKey))}</p>`;
  return `<p>${h(row.person.name)} · G–E–P ${h(recordText(row))} · ${h(message(messages, 'gamesSample')(row.played))}</p>`;
}

function personalComparisons(data, playerId, messages) {
  const events = eventCandidates(data, playerId);
  const best = [...events].sort((a, b) => -compareEventRate(a, b) || compareEventTie(a, b))[0];
  const worst = [...events].sort((a, b) => compareEventRate(a, b) || compareEventTie(a, b))[0];
  const rivals = rivalCandidates(data, playerId);
  const favorable = rivals.filter((row) => row.balance > 0)
    .sort((a, b) => b.balance - a.balance || b.played - a.played || a.person.id.localeCompare(b.person.id))[0];
  const adverse = rivals.filter((row) => row.balance < 0)
    .sort((a, b) => a.balance - b.balance || b.played - a.played || a.person.id.localeCompare(b.person.id))[0];
  return `<section aria-labelledby="players-comparisons"><h2 id="players-comparisons">${h(message(messages, 'comparisons'))}</h2>
    <p>${h(message(messages, 'comparisonsRule'))}</p>
    <div class="players-summary"><div><h3>${h(message(messages, 'bestEvent'))}</h3>${eventComparison(best, messages)}</div>
      <div><h3>${h(message(messages, 'worstEvent'))}</h3>${eventComparison(worst, messages)}</div></div>
    <p>${h(message(messages, 'rivalRule'))}</p>
    ${rivals.length ? '' : `<p>${h(message(messages, 'noEligibleRivals'))}</p>`}
    <div class="players-summary"><div><h3>${h(message(messages, 'favorable'))}</h3>${rivalComparison(favorable, 'noFavorable', messages)}</div>
      <div><h3>${h(message(messages, 'adverse'))}</h3>${rivalComparison(adverse, 'noAdverse', messages)}</div></div>
  </section>`;
}

export function renderPlayerProfile(data, slug, messages = playersEs) {
  const player = data.players?.find((person) => person.slug === slug);
  if (!player) return { title: titleFor(message(messages, 'notFound')),
    html: `<div class="players-page container"><h1>${h(message(messages, 'notFound'))}</h1><p>${h(message(messages, 'unknownPlayer'))}</p><a href="${h(routeHref('players'))}">${h(message(messages, 'back'))}</a></div>` };
  const profile = getPlayerProfile(data, player.id);
  const badges = (data.titles ?? []).filter((title) => title.playerId === player.id);
  const badgeItems = badges.map((title) => `<li>${h(title.label)}</li>`).join('');
  const count = profile.record;
  const colors = profile.colors;
  const html = `<div class="players-page container"><nav class="players-back" aria-label="${h(message(messages, 'back'))}"><a href="${h(routeHref('players'))}">${h(message(messages, 'back'))}</a></nav>
    <p class="players-eyebrow">${h(message(messages, 'demo'))}</p><h1>${h(player.name)}</h1><p class="players-membership">${h(membershipText(player, messages))}</p><p>${h(message(messages, 'accountNotice'))}</p>
    <section class="players-summary" aria-label="${h(message(messages, 'profile'))}">
      <div><h2>${h(message(messages, 'elo'))}</h2><p><strong>${h(formatNumber(Math.round(profile.elo.rating)))}</strong> · ${h(profile.elo.provisional ? message(messages, 'provisional') : message(messages, 'consolidated'))}</p>
        <p>${h(message(messages, 'peakElo'))}: ${h(formatNumber(Math.round(profile.elo.peak)))}</p><small>${h(message(messages, 'eloMethod'))}</small></div>
      <div><h2>${h(message(messages, 'games'))}</h2><p>${h(formatNumber(count.played))} · ${h(message(messages, 'record'))} ${h(recordText(count))}</p>
        <p>${h(message(messages, 'winsRate'))}: ${h(percentage(count.winRate))}</p><p>${h(message(messages, 'scoreRate'))}: ${h(percentage(count.scoreRate))}</p><small>${h(message(messages, 'rateExplanation'))}</small></div>
    </section><section aria-labelledby="players-colors"><h2 id="players-colors">${h(message(messages, 'games'))} · ${h(message(messages, 'white'))}/${h(message(messages, 'black'))}</h2>
      <dl class="players-colors"><div><dt>${h(message(messages, 'white'))}</dt><dd>${h(formatNumber(colors.white.played))} · ${h(message(messages, 'record'))} ${h(recordText(colors.white))}</dd></div>
      <div><dt>${h(message(messages, 'black'))}</dt><dd>${h(formatNumber(colors.black.played))} · ${h(message(messages, 'record'))} ${h(recordText(colors.black))}</dd></div></dl></section>
    ${officialAchievements(profile, badges.length, messages)}
    ${personalComparisons(data, player.id, messages)}
    <section aria-labelledby="players-titles"><h2 id="players-titles">${h(message(messages, 'titles'))}</h2>${badges.length ? `<ul>${badgeItems}</ul>` : `<p>${h(message(messages, 'noTitles'))}</p>`}</section>
    <section aria-labelledby="players-official"><h2 id="players-official">${h(message(messages, 'officialHistory'))}</h2><p>${h(message(messages, 'officialHistoryInfo'))}</p>${officialHistory(data, profile, messages)}</section>
    <section aria-labelledby="players-elo"><h2 id="players-elo">${h(message(messages, 'eloHistory'))}</h2><p>${h(message(messages, 'eloHistoryInfo'))}</p>${ratingHistory(data, profile, messages)}</section></div>`;
  return { title: titleFor(player.name), html };
}

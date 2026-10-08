// Helpers compartidos por las vistas públicas; no convierten datos en HTML confiable.
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

const DEFAULT_LOCALE = 'es-AR';
const DATE_FORMAT = Object.freeze({ day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const NUMBER_FORMAT = Object.freeze({ maximumFractionDigits: 1 });
const dateFormatters = new Map();
const numberFormatters = new Map();

function formatOptions(options, fallback) {
  if (typeof options === 'string') return { locale: options, fallback };
  return { locale: options?.locale ?? DEFAULT_LOCALE, fallback: options?.fallback ?? fallback };
}

function getFormatter(cache, locale, create) {
  if (!cache.has(locale)) cache.set(locale, create(locale));
  return cache.get(locale);
}

export function formatDate(isoDate, options) {
  const { locale, fallback } = formatOptions(options, 'Fecha no disponible');
  if (typeof isoDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return fallback;
  const date = new Date(`${isoDate}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== isoDate
    ? fallback : getFormatter(dateFormatters, locale, (language) => new Intl.DateTimeFormat(language, DATE_FORMAT)).format(date);
}

export function formatNumber(value, options) {
  const { locale, fallback } = formatOptions(options, 'Sin detalle');
  return typeof value === 'number' && Number.isFinite(value)
    ? getFormatter(numberFormatters, locale, (language) => new Intl.NumberFormat(language, NUMBER_FORMAT)).format(value)
    : fallback;
}

export const competitiveEs = Object.freeze({
  tournaments: 'Torneos', annual: 'Tabla anual', notFoundTournament: 'Torneo no encontrado',
  notFoundSeason: 'Temporada no encontrada', home: 'Inicio', players: 'Jugadores',
  tournamentIntro: 'Explorá las clasificaciones oficiales de los torneos ficticios. Una tabla puede existir aunque no haya partidas detalladas.',
  tournamentDetailLink: 'Ver clasificación y resultados', unavailableDetail: 'Detalle no disponible',
  tournamentDetailAccessible: (name) => `Ver clasificación y resultados de ${name}`,
  filterTournaments: 'Filtrar torneos', type: 'Tipo', season: 'Temporada',
  eventsCount: (shown, total) => `${shown} de ${total} torneos`,
  participants: 'participantes', rounds: 'rondas', round: 'Ronda',
  officialStanding: 'Clasificación oficial de', tournamentTable: 'Tabla del torneo',
  rank: 'Puesto', player: 'Jugador', points: 'Puntos', wins: 'Ganadas',
  draws: 'Empatadas', losses: 'Perdidas', noDetail: 'Sin detalle',
  boardResults: 'Resultados al tablero', byes: 'Descansos (byes)',
  whites: 'blancas', blacks: 'negras', byePoint: (points) => `punto${points === 1 ? '' : 's'} por descanso`,
  backTournaments: '← Torneos', annualLink: 'Ver tabla anual de',
  unknownTournament: 'El identificador no coincide con ningún torneo de la muestra.',
  unknownSeason: 'La temporada solicitada no forma parte de la muestra.',
  viewTournaments: 'Ver torneos', seasons: 'Temporadas', annualIntro: 'Temporada de agosto a julio. Puntos y participaciones de las clasificaciones oficiales de la muestra.',
  annualEvents: 'Torneos incluidos', demoRules: 'Reglas de esta muestra',
  annualTies: 'Los empates de puntos comparten puesto.',
  seasonAnnual: 'Tabla anual', tournamentsColumn: 'Torneos', movement: 'Movimiento',
  rises: (positions) => `Sube ${positions}`, falls: (positions) => `Baja ${positions}`,
  allTypes: 'Todos los tipos', allSeasons: 'Todas las temporadas', search: 'Filtrar',
  clear: 'Ver todos', noTournaments: 'No hay torneos para estos filtros.',
  noGames: 'No se registraron partidas individuales para este torneo. La clasificación oficial permanece disponible.',
  noByes: 'No se registraron descansos en este torneo.',
  noMoves: 'Sin jugadas registradas', movesPending: 'Jugadas registradas; visor en preparación',
  noAnnual: 'Todavía no hay eventos elegibles en esta temporada.',
  noStandings: 'No hay clasificación oficial disponible.',
  newAnnual: 'Nuevo', unchanged: 'Sin cambios',
  annualComparison: 'Respecto del torneo anterior de la misma temporada.',
  annualExclusions: 'No se incluyen torneos marcados como no elegibles en la muestra. Los resultados individuales y los byes no se vuelven a sumar: se toman los puntos oficiales de cada tabla.',
  circuitNotice: 'Un circuito completo distinguiría resultados de torneos, tabla anual, clasificación a Candidatos y posterior match. Aquí no se calculan plazas: la tabla no otorga cupos ni inscripciones en esta demostración.',
  demo: 'Datos ficticios de demostración',
  eventTypes: Object.freeze({ interno: 'Interno', abierto: 'Abierto', candidatos: 'Candidatos', match: 'Match' }),
});

export function playerName(data, playerId) {
  return data.players?.find((player) => player.id === playerId)?.name ?? playerId;
}

export function typeName(type, messages = competitiveEs) {
  const names = messages?.eventTypes ?? competitiveEs.eventTypes;
  return Object.hasOwn(names, type) ? names[type] : type;
}

export function safeRouteHref(routeHref, name, params = {}, query = {}) {
  try { return routeHref(name, params, query); } catch { return null; }
}

export function playerLink(data, playerId, routeHref) {
  const player = data.players?.find((item) => item.id === playerId);
  const href = player && safeRouteHref(routeHref, 'player', { slug: player.slug });
  const name = escapeHtml(playerName(data, playerId));
  return href ? `<a href="${escapeHtml(href)}">${name}</a>` : name;
}

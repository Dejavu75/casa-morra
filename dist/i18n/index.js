// El español es el idioma publicado. Otros catálogos pueden añadirse sin cambiar las vistas.
import { competitiveEs } from '../views/common.js';
import { playersEs } from '../views/players.js';
import { recordsEs } from '../views/records.js';
import { homeEs } from '../views/home.js';
import { editorialEs } from '../views/editorial.js';
import { gameEs } from '../views/game.js';
import { puzzleEs } from '../views/puzzle.js';

export const es = Object.freeze({
  'meta.description': 'Casa Morra: torneos, jugadores, estadísticas y partidas ficticias de ajedrez.',
  'skip.content': 'Saltar al contenido',
  'brand.home': 'Casa Morra, ir al inicio',
  'nav.menu': 'Menú',
  'nav.main': 'Navegación principal',
  'nav.home': 'Inicio',
  'nav.tournaments': 'Torneos',
  'nav.players': 'Jugadores',
  'nav.statistics': 'Estadísticas',
  'nav.classics': 'Clásicos',
  'nav.news': 'Novedades',
  'nav.classes': 'Clases',
  'nav.about': 'Nosotros',
  'nav.membership': 'Socios',
  'nav.project': 'El proyecto',
  'nav.next': 'Próximamente',
  'theme.dark': 'Modo oscuro',
  'theme.light': 'Modo claro',
  'hero.eyebrow': 'Una nueva casa para el ajedrez',
  'hero.action': 'Conocer el proyecto',
  'hero.demo': 'Datos de demostración · Sitio en desarrollo',
  'project.kicker': 'El proyecto',
  'project.note': 'Proyecto independiente · Contenido de demostración',
  'next.kicker': 'Lo que viene',
  'next.label': 'Secciones en preparación',
  'card.tournaments': '01 / TORNEOS',
  'card.players': '02 / JUGADORES',
  'card.games': '03 / PARTIDAS',
  'card.pending': 'En preparación',
  'footer.demo': 'Datos de demostración. Sin cuentas ni inscripción en esta etapa.',
  'footer.tagline': 'Una casa digital para el ajedrez.',
  'notFound.title': 'Página no encontrada',
  'notFound.body': 'La dirección solicitada no forma parte de esta demostración.',
  'notFound.home': 'Volver al inicio',
  views: Object.freeze({
    competitive: competitiveEs,
    players: playersEs,
    records: recordsEs,
    home: homeEs,
    editorial: editorialEs,
    game: gameEs,
    puzzle: puzzleEs,
  }),
});

export const catalogs = Object.freeze({ es });

export function resolveLocale(locale, available = catalogs) {
  const language = typeof locale === 'string' ? locale.toLowerCase().split('-')[0] : '';
  return Object.hasOwn(available, language) ? language : 'es';
}

export function translate(key, locale = 'es', available = catalogs) {
  const selected = available[resolveLocale(locale, available)];
  return selected?.[key] ?? available.es?.[key] ?? key;
}

function mergeMessages(fallback, selected) {
  const result = { ...fallback };
  for (const [key, value] of Object.entries(selected ?? {})) {
    if (value == null) continue;
    const original = fallback?.[key];
    result[key] = original && value && typeof original === 'object' && typeof value === 'object' &&
      !Array.isArray(original) && !Array.isArray(value)
      ? mergeMessages(original, value) : value;
  }
  return result;
}

export function resolveViewMessages(namespace, locale = 'es', available = catalogs) {
  const language = resolveLocale(locale, available);
  return mergeMessages(available.es?.views?.[namespace], available[language]?.views?.[namespace]);
}

export function applyTranslations(root, locale = 'es', available = catalogs) {
  const resolved = resolveLocale(locale, available);
  for (const element of root.querySelectorAll('[data-i18n]')) {
    element.textContent = translate(element.dataset.i18n, resolved, available);
  }
  for (const element of root.querySelectorAll('[data-i18n-aria]')) {
    element.setAttribute('aria-label', translate(element.dataset.i18nAria, resolved, available));
  }
  for (const element of root.querySelectorAll('[data-i18n-placeholder]')) {
    element.setAttribute('placeholder', translate(element.dataset.i18nPlaceholder, resolved, available));
  }
  for (const element of root.querySelectorAll('[data-i18n-content]')) {
    element.setAttribute('content', translate(element.dataset.i18nContent, resolved, available));
  }
  root.documentElement.lang = resolved;
  return resolved;
}

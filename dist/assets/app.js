import * as demo from '../data/demo.js';
import { applyTranslations, catalogs as defaultCatalogs, resolveLocale, resolveViewMessages, translate } from '../i18n/index.js?v=0.10.1-brand';
import { parseRoute, routeHref } from '../router.js';
import { renderTournamentList, renderTournamentDetail } from '../views/tournaments.js';
import { renderAnnual } from '../views/annual.js?v=0.10.1-brand';
import { renderPlayersDirectory, renderPlayerProfile } from '../views/players.js?v=0.10.1-brand';
import { renderStatistics, renderClassics, renderClassic } from '../views/records.js?v=0.10.1-brand';
import { renderAbout, renderNewsList, renderNewsDetail, renderClasses, renderMembership } from '../views/editorial.js?v=0.10.1-brand';
import { renderGame, attachGameReplay } from '../views/game.js';
import { renderElo } from '../views/elo.js';
import { renderEncyclopedia, renderComparison } from '../views/encyclopedia.js';
import { escapeHtml as h } from '../views/common.js';
import { applyTheme, nextTheme, readTheme, saveTheme } from './theme.js';
import { createDemoSource } from './demo-source.js';

const demoData = { ...demo };
const navGroup = Object.freeze({
  tournament: 'tournaments', annual: 'tournaments', player: 'players', compare: 'players',
  game: 'encyclopedia',
  classic: 'classics', 'news-detail': 'news',
});

export function createViewContext(locale = 'es', catalogs = defaultCatalogs) {
  const resolved = resolveLocale(locale, catalogs);
  return {
    locale: resolved === 'es' ? 'es-AR' : locale,
    messages: (namespace) => resolveViewMessages(namespace, resolved, catalogs),
  };
}

export function renderRoute(route, source = demoData, { locale = 'es', catalogs = defaultCatalogs } = {}) {
  const context = createViewContext(locale, catalogs);
  const { messages } = context;
  const formatLocale = context.locale;
  switch (route.name) {
    case 'home': return renderStatistics(source, messages('records'), formatLocale);
    case 'tournaments': return renderTournamentList(source, route.query, messages('competitive'), formatLocale);
    case 'tournament': return renderTournamentDetail(source, route.params.slug, messages('competitive'), formatLocale);
    case 'annual': return renderAnnual(source, route.params.seasonId, messages('competitive'), formatLocale);
    case 'players': return renderPlayersDirectory(source, route.query, messages('players'), formatLocale);
    case 'player': return renderPlayerProfile(source, route.params.slug, messages('players'), formatLocale);
    case 'statistics': return renderStatistics(source, messages('records'), formatLocale);
    case 'elo': return renderElo(source, route.query, messages('elo'), formatLocale);
    case 'encyclopedia': return renderEncyclopedia(source, route.query, messages('encyclopedia'), formatLocale);
    case 'compare': return renderComparison(source, route.query, messages('comparison'), formatLocale);
    case 'classics': return renderClassics(source, messages('records'), formatLocale);
    case 'classic': return renderClassic(source, route.params.first, route.params.second, messages('records'), formatLocale);
    case 'about': return renderAbout(source, messages('editorial'), formatLocale);
    case 'news': return renderNewsList(source, messages('editorial'), formatLocale);
    case 'news-detail': return renderNewsDetail(source, route.params.slug, messages('editorial'), formatLocale);
    case 'classes': return renderClasses(source, messages('editorial'), formatLocale);
    case 'membership': return renderMembership(source, messages('editorial'), formatLocale);
    case 'game': return renderGame(source, route.params.id, undefined, messages('game'), formatLocale);
    default: {
      const title = translate('notFound.title', locale, catalogs);
      const body = translate('notFound.body', locale, catalogs);
      const home = translate('notFound.home', locale, catalogs);
      return {
        title,
        html: `<div class="content-page container"><h1>${h(title)}</h1><p>${h(body)}</p><a href="${routeHref('home')}">${h(home)}</a></div>`,
      };
    }
  }
}

export function resolvePublicRoute(route) {
  if (['home', 'statistics', 'elo', 'encyclopedia', 'compare', 'players', 'player', 'tournaments', 'tournament',
    'annual', 'classics', 'classic', 'game', 'not-found'].includes(route.name)) {
    return { route, redirect: false };
  }
  return { route: parseRoute(routeHref('statistics')), redirect: true };
}

export function shouldClientNavigate(event, anchor, currentOrigin) {
  if (!anchor || event.defaultPrevented || event.button !== 0 || event.metaKey ||
      event.ctrlKey || event.shiftKey || event.altKey || anchor.hasAttribute('download') ||
      (anchor.target && anchor.target.toLowerCase() !== '_self')) return false;
  const rawHref = anchor.getAttribute('href');
  if (!rawHref || rawHref.startsWith('#')) return false;
  try {
    const url = new URL(anchor.href);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === currentOrigin;
  } catch {
    return false;
  }
}

export function closeMenuOnEscape(event, button, navigation, close) {
  const expanded = button?.getAttribute('aria-expanded') === 'true';
  const focusInside = event.target === button || navigation?.contains(event.target);
  if (event.key !== 'Escape' || !expanded || !focusInside) return false;
  close();
  button.focus();
  event.preventDefault();
  return true;
}

export function renderThemeToggle(button, theme, locale = 'es', catalogs = defaultCatalogs) {
  if (!button) return;
  const label = translate('theme.dark', locale, catalogs);
  button.setAttribute('aria-pressed', String(theme === 'oscuro'));
  button.setAttribute('aria-label', label);
  const labelNode = button.querySelector('[data-theme-label]');
  if (labelNode) labelNode.textContent = label;
}

function startApp() {
  const locale = applyTranslations(document, document.documentElement.lang);
  const { messages } = createViewContext(locale);
  const main = document.querySelector('#contenido');
  const menuButton = document.querySelector('[data-menu-toggle]');
  const navigation = document.querySelector('#navegacion-principal');
  const themeButton = document.querySelector('[data-theme-toggle]');
  const sourceStatus = document.querySelector('[data-demo-status]');
  const warning = document.querySelector('[data-demo-warning]');
  const warningText = document.querySelector('[data-demo-warning-text]');
  if (!main) return;
  main.tabIndex = -1;

  let storage = null;
  try { storage = window.localStorage; } catch { /* El sitio sigue funcionando sin almacenamiento. */ }
  let theme = readTheme(storage) ?? (window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'oscuro' : 'claro');
  let detachReplay = () => {};
  let activeData = demoData;
  const source = createDemoSource({ fixture: demoData, fetch: (...args) => window.fetch(...args),
    crypto: window.crypto, onPending() {
      if (sourceStatus) sourceStatus.textContent = translate('demo.status.loading', locale);
    }, onChange(state) {
      activeData = state.data;
      if (sourceStatus) sourceStatus.textContent = translate(state.warning ?
        'demo.status.unavailable' : state.kind === 'export' ? 'demo.status.export' : 'demo.status.fixture', locale);
      if (warning) {
        warning.hidden = !state.warning;
        if (warningText && state.warning) warningText.textContent = translate(state.warning, locale);
      }
      renderLocation();
    } });

  function renderTheme() {
    applyTheme(document, theme);
    renderThemeToggle(themeButton, theme, locale);
  }

  function setMenuOpen(open) {
    if (!menuButton || !navigation) return;
    menuButton.setAttribute('aria-expanded', String(open));
    navigation.classList.toggle('is-open', open);
  }

  function renderLocation({ focus = false, scroll = false } = {}) {
    const requested = parseRoute(window.location.pathname, window.location.search);
    const { route, redirect } = resolvePublicRoute(requested);
    if (redirect) window.history.replaceState({}, '', routeHref('statistics'));
    const page = renderRoute(route, activeData, { locale });
    detachReplay();
    detachReplay = () => {};
    main.innerHTML = page.html;
    document.title = page.title.includes('Centro de estadísticas') ? page.title : `${page.title} — Centro de estadísticas`;
    const active = route.name === 'home' ? 'statistics' : navGroup[route.name] ?? route.name;
    for (const link of navigation?.querySelectorAll('[data-route-name]') ?? []) {
      if (link.dataset.routeName === active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    if (route.name === 'game') {
      detachReplay = attachGameReplay(main.querySelector('[data-game-replay]'), activeData, route.params.id, messages('game'));
    }
    setMenuOpen(false);
    if (focus) main.focus({ preventScroll: true });
    if (scroll) window.scrollTo(0, 0);
  }

  renderTheme();

  themeButton?.addEventListener('click', () => {
    theme = nextTheme(theme);
    saveTheme(storage, theme);
    renderTheme();
  });
  menuButton?.addEventListener('click', () => {
    setMenuOpen(menuButton.getAttribute('aria-expanded') !== 'true');
  });
  document.addEventListener('keydown', (event) => {
    closeMenuOnEscape(event, menuButton, navigation, () => setMenuOpen(false));
  });
  document.addEventListener('click', (event) => {
    const anchor = event.target?.closest?.('a[href]');
    if (!shouldClientNavigate(event, anchor, window.location.origin)) return;
    const url = new URL(anchor.href);
    event.preventDefault();
    window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
    void source.refresh().then((state) => {
      if (state) { main.focus({ preventScroll: true }); window.scrollTo(0, 0); }
    });
  });
  window.addEventListener('popstate', () => {
    void source.refresh().then((state) => { if (state) main.focus({ preventScroll: true }); });
  });

  const year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
  renderLocation();
  void source.refresh();
}

if (typeof document !== 'undefined') startApp();

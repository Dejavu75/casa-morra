import * as demo from '../data/demo.js';
import { applyTranslations, catalogs as defaultCatalogs, resolveViewMessages, translate } from '../i18n/index.js';
import { parseRoute, routeHref } from '../router.js';
import { renderTournamentList, renderTournamentDetail } from '../views/tournaments.js';
import { renderAnnual } from '../views/annual.js';
import { renderPlayersDirectory, renderPlayerProfile } from '../views/players.js';
import { renderStatistics, renderClassics, renderClassic } from '../views/records.js';
import { renderHome } from '../views/home.js';
import { renderAbout, renderNewsList, renderNewsDetail, renderClasses, renderMembership } from '../views/editorial.js';
import { renderGame, attachGameReplay } from '../views/game.js';
import { attachPuzzle } from '../views/puzzle.js';
import { escapeHtml as h } from '../views/common.js';
import { applyTheme, nextTheme, readTheme, saveTheme } from './theme.js';
import { createDemoSource } from './demo-source.js';

const demoData = { ...demo };
const navGroup = Object.freeze({
  tournament: 'tournaments', annual: 'tournaments', player: 'players',
  classic: 'classics', 'news-detail': 'news',
});

export function renderRoute(route, source = demoData, { locale = 'es', catalogs = defaultCatalogs } = {}) {
  const messages = (namespace) => resolveViewMessages(namespace, locale, catalogs);
  switch (route.name) {
    case 'home': return renderHome(source, { puzzleMessages: messages('puzzle') }, messages('home'));
    case 'tournaments': return renderTournamentList(source, route.query, messages('competitive'));
    case 'tournament': return renderTournamentDetail(source, route.params.slug, messages('competitive'));
    case 'annual': return renderAnnual(source, route.params.seasonId, messages('competitive'));
    case 'players': return renderPlayersDirectory(source, route.query, messages('players'));
    case 'player': return renderPlayerProfile(source, route.params.slug, messages('players'));
    case 'statistics': return renderStatistics(source, messages('records'));
    case 'classics': return renderClassics(source, messages('records'));
    case 'classic': return renderClassic(source, route.params.first, route.params.second, messages('records'));
    case 'about': return renderAbout(source, messages('editorial'));
    case 'news': return renderNewsList(source, messages('editorial'));
    case 'news-detail': return renderNewsDetail(source, route.params.slug, messages('editorial'));
    case 'classes': return renderClasses(source, messages('editorial'));
    case 'membership': return renderMembership(source, messages('editorial'));
    case 'game': return renderGame(source, route.params.id, undefined, messages('game'));
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
  const main = document.querySelector('#contenido');
  const menuButton = document.querySelector('[data-menu-toggle]');
  const navigation = document.querySelector('#navegacion-principal');
  const themeButton = document.querySelector('[data-theme-toggle]');
  const refreshButton = document.querySelector('[data-demo-refresh]');
  const warning = document.querySelector('[data-demo-warning]');
  if (!main) return;
  main.tabIndex = -1;

  let storage = null;
  try { storage = window.localStorage; } catch { /* El sitio sigue funcionando sin almacenamiento. */ }
  let theme = readTheme(storage) ?? (window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'oscuro' : 'claro');
  let detachReplay = () => {};
  let detachPuzzle = () => {};
  let activeData = demoData;
  const source = createDemoSource({ fixture: demoData, fetch: (...args) => window.fetch(...args),
    crypto: window.crypto, onChange(state) {
      activeData = state.data;
      if (warning) {
        warning.hidden = !state.warning;
        warning.textContent = state.warning ? translate(state.warning, locale) : '';
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
    const route = parseRoute(window.location.pathname, window.location.search);
    const page = renderRoute(route, activeData, { locale });
    detachReplay();
    detachPuzzle();
    detachReplay = () => {};
    detachPuzzle = () => {};
    main.innerHTML = page.html;
    document.title = page.title.includes('Casa Morra') ? page.title : `${page.title} — Casa Morra`;
    const active = navGroup[route.name] ?? route.name;
    for (const link of navigation?.querySelectorAll('[data-route-name]') ?? []) {
      if (link.dataset.routeName === active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    if (route.name === 'game') {
      detachReplay = attachGameReplay(main.querySelector('[data-game-replay]'), activeData, route.params.id);
    }
    if (route.name === 'home') {
      detachPuzzle = attachPuzzle(main.querySelector('[data-puzzle-host]'), {
        messages: resolveViewMessages('puzzle', locale),
      });
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
  refreshButton?.addEventListener('click', () => { void source.refresh(); });
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

import * as demo from '../data/demo.js';
import { catalogs as defaultCatalogs, resolveViewMessages, translate } from '../i18n/index.js';
import { routeHref } from '../router.js';
import { renderTournamentList, renderTournamentDetail } from '../views/tournaments.js';
import { renderAnnual } from '../views/annual.js';
import { renderPlayersDirectory, renderPlayerProfile } from '../views/players.js';
import { renderStatistics, renderClassics, renderClassic } from '../views/records.js';
import { renderHome } from '../views/home.js';
import { renderAbout, renderNewsList, renderNewsDetail, renderClasses, renderMembership } from '../views/editorial.js';
import { renderGame } from '../views/game.js';
import { escapeHtml as h } from '../views/common.js';

const demoData = { ...demo };

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

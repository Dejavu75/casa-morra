import { getAnnualStandings, getHomeTotals } from '../domain/statistics.js';
import { routeHref } from '../router.js';
import { escapeHtml as h, formatDate, formatNumber, playerLink, playerName, safeRouteHref } from './common.js';
import { hasDemoReplay } from './game.js';
import { puzzleEs, renderPuzzle } from './puzzle.js';

export const homeEs = Object.freeze({
  title: 'Casa Morra — Ajedrez de demostración', eyebrow: 'Datos ficticios de demostración',
  headline: 'Toda gran partida empieza con una idea.',
  intro: 'Historias, torneos y partidas de una casa de ajedrez imaginaria. Cada cifra procede de la misma muestra ficticia.',
  players: 'jugadores', tournaments: 'torneos', games: 'partidas',
  upcoming: 'Próximo torneo', noUpcoming: 'No hay un próximo torneo programado en esta muestra.',
  annual: 'Primeros puestos de la anual', annualEmpty: 'Todavía no hay resultados elegibles para la tabla anual.',
  allAnnual: 'Ver tabla anual', news: 'Novedades', allNews: 'Ver todas las novedades',
  featured: 'Partida destacada', featuredEmpty: 'No hay jugadas reproducibles en esta muestra.',
  replay: 'Reproducir secuencia disponible', replayNote: 'Secuencia UCI ilustrativa; no es un PGN completo.',
  about: 'Conocer Casa Morra', classes: 'Ver clases ficticias', membership: 'Información para socios',
  explore: 'Explorar Casa Morra', totals: 'Cifras de demostración', points: 'puntos',
  noNews: 'Sin novedades publicadas en esta muestra.', projectInfo: 'Información del proyecto',
  galleryTitle: 'Imágenes para imaginar la próxima partida', galleryChoose: 'Elegir una escena',
  galleryStudy: 'Mesa de estudio', galleryRoom: 'Sala de análisis',
  galleryStudyAlt: 'Ilustración de un tablero de ajedrez junto a un cuaderno abierto sobre una mesa',
  galleryRoomAlt: 'Ilustración de una sala vacía con dos tableros de ajedrez preparados',
  galleryStudyCaption: 'Una mesa para revisar ideas y anotar variantes.',
  galleryRoomCaption: 'Un espacio imaginario para compartir el análisis.',
  galleryDisclaimer: 'Imagen generada para esta demostración; no retrata una sede real.',
});

const msg = (messages, key) => messages?.[key] ?? homeEs[key];

function localToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function upcomingTournament(data, today) {
  return (data.tournaments ?? []).filter((event) => event.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))[0] ?? null;
}

function renderGallery(messages) {
  return `<section class="home-gallery" aria-labelledby="home-gallery-title"><h2 id="home-gallery-title">${h(msg(messages, 'galleryTitle'))}</h2>
    <fieldset class="editorial-carousel"><legend>${h(msg(messages, 'galleryChoose'))}</legend>
      <input type="radio" name="gallery-home" id="gallery-home-1" checked><label for="gallery-home-1">${h(msg(messages, 'galleryStudy'))}</label>
      <input type="radio" name="gallery-home" id="gallery-home-2"><label for="gallery-home-2">${h(msg(messages, 'galleryRoom'))}</label>
      <div class="gallery-frames">
        <figure class="gallery-slide gallery-slide-1"><img src="/assets/galeria-estudio.png" alt="${h(msg(messages, 'galleryStudyAlt'))}" loading="lazy" decoding="async" width="1536" height="1024"><figcaption>${h(msg(messages, 'galleryStudyCaption'))} <span>${h(msg(messages, 'galleryDisclaimer'))}</span></figcaption></figure>
        <figure class="gallery-slide gallery-slide-2"><img src="/assets/galeria-sala.png" alt="${h(msg(messages, 'galleryRoomAlt'))}" loading="lazy" decoding="async" width="1536" height="1024"><figcaption>${h(msg(messages, 'galleryRoomCaption'))} <span>${h(msg(messages, 'galleryDisclaimer'))}</span></figcaption></figure>
      </div>
    </fieldset>
  </section>`;
}

export function renderHome(data, { today = localToday(), puzzleMessages = puzzleEs } = {}, messages = homeEs) {
  const totals = getHomeTotals(data);
  const season = [...(data.seasons ?? [])].sort((a, b) => b.start.localeCompare(a.start))[0];
  const annual = season ? getAnnualStandings(data, season.id).standings.slice(0, 5) : [];
  const annualUrl = season && safeRouteHref(routeHref, 'annual', { seasonId: season.id });
  const future = upcomingTournament(data, today);
  const futureUrl = future && safeRouteHref(routeHref, 'tournament', { slug: future.slug });
  const featured = data.games?.find(hasDemoReplay);
  const featuredUrl = featured && safeRouteHref(routeHref, 'game', { id: featured.id });
  const featuredEvent = featured && data.tournaments?.find((event) => event.id === featured.tournamentId);
  const news = [...(data.editorial?.news ?? [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2);
  const annualRows = annual.map((row) => `<li class="home-annual-row"><span>${h(formatNumber(row.rank))}.</span> ${playerLink(data, row.playerId, routeHref)} <strong>${h(formatNumber(row.points))} ${h(msg(messages, 'points'))}</strong></li>`).join('');
  const newsRows = news.map((item) => {
    const href = safeRouteHref(routeHref, 'news-detail', { slug: item.slug });
    return `<li><article><p>${h(formatDate(item.date))}</p><h3>${href ? `<a href="${h(href)}">${h(item.title)}</a>` : h(item.title)}</h3><p>${h(item.excerpt)}</p></article></li>`;
  }).join('');
  const futureHtml = future ? `<p>${futureUrl ? `<a href="${h(futureUrl)}">${h(future.name)}</a>` : h(future.name)} · ${h(formatDate(future.date))}</p>`
    : `<p>${h(msg(messages, 'noUpcoming'))}</p>`;
  const featuredHtml = featured && featuredUrl
    ? `<p>${h(playerName(data, featured.whiteId))} — ${h(playerName(data, featured.blackId))}${featuredEvent ? ` · ${h(featuredEvent.name)}` : ''}</p><a href="${h(featuredUrl)}">${h(msg(messages, 'replay'))}</a><p class="content-note">${h(msg(messages, 'replayNote'))}</p>`
    : `<p>${h(msg(messages, 'featuredEmpty'))}</p>`;
  return { title: msg(messages, 'title'), html: `<div class="content-page content-home container">
    <section class="content-hero" aria-labelledby="home-title"><p class="content-eyebrow">${h(msg(messages, 'eyebrow'))}</p><h1 id="home-title">${h(msg(messages, 'headline'))}</h1><p>${h(msg(messages, 'intro'))}</p>
      <nav aria-label="${h(msg(messages, 'explore'))}"><a href="${h(routeHref('tournaments'))}">${h(msg(messages, 'tournaments'))}</a><a href="${h(routeHref('players'))}">${h(msg(messages, 'players'))}</a><a href="${h(routeHref('about'))}">${h(msg(messages, 'about'))}</a></nav></section>
    <section class="home-totals" aria-label="${h(msg(messages, 'totals'))}"><p><strong>${h(formatNumber(totals.players))}</strong> ${h(msg(messages, 'players'))}</p><p><strong>${h(formatNumber(totals.tournaments))}</strong> ${h(msg(messages, 'tournaments'))}</p><p><strong>${h(formatNumber(totals.games))}</strong> ${h(msg(messages, 'games'))}</p></section>
    ${renderGallery(messages)}
    <div data-puzzle-host>${renderPuzzle(puzzleMessages)}</div>
    <div class="home-grid"><section aria-labelledby="home-next"><h2 id="home-next">${h(msg(messages, 'upcoming'))}</h2>${futureHtml}</section>
      <section aria-labelledby="home-annual"><h2 id="home-annual">${h(msg(messages, 'annual'))}${season ? ` · ${h(season.label)}` : ''}</h2>${annualRows ? `<ul class="home-annual">${annualRows}</ul>` : `<p>${h(msg(messages, 'annualEmpty'))}</p>`}${annualUrl ? `<a href="${h(annualUrl)}">${h(msg(messages, 'allAnnual'))}</a>` : ''}</section></div>
    <section aria-labelledby="home-news"><h2 id="home-news">${h(msg(messages, 'news'))}</h2>${newsRows ? `<ul class="content-card-grid">${newsRows}</ul>` : `<p>${h(msg(messages, 'noNews'))}</p>`}<a href="${h(routeHref('news'))}">${h(msg(messages, 'allNews'))}</a></section>
    <section aria-labelledby="home-featured"><h2 id="home-featured">${h(msg(messages, 'featured'))}</h2>${featuredHtml}</section>
    <nav class="content-end-links" aria-label="${h(msg(messages, 'projectInfo'))}"><a href="${h(routeHref('classes'))}">${h(msg(messages, 'classes'))}</a><a href="${h(routeHref('membership'))}">${h(msg(messages, 'membership'))}</a></nav>
  </div>` };
}

import { routeHref } from '../router.js';
import { escapeHtml as h, formatDate, safeRouteHref } from './common.js';

export const editorialEs = Object.freeze({
  demo: 'Datos ficticios de demostración', about: 'Sobre Casa Morra',
  news: 'Novedades', newsMissing: 'Novedad no encontrada',
  newsEmpty: 'No hay novedades publicadas en esta muestra.',
  newsBack: '← Todas las novedades',
  classes: 'Clases', classesCaption: 'Clases ficticias de Casa Morra',
  classesEmpty: 'No hay clases programadas en esta muestra.',
  day: 'Día', hour: 'Horario', class: 'Clase', teacher: 'Docente', level: 'Nivel', place: 'Lugar',
  membership: 'Socios', noApplications: 'No se reciben solicitudes ni pagos. Este sitio funciona solo como demostración pública.',
  clubOnly: 'Las clases, docentes y salas son ficticios. No existe reserva ni inscripción desde esta página.',
  newsUnknown: 'El identificador no coincide con ninguna novedad publicada.',
  goNews: 'Ver novedades', aboutNote: 'Este contenido no describe una institución real.',
  history: 'Historia de la muestra', explore: 'Explorar', viewTournaments: 'Ver torneos',
  galleryTitle: 'Galería de Casa Morra', galleryIntro: 'Escenas imaginarias creadas para la demostración.',
  galleryStudyAlt: 'Ilustración de un tablero de ajedrez y un cuaderno sobre una mesa de estudio',
  galleryRoomAlt: 'Ilustración de una sala vacía con dos tableros listos para analizar partidas',
  galleryStudyCaption: 'La mesa de estudio: un lugar imaginado para revisar variantes.',
  galleryRoomCaption: 'La sala de análisis: una escena ficticia, no una sede abierta al público.',
});

const msg = (messages, key) => messages?.[key] ?? editorialEs[key];
const shell = (heading, content, messages) => ({ title: `${heading} — Casa Morra`,
  html: `<div class="content-page container"><p class="content-eyebrow">${h(msg(messages, 'demo'))}</p><h1>${h(heading)}</h1>${content}</div>` });

export function renderAbout(data, messages = editorialEs) {
  const club = data.editorial?.club ?? {};
  return shell(msg(messages, 'about'), `<p class="content-lead">${h(club.description)}</p><section aria-labelledby="about-history"><h2 id="about-history">${h(msg(messages, 'history'))}</h2><p>${h(club.history)}</p></section>
    <section class="institution-gallery" aria-labelledby="institution-gallery-title"><h2 id="institution-gallery-title">${h(msg(messages, 'galleryTitle'))}</h2><p class="content-note">${h(msg(messages, 'galleryIntro'))}</p>
      <div class="institution-gallery-grid"><figure><img src="/assets/galeria-estudio.png" alt="${h(msg(messages, 'galleryStudyAlt'))}" loading="lazy" decoding="async" width="1536" height="1024"><figcaption>${h(msg(messages, 'galleryStudyCaption'))}</figcaption></figure>
      <figure><img src="/assets/galeria-sala.png" alt="${h(msg(messages, 'galleryRoomAlt'))}" loading="lazy" decoding="async" width="1536" height="1024"><figcaption>${h(msg(messages, 'galleryRoomCaption'))}</figcaption></figure></div>
    </section>
    <p class="content-note">${h(msg(messages, 'aboutNote'))}</p><nav class="content-end-links" aria-label="${h(msg(messages, 'explore'))}"><a href="${h(routeHref('tournaments'))}">${h(msg(messages, 'viewTournaments'))}</a><a href="${h(routeHref('news'))}">${h(msg(messages, 'goNews'))}</a></nav>`, messages);
}

export function renderNewsList(data, messages = editorialEs) {
  const items = [...(data.editorial?.news ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const cards = items.map((item) => {
    const url = safeRouteHref(routeHref, 'news-detail', { slug: item.slug });
    return `<li><article><p>${h(formatDate(item.date))}</p><h2>${url ? `<a href="${h(url)}">${h(item.title)}</a>` : h(item.title)}</h2><p>${h(item.excerpt)}</p></article></li>`;
  }).join('');
  return shell(msg(messages, 'news'), cards ? `<ul class="content-card-grid">${cards}</ul>` : `<p>${h(msg(messages, 'newsEmpty'))}</p>`, messages);
}

export function renderNewsDetail(data, slug, messages = editorialEs) {
  const item = data.editorial?.news?.find((entry) => entry.slug === slug);
  if (!item) return shell(msg(messages, 'newsMissing'), `<p>${h(msg(messages, 'newsUnknown'))}</p><a href="${h(routeHref('news'))}">${h(msg(messages, 'goNews'))}</a>`, messages);
  return shell(item.title, `<p>${h(formatDate(item.date))}</p><p class="content-lead">${h(item.excerpt)}</p><article><p>${h(item.body)}</p></article>
    <p class="content-note">${h(msg(messages, 'aboutNote'))}</p><a href="${h(routeHref('news'))}">${h(msg(messages, 'newsBack'))}</a>`, messages);
}

export function renderClasses(data, messages = editorialEs) {
  const items = data.editorial?.classes ?? [];
  const rows = items.map((item) => `<tr><td>${h(item.day)}</td><td>${h(item.time)}</td><th scope="row">${h(item.name)}</th><td>${h(item.teacher)}</td><td>${h(item.level)}</td><td>${h(item.place)}</td></tr>`).join('');
  const table = rows ? `<div class="content-table-wrap"><table><caption>${h(msg(messages, 'classesCaption'))}</caption><thead><tr>
    <th scope="col">${h(msg(messages, 'day'))}</th><th scope="col">${h(msg(messages, 'hour'))}</th><th scope="col">${h(msg(messages, 'class'))}</th><th scope="col">${h(msg(messages, 'teacher'))}</th><th scope="col">${h(msg(messages, 'level'))}</th><th scope="col">${h(msg(messages, 'place'))}</th>
    </tr></thead><tbody>${rows}</tbody></table></div>` : `<p>${h(msg(messages, 'classesEmpty'))}</p>`;
  return shell(msg(messages, 'classes'), `${table}<p class="content-note">${h(msg(messages, 'clubOnly'))}</p>`, messages);
}

export function renderMembership(data, messages = editorialEs) {
  const note = data.editorial?.club?.contactNote;
  return shell(msg(messages, 'membership'), `<p class="content-lead">${h(msg(messages, 'noApplications'))}</p><p>${h(note)}</p>
    <p class="content-note">${h(msg(messages, 'aboutNote'))}</p><a href="${h(routeHref('about'))}">${h(msg(messages, 'about'))}</a>`, messages);
}

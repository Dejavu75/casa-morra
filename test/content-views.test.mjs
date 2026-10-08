import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { players, tournaments, games, byes, titles, seasons, editorial } from '../dist/data/demo.js';
import { renderHome } from '../dist/views/home.js';
import { renderAbout, renderNewsList, renderNewsDetail, renderClasses, renderMembership } from '../dist/views/editorial.js';

const data = { players, tournaments, games, byes, titles, seasons, editorial };
const featured = games.find((game) => game.moves?.length);

test('la portada calcula poblaciones demo y presenta actividad y enlaces reales', () => {
  const view = renderHome(data, { today: '2026-10-07' });
  assert.equal(view.title, 'Casa Morra — Ajedrez de demostración');
  assert.match(view.html, /<strong>6<\/strong> jugadores/);
  assert.match(view.html, /<strong>6<\/strong> torneos/);
  assert.match(view.html, /<strong>70<\/strong> partidas/);
  assert.match(view.html, /No hay un próximo torneo programado/);
  assert.match(view.html, /Datos ficticios de demostración/);
  assert.match(view.html, /href="\/anual\/26-27"/);
  assert.match(view.html, /href="\/novedades\/cuaderno-de-aperturas"/);
  assert.match(view.html, new RegExp(`href="/partidas/${featured.id}"`));
  assert.equal((view.html.match(/class="home-annual-row"/g) ?? []).length, 5);
  assert.doesNotMatch(view.html, /Problema diario/);
  const earlier = renderHome(data, { today: '2026-09-01' });
  assert.match(earlier.html, /Copa Casa Morra/);
});

test('institución, noticias, clases y socios usan contenido ficticio sin acciones falsas', () => {
  assert.match(renderAbout(data).html, /Esta casa de demostración/);
  assert.match(renderNewsList(data).html, /Cuaderno para explorar aperturas/i);
  assert.match(renderNewsDetail(data, 'cuaderno-de-aperturas').html, /contenido ficticio de demostración/);
  assert.equal(renderNewsDetail(data, 'inexistente').title, 'Novedad no encontrada — Casa Morra');
  const classes = renderClasses(data).html;
  assert.match(classes, /<caption>Clases ficticias de Casa Morra<\/caption>/);
  assert.match(classes, /Primeras decisiones/);
  assert.match(classes, /Sala imaginaria/);
  assert.doesNotMatch(classes, /<form|wa\.me|mailto:/);
  const membership = renderMembership(data).html;
  assert.match(membership, /No se reciben solicitudes ni pagos/);
  assert.doesNotMatch(membership, /<form|wa\.me|mailto:/);
});

test('todo contenido editorial se escapa, incluso títulos y detalles', () => {
  const unsafe = { ...data, editorial: { ...editorial,
    club: { ...editorial.club, history: '<img src=x onerror=alert(1)>' },
    news: [{ ...editorial.news[0], title: '<svg onload=alert(1)>', body: '<script>alert(1)</script>' }],
    classes: [{ ...editorial.classes[0], place: '<img src=x>' }],
  } };
  assert.doesNotMatch(renderAbout(unsafe).html, /<img src=x/);
  assert.match(renderAbout(unsafe).html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(renderNewsList(unsafe).html, /<svg onload/);
  assert.doesNotMatch(renderNewsDetail(unsafe, 'cuaderno-de-aperturas').html, /<script>/);
  assert.doesNotMatch(renderClasses(unsafe).html, /<img src=x/);
});

test('etiquetas de portada y contenido editorial admiten un catálogo futuro', () => {
  assert.match(renderHome(data, { today: '2026-10-07' }, { headline: 'Chess house' }).html, /<h1 id="home-title">Chess house<\/h1>/);
  assert.match(renderAbout(data, { about: 'About' }).html, /<h1>About<\/h1>/);
});

test('la portada incorpora el problema original después de la galería', () => {
  const html = renderHome(data, { today: '2026-10-07' }).html;
  assert.match(html, /<div data-puzzle-host><section class="puzzle"/);
  assert.match(html, /Mate en una/);
  assert.ok(html.indexOf('class="home-gallery"') < html.indexOf('data-puzzle-host'));
  assert.ok(html.indexOf('data-puzzle-host') < html.indexOf('class="home-grid"'));
});

test('la portada muestra una galería ilustrativa con selector nativo accesible', () => {
  const html = renderHome(data, { today: '2026-10-07' }).html;
  assert.match(html, /<section class="home-gallery" aria-labelledby="home-gallery-title">/);
  assert.match(html, /<fieldset class="editorial-carousel">/);
  assert.match(html, /<input type="radio" name="gallery-home" id="gallery-home-1" checked>/);
  assert.match(html, /<input type="radio" name="gallery-home" id="gallery-home-2">/);
  assert.match(html, /<label for="gallery-home-1">/);
  assert.match(html, /<label for="gallery-home-2">/);
  assert.match(html, /src="\/assets\/galeria-estudio.png"[^>]+alt="[^"]+"/);
  assert.match(html, /src="\/assets\/galeria-sala.png"[^>]+alt="[^"]+"/);
  assert.match(html, /Imagen generada para esta demostración; no retrata una sede real/);
  assert.doesNotMatch(html, /autoplay|setInterval/);
  assert.ok(html.indexOf('class="home-totals"') < html.indexOf('class="home-gallery"'));
  assert.ok(html.indexOf('class="home-gallery"') < html.indexOf('class="home-grid"'));
});

test('la página institucional expone ambas imágenes sin afirmar que son fotografías del club', () => {
  const html = renderAbout(data).html;
  assert.match(html, /<section class="institution-gallery" aria-labelledby="institution-gallery-title">/);
  assert.match(html, /src="\/assets\/galeria-estudio.png"[^>]+alt="[^"]+"/);
  assert.match(html, /src="\/assets\/galeria-sala.png"[^>]+alt="[^"]+"/);
  assert.match(html, /Escenas imaginarias creadas para la demostración/);
});

test('las nuevas etiquetas y descripciones de galería admiten traducción sin insertar HTML', () => {
  const home = renderHome(data, { today: '2026-10-07' }, {
    galleryTitle: 'Gallery', galleryStudyAlt: '<img src=x onerror=alert(1)>',
  }).html;
  assert.match(home, /<h2 id="home-gallery-title">Gallery<\/h2>/);
  assert.match(home, /alt="&lt;img src=x onerror=alert\(1\)&gt;"/);
  const about = renderAbout(data, { galleryTitle: 'Gallery', galleryRoomCaption: '<script>alert(1)</script>' }).html;
  assert.match(about, /<h2 id="institution-gallery-title">Gallery<\/h2>/);
  assert.doesNotMatch(about, /<script>/);
});

test('los activos originales son PNG distintos y el CSS adapta la galería sin movimiento obligado', async () => {
  const study = await readFile(new URL('../dist/assets/galeria-estudio.png', import.meta.url));
  const room = await readFile(new URL('../dist/assets/galeria-sala.png', import.meta.url));
  assert.equal(study.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(room.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.notDeepEqual(study, room);
  const css = await readFile(new URL('../dist/views/content.css', import.meta.url), 'utf8');
  assert.match(css, /#gallery-home-1:checked\s*~\s*\.gallery-frames\s+\.gallery-slide-1/);
  assert.match(css, /#gallery-home-2:checked\s*~\s*\.gallery-frames\s+\.gallery-slide-2/);
  assert.match(css, /\.editorial-carousel input:focus-visible/);
  assert.match(css, /\.institution-gallery/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

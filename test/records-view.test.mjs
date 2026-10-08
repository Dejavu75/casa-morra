import test from 'node:test';
import assert from 'node:assert/strict';
import * as demo from '../dist/data/demo.js';
import { getClassics, getLeaderboards } from '../dist/domain/statistics.js';
import { hasDemoReplay } from '../dist/views/game.js';
import { renderStatistics, renderClassics, renderClassic } from '../dist/views/records.js';

const sample = { ...demo };

test('las diez clasificaciones presentan población, regla y tabla accesible', () => {
  const page = renderStatistics(sample);
  const boards = getLeaderboards(sample);
  assert.equal(page.title, 'Estadísticas y récords');
  assert.equal((page.html.match(/data-record-id=/g) ?? []).length, 10);
  for (const board of boards) assert.match(page.html, new RegExp(`data-record-id="${board.id}"`));
  assert.match(page.html, /al menos 15 partidas/);
  assert.match(page.html, /victorias \/ partidas al tablero/);
  assert.match(page.html, /<table/);
  assert.match(page.html, /<caption/);
  assert.match(page.html, /<th scope="col"/);
  assert.doesNotMatch(page.html, /mi posición|posición personal|bye.*partida jugada/i);
});

test('una clasificación larga usa expansión nativa sin esconder el encabezado de tabla', () => {
  const players = Array.from({ length: 12 }, (_, index) => ({
    id: `jugador-${index + 1}`, slug: `jugador-${index + 1}`, name: `Jugador ${index + 1}`,
  }));
  const data = {
    players, games: [], titles: [],
    tournaments: [{ id: 'torneo-demo', date: '2026-10-01', seasonId: '26-27',
      standings: players.map((player, index) => ({ playerId: player.id, rank: index + 1, points: 0 })) }],
  };
  const html = renderStatistics(data).html;
  assert.match(html, /<details><summary>Ver clasificación completa<\/summary><table/);
  assert.match(html, /<caption>Torneos jugados<\/caption>/);
});

test('los clásicos solo incluyen parejas con cuatro partidas al tablero', () => {
  const page = renderClassics(sample);
  const classics = getClassics(sample);
  assert.equal(page.title, 'Clásicos');
  assert.equal((page.html.match(/class="classic-pair"/g) ?? []).length, classics.length);
  assert.match(page.html, /cuatro partidas al tablero/);
  assert.match(page.html, /descansos no cuentan/);
});

const pair = {
  players: [
    { id: 'ana', slug: 'ana', name: 'Ana <img src=x onerror=alert(1)>' },
    { id: 'bruno', slug: 'bruno', name: 'Bruno & Cía' },
  ],
  games: ['1-0', '1-0', '1-0', '1-0', '1/2-1/2', '0-1', '0-1', '0-1'].map((result, index) => ({
    id: `p-${index + 1}`, tournamentId: 'demo', round: index + 1,
    date: `2026-10-${String(index + 1).padStart(2, '0')}`,
    whiteId: index % 2 ? 'bruno' : 'ana',
    blackId: index % 2 ? 'ana' : 'bruno',
    result: index % 2 ? ({ '1-0': '0-1', '0-1': '1-0', '1/2-1/2': '1/2-1/2' })[result] : result,
    moves: index === 0 ? ['e2e4'] : null,
  })),
  byes: [{ id: 'bye', playerId: 'ana', points: 1 }],
};

test('4-1-3 usa 4,5/8=56 % de puntos desde el primer jugador y distingue colores', () => {
  const list = renderClassics(pair);
  const detail = renderClassic(pair, 'ana', 'bruno');
  assert.match(list.html, /4-1-3/);
  assert.match(detail.html, /4-1-3/);
  assert.match(detail.html, /4,5 \/ 8/);
  assert.match(detail.html, /56 %/);
  assert.match(detail.html, /Blancas/);
  assert.match(detail.html, /Negras/);
  assert.match(detail.html, /1-0/);
  assert.match(detail.html, /octubre de 2026/);
  assert.doesNotMatch(detail.html, /href="\/partidas\/p-1"/);
  assert.equal((detail.html.match(/href="\/partidas\//g) ?? []).length, 0);
  assert.match(detail.html, /Jugadas registradas; enlace no disponible/);
  assert.match(detail.html, /Sin jugadas registradas/);
  assert.doesNotMatch(detail.html, /<img src=x|<script/i);
  assert.match(detail.html, /Ana &lt;img/);
  assert.match(detail.html, /Bruno &amp; Cía/);
});

test('solo enlaza la secuencia UCI que el visor demo reconoce', () => {
  const supported = sample.games.find(hasDemoReplay);
  assert.ok(supported, 'el fixture incluye una secuencia conocida');
  const first = sample.players.find((player) => player.id === supported.whiteId);
  const second = sample.players.find((player) => player.id === supported.blackId);
  const detail = renderClassic(sample, first.slug, second.slug);
  assert.match(detail.html, new RegExp(`href="/partidas/${supported.id}"`));
});

test('pareja desconocida o no clásica devuelve 404 seguro sin reflejar slug', () => {
  const unknown = renderClassic(pair, 'bad<script>', 'bruno');
  assert.equal(unknown.title, 'Clásico no encontrado');
  assert.doesNotMatch(unknown.html, /bad|script/);
  assert.equal(renderClassic(pair, 'ana', 'ana').title, 'Clásico no encontrado');
  const short = { ...pair, games: pair.games.slice(0, 3) };
  assert.equal(renderClassic(short, 'ana', 'bruno').title, 'Clásico no encontrado');
});

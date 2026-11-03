import test from 'node:test';
import assert from 'node:assert/strict';
import * as data from '../dist/data/demo.js';
import { renderPlayerProfile } from '../dist/views/players.js';
import { renderClassics, renderClassic } from '../dist/views/records.js';
import { renderTournamentDetail } from '../dist/views/tournaments.js';

const shorthand = /G[–-]E[–-]P|<abbr title="Ganadas">G<\/abbr>/;

test('el perfil usa barras y cantidades explícitas en cada balance', () => {
  const html = renderPlayerProfile(data, 'celia-montiel').html;
  assert.doesNotMatch(html, shorthand);
  assert.match(html, /Partidas al tablero[\s\S]*?24 partidas[\s\S]*?10 ganadas[\s\S]*?10 empatadas[\s\S]*?4 perdidas/);
  assert.match(html, /Rival con Elo superior[\s\S]*?players-results-bar/);
  assert.match(html, /Balance favorable[\s\S]*?players-results-bar/);
  assert.match(html, /Historial oficial de torneos[\s\S]*?<th scope="col">Resultados<\/th>/);
});

test('los clásicos muestran la misma ficha en listado, detalle y por color', () => {
  const list = renderClassics(data).html;
  assert.doesNotMatch(list, shorthand);
  assert.match(list, /classic-pair[\s\S]*?players-results-bar/);
  const pair = data.players.slice(0, 2);
  const detail = renderClassic(data, pair[0].slug, pair[1].slug).html;
  assert.doesNotMatch(detail, shorthand);
  assert.match(detail, /Blancas[\s\S]*?players-results-bar[\s\S]*?Negras[\s\S]*?players-results-bar/);
});

test('la tabla de torneo conserva la ausencia de detalle y muestra resultados compactos', () => {
  const withResults = data.tournaments.find((event) => event.standings.some((row) => row.wins != null));
  const html = renderTournamentDetail(data, withResults.slug).html;
  assert.doesNotMatch(html, shorthand);
  assert.match(html, /<th scope="col">Resultados<\/th>/);
  assert.match(html, /players-results-bar/);
  const withoutResults = data.tournaments.find((event) => event.standings.some((row) => row.wins == null));
  assert.match(renderTournamentDetail(data, withoutResults.slug).html, /Sin detalle/);
});

test('los diccionarios parciales conservan los textos predeterminados sin perder la personalización', () => {
  const profile = renderPlayerProfile(data, 'celia-montiel', { wins: 'Victorias' }).html;
  assert.match(profile, /10 victorias/);
  assert.match(profile, /10 empatadas/);
  const tournament = data.tournaments.find((event) => event.standings.some((row) => row.wins != null));
  const standing = renderTournamentDetail(data, tournament.slug, { wins: 'Victorias' }).html;
  assert.match(standing, /victorias/);
  assert.match(standing, /empatadas/);
  const pair = data.players.slice(0, 2);
  const classic = renderClassic(data, pair[0].slug, pair[1].slug, { wins: 'victorias' }).html;
  assert.match(classic, /victorias/);
  assert.match(classic, /empatadas/);
});

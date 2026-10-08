import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import * as demo from '../dist/data/demo.js';
import {
  SNAPSHOT_FORMAT,
  SNAPSHOT_VERSION,
  encodeDemoSnapshot,
  decodeDemoSnapshot,
  validateDemoSnapshot,
  snapshotMetadata,
} from '../scripts/demo-snapshot.mjs';

function alteredSnapshot(change) {
  const snapshot = JSON.parse(encodeDemoSnapshot(demo));
  change(snapshot);
  return snapshot;
}

test('el snapshot versionado es canónico, determinista y reversible', () => {
  const first = encodeDemoSnapshot(demo);
  const second = encodeDemoSnapshot({ ...demo, games: [...demo.games] });
  assert.equal(first, second);
  assert.equal(encodeDemoSnapshot(decodeDemoSnapshot(first)), first);
  const parsed = JSON.parse(first);
  assert.equal(parsed.format, SNAPSHOT_FORMAT);
  assert.equal(parsed.version, SNAPSHOT_VERSION);
  assert.equal(parsed.provenance, 'casa-morra-original-demo');
  assert.equal(parsed.classification, 'public-demo');
  assert.deepEqual(parsed.data.tournaments[0].standings, demo.tournaments[0].standings);
  assert.deepEqual(Object.keys(parsed.data), ['byes', 'editorial', 'games', 'players', 'seasons', 'titles', 'tournaments']);
  assert.equal(parsed.generatedAt, undefined);
});

test('tamaño UTF-8 y SHA-256 corresponden exactamente a los bytes canónicos', () => {
  const json = encodeDemoSnapshot(demo);
  const metadata = snapshotMetadata(json);
  assert.equal(metadata.bytes, Buffer.byteLength(json, 'utf8'));
  assert.equal(metadata.sha256, createHash('sha256').update(Buffer.from(json, 'utf8')).digest('hex'));
  assert.equal(metadata.bytes, 20184);
  assert.equal(metadata.sha256, 'f8238289ac5ea38ded4911f0667fae32cfa7ef1b87d37affbaf5ff2438488a24');
  assert.match(metadata.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(snapshotMetadata(encodeDemoSnapshot(demo)), metadata);
});

test('rechaza versión o formato incompatibles antes de importar', () => {
  const version = alteredSnapshot((snapshot) => { snapshot.version = SNAPSHOT_VERSION + 1; });
  const format = alteredSnapshot((snapshot) => { snapshot.format = 'otro.formato'; });
  assert.ok(validateDemoSnapshot(version).errors.some((error) => error.code === 'UNSUPPORTED_VERSION'));
  assert.ok(validateDemoSnapshot(format).errors.some((error) => error.code === 'UNSUPPORTED_FORMAT'));
  assert.throws(() => decodeDemoSnapshot(JSON.stringify(version)), /UNSUPPORTED_VERSION/);
});

test('detecta referencias rotas y no modifica el dataset de entrada', () => {
  const snapshot = alteredSnapshot((value) => { value.data.games[0].whiteId = 'jugador-inexistente'; });
  const before = JSON.stringify(snapshot);
  const report = validateDemoSnapshot(snapshot);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => error.code === 'UNKNOWN_PLAYER'));
  assert.equal(JSON.stringify(snapshot), before);
  assert.throws(() => decodeDemoSnapshot(JSON.stringify(snapshot)), /UNKNOWN_PLAYER/);
  const outsideRoster = alteredSnapshot((value) => {
    value.data.games.find((game) => game.tournamentId === 'primavera-2026').whiteId = 'felipe-rivas';
  });
  assert.ok(validateDemoSnapshot(outsideRoster).errors.some((error) => error.code === 'UNKNOWN_PARTICIPANT'));
});

test('impide campos no versionados y duplicados; no inventa PGN en tabla aislada', () => {
  const dummyEmail = ['persona', 'example.invalid'].join('@');
  const extra = alteredSnapshot((value) => { value.data.players[0].email = dummyEmail; });
  assert.ok(validateDemoSnapshot(extra).errors.some((error) => error.code === 'UNEXPECTED_FIELD'));
  assert.throws(() => encodeDemoSnapshot({ ...demo, accounts: [{ email: dummyEmail }] }), /UNEXPECTED_FIELD/);
  const duplicate = alteredSnapshot((value) => { value.data.byes[1].id = value.data.byes[0].id; });
  assert.ok(validateDemoSnapshot(duplicate).errors.some((error) => error.code === 'DUPLICATE_ID'));
  const data = decodeDemoSnapshot(encodeDemoSnapshot(demo));
  const tableOnly = data.tournaments.find((event) => event.format === 'table-only');
  assert.ok(tableOnly);
  assert.equal(data.games.some((game) => game.tournamentId === tableOnly.id), false);
  assert.equal(data.byes.some((bye) => bye.tournamentId === tableOnly.id), false);
});

test('rechaza slugs duplicados de novedades aunque sus ID sean distintos', () => {
  const snapshot = alteredSnapshot((value) => {
    value.data.editorial.news[1].slug = value.data.editorial.news[0].slug;
  });
  const report = validateDemoSnapshot(snapshot);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => error.code === 'DUPLICATE_KEY' &&
    error.detail.includes('editorial.news.slug')));
  assert.throws(() => decodeDemoSnapshot(JSON.stringify(snapshot)), /DUPLICATE_KEY/);
  assert.throws(() => encodeDemoSnapshot(snapshot.data), /DUPLICATE_KEY/);
});

test('rechaza puestos oficiales fuera de rango y fechas inexistentes en el snapshot', () => {
  const invalidRank = alteredSnapshot((snapshot) => {
    snapshot.data.tournaments[0].standings[0].rank = -1;
  });
  assert.ok(validateDemoSnapshot(invalidRank).errors.some((error) => error.code === 'STANDING_RANK'));
  assert.throws(() => decodeDemoSnapshot(JSON.stringify(invalidRank)), /STANDING_RANK/);
  const invalidDate = alteredSnapshot((snapshot) => {
    snapshot.data.editorial.news[0].date = '2030-99-99';
  });
  assert.ok(validateDemoSnapshot(invalidDate).errors.some((error) => error.code === 'INVALID_DATE'));
  assert.throws(() => encodeDemoSnapshot(invalidDate.data), /INVALID_DATE/);
  const leapDate = alteredSnapshot((snapshot) => {
    snapshot.data.games[0].date = '2025-02-29';
  });
  assert.ok(validateDemoSnapshot(leapDate).errors.some((error) => error.code === 'INVALID_DATE'));
});

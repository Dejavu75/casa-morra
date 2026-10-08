import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import test from 'node:test';
import { buildStatsCorrection } from '../scripts/demo-stats-scenario.mjs';
import { decodeDemoSnapshot } from '../scripts/demo-snapshot.mjs';
import { getAnnualStandings, getHeadToHead, getLeaderboards, getPlayerProfile } from '../dist/domain/statistics.js';
import { renderHome } from '../dist/views/home.js';
import { renderTournamentDetail } from '../dist/views/tournaments.js';
import { renderAnnual } from '../dist/views/annual.js';
import { renderPlayerProfile } from '../dist/views/players.js';
import { renderStatistics, renderClassic } from '../dist/views/records.js';
import { verifyData } from '../scripts/verify-data.mjs';

function command(script, operation, args) {
  const result = spawnSync(process.execPath, [script, operation, ...args],
    { cwd: process.cwd(), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

const correction = (store, input, expectedSha, allowlist) => command('scripts/demo-store.mjs',
  'correct', ['--store', store, '--input', input, '--expected-sha', expectedSha,
    '--allowlist', allowlist]);
const publication = (store, output, operation) => command('scripts/demo-public.mjs',
  operation, ['--store', store, '--output', output]);
const publicData = async (output) => JSON.parse(await readFile(output, 'utf8')).snapshot.data;

function stats(data) {
  const dante = getPlayerProfile(data, 'dante-arce');
  const celia = getPlayerProfile(data, 'celia-montiel');
  const annual = getAnnualStandings(data, '26-27');
  const event = data.tournaments.find(({ id }) => id === 'casa-2026');
  const danteRow = event.standings.find(({ playerId }) => playerId === 'dante-arce');
  const celiaRow = event.standings.find(({ playerId }) => playerId === 'celia-montiel');
  const board = getLeaderboards(data).find(({ id }) => id === 'gamesWon');
  const classic = getHeadToHead(data, 'celia-montiel', 'dante-arce');
  return { dantePoints: danteRow.points, danteRank: danteRow.rank,
    celiaPoints: celiaRow.points, celiaRank: celiaRow.rank,
    annualDante: annual.standings.find(({ playerId }) => playerId === 'dante-arce').points,
    annualCelia: annual.standings.find(({ playerId }) => playerId === 'celia-montiel').points,
    danteWins: dante.record.wins, celiaLosses: celia.record.losses,
    leaderboardDante: board.entries.find(({ playerId }) => playerId === 'dante-arce').value,
    classicWins: classic.record.wins, classicDraws: classic.record.draws,
    classicLosses: classic.record.losses };
}

function assertViews(data, expected) {
  const html = [renderHome(data).html,
    renderTournamentDetail(data, 'copa-casa-morra-2026').html,
    renderAnnual(data, '26-27').html,
    renderPlayerProfile(data, 'dante-arce').html,
    renderStatistics(data).html,
    renderClassic(data, 'celia-montiel', 'dante-arce').html];
  for (const view of html) assert.ok(view.length > 500);
  assert.match(html[0], new RegExp(`${expected.annualDante.toString().replace('.', ',')} puntos`));
  assert.match(html[1], new RegExp(`${expected.dantePoints.toString().replace('.', ',')}`));
  assert.match(html[2], new RegExp(`${expected.annualDante.toString().replace('.', ',')}`));
  assert.match(html[3], new RegExp(`${expected.danteWins}–`));
  assert.match(html[4], new RegExp(`data-record-id="gamesWon"[\\s\\S]*?Dante Arce[\\s\\S]*?${expected.danteWins}`));
  assert.match(html[5], new RegExp(`G-E-P: ${expected.classicWins}-${expected.classicDraws}-${expected.classicLosses}`));
}

test('corrección estadística: CLI, exportación obsoleta, publicación y reversión concilian seis vistas', async (t) => {
  const id = randomUUID();
  const stateDir = join(process.cwd(), '.demo-state', id);
  const publicDir = join(process.cwd(), '.demo-public', id);
  for (const directory of [stateDir, publicDir]) {
    const path = relative(resolve(process.cwd()), resolve(directory));
    assert.ok(path && !path.startsWith(`..${sep}`) && path !== '..');
  }
  await mkdir(stateDir, { recursive: true });
  await mkdir(publicDir, { recursive: true });
  t.after(async () => { await rm(stateDir, { recursive: true, force: true });
    await rm(publicDir, { recursive: true, force: true }); });
  const store = join(stateDir, 'store.json');
  const input = join(stateDir, 'correction.json');
  const allowlist = join(stateDir, 'allowlist.json');
  const output = join(publicDir, 'snapshot.json');

  command('scripts/demo-store.mjs', 'init', ['--store', store]);
  publication(store, output, 'publish');
  const before = await publicData(output);
  const baseline = stats(before);
  assert.deepEqual(baseline, { dantePoints: 4, danteRank: 1, celiaPoints: 2, celiaRank: 3,
    annualDante: 6.5, annualCelia: 5.5, danteWins: 9, celiaLosses: 4,
    leaderboardDante: 9, classicWins: 1, classicDraws: 2, classicLosses: 2 });
  assertViews(before, baseline);

  const { snapshot, allowed } = buildStatsCorrection(before);
  assert.equal(verifyData(decodeDemoSnapshot(snapshot)).ok, true);
  await writeFile(input, snapshot);
  await writeFile(allowlist, JSON.stringify(allowed));
  const initialSha = JSON.parse(await readFile(store, 'utf8')).snapshot.sha256;
  correction(store, input, initialSha, allowlist);
  assert.equal(publication(store, output, 'status').fresh, false);
  assert.deepEqual(stats(await publicData(output)), baseline);

  publication(store, output, 'publish');
  assert.equal(publication(store, output, 'status').fresh, true);
  const changed = await publicData(output);
  const updated = stats(changed);
  assert.deepEqual(updated, { dantePoints: 4.5, danteRank: 1, celiaPoints: 1.5, celiaRank: 5,
    annualDante: 7, annualCelia: 5, danteWins: 10, celiaLosses: 5,
    leaderboardDante: 10, classicWins: 1, classicDraws: 1, classicLosses: 3 });
  assertViews(changed, updated);
  assert.equal(verifyData(changed).ok, true);

  command('scripts/demo-store.mjs', 'rollback', ['--store', store]);
  assert.equal(publication(store, output, 'status').fresh, false);
  publication(store, output, 'publish');
  assert.equal(publication(store, output, 'status').fresh, true);
  assert.deepEqual(stats(await publicData(output)), baseline);
  assert.deepEqual(await publicData(output), before);
  const audit = JSON.parse(await readFile(store, 'utf8')).audit;
  assert.deepEqual(audit.map(({ operation }) => operation), ['init', 'correct', 'rollback']);
});

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { encodeDemoSnapshot } from './demo-snapshot.mjs';
import { verifyData } from './verify-data.mjs';

/** Caso ficticio acotado: una partida y su clasificación oficial, sin inferir desempates. */
export function buildStatsCorrection(data) {
  const next = structuredClone(data);
  const game = next.games.find(({ id }) => id === 'casa-2026-r1-p3');
  const event = next.tournaments.find(({ id }) => id === 'casa-2026');
  if (game?.result !== '1/2-1/2' || !event) throw new Error('La muestra inicial no coincide');
  game.result = '1-0';
  const byId = new Map(event.standings.map((row) => [row.playerId, row]));
  const dante = byId.get('dante-arce');
  const celia = byId.get('celia-montiel');
  if (dante?.points !== 4 || celia?.points !== 2) throw new Error('Tabla inicial inesperada');
  Object.assign(dante, { points: 4.5, wins: 4, draws: 1, losses: 0, rank: 1, order: 1 });
  Object.assign(celia, { points: 1.5, wins: 1, draws: 1, losses: 3, rank: 5, order: 5 });
  const bautista = byId.get('bautista-lujan');
  const felipe = byId.get('felipe-rivas');
  Object.assign(bautista, { rank: 2, order: 2 });
  Object.assign(felipe, { rank: 3, order: 4 });
  event.standings = [...byId.values()].sort((a, b) => a.order - b.order);
  const report = verifyData(next);
  if (!report.ok) throw new Error(`Corrección inconsistente: ${report.errors.map((item) => item.code).join(', ')}`);
  return { snapshot: encodeDemoSnapshot(next), allowed: [
    { collection: 'games', id: game.id },
    { collection: 'tournaments', id: event.id },
  ] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [, , baseline, output, allowlist] = process.argv;
  if (!baseline || !output || !allowlist) throw new Error('Uso: node scripts/demo-stats-scenario.mjs baseline.json correccion.json allowlist.json');
  const { readFile } = await import('node:fs/promises');
  const data = JSON.parse(await readFile(baseline, 'utf8')).snapshot.data;
  const scenario = buildStatsCorrection(data);
  await writeFile(output, scenario.snapshot);
  await writeFile(allowlist, JSON.stringify(scenario.allowed));
  console.log(JSON.stringify({ game: 'casa-2026-r1-p3', tournament: 'casa-2026', allowed: scenario.allowed }));
}

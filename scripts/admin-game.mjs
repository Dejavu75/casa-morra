import { Chess } from 'chess.js';
import { decodeDemoSnapshot, encodeDemoSnapshot } from './demo-snapshot.mjs';
import { verifyData } from './verify-data.mjs';

const results = new Set(['1-0', '0-1', '1/2-1/2']);
const toUci = (move) => `${move.from}${move.to}${move.promotion ?? ''}`;

function hasPgnVariation(text) {
  let state = 'moves';
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (state === 'moves') {
      if (char === '[') state = 'tag';
      else if (char === '{') state = 'comment';
      else if (char === ';') state = 'line';
      else if (char === '(' || char === ')') return true;
    } else if (state === 'tag') {
      if (char === '"') state = 'quoted';
      else if (char === ']') state = 'moves';
    } else if (state === 'quoted') {
      if (char === '\\') index += 1;
      else if (char === '"') state = 'tag';
    } else if (state === 'comment' && char === '}') state = 'moves';
    else if (state === 'line' && (char === '\n' || char === '\r')) state = 'moves';
  }
  return false;
}

/** Convierte una entrada administrativa en jugadas legales de ajedrez estándar. */
export function parseAdminMoves(format, text, result) {
  if (!results.has(result)) throw new Error('Resultado inválido');
  if (typeof text !== 'string' || !text.trim() || text.length > 100_000)
    throw new Error('Texto de jugadas obligatorio (máximo 100 KB)');
  const chess = new Chess();
  if (format === 'pgn') {
    if (hasPgnVariation(text))
      throw new Error('El PGN contiene variantes de análisis; importe solo la línea principal');
    try { chess.loadPgn(text); }
    catch (error) { throw new Error(`PGN o jugada inválida: ${error.message}`); }
    const headers = chess.getHeaders();
    if (Object.hasOwn(headers, 'SetUp') || Object.hasOwn(headers, 'FEN'))
      throw new Error('El PGN debe comenzar desde la posición inicial estándar (sin SetUp/FEN)');
    if (Object.hasOwn(headers, 'Variant'))
      throw new Error('El PGN no debe indicar una variante; solo ajedrez estándar');
    if (headers.Result !== result)
      throw new Error('El resultado del PGN no coincide con el resultado registrado');
  } else if (format === 'manual') {
    for (const san of text.trim().split(/\s+/u)) {
      try { chess.move(san); }
      catch { throw new Error(`Jugada manual inválida: ${san}`); }
    }
  } else throw new Error('Formato de jugadas inválido');
  const moves = chess.history({ verbose: true }).map(toUci);
  if (!moves.length) throw new Error('La partida no contiene jugadas');
  return moves;
}

function incrementStanding(row, result, color) {
  const key = result === '1/2-1/2' ? 'draws' :
    (result === '1-0') === (color === 'white') ? 'wins' : 'losses';
  if (!Number.isInteger(row[key]) || row[key] < 0)
    throw new Error('La tabla del torneo no permite sumar este resultado automáticamente');
  row[key] += 1;
  row.points += key === 'wins' ? 1 : key === 'draws' ? 0.5 : 0;
}

export function rankStandings(event) {
  const ranked = [...event.standings].sort((a, b) => b.points - a.points || a.order - b.order);
  let previous = null;
  let rank = 0;
  event.standings = ranked.map((row, index) => {
    if (row.points !== previous) rank = index + 1;
    previous = row.points;
    return { ...row, order: index + 1, rank };
  });
}

/** Prepara una alta o actualización de jugadas sin modificar el snapshot recibido. */
export function prepareAdminGame(currentData, request) {
  const next = decodeDemoSnapshot(encodeDemoSnapshot(currentData));
  if (request?.mode === 'create') {
    const game = request.game;
    if (!game || typeof game !== 'object' || Array.isArray(game)) throw new Error('Partida obligatoria');
    if (next.games.some((row) => row.id === game.id)) throw new Error('La partida ya existe');
    if (!results.has(game.result)) throw new Error('Resultado inválido');
    const event = next.tournaments.find((row) => row.id === game.tournamentId);
    if (!event) throw new Error('Torneo inexistente');
    if (!Number.isInteger(game.round) || game.round < 1) throw new Error('Ronda inválida');
    if (game.whiteId === game.blackId) throw new Error('Una partida requiere dos jugadores distintos');
    const white = event.standings.find((row) => row.playerId === game.whiteId);
    const black = event.standings.find((row) => row.playerId === game.blackId);
    if (!white || !black) throw new Error('Ambos jugadores deben estar en la tabla del torneo');
    const duplicate = next.games.some((row) => row.tournamentId === game.tournamentId &&
      row.round === game.round && [row.whiteId, row.blackId].includes(game.whiteId) &&
      [row.whiteId, row.blackId].includes(game.blackId));
    if (duplicate) throw new Error('Esa pareja ya tiene una partida en la ronda');
    const moves = request.text ? parseAdminMoves(request.format, request.text, game.result) : null;
    const record = { ...game, moves };
    next.games.push(record);
    incrementStanding(white, game.result, 'white');
    incrementStanding(black, game.result, 'black');
    event.rounds = Math.max(event.rounds, game.round);
    rankStandings(event);
    const report = verifyData(next);
    if (!report.ok) throw new Error(`La partida no concilia con las estadísticas (${[...new Set(report.errors.map((row) => row.code))].join(', ')})`);
    return { next, gameId: game.id, operation: 'create' };
  }
  if (request?.mode === 'complete') {
    const game = next.games.find((row) => row.id === request.gameId);
    if (!game) throw new Error('Partida inexistente');
    const moves = parseAdminMoves(request.format, request.text, game.result);
    if (JSON.stringify(game.moves) === JSON.stringify(moves))
      return { next, gameId: game.id, operation: 'unchanged' };
    game.moves = moves;
    const report = verifyData(next);
    if (!report.ok) throw new Error(`La partida no concilia con las estadísticas (${[...new Set(report.errors.map((row) => row.code))].join(', ')})`);
    return { next, gameId: game.id, operation: 'complete' };
  }
  throw new Error('Operación de partida inválida');
}

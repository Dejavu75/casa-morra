// Reglas demo propias de Casa Morra: funciones puras, sin DOM ni almacenamiento.
const INITIAL_ELO = 1400;
const ELO_K = 20;

const compareId = (left, right) => left < right ? -1 : left > right ? 1 : 0;

function orderedGames(data) {
  return [...data.games].sort((a, b) =>
    compareId(a.date, b.date) || compareId(a.tournamentId, b.tournamentId) ||
    a.round - b.round || compareId(a.id, b.id));
}

function emptyCounts() {
  return { wins: 0, draws: 0, losses: 0 };
}

function resultFor(game, playerId) {
  if (game.result === '1/2-1/2') return 'draws';
  const won = (game.whiteId === playerId && game.result === '1-0') ||
    (game.blackId === playerId && game.result === '0-1');
  return won ? 'wins' : 'losses';
}

function recordFromCounts(counts) {
  const played = counts.wins + counts.draws + counts.losses;
  return {
    ...counts,
    played,
    points: counts.wins + counts.draws * 0.5,
    winRate: played ? 100 * counts.wins / played : null,
    scoreRate: played ? 100 * (counts.wins + counts.draws * 0.5) / played : null,
  };
}

function summarizeGames(games, playerId) {
  const counts = emptyCounts();
  const white = emptyCounts();
  const black = emptyCounts();
  for (const game of games) {
    if (game.whiteId !== playerId && game.blackId !== playerId) continue;
    const outcome = resultFor(game, playerId);
    counts[outcome]++;
    (game.whiteId === playerId ? white : black)[outcome]++;
  }
  return { record: recordFromCounts(counts), colors: {
    white: recordFromCounts(white), black: recordFromCounts(black),
  } };
}

function streaks(games, playerId) {
  let winning = 0;
  let unbeaten = 0;
  let winningMax = 0;
  let unbeatenMax = 0;
  for (const game of games) {
    if (game.whiteId !== playerId && game.blackId !== playerId) continue;
    const outcome = resultFor(game, playerId);
    winning = outcome === 'wins' ? winning + 1 : 0;
    unbeaten = outcome === 'losses' ? 0 : unbeaten + 1;
    winningMax = Math.max(winningMax, winning);
    unbeatenMax = Math.max(unbeatenMax, unbeaten);
  }
  return { winning: winningMax, unbeaten: unbeatenMax };
}

export function getHomeTotals(data) {
  return { players: data.players.length, tournaments: data.tournaments.length, games: data.games.length };
}

export function calculateElo(data) {
  const events = new Map(data.tournaments.map((event) => [event.id, event]));
  const ratings = Object.fromEntries(data.players.map((player) => [player.id, {
    rating: INITIAL_ELO, peak: INITIAL_ELO, played: 0, history: [],
  }]));
  for (const game of orderedGames(data)) {
    const event = events.get(game.tournamentId);
    if (!event) throw new Error(`Torneo desconocido: ${game.tournamentId}`);
    if (!event.eloEligible) continue;
    const white = ratings[game.whiteId];
    const black = ratings[game.blackId];
    if (!white || !black) throw new Error(`Jugador desconocido en ${game.id}`);
    const whiteBefore = white.rating;
    const blackBefore = black.rating;
    const whiteScore = game.result === '1-0' ? 1 : game.result === '0-1' ? 0 : 0.5;
    const expectedWhite = 1 / (1 + 10 ** ((blackBefore - whiteBefore) / 400));
    const whiteChange = ELO_K * (whiteScore - expectedWhite);
    white.rating = whiteBefore + whiteChange;
    black.rating = blackBefore - whiteChange;
    for (const [player, opponentId, before] of [
      [white, game.blackId, whiteBefore], [black, game.whiteId, blackBefore],
    ]) {
      player.played++;
      player.peak = Math.max(player.peak, player.rating);
      player.history.push({ gameId: game.id, date: game.date, round: game.round,
        opponentId, before, after: player.rating });
    }
  }
  return ratings;
}

function profileFromPrepared(data, playerId, gameOrder, eloByPlayer) {
  const player = data.players.find((row) => row.id === playerId);
  if (!player) return null;
  const tournaments = data.tournaments
    .flatMap((event) => event.standings
      .filter((row) => row.playerId === playerId)
      .map((row) => ({ tournamentId: event.id, seasonId: event.seasonId,
        date: event.date, annualEligible: event.annualEligible, ...row })))
    .sort((a, b) => compareId(a.date, b.date) || compareId(a.tournamentId, b.tournamentId));
  const elo = eloByPlayer[playerId];
  return {
    player,
    ...summarizeGames(gameOrder, playerId),
    tournaments,
    officialPoints: tournaments.reduce((sum, row) => sum + row.points, 0),
    streaks: streaks(gameOrder, playerId),
    elo: { ...elo, provisional: elo.played < 10 },
  };
}

export function getPlayerProfile(data, playerId) {
  return profileFromPrepared(data, playerId, orderedGames(data), calculateElo(data));
}

function rankedAnnualRows(totals, players, previous = null) {
  const names = new Map(players.map((player) => [player.id, player.name]));
  const sorted = [...totals.entries()].sort(([idA, a], [idB, b]) =>
    b.points - a.points || compareId(names.get(idA) ?? idA, names.get(idB) ?? idB) || compareId(idA, idB));
  let priorPoints = null;
  let rank = 0;
  return sorted.map(([playerId, value], index) => {
    if (value.points !== priorPoints) rank = index + 1;
    priorPoints = value.points;
    const oldRank = previous?.get(playerId);
    return { playerId, points: value.points, tournaments: value.tournaments,
      rank, order: index + 1, movement: oldRank === undefined ? null : oldRank - rank };
  });
}

export function getAnnualStandings(data, seasonId) {
  const events = data.tournaments
    .filter((event) => event.seasonId === seasonId && event.annualEligible)
    .sort((a, b) => compareId(a.date, b.date) || compareId(a.id, b.id));
  const totals = new Map();
  const snapshots = [];
  let previous = null;
  for (const event of events) {
    for (const standing of event.standings) {
      const current = totals.get(standing.playerId) ?? { points: 0, tournaments: 0 };
      totals.set(standing.playerId, {
        points: current.points + standing.points,
        tournaments: current.tournaments + 1,
      });
    }
    const standings = rankedAnnualRows(totals, data.players, previous);
    snapshots.push({ tournamentId: event.id, standings });
    previous = new Map(standings.map((row) => [row.playerId, row.rank]));
  }
  return { seasonId, events, snapshots, standings: snapshots.at(-1)?.standings ?? [] };
}

export function getHeadToHead(data, firstId, secondId) {
  const knownPlayers = new Set(data.players.map((player) => player.id));
  if (firstId === secondId || !knownPlayers.has(firstId) || !knownPlayers.has(secondId)) return null;
  const matches = orderedGames(data).filter((game) =>
    (game.whiteId === firstId && game.blackId === secondId) ||
    (game.whiteId === secondId && game.blackId === firstId));
  return { firstId, secondId, ...summarizeGames(matches, firstId), games: matches };
}

export function getClassics(data) {
  const pairs = new Set(data.games.map((game) =>
    [game.whiteId, game.blackId].sort(compareId).join('|')));
  return [...pairs].sort(compareId).map((key) => {
    const [firstId, secondId] = key.split('|');
    return getHeadToHead(data, firstId, secondId);
  }).filter((pair) => pair.record.played >= 4);
}

function leaderboard(data, id, label, values, isEligibleValue = (value) => value > 0) {
  const names = new Map(data.players.map((player) => [player.id, player.name]));
  const sorted = values.filter((row) => row.value !== null && isEligibleValue(row.value))
    .sort((a, b) => b.value - a.value || compareId(names.get(a.playerId), names.get(b.playerId)));
  let priorValue = null;
  let rank = 0;
  const entries = sorted.map((row, index) => {
    if (row.value !== priorValue) rank = index + 1;
    priorValue = row.value;
    return { ...row, name: names.get(row.playerId), rank, order: index + 1 };
  });
  return { id, label, entries };
}

export function getLeaderboards(data) {
  const gameOrder = orderedGames(data);
  const eloByPlayer = calculateElo(data);
  const profiles = data.players.map((player) =>
    profileFromPrepared(data, player.id, gameOrder, eloByPlayer));
  const counts = (value) => profiles.map((profile) => ({
    playerId: profile.player.id, value: value(profile),
  }));
  const titleCounts = new Map();
  for (const title of data.titles) {
    if (title.kind === 'campeonato-club')
      titleCounts.set(title.playerId, (titleCounts.get(title.playerId) ?? 0) + 1);
  }
  return [
    leaderboard(data, 'tournamentsWon', 'Torneos ganados', counts((p) => p.tournaments.filter((row) => row.rank === 1).length)),
    leaderboard(data, 'championships', 'Campeonatos del club', counts((p) => titleCounts.get(p.player.id) ?? 0)),
    leaderboard(data, 'gamesPlayed', 'Partidas jugadas', counts((p) => p.record.played)),
    leaderboard(data, 'gamesWon', 'Partidas ganadas', counts((p) => p.record.wins)),
    leaderboard(data, 'winRate', 'Porcentaje de victorias', counts((p) => p.record.played >= 15 ? p.record.winRate : null), (value) => value >= 0),
    leaderboard(data, 'winningStreak', 'Racha ganadora', counts((p) => p.streaks.winning)),
    leaderboard(data, 'unbeatenStreak', 'Racha invicta', counts((p) => p.streaks.unbeaten)),
    leaderboard(data, 'peakElo', 'Mayor Elo demo', counts((p) => p.elo.played > 0 ? p.elo.peak : null)),
    leaderboard(data, 'tournamentsPlayed', 'Torneos jugados', counts((p) => p.tournaments.length)),
    leaderboard(data, 'podiums', 'Podios', counts((p) => p.tournaments.filter((row) =>
      Number.isInteger(row.rank) && row.rank >= 1 && row.rank <= 3).length)),
  ];
}

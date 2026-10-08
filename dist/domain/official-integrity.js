// Contrato semántico común del snapshot público y la verificación local.
function calendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function validateOfficialFields(data, errors) {
  for (const [collection, rows, fields] of [
    ['seasons', data.seasons, ['start', 'end']],
    ['tournaments', data.tournaments, ['date']],
    ['games', data.games, ['date']],
    ['editorial.news', data.editorial?.news ?? [], ['date']],
  ]) {
    rows.forEach((row, index) => {
      for (const field of fields)
        if (!calendarDate(row[field]))
          errors.push({ code: 'INVALID_DATE', detail: `${collection}[${index}].${field}` });
    });
  }
  data.tournaments.forEach((event, eventIndex) => {
    const standings = event.standings ?? [];
    standings.forEach((row, rowIndex) => {
      if (!Number.isInteger(row.rank) || row.rank < 1 || row.rank > standings.length)
        errors.push({ code: 'STANDING_RANK', detail: `tournaments[${eventIndex}].standings[${rowIndex}].rank` });
    });
  });
}

// Solo se concilian resultados que tienen partidas individuales: una tabla
// histórica independiente no permite inferir victorias, empates ni derrotas.
function boardTotals(games, byes) {
  const totals = new Map();
  const get = (id) => {
    if (!totals.has(id)) totals.set(id, { wins: 0, draws: 0, losses: 0, points: 0 });
    return totals.get(id);
  };
  for (const game of games) {
    const white = get(game.whiteId);
    const black = get(game.blackId);
    if (game.result === '1-0') { white.wins++; white.points++; black.losses++; }
    if (game.result === '0-1') { black.wins++; black.points++; white.losses++; }
    if (game.result === '1/2-1/2') { white.draws++; black.draws++; white.points += 0.5; black.points += 0.5; }
  }
  for (const bye of byes) get(bye.playerId).points += bye.points;
  return totals;
}

export function validateOfficialStandings(data, errors) {
  for (const event of data.tournaments) {
    const games = data.games.filter((game) => game.tournamentId === event.id);
    const byes = data.byes.filter((bye) => bye.tournamentId === event.id);
    if (!games.length) continue;
    const totals = boardTotals(games, byes);
    const standingIds = new Set((event.standings ?? []).map((row) => row.playerId));
    for (const id of totals.keys())
      if (!standingIds.has(id)) errors.push({ code: 'MISSING_STANDING', detail: `${event.id}/${id}` });
    for (const row of event.standings ?? []) {
      const expected = totals.get(row.playerId);
      if (!expected) { errors.push({ code: 'UNEXPLAINED_STANDING', detail: `${event.id}/${row.playerId}` }); continue; }
      if (!Number.isFinite(row.points) || !Number.isFinite(expected.points) || Math.abs(row.points - expected.points) >= 1e-7)
        errors.push({ code: 'STANDING_POINTS', detail: `${event.id}/${row.playerId}: ${row.points} ≠ ${expected.points}` });
      for (const key of ['wins', 'draws', 'losses'])
        if (row[key] !== expected[key]) errors.push({ code: 'STANDING_WDL', detail: `${event.id}/${row.playerId}/${key}` });
    }
  }
}

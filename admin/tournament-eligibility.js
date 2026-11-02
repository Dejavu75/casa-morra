/** Los torneos históricos sin desglose de resultados permanecen en las estadísticas. */
export function writableTournaments(tournaments) {
  return tournaments.filter((event) => event.standings.length >= 2 &&
    event.standings.every((row) => Number.isFinite(row.points) && row.points >= 0 &&
      ['wins', 'draws', 'losses'].every((key) => Number.isInteger(row[key]) && row[key] >= 0)));
}

// Shared semantic checks for the demo fixture and its versioned snapshot.
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

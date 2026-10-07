// Datos ficticios y deterministas de Casa Morra. No proceden del club de referencia.
export const seasons = [
  { id: '24-25', label: '2024–2025', start: '2024-08-01', end: '2025-07-31' },
  { id: '25-26', label: '2025–2026', start: '2025-08-01', end: '2026-07-31' },
  { id: '26-27', label: '2026–2027', start: '2026-08-01', end: '2027-07-31' },
];

export const players = [
  { id: 'ayla-neri', slug: 'ayla-neri', name: 'Ayla Neri', membership: 'socia', demo: true },
  { id: 'bautista-lujan', slug: 'bautista-lujan', name: 'Bautista Luján', membership: 'socio', demo: true },
  { id: 'celia-montiel', slug: 'celia-montiel', name: 'Celia Montiel', membership: 'socia', demo: true },
  { id: 'dante-arce', slug: 'dante-arce', name: 'Dante Arce', membership: 'no_socio', demo: true },
  { id: 'elena-soria', slug: 'elena-soria', name: 'Elena Soria', membership: 'socia', demo: true },
  { id: 'felipe-rivas', slug: 'felipe-rivas', name: 'Felipe Rivas', membership: 'no_socio', demo: true },
];

const allPlayers = players.map((player) => player.id);

const eventSeeds = [
  { id: 'patio-2025', slug: 'apertura-del-patio-2025', name: 'Apertura del Patio', seasonId: '24-25', date: '2025-03-15', type: 'interno', format: 'round-robin-6', roster: allPlayers, annualEligible: true, eloEligible: true },
  { id: 'invierno-2025', slug: 'ronda-de-invierno-2025', name: 'Ronda de Invierno', seasonId: '25-26', date: '2025-11-15', type: 'interno', format: 'round-robin-6', roster: allPlayers, annualEligible: true, eloEligible: true },
  { id: 'otono-2026', slug: 'tableros-de-otono-2026', name: 'Tableros de Otoño', seasonId: '25-26', date: '2026-05-16', type: 'abierto', format: 'round-robin-6', roster: allPlayers, annualEligible: true, eloEligible: true },
  { id: 'casa-2026', slug: 'copa-casa-morra-2026', name: 'Copa Casa Morra', seasonId: '26-27', date: '2026-09-19', type: 'interno', format: 'round-robin-6', roster: allPlayers, annualEligible: true, eloEligible: true },
  { id: 'primavera-2026', slug: 'encuentro-de-primavera-2026', name: 'Encuentro de Primavera', seasonId: '26-27', date: '2026-10-03', type: 'abierto', format: 'round-robin-5', roster: allPlayers.slice(0, 5), annualEligible: true, eloEligible: true },
];

// Posiciones de un todos-contra-todos simple: rotación circular con plaza vacante si N es impar.
function pairings(roster) {
  let circle = roster.length % 2 === 0 ? [...roster] : [...roster, null];
  const rounds = [];
  for (let round = 1; round < circle.length; round++) {
    const pairs = [];
    let bye = null;
    for (let index = 0; index < circle.length / 2; index++) {
      const first = circle[index];
      const second = circle[circle.length - index - 1];
      if (first === null || second === null) bye = first ?? second;
      else pairs.push([first, second]);
    }
    rounds.push({ round, pairs, bye });
    circle = [circle[0], circle.at(-1), ...circle.slice(1, -1)];
  }
  return rounds;
}

const illustrativeMoves = [
  'd2d4', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'd7d5', 'c4d5', 'e6d5',
  'c1g5', 'f8e7', 'e2e3', 'e8g8', 'g1f3', 'c7c6', 'f1d3', 'b8d7',
];

function makeEvent(seed, eventIndex) {
  const schedule = pairings(seed.roster);
  const eventGames = [];
  const eventByes = [];
  for (const { round, pairs, bye } of schedule) {
    pairs.forEach(([first, second], pairIndex) => {
      const swapColors = (round + eventIndex + pairIndex) % 2 === 0;
      const whiteId = swapColors ? second : first;
      const blackId = swapColors ? first : second;
      const roll = (eventIndex * 7 + round * 5 + pairIndex * 3 + round * pairIndex) % 5;
      const illustrative = seed.id === 'patio-2025' && round === 1 && pairIndex === 0;
      eventGames.push({
        id: `${seed.id}-r${round}-p${pairIndex + 1}`,
        tournamentId: seed.id,
        round,
        date: seed.date,
        whiteId,
        blackId,
        result: illustrative ? '1/2-1/2' : roll < 2 ? '1-0' : roll === 2 ? '0-1' : '1/2-1/2',
        moves: illustrative ? illustrativeMoves : null,
        finish: illustrative ? 'acuerdo' : null,
      });
    });
    if (bye) eventByes.push({
      id: `${seed.id}-r${round}-bye`, tournamentId: seed.id, round, playerId: bye, points: 1,
    });
  }

  const totals = new Map(seed.roster.map((playerId) => [playerId, { wins: 0, draws: 0, losses: 0, points: 0 }]));
  for (const game of eventGames) {
    const white = totals.get(game.whiteId);
    const black = totals.get(game.blackId);
    if (game.result === '1-0') { white.wins++; white.points++; black.losses++; }
    else if (game.result === '0-1') { black.wins++; black.points++; white.losses++; }
    else { white.draws++; black.draws++; white.points += 0.5; black.points += 0.5; }
  }
  for (const bye of eventByes) totals.get(bye.playerId).points += bye.points;

  // La tabla es un documento oficial separado, con orden y puesto explícitos.
  // Para esta muestra se fija al cargar; ninguna vista debe reconstruir desempates ocultos.
  const ordered = [...totals.entries()]
    .sort(([idA, a], [idB, b]) => b.points - a.points || (idA < idB ? -1 : idA > idB ? 1 : 0));
  let lastPoints = null;
  let rank = 0;
  const standings = ordered.map(([playerId, total], index) => {
    if (total.points !== lastPoints) rank = index + 1;
    lastPoints = total.points;
    return { playerId, order: index + 1, rank, ...total };
  });
  return {
    tournament: {
      id: seed.id, slug: seed.slug, name: seed.name, seasonId: seed.seasonId,
      date: seed.date, type: seed.type, format: seed.format, rounds: schedule.length,
      annualEligible: seed.annualEligible, eloEligible: seed.eloEligible, standings,
    },
    eventGames,
    eventByes,
  };
}

const built = eventSeeds.map(makeEvent);
export const games = built.flatMap((event) => event.eventGames);
export const byes = built.flatMap((event) => event.eventByes);
export const tournaments = [
  {
    id: 'archivo-2025', slug: 'archivo-de-verano-2025', name: 'Archivo de Verano',
    seasonId: '24-25', date: '2025-01-18', type: 'interno', format: 'table-only',
    rounds: 3, annualEligible: true, eloEligible: false,
    standings: [
      { playerId: 'celia-montiel', order: 1, rank: 1, points: 2.5, wins: null, draws: null, losses: null },
      { playerId: 'elena-soria', order: 2, rank: 2, points: 2, wins: null, draws: null, losses: null },
      { playerId: 'ayla-neri', order: 3, rank: 3, points: 1, wins: null, draws: null, losses: null },
      { playerId: 'dante-arce', order: 4, rank: 4, points: 0.5, wins: null, draws: null, losses: null },
    ],
  },
  ...built.map((event) => event.tournament),
];

export const titles = [
  { id: 'titulo-patio-2025', playerId: built[0].tournament.standings[0].playerId, tournamentId: 'patio-2025', kind: 'campeonato-club', label: 'Campeón de la Apertura del Patio' },
  { id: 'titulo-invierno-2025', playerId: built[1].tournament.standings[0].playerId, tournamentId: 'invierno-2025', kind: 'campeonato-club', label: 'Campeón de la Ronda de Invierno' },
];

export const editorial = {
  club: {
    name: 'Casa Morra',
    description: 'Un club ficticio para explorar torneos, partidas y estadísticas de ajedrez.',
    history: 'Esta casa de demostración nació como un tablero abierto a la curiosidad, el estudio y la conversación. Sus personajes y actividades son inventados.',
    contactNote: 'Los datos son de demostración: no se reciben mensajes ni inscripciones reales.',
  },
  news: [
    { id: 'cuaderno-2026', slug: 'cuaderno-de-aperturas', date: '2026-09-20', title: 'Un cuaderno para explorar aperturas', excerpt: 'Ideas para registrar planes, no solo jugadas.', body: 'En Casa Morra imaginamos un cuaderno de estudio donde cada partida abre una pregunta nueva. Esta nota es contenido ficticio de demostración.' },
    { id: 'ronda-2026', slug: 'ronda-de-primavera', date: '2026-10-04', title: 'La ronda de primavera en cifras', excerpt: 'Un vistazo a resultados, tablas y byes.', body: 'El encuentro ficticio permite comparar puntos oficiales con partidas al tablero. Sus cifras se calculan a partir del mismo conjunto de datos demo.' },
  ],
  classes: [
    { id: 'inicial', day: 'Martes', time: '18:00', name: 'Primeras decisiones', teacher: 'Celia Montiel', level: 'Inicial', place: 'Sala imaginaria A' },
    { id: 'analisis', day: 'Jueves', time: '19:30', name: 'Análisis de partidas', teacher: 'Bautista Luján', level: 'Intermedio', place: 'Sala imaginaria B' },
  ],
};

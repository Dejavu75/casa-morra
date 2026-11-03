import { decodeDemoSnapshot, encodeDemoSnapshot } from './demo-snapshot.mjs';
import { correctDemoStore, statusDemoStore } from './demo-store.mjs';

const fail = (message, status) => { throw Object.assign(new Error(message), { status }); };

/** Changes only descriptive tournament metadata through the audited correction path. */
export async function updateTournamentModality(store, tournamentId, input) {
  if (!input || Array.isArray(input) || typeof input !== 'object' ||
      Object.keys(input).sort().join(',') !== 'expectedSha,modality' ||
      typeof input.expectedSha !== 'string' || !/^[a-f0-9]{64}$/.test(input.expectedSha) ||
      typeof input.modality !== 'string')
    fail('Modalidad o hash inválido', 400);
  const modality = input.modality.trim();
  if (modality.length > 80 || /[\x00-\x1f\x7f]/.test(modality))
    fail('Modalidad inválida: use una sola línea de hasta 80 caracteres', 400);

  const state = await statusDemoStore(store);
  if (state.snapshot.sha256 !== input.expectedSha) fail('CAS rechazado: hash vigente obsoleto', 409);
  const data = decodeDemoSnapshot(state.data);
  const tournament = data.tournaments.find((event) => event.id === tournamentId);
  if (!tournament) fail('Torneo inexistente', 404);
  if ((tournament.modality ?? '') === modality) {
    const current = await statusDemoStore(store);
    if (current.snapshot.sha256 !== input.expectedSha) fail('CAS rechazado: hash vigente obsoleto', 409);
    return current;
  }
  if (modality) tournament.modality = modality;
  else delete tournament.modality;
  return correctDemoStore(store, encodeDemoSnapshot(data), input.expectedSha,
    [{ collection: 'tournaments', id: tournamentId }]);
}

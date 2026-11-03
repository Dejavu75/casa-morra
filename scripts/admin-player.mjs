import { randomUUID } from 'node:crypto';
import { decodeDemoSnapshot, encodeDemoSnapshot } from './demo-snapshot.mjs';
import { applyDemoStore, correctDemoStore, statusDemoStore } from './demo-store.mjs';

const membershipValues = new Set(['socia', 'socio', 'no_socio']);
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
export const slugFrom = (name) => name.normalize('NFD').replace(/\p{M}/gu, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function validateInput(input) {
  if (!input || Array.isArray(input) || typeof input !== 'object' ||
      Object.keys(input).sort().join(',') !== 'expectedSha,membership,name' ||
      typeof input.expectedSha !== 'string' || !/^[a-f0-9]{64}$/.test(input.expectedSha) ||
      typeof input.name !== 'string' || typeof input.membership !== 'string')
    fail('Datos de jugador o hash inválidos');
  const name = input.name.trim().replace(/\s+/gu, ' ');
  if (!name || name.length > 120 || /[\x00-\x1f\x7f]/.test(name))
    fail('Nombre de jugador inválido');
  if (!membershipValues.has(input.membership)) fail('Condición de socio inválida');
  return { expectedSha: input.expectedSha, name, membership: input.membership };
}

export async function createAdminPlayer(store, input) {
  const { expectedSha, name, membership } = validateInput(input);
  const state = await statusDemoStore(store);
  if (state.snapshot.sha256 !== expectedSha) fail('CAS rechazado: hash vigente obsoleto', 409);
  const data = decodeDemoSnapshot(state.data);
  const slug = slugFrom(name);
  if (!slug) fail('Nombre de jugador sin identificador válido');
  if (data.players.some((row) => row.slug === slug)) fail('El jugador ya existe', 409);
  const id = `admin-player-${randomUUID()}`;
  data.players.push({ id, slug, name, membership, demo: false });
  return { state: await applyDemoStore(store, encodeDemoSnapshot(data), { expectedSha }), id };
}

export async function updateAdminPlayer(store, id, input) {
  const { expectedSha, name, membership } = validateInput(input);
  const state = await statusDemoStore(store);
  if (state.snapshot.sha256 !== expectedSha) fail('CAS rechazado: hash vigente obsoleto', 409);
  const data = decodeDemoSnapshot(state.data);
  const player = data.players.find((row) => row.id === id);
  if (!player) fail('Jugador inexistente', 404);
  if (player.name === name && player.membership === membership) return { state, id };
  player.name = name;
  player.membership = membership;
  return { state: await correctDemoStore(store, encodeDemoSnapshot(data), expectedSha,
    [{ collection: 'players', id }]), id };
}

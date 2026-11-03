import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { decodeDemoSnapshot } from './demo-snapshot.mjs';
import { recordAdminGame, statusDemoStore } from './demo-store.mjs';
import { publishPublicDemo } from './demo-public.mjs';
import { updateTournamentModality } from './admin-tournament.mjs';

const SESSION_AGE_MS = 8 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 200_000;
const cookieName = 'cm_admin';
const digest = (value) => createHash('sha256').update(value).digest();
const json = (response, status, value, headers = {}) => {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer', ...headers });
  response.end(JSON.stringify(value));
};

async function bodyJson(request) {
  if (!request.headers['content-type']?.startsWith('application/json'))
    throw Object.assign(new Error('Se requiere JSON'), { status: 415 });
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('Solicitud demasiado grande'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('JSON inválido'), { status: 400 }); }
}

function cookie(request) {
  return request.headers.cookie?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
}

/** API administrativa; el llamador decide el bind, pero la ruta CLI usa loopback. */
export function createAdminServer({ password, store, output }) {
  if (typeof password !== 'string' || !password || !store || !output)
    throw new Error('Se requieren contraseña, almacén y exportación pública');
  const passwordDigest = digest(password);
  const sessions = new Map();
  const server = createServer(async (request, response) => {
    const host = request.headers.host ?? '';
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host)) {
      json(response, 403, { error: 'Host administrativo inválido' }); return;
    }
    const origin = `http://${host}`;
    const sameOrigin = request.headers.origin === origin;
    const token = cookie(request);
    const expires = sessions.get(token);
    const authenticated = typeof token === 'string' && expires > Date.now();
    if (token && !authenticated) sessions.delete(token);
    try {
      const path = new URL(request.url, origin).pathname;
      if (request.method === 'GET' && path === '/health') {
        json(response, 200, { status: 'ok' }); return;
      }
      const assets = { '/': ['../admin/index.html', 'text/html; charset=utf-8'],
        '/admin.js': ['../admin/admin.js', 'text/javascript; charset=utf-8'],
        '/tournament-eligibility.js': ['../admin/tournament-eligibility.js', 'text/javascript; charset=utf-8'],
        '/admin.css': ['../admin/admin.css', 'text/css; charset=utf-8'],
        '/rook-small.png': ['../dist/assets/rook-small.png', 'image/png'],
        '/rook-large.png': ['../dist/assets/rook-large.png', 'image/png'] };
      if (request.method === 'GET' && Object.hasOwn(assets, path)) {
        const [file, type] = assets[path];
        const source = await readFile(new URL(file, import.meta.url));
        response.writeHead(200, { 'content-type': type, 'cache-control': 'no-store',
          'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer',
          'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'" });
        response.end(source); return;
      }
      if (request.method === 'POST' && path === '/api/login') {
        if (request.headers.origin && !sameOrigin) {
          json(response, 403, { error: 'Origen inválido' }); return;
        }
        const input = await bodyJson(request);
        const candidate = typeof input?.password === 'string' ? digest(input.password) : digest('');
        if (!timingSafeEqual(candidate, passwordDigest)) {
          json(response, 401, { error: 'Credenciales inválidas' }); return;
        }
        const session = randomBytes(32).toString('hex');
        sessions.set(session, Date.now() + SESSION_AGE_MS);
        json(response, 200, { authenticated: true }, { 'set-cookie':
          `${cookieName}=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_AGE_MS / 1000}` });
        return;
      }
      if (!authenticated) { json(response, 401, { error: 'Autenticación requerida' }); return; }
      if (request.method === 'GET' && path === '/api/state') {
        const state = await statusDemoStore(store);
        const data = decodeDemoSnapshot(state.data);
        json(response, 200, { sha256: state.snapshot.sha256,
          players: data.players, tournaments: data.tournaments, games: data.games });
        return;
      }
      if (['POST', 'PUT', 'DELETE'].includes(request.method) && !sameOrigin) {
        json(response, 403, { error: 'Origen inválido' }); return;
      }
      if (request.method === 'POST' && path === '/api/logout') {
        sessions.delete(token);
        response.writeHead(204, { 'cache-control': 'no-store', 'set-cookie':
          `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0` });
        response.end(); return;
      }
      if (request.method === 'POST' && path === '/api/publish') {
        const published = await publishPublicDemo(store, output);
        json(response, 200, { sha256: published.source.sha256, published: true }); return;
      }
      const modalityRoute = path.match(/^\/api\/tournaments\/([a-zA-Z0-9_-]+)\/modality$/);
      if (request.method === 'PUT' && modalityRoute) {
        const state = await updateTournamentModality(store, modalityRoute[1], await bodyJson(request));
        try {
          await publishPublicDemo(store, output);
          json(response, 200, { sha256: state.snapshot.sha256, published: true });
        } catch {
          json(response, 202, { sha256: state.snapshot.sha256, saved: true, published: false,
            warning: 'Modalidad guardada, publicación pendiente. Use Reintentar publicación.' });
        }
        return;
      }
      let operation;
      let input;
      if (request.method === 'POST' && path === '/api/games') {
        input = await bodyJson(request);
        operation = { mode: 'create', game: input?.game, format: input?.format, text: input?.text };
      } else {
        const match = path.match(/^\/api\/games\/([a-zA-Z0-9_-]+)\/moves$/);
        if (request.method === 'PUT' && match) {
          input = await bodyJson(request);
          operation = { mode: 'complete', gameId: match[1], format: input?.format, text: input?.text };
        }
      }
      if (!operation) { json(response, 404, { error: 'Ruta inexistente' }); return; }
      const state = await recordAdminGame(store, operation, input?.expectedSha);
      try {
        await publishPublicDemo(store, output);
        json(response, operation.mode === 'create' ? 201 : 200,
          { sha256: state.snapshot.sha256, published: true });
      } catch {
        json(response, 202, { sha256: state.snapshot.sha256, saved: true, published: false,
          warning: 'Partida guardada, publicación pendiente. Use Reintentar publicación.' });
      }
    } catch (error) {
      const status = error.status ?? (/CAS|obsoleto|ya existe|ya tiene/.test(error.message) ? 409 :
        /inválid|inexistente|obligator|rechazad|no contiene|no coincide|no permite|La partida/.test(error.message) ? 400 : 500);
      json(response, status, { error: status === 500 ? 'Error administrativo interno' : error.message });
    }
  });
  server.on('close', () => sessions.clear());
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const docker = process.argv.includes('--docker');
  const server = createAdminServer({ password: process.env.CASA_MORRA_ADMIN_PASSWORD,
    store: process.env.CASA_MORRA_ADMIN_STORE ?? '.demo-state/admin.json',
    output: process.env.CASA_MORRA_ADMIN_PUBLIC ?? '.demo-public/snapshot.json' });
  server.listen(8090, docker ? '0.0.0.0' : '127.0.0.1', () =>
    console.log(`Panel administrativo local disponible en el puerto 8090 (${docker ? 'contenedor' : 'loopback'})`));
}

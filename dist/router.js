// Contrato de rutas públicas; no toca el DOM ni crea enlaces a vistas pendientes.
const definitions = Object.freeze([
  ['home', '/', []],
  ['tournaments', '/torneos', []],
  ['tournament', '/torneos/:slug', ['slug']],
  ['annual', '/anual/:seasonId', ['seasonId']],
  ['players', '/jugadores', []],
  ['player', '/jugadores/:slug', ['slug']],
  ['statistics', '/estadisticas', []],
  ['classics', '/clasicos', []],
  ['classic', '/clasicos/:first/:second', ['first', 'second']],
  ['about', '/nosotros', []],
  ['news', '/novedades', []],
  ['news-detail', '/novedades/:slug', ['slug']],
  ['classes', '/clases', []],
  ['membership', '/socios', []],
  ['game', '/partidas/:id', ['id']],
]);
const routeByName = new Map(definitions.map((definition) => [definition[0], definition]));

const validSegment = /^[\p{Ll}\p{N}]+(?:-[\p{Ll}\p{N}]+)*$/u;
const MAX_FILTER_LENGTH = 48;
const notFound = () => ({ name: 'not-found', params: {}, query: {} });

function validFilter(value) {
  return typeof value === 'string' && value.length <= MAX_FILTER_LENGTH && validSegment.test(value);
}

function readFilter(fields, key) {
  const value = fields.get(key) ?? '';
  return validFilter(value) ? value : '';
}

function decodeSegment(raw) {
  try {
    const decoded = decodeURIComponent(raw);
    return validSegment.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

export function parseRoute(pathname, search = '') {
  if (typeof pathname !== 'string' || !pathname.startsWith('/')) return notFound();
  const pathParts = pathname === '/' ? [] : pathname.slice(1).split('/');
  for (const [name, template] of definitions) {
    const templateParts = template === '/' ? [] : template.slice(1).split('/');
    if (pathParts.length !== templateParts.length) continue;
    const params = {};
    let matched = true;
    for (let index = 0; index < templateParts.length; index += 1) {
      const expected = templateParts[index];
      const raw = pathParts[index];
      if (expected.startsWith(':')) {
        const decoded = decodeSegment(raw);
        if (decoded === null) { matched = false; break; }
        params[expected.slice(1)] = decoded;
      } else if (raw !== expected) {
        matched = false;
        break;
      }
    }
    if (!matched) continue;
    let query = {};
    if (name === 'players') {
      query = { q: new URLSearchParams(search).get('q')?.trim() ?? '' };
    } else if (name === 'tournaments') {
      const fields = new URLSearchParams(search);
      query = { tipo: readFilter(fields, 'tipo'), temporada: readFilter(fields, 'temporada') };
    }
    return { name, params, query };
  }
  return notFound();
}

export function routeHref(name, params = {}, query = {}) {
  const definition = routeByName.get(name);
  if (!definition) throw new TypeError(`Ruta desconocida: ${name}`);
  const [, template, keys] = definition;
  let path = template;
  for (const key of keys) {
    const value = params?.[key];
    if (typeof value !== 'string' || !validSegment.test(value)) {
      throw new TypeError(`Identificador de ruta inválido: ${key}`);
    }
    path = path.replace(`:${key}`, encodeURIComponent(value));
  }
  if (name === 'tournaments') {
    const filters = new URLSearchParams();
    for (const key of ['tipo', 'temporada']) {
      const value = query?.[key];
      if (value === undefined || value === '') continue;
      if (!validFilter(value)) throw new TypeError(`Filtro de ruta inválido: ${key}`);
      filters.set(key, value);
    }
    return filters.size ? `${path}?${filters}` : path;
  }
  if (name === 'players' && typeof query?.q === 'string' && query.q.trim()) {
    return `${path}?${new URLSearchParams({ q: query.q.trim() })}`;
  }
  return path;
}

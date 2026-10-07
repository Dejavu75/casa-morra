import assert from 'node:assert/strict';
import test from 'node:test';
import { formatDate, formatNumber } from '../dist/views/common.js';

test('formato actual es-AR permanece igual sin opciones', () => {
  assert.equal(formatDate('2025-02-01'), '1 de febrero de 2025');
  assert.equal(formatNumber(1234.5), '1.234,5');
  assert.equal(formatDate('2025-02-30'), 'Fecha no disponible');
  assert.equal(formatNumber(Number.NaN), 'Sin detalle');
});

test('locale alternativo cambia fechas y números sin alterar valores', () => {
  assert.equal(formatDate('2025-02-01', { locale: 'en-US' }), 'February 1, 2025');
  assert.equal(formatNumber(1234.5, { locale: 'en-US' }), '1,234.5');
  assert.equal(formatDate('2025-02-01', 'en-US'), 'February 1, 2025');
  assert.equal(formatNumber(1234.5, 'en-US'), '1,234.5');
});

test('fallbacks de fecha y número se inyectan incluso como cadena vacía', () => {
  assert.equal(formatDate('fecha inválida', { fallback: 'Sin fecha' }), 'Sin fecha');
  assert.equal(formatDate('2025-02-30', { locale: 'en-US', fallback: 'Date unavailable' }), 'Date unavailable');
  assert.equal(formatNumber(null, { fallback: 'No data' }), 'No data');
  assert.equal(formatNumber(Infinity, { locale: 'en-US', fallback: '' }), '');
});

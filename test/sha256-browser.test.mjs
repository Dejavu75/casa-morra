import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sha256Hex } from '../dist/assets/sha256.js';

test('SHA-256 local coincide con vectores conocidos y Node en límites de bloque', () => {
  for (const [input, expected] of [
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
  ]) assert.equal(sha256Hex(new TextEncoder().encode(input)), expected);
  for (const length of [1, 55, 56, 63, 64, 65, 127, 128, 20184]) {
    const bytes = Uint8Array.from({ length }, (_, index) => (index * 37 + 11) & 255);
    const expected = createHash('sha256').update(bytes).digest('hex');
    assert.equal(sha256Hex(bytes), expected, `longitud ${length}`);
  }
});

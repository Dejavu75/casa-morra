import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  PUZZLE_FEN,
  puzzleEs,
  initialPuzzleState,
  transitionPuzzle,
  renderPuzzle,
  attachPuzzle,
} from '../dist/views/puzzle.js';

test('el problema original presenta tablero, objetivo y entrada accesible', () => {
  const html = renderPuzzle();
  assert.equal(PUZZLE_FEN, '8/8/8/8/8/k1K5/4Q3/8 w - - 0 1');
  assert.equal((html.match(/<td\b/g) ?? []).length, 64);
  assert.match(html, /data-square="c3"[^>]*aria-label="c3, rey blanco"/);
  assert.match(html, /data-square="e2"[^>]*aria-label="e2, dama blanca"/);
  assert.match(html, /data-square="a3"[^>]*aria-label="a3, rey negro"/);
  assert.match(html, /<caption>[^<]*Posición inicial/);
  assert.match(html, /<label for="puzzle-move">/);
  assert.match(html, /aria-describedby="puzzle-instructions puzzle-feedback"/);
  assert.match(html, /id="puzzle-feedback"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /Problema de demostración/);
  assert.doesNotMatch(html, /problema diario/i);
});

test('solo e2a6 resuelve el mate en una; otras respuestas no se declaran ilegales', () => {
  const correct = transitionPuzzle(initialPuzzleState(), { type: 'submit', move: ' E2A6 ' });
  assert.equal(correct.status, 'solved');
  assert.match(correct.feedback, /mate/i);
  assert.match(renderPuzzle(puzzleEs, correct), /data-square="a6"[^>]*aria-label="a6, dama blanca"/);

  const wrong = transitionPuzzle(initialPuzzleState(), { type: 'submit', move: 'e2e3' });
  assert.equal(wrong.status, 'ready');
  assert.match(wrong.feedback, /no es el mate/i);
  assert.doesNotMatch(wrong.feedback, /ilegal/i);
  assert.match(renderPuzzle(puzzleEs, wrong), /data-square="e2"[^>]*aria-label="e2, dama blanca"/);
});

test('entrada mal formada se rechaza sin evaluar legalidad', () => {
  const state = transitionPuzzle(initialPuzzleState(), { type: 'submit', move: 'e2<script>' });
  assert.equal(state.status, 'ready');
  assert.match(state.feedback, /cuatro caracteres/i);
  assert.doesNotMatch(renderPuzzle(puzzleEs, state), /<script>/);
});

test('revelar solución y reiniciar preservan estados coherentes', () => {
  const revealed = transitionPuzzle(initialPuzzleState(), { type: 'reveal' });
  assert.equal(revealed.status, 'revealed');
  assert.match(revealed.feedback, /Qa6#/);
  assert.match(renderPuzzle(puzzleEs, revealed), /data-square="a6"[^>]*aria-label="a6, dama blanca"/);
  const reset = transitionPuzzle(revealed, { type: 'reset' });
  assert.deepEqual(reset, initialPuzzleState());
  assert.match(renderPuzzle(puzzleEs, reset), /data-square="e2"[^>]*aria-label="e2, dama blanca"/);
});

test('attachPuzzle conecta formulario, revelar y reiniciar; dispone listeners', () => {
  const handlers = new Map();
  const focused = [];
  const host = {
    innerHTML: '',
    addEventListener(name, fn) { handlers.set(name, fn); },
    removeEventListener(name, fn) { if (handlers.get(name) === fn) handlers.delete(name); },
    querySelector(selector) {
      if (selector === '[data-puzzle-input]') return { value: this.move ?? '', focus() { focused.push('input'); } };
      if (selector === '[data-puzzle-feedback]') return { focus() { focused.push('feedback'); } };
      return null;
    },
  };
  const dispose = attachPuzzle(host);
  assert.match(host.innerHTML, /Problema de demostración/);
  host.move = 'e2a6';
  let prevented = false;
  handlers.get('submit')({ target: { matches: () => true }, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.match(host.innerHTML, /data-square="a6"[^>]*aria-label="a6, dama blanca"/);
  assert.equal(focused.at(-1), 'feedback');
  handlers.get('click')({ target: { closest: () => ({ dataset: { puzzleAction: 'reset' } }) } });
  assert.match(host.innerHTML, /data-square="e2"[^>]*aria-label="e2, dama blanca"/);
  assert.equal(focused.at(-1), 'input');
  handlers.get('click')({ target: { closest: () => ({ dataset: { puzzleAction: 'reveal' } }) } });
  assert.match(host.innerHTML, /Qa6#/);
  dispose();
  assert.equal(handlers.size, 0);
});

test('el tablero conserva encabezados y casillas frente a estilos generales de tablas', () => {
  const css = readFileSync(new URL('../dist/views/puzzle.css', import.meta.url), 'utf8');
  assert.match(css, /\.content-page table\.puzzle-board thead\s*\{[^}]*background:\s*transparent/);
  assert.match(css, /\.content-page table\.puzzle-board td\s*\{[^}]*padding:\s*\.15rem/);
});

test('un catálogo sintético cambia textos y aria, no FEN, solución ni identificadores', () => {
  const messages = {
    eyebrow: 'Catálogo de prueba',
    title: 'Objetivo alternativo',
    whiteQueen: 'pieza de prueba',
    controls: 'Acciones alternativas',
    squareLabel: (square, piece) => `${square}: ${piece}`,
    correctFeedback: (notation) => `Resuelto con ${notation}`,
  };
  const html = renderPuzzle(messages);
  assert.match(html, /Objetivo alternativo/);
  assert.match(html, /aria-label="e2: pieza de prueba"/);
  assert.match(html, /aria-label="Acciones alternativas"/);
  assert.match(html, /Juegan las blancas/); // clave ausente: español completo de respaldo
  assert.match(html, /data-fen="8\/8\/8\/8\/8\/k1K5\/4Q3\/8 w - - 0 1"/);
  assert.match(html, /id="puzzle-move"/);
  const state = transitionPuzzle(initialPuzzleState(messages), { type: 'submit', move: 'e2a6' }, messages);
  assert.equal(state.status, 'solved');
  assert.equal(state.feedback, 'Resuelto con Qa6#');
  assert.match(renderPuzzle(messages, state), /data-square="a6"/);
  assert.equal(puzzleEs.title, 'Mate en una');
});

test('el catálogo externo se escapa en texto y nombres accesibles', () => {
  const html = renderPuzzle({ title: '<img src=x onerror=alert(1)>', whiteQueen: '" onfocus="alert(1)' });
  assert.doesNotMatch(html, /<img|onfocus="alert/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /&quot; onfocus=&quot;alert\(1\)/);
});

test('attachPuzzle conserva el catálogo sintético al interactuar', () => {
  const handlers = new Map();
  const host = {
    innerHTML: '',
    move: 'e2a6',
    addEventListener(name, fn) { handlers.set(name, fn); },
    removeEventListener(name) { handlers.delete(name); },
    querySelector(selector) {
      if (selector === '[data-puzzle-input]') return { value: this.move, focus() {} };
      if (selector === '[data-puzzle-feedback]') return { focus() {} };
      return null;
    },
  };
  const dispose = attachPuzzle(host, { messages: {
    title: 'Título de prueba',
    correctFeedback: (notation) => `Resultado de prueba: ${notation}`,
  } });
  assert.match(host.innerHTML, /Título de prueba/);
  assert.match(host.innerHTML, /Juegan las blancas/);
  handlers.get('submit')({ target: { matches: () => true }, preventDefault() {} });
  assert.match(host.innerHTML, /Resultado de prueba: Qa6#/);
  dispose();
  assert.equal(handlers.size, 0);
});

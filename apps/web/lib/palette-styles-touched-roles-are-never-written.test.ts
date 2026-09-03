import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveBoard, type PaletteStyle } from './palette-styles';

/**
 * `touchedRoles` is the seam that lets a couple's hand-edited swatch survive
 * a re-derivation: `deriveBoard` must never write a role the caller marks
 * touched, and must never let touching one role change any OTHER role's
 * output. Ported verbatim from the prototype's `spec/touched.mjs`.
 */

const M = ['#7A1F2B', '#FAF7F2', '#D4AF37', '#302B1B', '#FFD8DD'];
const STYLES: PaletteStyle[] = ['simple', 'depth', 'complex'];
const touched = new Set(['bridesmaids', 'guest', 'room_dressing']);

test('deriveBoard never writes a touched role, and untouched roles are unaffected by which roles are touched', () => {
  const failures: string[] = [];
  for (const style of STYLES) {
    const b = deriveBoard(M, style, touched);
    for (const k of touched) {
      if (k in b) failures.push(`WROTE TOUCHED ${style}/${k}`);
    }
    const free = deriveBoard(M, style);
    for (const key of Object.keys(free)) {
      if (key === '__meta' || touched.has(key)) continue;
      if (JSON.stringify((free as Record<string, unknown>)[key]) !== JSON.stringify((b as Record<string, unknown>)[key])) {
        failures.push(`UNTOUCHED DIFFERS ${style}/${key}`);
      }
    }
  }
  assert.deepEqual(failures, []);
});

test('switching style and back is a pure function of (majors, style, touched) — no hidden state carries across calls', () => {
  const cold = JSON.stringify(deriveBoard(M, 'depth', touched));
  deriveBoard(M, 'complex', touched);
  const back = JSON.stringify(deriveBoard(M, 'depth', touched));
  assert.equal(back, cold);
});

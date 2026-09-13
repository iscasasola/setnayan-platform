import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveBoard,
  deriveVenue,
  roomReference,
  normalizeMajors,
  visibility,
  VISIBILITY_RANK,
  EXEMPT,
  RANK_EXEMPT,
  PEOPLE_KEYS,
  type PaletteStyle,
  type RoleKey,
} from './palette-styles';
import { oklchOfHex } from './color-space';

/**
 * THE SIX-RANK VISIBILITY LADDER'S OWN INVARIANT SUITE, carried over from the
 * prototype (`spec/run.ts` `invariants()` / `spec/check-integrated.mjs`) so
 * the verification that proved the engine correct travels with it instead of
 * staying behind in a scratchpad.
 *
 * The promise: a guest standing at the back of the room can tell who
 * outranks whom by colour alone. For every pair of adjacent SEPARABLE rank
 * groups, the least-visible member of the higher group must still read as
 * more visible than the most-visible member of the lower group — across
 * every fixture palette, every palette style.
 *
 * 🛑 THESE COUNTS ARE PINNED, NOT ILLUSTRATIVE. 97 ordered pairs / 0 failures
 * is the exact measurement this port must reproduce; a change in either
 * number means the ladder's behaviour changed, which this test exists to
 * catch (see the sabotage note on `MB4` — swapping two ranks turned this red
 * during verification, then was reverted; nothing sabotaged ships here).
 */

const STYLES: PaletteStyle[] = ['simple', 'depth', 'complex'];

const SETS: Record<string, string[]> = {
  crimson_ivory_regal: ['#7A1F2B', '#FAF7F2', '#D4AF37', '#302B1B', '#FFD8DD'],
  vintage_ilustrado: ['#FAF7F2', '#C5A059', '#824A2A', '#817B70', '#ECC499'],
  blush_sage: ['#F4C2C2', '#8A9A6B', '#FAF7F2', '#C9A0A0', '#DCE3DC'],
  modern_mono: ['#FFFFFF', '#CCCCCC', '#888888', '#EEEEEE', '#444444'],
  capiz_pina: ['#F2E8D5', '#E7E2DA', '#D9CBB0', '#F3ECE0', '#C9BBA8'],
  magenta_red_seam: ['#FFFFF0', '#B3202C', '#C4177A', '#E7E2DA', '#7A1F2B'],
  three_only: ['#7A1F2B', '#D4AF37', '#FAF7F2'],
  royalty: ['#1E2540', '#7A1F2B', '#C5A059', '#F3ECE0', '#3B5437'],
  timeless: ['#F3ECE0', '#E8D6B8', '#C5A059', '#8A6D3B', '#FAF7F2'],
};

const ORDER: RoleKey[] = [
  'ceremony',
  'bride',
  'groom',
  'parents_immediate_family',
  'principal_sponsors',
  'muslim_principals',
  'maid_of_honor',
  'best_man',
  'bridesmaids',
  'groomsmen',
  'wedding_party',
  'secondary_sponsors',
  'bearers_flower_girl',
  'officiants',
  'guest',
];

test('the six-rank visibility ordering holds across every fixture and style: 97 ordered pairs, 0 failures', () => {
  let fails = 0;
  let checks = 0;
  const failures: string[] = [];

  for (const [name, majors] of Object.entries(SETS)) {
    for (const style of STYLES) {
      const slots = normalizeMajors(majors);
      const venue = deriveVenue(slots, style);
      const room = roomReference(venue);
      const board = deriveBoard(majors, style);

      // monotone over DERIVED, non-exempt roles
      const byRank: Record<number, number[]> = {};
      for (const k of PEOPLE_KEYS) {
        if (EXEMPT.has(k) || RANK_EXEMPT.has(k)) continue;
        const r = VISIBILITY_RANK[k]!;
        (byRank[r] ||= []).push(visibility(oklchOfHex(board[k]![0]!), room));
      }
      const groups = board.__meta.separable;
      const vOf = (g: number[]): number[] => g.flatMap((r) => byRank[r] ?? []);
      for (let i = 0; i + 1 < groups.length; i++) {
        const a = vOf(groups[i]!);
        const b2 = vOf(groups[i + 1]!);
        if (!a.length || !b2.length) continue;
        checks++;
        const hi = Math.min(...a);
        const lo = Math.max(...b2);
        const ok = style === 'simple' ? hi >= lo - 1e-9 : hi > lo + 1e-9;
        if (!ok) {
          fails++;
          failures.push(`INVERSION ${name}/${style} [${groups[i]}]=${hi.toFixed(4)} [${groups[i + 1]}]=${lo.toFixed(4)}`);
        }
      }
    }
  }

  assert.deepEqual(failures, []);
  assert.equal(checks, 97, `expected 97 ordered pairs, measured ${checks}`);
  assert.equal(fails, 0);
});

test('deriveBoard is deterministic: same majors + style always derives the same board', () => {
  const nondet: string[] = [];
  for (const [name, majors] of Object.entries(SETS)) {
    for (const style of STYLES) {
      const board = deriveBoard(majors, style);
      const again = deriveBoard(majors, style);
      for (const k of ORDER) {
        if (JSON.stringify(board[k]) !== JSON.stringify(again[k])) nondet.push(`${name}/${style}/${k}`);
      }
    }
  }
  assert.deepEqual(nondet, []);
});

test('no one but the bride wears bridal white; the flower girl/ring bearer never wears the child-floor-violating dark end', () => {
  const violations: string[] = [];
  for (const [name, majors] of Object.entries(SETS)) {
    for (const style of STYLES) {
      const board = deriveBoard(majors, style);
      for (const k of PEOPLE_KEYS) {
        for (const h of board[k] ?? []) {
          const c = oklchOfHex(h);
          if (k !== 'bride' && c.L >= 0.86 && c.C <= 0.06) violations.push(`BRIDAL ${name}/${style}/${k} ${h}`);
          if (
            k === 'bearers_flower_girl' &&
            c.L < 0.7 &&
            !board.__meta.warnings.some((w) => w.key === k)
          ) {
            violations.push(`CHILD ${name}/${style} ${h}`);
          }
        }
      }
    }
  }
  assert.deepEqual(violations, []);
});

test('a fully grey theme (modern_mono) never leaks a chromatic colour into any role', () => {
  const violations: string[] = [];
  const majors = SETS.modern_mono!;
  for (const style of STYLES) {
    const board = deriveBoard(majors, style);
    for (const k of PEOPLE_KEYS) {
      for (const h of board[k] ?? []) {
        const c = oklchOfHex(h);
        if (c.C >= 0.03) violations.push(`GREY-LEAK ${style}/${k} ${h} C=${c.C.toFixed(3)}`);
      }
    }
  }
  assert.deepEqual(violations, []);
});

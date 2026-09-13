import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displayColorsFor, derivedBoardFor, effectiveMajors } from './mood-board-derive';
import { PALETTE_ORDER, type PaletteKey, type RolePalette } from './mood-board';
import {
  deriveVenue,
  roomReference,
  normalizeMajors,
  visibility,
  VISIBILITY_RANK,
  EXEMPT,
  RANK_EXEMPT,
  PEOPLE_KEYS,
  type PaletteStyle,
} from './palette-styles';
import { oklchOfHex } from './color-space';

/**
 * THE TRAP THE BRIEF NAMES: the old UI top-up ("while colors.length < min,
 * push the Dominant major") broke the six-rank monotonic invariant, because
 * repeating the loudest major into a short role can hand it MORE visibility
 * than a rank above it. `lib/palette-styles-rank-ordering-is-monotonic.test.ts`
 * proves the invariant holds for `deriveBoard`'s raw output; this file
 * re-runs the EXACT same check through `displayColorsFor` — the function
 * section 02 actually calls to decide what a role's swatches show — so a
 * regression that reintroduces padding in the UI layer (not the engine) is
 * caught here, not just in the lib.
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

const NO_TOUCHED: ReadonlySet<PaletteKey> = new Set();

test('the six-rank ordering still holds THROUGH displayColorsFor (the UI slice path): 97 ordered pairs, 0 failures', () => {
  let checks = 0;
  const failures: string[] = [];

  for (const [name, majors] of Object.entries(SETS)) {
    for (const style of STYLES) {
      const palette: RolePalette = { reception: majors };
      const derived = derivedBoardFor(effectiveMajors(palette), style);
      assert.ok(derived, `${name}/${style} should derive a board`);
      const venue = deriveVenue(normalizeMajors(majors), style);
      const room = roomReference(venue);

      const byRank: Record<number, number[]> = {};
      for (const k of PEOPLE_KEYS) {
        if (EXEMPT.has(k) || RANK_EXEMPT.has(k)) continue;
        const r = VISIBILITY_RANK[k]!;
        const colors = displayColorsFor(k, palette, NO_TOUCHED, derived);
        if (!colors.length) continue;
        (byRank[r] ||= []).push(visibility(oklchOfHex(colors[0]!), room));
      }
      const groups = derived.__meta.separable;
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
          failures.push(`INVERSION ${name}/${style} [${groups[i]}]=${hi.toFixed(4)} [${groups[i + 1]}]=${lo.toFixed(4)}`);
        }
      }
    }
  }

  assert.deepEqual(failures, []);
  assert.equal(checks, 97, `expected 97 ordered pairs through the slice path, measured ${checks}`);
});

test('🛑 THE TRAP · displayColorsFor never pads a short derived role up toward its min', () => {
  // A hand-built Board where `guest` derived only ONE color — shorter than
  // its min of 3. The old UI's top-up would have pushed the Dominant major
  // twice more to reach 3; the ported function must show exactly the one
  // honest color instead.
  const majors = SETS.crimson_ivory_regal!;
  const derived = derivedBoardFor(majors, 'depth')!;
  const shortDerived = { ...derived, guest: [derived.guest![0]!] };
  const palette: RolePalette = { reception: majors };
  const shown = displayColorsFor('guest', palette, NO_TOUCHED, shortDerived);
  assert.deepEqual(shown, [derived.guest![0]!], 'must show fewer than min, never pad to reach it');
});

test('a touched role is never re-derived, no matter what the (possibly stale) derived board says', () => {
  const majors = SETS.crimson_ivory_regal!;
  const derived = derivedBoardFor(majors, 'depth')!;
  const palette: RolePalette = { reception: majors, guest: ['#112233'] };
  const touched = new Set<PaletteKey>(['guest']);
  assert.deepEqual(displayColorsFor('guest', palette, touched, derived), ['#112233']);
  // Even a null/absent derived board (majors just cleared) must not touch it.
  assert.deepEqual(displayColorsFor('guest', palette, touched, null), ['#112233']);
});

test('no major chosen yet: every derivable role shows an honest empty array, never a fabricated one', () => {
  const palette: RolePalette = {};
  for (const key of PALETTE_ORDER) {
    if (key === 'officiants' || key === 'reception') continue;
    assert.deepEqual(displayColorsFor(key, palette, NO_TOUCHED, null), []);
  }
});

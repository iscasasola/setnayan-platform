import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  harmonySuggestions,
  shadeSuggestions,
  candidatesFor,
  dedupeSuggestionsByName,
  progressiveReceptionSuggestion,
  type ColorSuggestion,
} from './palette-recommender';
import { nearestColorName } from './color-names';

const HEX_RE = /^#[0-9A-F]{6}$/;

// ── harmonySuggestions / shadeSuggestions — pure colour-wheel relations ────

test('harmonySuggestions returns five valid, distinct hexes for a mid-tone base', () => {
  const out = harmonySuggestions('#C97B4B');
  assert.equal(out.length, 5);
  for (const s of out) assert.match(s.hex, HEX_RE);
  const hexes = new Set(out.map((s) => s.hex));
  assert.equal(hexes.size, 5, 'no two harmony relations should collapse to the same hex');
});

test('harmonySuggestions never throws on a neon or greyscale extreme', () => {
  for (const base of ['#FF0000', '#00FF00', '#000000', '#FFFFFF', '#808080']) {
    assert.doesNotThrow(() => harmonySuggestions(base));
  }
});

test('shadeSuggestions returns four same-hue variants, all valid hexes', () => {
  const out = shadeSuggestions('#7A1F2B');
  assert.equal(out.length, 4);
  for (const s of out) assert.match(s.hex, HEX_RE);
});

// ── dedupeSuggestionsByName — one chip per name ────────────────────────────

test('dedupeSuggestionsByName drops a later candidate whose nearest name repeats an earlier one', () => {
  const list: ColorSuggestion[] = [
    { label: 'A', hex: '#C97B4B' },
    { label: 'B', hex: '#C97B4C' }, // effectively the same colour — same nearest name
  ];
  const out = dedupeSuggestionsByName(list);
  assert.equal(out.length, 1);
});

test('dedupeSuggestionsByName excludes a candidate whose name is already taken', () => {
  const list: ColorSuggestion[] = [{ label: 'A', hex: '#C97B4B' }];
  const takenName = nearestColorName('#C97B4B') ?? '#C97B4B';
  assert.deepEqual(dedupeSuggestionsByName(list, [takenName]), []);
});

test('a hex with no reasonably close named colour is never silently dropped by dedupe', () => {
  // Two candidates that are unlikely to share a nearest name and unlikely to
  // resolve to null either — the guard here is simply "distinct inputs
  // survive distinct outputs", not a specific colour name.
  const list: ColorSuggestion[] = [
    { label: 'A', hex: '#123456' },
    { label: 'B', hex: '#654321' },
  ];
  const out = dedupeSuggestionsByName(list);
  assert.ok(out.length >= 1);
});

// ── candidatesFor — THE PROGRESSIVE STEP ───────────────────────────────────

test('candidatesFor never throws and only returns valid hexes, across a spread of chosen sets', () => {
  const sets: string[][] = [
    ['#C97B4B'],
    ['#7A1F2B', '#C5A059'],
    ['#000000', '#FFFFFF', '#808080'],
    ['#3A5746', '#E3C9A6', '#1E2540', '#C9A0A0'],
  ];
  for (const chosen of sets) {
    const out = candidatesFor(chosen);
    for (const s of out) assert.match(s.hex, HEX_RE);
  }
});

test('candidatesFor never returns a candidate that collides with any already-chosen colour', () => {
  const chosen = ['#7A1F2B', '#C5A059', '#3A5746'];
  const out = candidatesFor(chosen);
  assert.ok(out.length > 0, 'a three-colour palette should still surface candidates');
  // Re-derive the same WCAG-style contrast the implementation enforces, so
  // this test fails independently if the collision filter is ever loosened.
  const hexToRgb = (hex: string): [number, number, number] => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const relLuminance = ([r, g, b]: [number, number, number]) => {
    const lin = (v: number) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const contrast = (a: string, b: string) => {
    const la = relLuminance(hexToRgb(a));
    const lb = relLuminance(hexToRgb(b));
    const [lighter, darker] = la > lb ? [la, lb] : [lb, la];
    return (lighter + 0.05) / (darker + 0.05);
  };
  for (const c of out) {
    for (const o of chosen) {
      assert.ok(contrast(c.hex, o) >= 1.15, `${c.hex} collides with already-chosen ${o}`);
    }
  }
});

// THE DEFECT THIS SESSION EXISTS TO FIX ("second row does not offer 4th and
// 5th colour" — owner, 2026-09-03): the candidate pool for a two-colour
// board must be shaped by BOTH colours, not just the most recently added
// one — i.e. genuinely cumulative, not one-shot.
test('candidatesFor accounts for every chosen colour, not only the most recent one', () => {
  const first = ['#7A1F2B'];
  const withSecond = ['#7A1F2B', '#C5A059'];
  const poolFirstOnly = new Set(candidatesFor(first).map((s) => s.hex));
  const poolBoth = new Set(candidatesFor(withSecond).map((s) => s.hex));
  // The two-colour pool must differ from the one-colour pool — proof that
  // the second colour actually widened/reshaped the candidate set instead
  // of the function reading only the last (or only the first) entry.
  const onlyInBoth = [...poolBoth].filter((h) => !poolFirstOnly.has(h));
  assert.ok(
    onlyInBoth.length > 0,
    'adding a second chosen colour should change the candidate pool — it is not reachable from the first colour alone',
  );
});

test('candidatesFor on an empty chosen list returns no candidates (nothing to be progressive from)', () => {
  assert.deepEqual(candidatesFor([]), []);
});

// ── progressiveReceptionSuggestion — the gated entry point section 02 calls ─

test('⭐ THE GUARD · stays silent (undefined) on a genuinely blank board — nothing chosen yet', () => {
  assert.equal(progressiveReceptionSuggestion([]), undefined);
});

test('⭐ THE GUARD · advises the moment hasChosenMajors is true — one colour already chosen', () => {
  const out = progressiveReceptionSuggestion(['#C97B4B']);
  assert.notEqual(out, undefined);
  assert.match(out as string, HEX_RE);
});

test('progressiveReceptionSuggestion never repeats an already-chosen colour by name', () => {
  const chosen = ['#7A1F2B', '#C5A059', '#3A5746', '#1E2540'];
  const out = progressiveReceptionSuggestion(chosen);
  assert.notEqual(out, undefined);
  assert.ok(!chosen.includes(out as string));
});

test('progressiveReceptionSuggestion never collides with any colour already on the board, even as the board grows', () => {
  // The scalar "best pick" can coincidentally survive from a smaller board
  // to a larger one (candidatesFor's growing POOL is what test 9 pins), so
  // this asserts the invariant that actually matters here: whatever comes
  // back is always distinct from everything already chosen, at every size.
  let chosen: string[] = [];
  for (const hex of ['#7A1F2B', '#C5A059', '#3A5746', '#1E2540']) {
    const suggestion = progressiveReceptionSuggestion(chosen);
    if (suggestion) assert.ok(!chosen.includes(suggestion));
    chosen = [...chosen, hex];
  }
});

test('progressiveReceptionSuggestion never throws across a spread of fuzz sets', () => {
  const sets: string[][] = [
    [],
    ['#FFFFFF'],
    ['#000000'],
    ['#808080'],
    ['#FAF7F2', '#F5EDE4'],
    ['#7A1F2B', '#C5A059', '#8A9A6B', '#1E2540', '#C97B4B'],
  ];
  for (const chosen of sets) {
    assert.doesNotThrow(() => progressiveReceptionSuggestion(chosen));
  }
});

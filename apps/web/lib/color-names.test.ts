import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CSS_NAMES,
  WEDDING_NAMES,
  descriptiveColorName,
  nearestColorName,
  resolveColorName,
} from './color-names';

/**
 * A NAME FROM THE WRONG HUE FAMILY DESTROYS EVERY NAME ON THE PAGE.
 *
 * These names ride the couple's palette editor, the vendor-facing mood board,
 * the concept PDF, the gallery swatch strips and the generated theme
 * descriptions. Measured on the pre-fix function, 45.1% of a 6,480-hex sweep
 * across the hue circle came back from the wrong family:
 *
 *   #20452F  deep pine GREEN     → "Charcoal"  (a blue-black NEUTRAL)
 *   #CDD590  pale YELLOW-GREEN   → "Tan"       (an orange-brown)
 *   #DC143C  CRIMSON, in the CSS table EXACTLY → "Rose"
 *
 * ⚠ CIELAB IS WRITTEN OUT AGAIN BELOW ON PURPOSE — the same discipline
 * `moodboard-theme-generator.test.ts` and
 * `the-completion-cannot-invert-a-theme-s-mood.test.ts` use. If this file
 * imported `./color-space`, a broken conversion would satisfy its own guard
 * and every assertion here would still be green.
 */
function lab(hex: string): { L: number; a: number; b: number } {
  const n = parseInt(hex.slice(1), 16);
  const lin = (u: number) => (u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4);
  const r = lin(((n >> 16) & 255) / 255);
  const g = lin(((n >> 8) & 255) / 255);
  const b = lin((n & 255) / 255);
  const X = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const Y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const Z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
  return { L: 116 * f(Y) - 16, a: 500 * (f(X) - f(Y)), b: 200 * (f(Y) - f(Z)) };
}
const chroma = (hex: string) => Math.hypot(lab(hex).a, lab(hex).b);
const hue = (hex: string) => ((Math.atan2(lab(hex).b, lab(hex).a) * 180) / Math.PI + 360) % 360;
function hueDeg(h1: number, h2: number) {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
}
function deltaH(p: string, q: string) {
  const dh = (hueDeg(hue(p), hue(q)) * Math.PI) / 180;
  return 2 * Math.sqrt(chroma(p) * chroma(q)) * Math.sin(dh / 2);
}

// The shipped thresholds, restated. If the module loosens one, these fail.
const ACHROMATIC = 6;
const TINTED_NEUTRAL = 12;
const MAX_DRIFT = 12;
const MAX_DRIFT_DEG = 40;

/** Is `name`'s own color in the same hue family as `input`? */
function hueHonest(input: string, source: string): boolean {
  if (input.toUpperCase() === source.toUpperCase()) return true;
  const inChroma = chroma(input);
  const srcChroma = chroma(source);
  const srcIsGrey = srcChroma < ACHROMATIC;
  if (inChroma < ACHROMATIC) return srcIsGrey;
  const hueOk =
    !srcIsGrey && deltaH(input, source) <= MAX_DRIFT && hueDeg(hue(input), hue(source)) <= MAX_DRIFT_DEG;
  if (inChroma < TINTED_NEUTRAL) return srcIsGrey || hueOk;
  return hueOk;
}

// ── the three reported defects ───────────────────────────────────────────

test('the three reported wrong-family names are gone', () => {
  // Not "is it this exact string" — the property that was violated is what is
  // asserted: the name must belong to the input's own hue family.
  for (const hex of ['#20452F', '#CDD590', '#DC143C']) {
    const got = resolveColorName(hex);
    assert.ok(got, `${hex} must resolve`);
    if (got.hex) {
      assert.ok(
        hueHonest(hex, got.hex),
        `${hex} (C* ${chroma(hex).toFixed(0)}, h ${hue(hex).toFixed(0)}°) was named "${got.name}" ` +
          `= ${got.hex} (C* ${chroma(got.hex).toFixed(0)}, h ${hue(got.hex).toFixed(0)}°) — wrong family`,
      );
    }
  }
  // and the specific regressions, so the fix cannot silently become vacuous
  assert.notEqual(nearestColorName('#20452F'), 'Charcoal'); // a green is not a neutral
  assert.notEqual(nearestColorName('#CDD590'), 'Tan'); // a yellow-green is not a brown
  assert.equal(nearestColorName('#DC143C'), 'Crimson'); // an exact CSS entry names itself
});

test('a green is never given a neutral name, at any lightness', () => {
  for (const hex of ['#20452F', '#0B2B18', '#2E5C40', '#14331F', '#3A6B4C']) {
    const name = nearestColorName(hex);
    assert.ok(
      !['Charcoal', 'Silver', 'Gainsboro', 'Dim Gray', 'Dark Gray', 'Gray', 'Black'].includes(
        name ?? '',
      ),
      `${hex} is a green (C* ${chroma(hex).toFixed(0)}) and was named "${name}"`,
    );
  }
});

// ── achromatic inputs, both directions ───────────────────────────────────

test('a near-grey still gets a grey name', () => {
  for (const hex of ['#1E2229', '#2A2A2A', '#4A4A50', '#808080', '#9A9A9A', '#C0C0C0', '#DCDCDC', '#F5F5F5']) {
    const got = resolveColorName(hex)!;
    assert.ok(chroma(hex) < ACHROMATIC, `${hex} should be achromatic for this test`);
    assert.ok(got.hex, `${hex} should find a real grey name, not the descriptive fallback`);
    assert.ok(
      chroma(got.hex!) < ACHROMATIC,
      `${hex} (a grey) was named "${got.name}", whose own C* is ${chroma(got.hex!).toFixed(1)}`,
    );
  }
});

test('a chromatic input is never given an achromatic name', () => {
  let checked = 0;
  for (let h = 0; h < 360; h += 3) {
    for (const [s, l] of [
      [0.5, 0.3],
      [0.7, 0.5],
      [0.4, 0.7],
    ] as const) {
      const hex = hslHex(h, s, l);
      if (chroma(hex) < TINTED_NEUTRAL) continue;
      const got = resolveColorName(hex)!;
      checked++;
      if (!got.hex) continue;
      assert.ok(
        chroma(got.hex) >= ACHROMATIC,
        `${hex} (C* ${chroma(hex).toFixed(0)}) was named "${got.name}", an achromatic name`,
      );
    }
  }
  assert.ok(checked > 200, `expected a real sample, checked ${checked}`);
});

// ── the curated layer must not regress ───────────────────────────────────

test('curated wedding / Filipino names still win where they apply', () => {
  for (const entry of WEDDING_NAMES) {
    assert.equal(nearestColorName(entry.hex), entry.name, `${entry.hex} should be ${entry.name}`);
  }
  // and near-misses — a couple never picks the table value exactly
  const nearMisses: ReadonlyArray<readonly [string, string]> = [
    ['#F5C4C4', 'Blush'],
    ['#F3C0C0', 'Blush'],
    ['#C87D4D', 'Terracotta'],
    ['#8C9C6D', 'Sage'],
    ['#F3E9D6', 'Piña Cream'],
    ['#EBE7DB', 'Capiz Pearl'],
    ['#FBFBF4', 'Sampaguita White'],
    ['#6C4327', 'Narra Brown'],
    ['#4D6C40', 'Banana Leaf Green'],
    ['#8F4C8D', 'Waling-Waling Purple'],
    ['#C8A86D', 'Bamboo Tan'],
    ['#1F2641', 'Navy'],
    ['#7EB9DA', 'Sky Blue'],
    ['#C6A15A', 'Champagne Gold'],
    ['#E9745B', 'Coral'],
  ];
  for (const [hex, want] of nearMisses) {
    assert.equal(nearestColorName(hex), want, `${hex} should still read as ${want}`);
  }
});

test('every CSS entry round-trips to its own name', () => {
  const failures = CSS_NAMES.filter((n) => nearestColorName(n.hex) !== n.name).map(
    (n) => `${n.hex} is ${n.name} but resolved to ${nearestColorName(n.hex)}`,
  );
  assert.deepEqual(failures, [], failures.join('\n'));
  assert.ok(CSS_NAMES.length >= 138, `expected the full CSS table, got ${CSS_NAMES.length}`);
});

// ── the sweep ────────────────────────────────────────────────────────────

function hslHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g] = [c, x];
  else if (h < 120) [r, g] = [x, c];
  else if (h < 180) [g, b] = [c, x];
  else if (h < 240) [g, b] = [x, c];
  else if (h < 300) [r, b] = [x, c];
  else [r, b] = [c, x];
  return `#${[r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

test('a sweep of the hue circle never returns a name from another family', () => {
  const violations: string[] = [];
  let total = 0;
  let descriptive = 0;
  for (let h = 0; h < 360; h += 2) {
    for (const s of [0.1, 0.2, 0.35, 0.5, 0.7, 0.9]) {
      for (const l of [0.15, 0.3, 0.45, 0.6, 0.75, 0.9]) {
        const hex = hslHex(h, s, l);
        total++;
        const got = resolveColorName(hex);
        assert.ok(got, `${hex} must resolve to something`);
        // 🔑 READ `source`, NOT THE STRING. The descriptive fallback
        // legitimately emits words the CSS table also holds ("Purple",
        // "Deep Pink"). An earlier cut of this guard matched on the name and
        // reported three violations that were all honest fallbacks.
        if (got.source === 'descriptive') {
          descriptive++;
          continue;
        }
        if (!hueHonest(hex, got.hex!)) {
          violations.push(
            `${hex} (C* ${chroma(hex).toFixed(0)}, h ${hue(hex).toFixed(0)}°) → "${got.name}" ${got.hex}`,
          );
        }
      }
    }
  }
  assert.ok(total >= 6000, `expected a real sweep, got ${total}`);
  assert.deepEqual(violations.slice(0, 15), [], `${violations.length} wrong-family names`);
  // The fallback is the honest answer, not the usual one — if it starts
  // carrying the page, the tables or the radius are wrong, not the guard.
  assert.ok(
    descriptive / total < 0.05,
    `descriptive fallback fired for ${((descriptive / total) * 100).toFixed(1)}% of the sweep`,
  );
});

// ── the honest fallback ──────────────────────────────────────────────────

test('the fallback describes what was measured, and never returns null for a valid hex', () => {
  // every caller codes against `string | null` where null means "not a hex"
  assert.equal(nearestColorName('nope'), null);
  assert.equal(nearestColorName('#FFF'), null);
  assert.equal(nearestColorName(''), null);
  for (let h = 0; h < 360; h += 7) {
    for (const s of [0.05, 0.45, 0.95]) {
      for (const l of [0.05, 0.5, 0.95]) {
        assert.equal(typeof nearestColorName(hslHex(h, s, l)), 'string');
      }
    }
  }
  // and the descriptive name states the family it actually is
  assert.equal(descriptiveColorName(lab('#20452F')), 'Dark Green'); // L* 26 — the Dark band
  assert.equal(descriptiveColorName(lab('#0B2B18')), 'Deep Green'); // L* 14 — the Deep band
  assert.equal(descriptiveColorName(lab('#808080')), 'Gray');
  assert.equal(descriptiveColorName(lab('#0A0A0A')), 'Near Black');
  // 🔑 The Yellow / Yellow-Green boundary is the midpoint of the sRGB yellow
  // (h 103°) and chartreuse (h 128°) anchors, and the CSS table's OWN
  // "Yellow Green" #9ACD32 (h 120°) lands inside the Yellow-Green band —
  // the boundary is corroborated by the table, not fitted to one example.
  assert.equal(descriptiveColorName(lab('#9ACD32')), 'Light Yellow-Green');
  assert.equal(descriptiveColorName(lab('#CDD590')), 'Light Yellow'); // h 112° — yellow side
});

test('lowercase and uppercase hex resolve identically', () => {
  for (const hex of ['#20452f', '#cdd590', '#dc143c', '#f4c2c2']) {
    assert.equal(nearestColorName(hex), nearestColorName(hex.toUpperCase()));
  }
});

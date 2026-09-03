import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CSS_NAMES,
  WEDDING_NAMES,
  descriptiveColorName,
  foldColorName,
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
/** ΔE (CIE76), written out here for the same reason `lab` is. */
function dE(p: string, q: string) {
  const a = lab(p);
  const b = lab(q);
  return Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b);
}

// The shipped thresholds, restated. If the module loosens one, these fail.
const ACHROMATIC = 6;
const TINTED_NEUTRAL = 12;
const MAX_DRIFT = 12;
const MAX_DRIFT_DEG = 40;
const MAX_SRGB_DRIFT_DEG = 30;

/** sRGB hue, written out here for the same reason `lab` is. */
function srgbHue(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

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

// ── the boundary CIELAB CANNOT SEE ──────────────────────────────────────
//
// 🛑 EVERY ASSERTION ABOVE IS BLIND TO THIS ONE, AND WOULD STAY GREEN IF THE
// FIX WERE DELETED. `hueHonest` is built from ΔH*ab and the Lab hue angle, and
// CIELAB gives sRGB blue #0000FF and CSS Medium Purple #9370DB the SAME hue
// angle — 306.3° both. So a guard made only of those two terms admits a purple
// name for a blue at Δh 0°, the sweep above calls it honest, and a couple is
// told their cornflower table runner is "Ube". Measured on a 1,746-hex corpus,
// that one boundary was 91 of 227 wrong-family names — the largest group, and
// the only one no threshold could reach. The module answers it with a THIRD
// term in sRGB hue; these two tests are what stop that term shipping inert.

test('a blue is never given a purple name, and a purple never a blue one', () => {
  const pinned: ReadonlyArray<readonly [string, string]> = [
    ['#383E8C', 'a deep indigo BLUE'],
    ['#3940A0', 'a royal BLUE'],
    ['#303A8E', 'a dark indigo BLUE'],
    ['#666DCC', 'a cornflower BLUE'],
    ['#B7C7E4', 'a powder BLUE'],
    ['#3B105E', 'a deep VIOLET'],
    ['#370F4F', 'an aubergine VIOLET'],
    ['#2E2436', 'a near-black EGGPLANT'],
  ];
  for (const [hex, what] of pinned) {
    const got = resolveColorName(hex)!;
    if (!got.hex) continue; // an honest descriptive answer is allowed
    const gap = hueDeg(srgbHue(hex), srgbHue(got.hex));
    assert.ok(
      gap <= MAX_SRGB_DRIFT_DEG,
      `${hex} is ${what} and was named "${got.name}" ${got.hex} — ` +
        `${gap.toFixed(0)}° away in sRGB hue (ceiling ${MAX_SRGB_DRIFT_DEG}°), ` +
        `though only ${hueDeg(hue(hex), hue(got.hex)).toFixed(0)}° away in CIELAB, ` +
        `which is why CIELAB alone cannot catch it`,
    );
  }
});

test('the sRGB hue ceiling holds across the whole cube, not just the blues', () => {
  const violations: string[] = [];
  let checked = 0;
  const h2 = (v: number) => v.toString(16).padStart(2, '0').toUpperCase();
  for (let r = 0; r < 256; r += 16) {
    for (let g = 0; g < 256; g += 16) {
      for (let b = 0; b < 256; b += 16) {
        const hex = `#${h2(r)}${h2(g)}${h2(b)}`;
        if (chroma(hex) < TINTED_NEUTRAL) continue; // the tinted-neutral regime may take a grey
        const got = resolveColorName(hex)!;
        if (!got.hex || chroma(got.hex) < ACHROMATIC) continue;
        checked++;
        const gap = hueDeg(srgbHue(hex), srgbHue(got.hex));
        if (gap > MAX_SRGB_DRIFT_DEG) violations.push(`${hex} → "${got.name}" ${got.hex}, ${gap.toFixed(0)}°`);
      }
    }
  }
  assert.ok(checked > 1500, `expected a real sample, checked ${checked}`);
  assert.deepEqual(violations.slice(0, 10), [], `${violations.length} answers exceed the sRGB hue ceiling`);
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

// ── the table's own coherence ────────────────────────────────────────────
//
// 🛑 THE ASSERTIONS ABOVE WENT GREEN, UNCHANGED, ON A CHANGE THAT REWROTE 28%
// OF THE COLOUR CUBE. On 2026-09-03 `WEDDING_NAMES` went 32 → 62 entries and
// `Sage` moved to a different hex; every test above passed before AND after,
// because they all ask "is this name from the right hue family" and nothing
// asks whether the TABLE is coherent. It was not: the shipped `Sage #8A9A6B`
// was sitting on moss's coordinates, so the owner's "where is the moss green?"
// was answered, at full confidence, with "Sage".
//
// A wrong-family name is what the guards above catch. A right-family name from
// the WRONG COLOUR is what these five catch — the defect that actually shipped.

/**
 * The 32 entries as shipped before 2026-09-03. Several of them sit on top of
 * each other (Cream / Sampaguita White are ΔE 2.16 apart) and a retroactive
 * separation rule is therefore impossible. They are grandfathered EXPLICITLY,
 * BY NAME, so the rule cannot be quietly dropped for the whole table instead.
 */
const GRANDFATHERED = new Set([
  'Bamboo Tan', 'Banana Leaf Green', 'Black', 'Blush', 'Burgundy', 'Capiz Pearl',
  'Champagne Gold', 'Charcoal', 'Coral', 'Cream', 'Dusty Rose', 'Emerald',
  'Forest Green', 'Gold', 'Ivory', 'Lavender', 'Mustard', 'Narra Brown', 'Navy',
  'Peach', 'Piña Cream', 'Plum', 'Rose', 'Rust', 'Sage', 'Sampaguita White',
  'Silver', 'Sky Blue', 'Slate', 'Terracotta', 'Waling-Waling Purple', 'White',
]);

/** The mood board's own `MIN_PERCEPTUAL_GAP` — where two chips in one strip
 *  stop reading as one colour. Two curated NAMES closer than this are one
 *  colour with two words, and which word a couple gets is a coin flip. */
const MIN_PERCEPTUAL_GAP = 12;

test('every curated pair is at least MIN_PERCEPTUAL_GAP apart, except the shipped 32', () => {
  const tooClose: string[] = [];
  let grandfatheredDebt = 0;
  for (let i = 0; i < WEDDING_NAMES.length; i++) {
    for (let j = i + 1; j < WEDDING_NAMES.length; j++) {
      const a = WEDDING_NAMES[i]!;
      const b = WEDDING_NAMES[j]!;
      const d = dE(a.hex, b.hex);
      if (d >= MIN_PERCEPTUAL_GAP) continue;
      if (GRANDFATHERED.has(a.name) && GRANDFATHERED.has(b.name)) {
        grandfatheredDebt++;
        continue;
      }
      tooClose.push(`${a.name} ${a.hex} / ${b.name} ${b.hex} — ΔE ${d.toFixed(2)}`);
    }
  }
  assert.deepEqual(
    tooClose,
    [],
    `${tooClose.length} curated pair(s) are one colour with two names:\n${tooClose.join('\n')}`,
  );
  // The grandfathered debt may SHRINK, never grow — 17 pairs, every one of them
  // in the near-white cluster (Cream / Ivory / Capiz Pearl / Piña Cream /
  // Sampaguita White / White) plus Bamboo Tan-Champagne Gold and Narra
  // Brown-Rust. Moving a shipped hex ON TOP of another shipped one would keep
  // both names grandfathered and would otherwise slip past the check above.
  assert.ok(
    grandfatheredDebt <= 17,
    `the pre-2026-09-03 tight-pair debt grew to ${grandfatheredDebt} — it may only shrink`,
  );
});

test('no NEW curated name silently redefines a CSS name', () => {
  // `hexForColorName` builds its index CSS-first, curated-second, and the
  // second write wins — so a curated entry sharing a CSS word REDEFINES that
  // word for the whole app, in the name → hex direction. These eleven do it
  // deliberately and are documented in the module; a twelfth would do it by
  // accident, and nothing at the call site would look different.
  const DELIBERATE = new Set([
    'Black', 'Coral', 'Forest Green', 'Gold', 'Ivory', 'Lavender', 'Navy',
    'Plum', 'Silver', 'Sky Blue', 'White',
  ]);
  const css = new Set(CSS_NAMES.map((n) => foldColorName(n.name)));
  const accidents = WEDDING_NAMES.filter(
    (n) => css.has(foldColorName(n.name)) && !DELIBERATE.has(n.name),
  ).map((n) => `curated "${n.name}" shadows the CSS name of the same word`);
  assert.deepEqual(accidents, [], accidents.join('\n'));
  // and the documented list is EXHAUSTIVE, not a lower bound — a deliberate
  // collision that gets deleted should be removed from the module docblock too
  for (const name of DELIBERATE) {
    assert.ok(
      WEDDING_NAMES.some((n) => n.name === name),
      `"${name}" is documented as a deliberate CSS collision but is no longer curated`,
    );
  }
});

test('a curated name never wins on lightness alone', () => {
  // The defect the radius exists to prevent, asserted instead of commented:
  // #CDD590, a PALE yellow-green, used to be captured by Sage at ΔE 24.5 —
  // right family, 22 points of L* away, two whole lightness bands. Same family
  // is the floor, not the goal.
  const lies: string[] = [];
  let curated = 0;
  const h2 = (v: number) => v.toString(16).padStart(2, '0').toUpperCase();
  for (let r = 0; r < 256; r += 8) {
    for (let g = 0; g < 256; g += 8) {
      for (let b = 0; b < 256; b += 8) {
        const hex = `#${h2(r)}${h2(g)}${h2(b)}`;
        const got = resolveColorName(hex)!;
        if (got.source !== 'wedding' || !got.hex) continue;
        curated++;
        const dL = Math.abs(lab(hex).L - lab(got.hex).L);
        if (dL > 15) lies.push(`${hex} → "${got.name}" — right family, ΔL* ${dL.toFixed(1)}`);
      }
    }
  }
  assert.ok(curated > 8000, `expected a real curated sample, got ${curated}`);
  // 47 of 13,173 at 62 names / radius 16 — measured, and the number the radius
  // was CHOSEN by (5.1% at radius 20 → 0.4% at 16). It may only shrink.
  assert.ok(
    lies.length <= 60,
    `${lies.length} curated wins are the right family at the wrong lightness:\n${lies.slice(0, 10).join('\n')}`,
  );
});

test('the achromatic census is deliberate', () => {
  // Below C* 6 the hue gate STOPS FILTERING — an achromatic entry is compatible
  // with every grey in reach, so these six compete for the entire neutral axis
  // and each new one takes territory from all the others. A seventh must be a
  // decision, not a side effect of adding a word that happened to be greyish.
  assert.deepEqual(
    WEDDING_NAMES.filter((n) => chroma(n.hex) < ACHROMATIC)
      .map((n) => n.name)
      .sort(),
    ['Black', 'Charcoal', 'Cream', 'Sampaguita White', 'Silver', 'White'],
  );
});

test('a name that claims a hue family belongs to it', () => {
  // A hue lie can be spelled into the NAME instead of into the match, and no
  // guard above would see it. "Olive Green" at #6E7145 was the live candidate:
  // it measures h 110°, which this module's own `descriptiveColorName` calls
  // Yellow. It shipped as "Olive Grove" — no family claim — rather than having
  // its hex tuned until the word came true.
  for (const n of WEDDING_NAMES) {
    const claim = /Green|Red|Blue|Teal|Purple|Violet|Pink|Yellow|Orange/.exec(n.name);
    if (!claim) continue;
    const measured = descriptiveColorName(lab(n.hex));
    assert.ok(
      measured.includes(claim[0]),
      `"${n.name}" ${n.hex} claims ${claim[0]} but this module measures it as "${measured}"`,
    );
  }
});

test('the vocabulary the owner asked for actually answers', () => {
  // "provide a wider color naming. where is the moss green?" — 2026-09-02.
  // Eleven of these were answered by a CONFIDENT CURATED NAME FROM THE WRONG
  // COLOUR before the table doubled, which is why the assertion is on the word
  // and not merely on the layer.
  const trade: ReadonlyArray<readonly [string, string]> = [
    ['#8A9A5B', 'Moss'], // was "Sage" — the owner's actual question
    ['#9DB2A6', 'Eucalyptus'], // was "Silver"
    ['#BFB5A8', 'Greige'], // was "Silver"
    ['#B08D9E', 'Mauve'], // was "Dusty Rose"
    ['#4A0F1E', 'Oxblood'], // was "Burgundy"
    ['#7B5E51', 'Mocha'], // was "Narra Brown"
    ['#3C2415', 'Espresso'], // was "Narra Brown"
    ['#1F6F78', 'Peacock'], // was "Slate"
    ['#CCCCFF', 'Periwinkle'], // was "Lavender"
    ['#6E4B9E', 'Ube'], // was the CSS "Dark Slate Blue"
    ['#9CAF4A', 'Calamansi'], // was the CSS "Olive Drab"
    ['#8B7E74', 'Taupe'], // was the CSS "Gray"
    ['#9CAF88', 'Sage'], // and Sage still answers, at its attested value
  ];
  for (const [hex, want] of trade) {
    assert.equal(nearestColorName(hex), want, `${hex} should read as ${want}`);
  }
});

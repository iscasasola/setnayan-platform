/**
 * Theme-template PROCEDURAL GENERATOR tests (Mood Board taxonomy expansion,
 * 2026-09-03) — the ≥25-per-combination, schema-valid, non-duplicate-name
 * guarantees the seed script (scripts/generate-moodboard-theme-seed.ts)
 * relies on before it will even write SQL. These tests run the SAME
 * generator function the seed script does, not a copy of it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateAllThemes,
  generateTemplate,
  validateGeneratedTemplate,
  completeReceptionFive,
  ALL_STYLE_FAMILIES,
  ALL_MOOD_TAGS,
  THEMES_PER_COMBINATION,
  RECEPTION_PALETTE_SIZE,
} from './moodboard-theme-generator';
import { PALETTE_LIMITS, sanitizeRolePalette } from './mood-board';

// Full generation is done once and shared across tests — it's pure and
// deterministic, and re-running it per test would be wasteful (2,500 rows).
const ALL = generateAllThemes();

// Color measures the assertions below reason about, computed HERE from the hex
// rather than imported from the generator — a palette rule checked with the
// generator's own private helpers would agree with it by construction.
const rgbOf = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
/** 0-100 — how colorful, i.e. the RGB max-min spread. NOT HSL saturation,
 *  which reports 100 for ivory (#FFFFF0). */
const chromaOf = (hex: string) => {
  const c = rgbOf(hex);
  return (Math.max(...c) - Math.min(...c)) / 2.55;
};
/** 0-100 HSL lightness. */
const lightnessOf = (hex: string) => {
  const c = rgbOf(hex);
  return (Math.max(...c) + Math.min(...c)) / 2 / 2.55;
};
/** CIELAB, written out here rather than imported: "is this still a neutral"
 *  answered with the generator's own helper would agree with it by
 *  construction. C*ab is the number a person sees, and it is NOT HSL chroma —
 *  the same 3 HSL points read as C*ab 5 on a near-white and C*ab 2 mid-scale. */
const starChromaOf = (hex: string) => {
  const lin = (u: number) => (u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = rgbOf(hex).map((v) => lin(v / 255)) as [number, number, number];
  const X = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const Y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const Z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
  return Math.hypot(500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z)));
};

test('generates the full expected taxonomy size', () => {
  assert.equal(ALL_STYLE_FAMILIES.length, 10);
  assert.equal(ALL_MOOD_TAGS.length, 10);
  assert.equal(THEMES_PER_COMBINATION, 25);
  assert.equal(ALL.length, 10 * 10 * 25);
});

test('every (style, mood) combination produces at least THEMES_PER_COMBINATION rows', () => {
  const counts = new Map<string, number>();
  for (const row of ALL) {
    const key = `${row.style_family}::${row.mood_tag}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const style of ALL_STYLE_FAMILIES) {
    for (const mood of ALL_MOOD_TAGS) {
      const key = `${style}::${mood}`;
      assert.ok(
        (counts.get(key) ?? 0) >= THEMES_PER_COMBINATION,
        `${key} only produced ${counts.get(key) ?? 0} rows`,
      );
    }
  }
});

test('generation is deterministic — same inputs, same output', () => {
  const again = generateAllThemes();
  assert.deepEqual(again, ALL);
});

test('no duplicate names within any single (style, mood) combination', () => {
  const seen = new Map<string, Set<string>>();
  for (const row of ALL) {
    const key = `${row.style_family}::${row.mood_tag}`;
    const set = seen.get(key) ?? new Set<string>();
    assert.ok(!set.has(row.name), `duplicate name "${row.name}" within ${key}`);
    set.add(row.name);
    seen.set(key, set);
  }
});

test('every generated row is valid against the REAL sanitizers (full sweep)', () => {
  for (const row of ALL) {
    const problems = validateGeneratedTemplate(row);
    assert.deepEqual(problems, [], `row "${row.name}" (${row.style_family}/${row.mood_tag}) failed: ${problems.join('; ')}`);
  }
});

test('a representative sample: at least one valid row per style family', () => {
  for (const style of ALL_STYLE_FAMILIES) {
    const row = ALL.find((r) => r.style_family === style);
    assert.ok(row, `no row generated for style ${style}`);
    assert.deepEqual(validateGeneratedTemplate(row!), []);
  }
});

test('a representative sample: at least one valid row per mood', () => {
  for (const mood of ALL_MOOD_TAGS) {
    const row = ALL.find((r) => r.mood_tag === mood);
    assert.ok(row, `no row generated for mood ${mood}`);
    assert.deepEqual(validateGeneratedTemplate(row!), []);
  }
});

test('generateTemplate never returns colors outside the #RRGGBB shape', () => {
  const hexRe = /^#[0-9A-F]{6}$/;
  const row = generateTemplate('moody garden', 'dark_moody', 3, 0, new Set());
  for (const colors of Object.values(row.role_palette)) {
    if (!Array.isArray(colors)) continue;
    for (const c of colors) {
      if (typeof c !== 'string') continue; // skip custom_roles entries (not colors)
      assert.match(c, hexRe);
    }
  }
});

test('dark_moody pulls lightness down relative to the same style’s whimsical_storybook variant', () => {
  // Not a pixel-exact assertion (the HSL transform is intentionally
  // per-style/mood, not a single global formula) — just the documented
  // DIRECTION: dark_moody should read visibly darker than a light/airy mood
  // on the same style family's reception palette.
  const dark = generateTemplate('bridgerton · regal', 'dark_moody', 0, 0, new Set());
  const whimsical = generateTemplate('bridgerton · regal', 'whimsical_storybook', 0, 0, new Set());
  const avgLightness = (hexes: string[]) => {
    const lum = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
    };
    return hexes.reduce((s, h) => s + lum(h), 0) / hexes.length;
  };
  const darkAvg = avgLightness(dark.role_palette.reception ?? []);
  const whimsicalAvg = avgLightness(whimsical.role_palette.reception ?? []);
  assert.ok(darkAvg < whimsicalAvg, `expected dark_moody (${darkAvg}) < whimsical_storybook (${whimsicalAvg})`);
});

// ── the five-color reception contract ───────────────────────────────────
//
// Owner directive 2026-09-03: "themes must be 5 colors". These hold the
// generator to it. The seeded SQL is checked separately, against the files
// that actually ship, by every-theme-carries-five-reception-colors.test.ts —
// a generator that is right and a seed that is stale look identical from here.

test('🚨 EVERY generated theme carries exactly five reception colors', () => {
  assert.equal(RECEPTION_PALETTE_SIZE, 5);
  const wrong = ALL.filter((r) => (r.role_palette.reception?.length ?? 0) !== 5);
  assert.deepEqual(
    wrong.map((r) => `${r.name} (${r.style_family}/${r.mood_tag}): ${r.role_palette.reception?.length}`),
    [],
  );
});

test('🚨 the five survive the REAL sanitizer un-clamped', () => {
  // The failure this catches renders as SUCCESS: with PALETTE_LIMITS.reception
  // .max below 5, sanitizeRolePalette slices every palette back to three on
  // its way into the event, and the board looks exactly like a correct
  // three-color board. Assert against the shipped limit, not a local copy.
  assert.ok(
    PALETTE_LIMITS.reception.max >= RECEPTION_PALETTE_SIZE,
    `PALETTE_LIMITS.reception.max is ${PALETTE_LIMITS.reception.max} — it would CLAMP every five-color theme`,
  );
  for (const row of ALL) {
    const after = sanitizeRolePalette(row.role_palette).reception ?? [];
    assert.deepEqual(after, row.role_palette.reception, `"${row.name}" lost colors through the sanitizer`);
  }
});

test('every reception slot has a label, and no label is orphaned', () => {
  assert.equal(PALETTE_LIMITS.reception.slotLabels?.length, RECEPTION_PALETTE_SIZE);
});

test('no generated reception palette repeats a swatch', () => {
  // Five chips two of which are the same hex renders as a FOUR-color palette,
  // and the gallery's swatch strip dedupes, so it would not even look broken.
  for (const row of ALL) {
    const rec = row.role_palette.reception ?? [];
    assert.equal(new Set(rec).size, rec.length, `"${row.name}" repeats a color: ${rec.join(' ')}`);
  }
});

test('completing a palette never NARROWS the lightness it already had', () => {
  // ⚠ THIS TEST USED TO ASSERT A 30-POINT SPAN ON EVERY ROW, AND THAT
  // ASSERTION WAS THE DEFECT WRITTEN DOWN AS A RULE. "Zero rows span under 30"
  // was true only because every palette that deliberately sat at one end of
  // the lightness range — all-black, all-white, dove-grey on dove-grey — was
  // forced to the opposite pole to satisfy it, which is exactly the mood
  // inversion this module now exists to prevent. A full lightness span is NOT
  // a goal.
  //
  // What is actually required is one-directional: the completion may open a
  // palette up (bold_contrasting deliberately does), and it may leave it as
  // narrow as it was, but it must never SQUEEZE one — that would mean the two
  // additions landed outside the existing range on both sides, i.e. nowhere.
  for (const row of ALL) {
    const rec = row.role_palette.reception ?? [];
    const three = rec.slice(0, 3).map(lightnessOf);
    const five = rec.map(lightnessOf);
    const spanThree = Math.max(...three) - Math.min(...three);
    const spanFive = Math.max(...five) - Math.min(...five);
    assert.ok(
      spanFive >= spanThree,
      `"${row.name}" (${row.style_family}/${row.mood_tag}) narrowed from ${spanThree.toFixed(0)} to ${spanFive.toFixed(0)}: ${rec.join(' ')}`,
    );
  }
});

test('a generated palette never ships more than two competing hues', () => {
  // Real wedding palettes are two hues plus neutrals. The generator controls
  // all five of its own colors, so unlike the hand-authored rows it has no
  // excuse for a third.
  for (const row of ALL) {
    const hues = (row.role_palette.reception ?? []).filter((h) => chromaOf(h) >= 42);
    assert.ok(
      hues.length <= 2,
      `"${row.name}" carries ${hues.length} high-chroma colors: ${row.role_palette.reception?.join(' ')}`,
    );
  }
});

test('minimalist narrows the HUES, not the slot count', () => {
  // This test used to assert `reception.length <= 3` — which the five-color
  // directive makes false. What the mood actually means is preserved and
  // asserted instead: a minimalist theme still fills all five slots, but at
  // most one of them reads as a hue; the rest are its neutrals.
  const row = generateTemplate('modern minimalist', 'minimalist', 0, 0, new Set());
  const rec = row.role_palette.reception ?? [];
  assert.equal(rec.length, RECEPTION_PALETTE_SIZE);
  assert.ok(
    rec.filter((h) => chromaOf(h) >= 42).length <= 1,
    `minimalist should read as neutrals: ${rec.join(' ')}`,
  );
});

// ── completeReceptionFive, the shared slot-3/4 derivation ────────────────

test('completeReceptionFive preserves the input colors, in order', () => {
  const base = ['#FAF7F2', '#C5A059', '#824A2A'];
  const out = completeReceptionFive(base, 'simple_understated');
  assert.equal(out.length, 5);
  assert.deepEqual(out.slice(0, 3), base);
});

test('completeReceptionFive is deterministic and idempotent', () => {
  const base = ['#F4C2C2', '#8A9A6B', '#FAF7F2'];
  const once = completeReceptionFive(base, 'whimsical_storybook');
  assert.deepEqual(completeReceptionFive(base, 'whimsical_storybook'), once);
  // Re-running the lift over already-lifted content must rewrite it to itself,
  // or a second run of the one-off script would drift the shipped seed.
  assert.deepEqual(completeReceptionFive(once, 'whimsical_storybook'), once);
});

test('completeReceptionFive derives from the palette, never a fixed filler pair', () => {
  // Two different themes must not receive the SAME two appended colors —
  // that is precisely the "bulk-append two arbitrary colors" failure.
  const warm = completeReceptionFive(['#C97B4B', '#824A2A', '#D08654'], 'organic_natural').slice(3);
  const cool = completeReceptionFive(['#CFD3D6', '#3A5766', '#FAF7F2'], 'organic_natural').slice(3);
  assert.notDeepEqual(warm, cool);
});

test('🚨 two themes that merely SHARE A GOLD do not receive the same pair', () => {
  // The exact failure measured on the shipped seed: `#F5EFDB + #E7D186` was
  // appended byte-identically to Navy & Gold Ballroom Regal, Midnight Garden
  // Regal, Moonlit Mangrove Heritage AND Full Black Modern Statement, because
  // the derivation read only the hue CARRIER — the gold they have in common —
  // and nothing else about the theme. These four triples share that gold and
  // nothing else; their added pairs must all differ.
  const goldThemes = [
    ['#1E2540', '#D4AF37', '#3A5766'], // navy & gold
    ['#2C3B2E', '#D4AF37', '#1E2229'], // midnight garden
    ['#3A5746', '#1E2229', '#D4AF37'], // moonlit mangrove
    ['#000000', '#1E2229', '#D4AF37'], // full black
  ];
  const pairs = goldThemes.map((t) => completeReceptionFive(t, 'dark_moody').slice(3).join(' '));
  assert.equal(new Set(pairs).size, pairs.length, `identical pairs across themes: ${pairs.join(' | ')}`);
});

test('🚨 an all-light palette stays light — the mood decides, not the missing pole', () => {
  // ⚠ THIS TEST ASSERTED THE OPPOSITE. It used to require a swatch under L 32
  // for an all-light input ("something to stand on"), which is the inversion
  // itself: a light palette ALWAYS lacks deep, so it always got deep. A
  // romantic_ethereal theme completes light.
  const out = completeReceptionFive(['#FAF7F2', '#F0EBE6', '#E8DCC8'], 'romantic_ethereal');
  assert.ok(
    out.every((h) => lightnessOf(h) >= 60),
    `romantic_ethereal must not be handed a dark: ${out.join(' ')}`,
  );
  // ...and the one mood for which opening the range IS the point still does.
  const bold = completeReceptionFive(['#FAF7F2', '#F0EBE6', '#E8DCC8'], 'bold_contrasting');
  const boldSpan = Math.max(...bold.map(lightnessOf)) - Math.min(...bold.map(lightnessOf));
  const softSpan = Math.max(...out.map(lightnessOf)) - Math.min(...out.map(lightnessOf));
  assert.ok(boldSpan > softSpan, `bold_contrasting should widen further than romantic_ethereal`);
});

test('🚨 an all-dark palette stays dark', () => {
  // Same inversion, mirrored: this used to demand a swatch at L>=78 for an
  // all-dark input. "All black — walls, linens, chairs" received two
  // near-whites in production because of exactly that rule.
  const out = completeReceptionFive(['#1B1F1C', '#23060B', '#2C3B2E'], 'dark_moody');
  assert.ok(
    out.every((h) => lightnessOf(h) <= 45),
    `dark_moody must not be handed a near-white: ${out.join(' ')}`,
  );
});

test('🚨 a deliberately NARROW palette completes inside its own band', () => {
  // Detected from the colors' spread, never from the name. Dove grey on dove
  // grey gets more dove grey — not a charcoal and not a black.
  const dove = completeReceptionFive(['#CFD3D6', '#D8DBDD', '#C4C9CC'], 'minimalist');
  const ls = dove.map(lightnessOf);
  assert.ok(
    Math.max(...ls) - Math.min(...ls) < 30,
    `a one-band palette must not be stretched to both poles: ${dove.join(' ')}`,
  );
});

test('🚨 an added color is never more colorful than the palette already is', () => {
  // "All white, no accent color at all" must not receive an accent. Measured
  // in C*ab, because 3 points of HSL chroma render at C*ab 5 on a near-white
  // and at C*ab 2 in the midtones — judging this in HSL is how that row
  // received a sage.
  const white = completeReceptionFive(['#FFFFFF', '#CFD3D6', '#FAF7F2'], 'minimalist');
  const ceiling = Math.max(...white.slice(0, 3).map(starChromaOf));
  for (const hex of white.slice(3)) {
    assert.ok(
      starChromaOf(hex) <= ceiling + 0.001,
      `${hex} (C*ab ${starChromaOf(hex).toFixed(1)}) out-colors the whole palette (C*ab ${ceiling.toFixed(1)}): ${white.join(' ')}`,
    );
  }
});

test('completeReceptionFive returns the first five of an already-complete set', () => {
  const five = ['#111111', '#222222', '#333333', '#444444', '#555555'];
  assert.deepEqual(completeReceptionFive([...five, '#666666'], 'dark_moody'), five);
});

test('generateAllThemes offsets sort_order when a startSortOrder is given', () => {
  const offset = generateAllThemes(100);
  assert.equal(offset[0]!.sort_order, 100);
  assert.equal(offset[offset.length - 1]!.sort_order, 100 + ALL.length - 1);
});

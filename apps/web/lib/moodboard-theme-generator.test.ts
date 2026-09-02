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
  ALL_STYLE_FAMILIES,
  ALL_MOOD_TAGS,
  THEMES_PER_COMBINATION,
} from './moodboard-theme-generator';

// Full generation is done once and shared across tests — it's pure and
// deterministic, and re-running it per test would be wasteful (2,500 rows).
const ALL = generateAllThemes();

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

test('minimalist trims the palette to at most 3 colors', () => {
  const row = generateTemplate('modern minimalist', 'minimalist', 0, 0, new Set());
  assert.ok((row.role_palette.reception?.length ?? 0) <= 3);
});

test('generateAllThemes offsets sort_order when a startSortOrder is given', () => {
  const offset = generateAllThemes(100);
  assert.equal(offset[0]!.sort_order, 100);
  assert.equal(offset[offset.length - 1]!.sort_order, 100 + ALL.length - 1);
});

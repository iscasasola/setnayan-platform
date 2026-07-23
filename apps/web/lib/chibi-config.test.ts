/**
 * Unit suite for the chibi avatar config whitelist + sanitizer
 * (`lib/chibi-config.ts`). Load-bearing invariants:
 *   • defaultChibiConfig is DETERMINISTIC — same id → same chibi, forever
 *     (a guest must never re-roll their look between visits), and defaults
 *     always pass strict validation.
 *   • resolveChibiConfig NEVER throws and always emits a valid config — a
 *     stale/junk stored value can never crash a render; valid stored fields
 *     win over hash defaults; junk fields fall back per-field.
 *   • validateChibiConfig is the fail-closed server gate: unknown keys,
 *     off-palette colours, out-of-catalog ids, wrong version → rejected.
 *   • Serialized configs stay far inside the DB's 2048-byte CHECK.
 *   • The privacy posture: bodyType derives only from the opaque id hash
 *     (cosmetic), and defaults never roll 'none' faces or accessories.
 *
 * Run via the repo's `test:unit` script (tsx --test "lib/**\/*.test.ts").
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CHIBI_CONFIG_VERSION,
  CHIBI_CONFIG_MAX_BYTES,
  CHIBI_BODY_TYPES,
  CHIBI_SKIN_TONES,
  CHIBI_HAIR_COLORS,
  CHIBI_HAIR_STYLES,
  CHIBI_EYES,
  CHIBI_MOUTHS,
  CHIBI_MARKS,
  CHIBI_OUTFITS,
  CHIBI_OUTFIT_COLORS,
  CHIBI_ACCESSORIES,
  CHIBI_COLOR_MODES,
  CHIBI_DEFAULT_OUTFITS,
  FIGURE_CHIBI_ENABLED,
  defaultChibiConfig,
  resolveChibiConfig,
  validateChibiConfig,
  darkenHex,
  effectiveChibiColors,
  CHIBI_AUTO_COLORS,
  CHIBI_SHOE_COLOR,
  type ChibiAvatarConfig,
} from './chibi-config';

// ── flag ─────────────────────────────────────────────────────────────────────

test('NEXT_PUBLIC_FIGURE_CHIBI defaults OFF', () => {
  // The env var is unset in the test environment — the gate must read false
  // (an unset flag is a byte-identical off path).
  assert.equal(FIGURE_CHIBI_ENABLED, false);
});

// ── defaults ─────────────────────────────────────────────────────────────────

test('same id resolves the same default config every call (determinism)', () => {
  const a = defaultChibiConfig('S89G-ABC123DEF0');
  const b = defaultChibiConfig('S89G-ABC123DEF0');
  assert.deepEqual(a, b);
});

test('defaults draw from the catalogs, are friendly, and validate clean', () => {
  const seenBodies = new Set<string>();
  for (let i = 0; i < 80; i++) {
    const d = defaultChibiConfig(`guest-${i}`);
    assert.equal(d.v, CHIBI_CONFIG_VERSION);
    assert.ok((CHIBI_BODY_TYPES as readonly string[]).includes(d.bodyType));
    assert.ok(CHIBI_SKIN_TONES.includes(d.skinTone));
    assert.ok((CHIBI_HAIR_STYLES as readonly string[]).includes(d.hairStyle));
    assert.ok(CHIBI_HAIR_COLORS.includes(d.hairColor));
    // Friendly defaults: never a rolled 'none' face, never bald, never a
    // rolled accessory; silver/gold hair stays an explicit pick (§ 9.4).
    assert.notEqual(d.eyes, 'none');
    assert.notEqual(d.mouth, 'none');
    assert.notEqual(d.hairStyle, 'bald');
    assert.equal(d.accessory, 'none');
    assert.notEqual(d.hairColor, '#8a8a92');
    assert.notEqual(d.hairColor, '#b98a2f');
    // Outfit comes from the body's default pool.
    assert.ok(CHIBI_DEFAULT_OUTFITS[d.bodyType].includes(d.outfit));
    assert.ok(CHIBI_OUTFIT_COLORS.some((c) => c.hex === d.outfitColor));
    assert.deepEqual(validateChibiConfig(d), []);
    seenBodies.add(d.bodyType);
  }
  // The hash actually varies bodyType across a crowd (cosmetic variety).
  assert.equal(seenBodies.size, 2);
});

// ── resolveChibiConfig (read-path repair) ────────────────────────────────────

test('null / junk / non-object stored values resolve to the hash default', () => {
  const d = defaultChibiConfig('g1');
  assert.deepEqual(resolveChibiConfig('g1', null), d);
  assert.deepEqual(resolveChibiConfig('g1', undefined), d);
  assert.deepEqual(resolveChibiConfig('g1', 'not-an-object'), d);
  assert.deepEqual(resolveChibiConfig('g1', 42), d);
  assert.deepEqual(resolveChibiConfig('g1', ['array']), d);
});

test('valid stored fields win; invalid fields fall back per-field', () => {
  const r = resolveChibiConfig('g2', {
    v: 1,
    bodyType: 'male',
    outfit: 'barong',
    hairStyle: 'mohawk', // not in catalog → default
    skinTone: '#ff0000', // off-palette → default
    outfitColor: CHIBI_OUTFIT_COLORS[4]!.hex,
    eyes: 'happy',
  });
  const d = defaultChibiConfig('g2');
  assert.equal(r.bodyType, 'male');
  assert.equal(r.outfit, 'barong');
  assert.equal(r.eyes, 'happy');
  assert.equal(r.outfitColor, CHIBI_OUTFIT_COLORS[4]!.hex);
  assert.equal(r.hairStyle, d.hairStyle);
  assert.equal(r.skinTone, d.skinTone);
  assert.deepEqual(validateChibiConfig(r), []);
});

test('resolve is idempotent and drops unknown keys', () => {
  const once = resolveChibiConfig('g3', {
    outfit: 'tux',
    __proto__evil: 'x',
    hacker: { nested: true },
  });
  assert.ok(!('hacker' in once));
  const twice = resolveChibiConfig('g3', once);
  assert.deepEqual(twice, once);
  assert.deepEqual(validateChibiConfig(once), []);
});

test('every catalog value round-trips through resolve unchanged', () => {
  // Exhaustive per-field: a config built from ANY combination of catalog
  // values must survive resolve verbatim (stored picks never dangle).
  for (const outfit of CHIBI_OUTFITS) {
    for (const bodyType of CHIBI_BODY_TYPES) {
      const cfg: ChibiAvatarConfig = {
        v: CHIBI_CONFIG_VERSION,
        bodyType,
        skinTone: CHIBI_SKIN_TONES[3]!,
        hairStyle: CHIBI_HAIR_STYLES[2]!,
        hairColor: CHIBI_HAIR_COLORS[5]!, // gold — catalog-valid explicit pick
        eyes: CHIBI_EYES[1]!,
        mouth: CHIBI_MOUTHS[2]!,
        mark: CHIBI_MARKS[3]!,
        outfit,
        outfitColor: CHIBI_OUTFIT_COLORS[0]!.hex,
        accessory: CHIBI_ACCESSORIES[1]!,
        colorMode: CHIBI_COLOR_MODES[1]!,
      };
      assert.deepEqual(resolveChibiConfig('any-id', cfg), cfg);
      assert.deepEqual(validateChibiConfig(cfg), []);
    }
  }
});

// ── validateChibiConfig (write-path gate) ────────────────────────────────────

test('strict validation rejects non-objects and wrong versions', () => {
  assert.ok(validateChibiConfig(null).length > 0);
  assert.ok(validateChibiConfig([]).length > 0);
  assert.ok(validateChibiConfig('x').length > 0);
  const bad = { ...defaultChibiConfig('g4'), v: 2 };
  assert.ok(validateChibiConfig(bad).some((e) => e.includes('v must be')));
});

test('strict validation rejects unknown keys (payload smuggling)', () => {
  const cfg = { ...defaultChibiConfig('g5'), smuggled: 'data' };
  assert.ok(validateChibiConfig(cfg).some((e) => e.includes('unknown key: smuggled')));
});

test('strict validation rejects off-palette colours (the clamp rule)', () => {
  const cfg = { ...defaultChibiConfig('g6'), outfitColor: '#123456' };
  assert.ok(validateChibiConfig(cfg).some((e) => e.includes('outfitColor')));
  const cfg2 = { ...defaultChibiConfig('g6'), hairColor: 'red' };
  assert.ok(validateChibiConfig(cfg2).some((e) => e.includes('hairColor')));
});

test('serialized configs stay far inside the 2048-byte DB CHECK', () => {
  // Worst case: the longest value in every catalog slot.
  const longest = <T extends string>(pool: readonly T[]): T =>
    pool.reduce((a, b) => (b.length > a.length ? b : a));
  const cfg: ChibiAvatarConfig = {
    v: CHIBI_CONFIG_VERSION,
    bodyType: longest(CHIBI_BODY_TYPES),
    skinTone: longest(CHIBI_SKIN_TONES),
    hairStyle: longest(CHIBI_HAIR_STYLES),
    hairColor: longest(CHIBI_HAIR_COLORS),
    eyes: longest(CHIBI_EYES),
    mouth: longest(CHIBI_MOUTHS),
    mark: longest(CHIBI_MARKS),
    outfit: longest(CHIBI_OUTFITS),
    outfitColor: longest(CHIBI_OUTFIT_COLORS.map((c) => c.hex)),
    accessory: longest(CHIBI_ACCESSORIES),
    colorMode: longest(CHIBI_COLOR_MODES),
  };
  const bytes = JSON.stringify(cfg).length;
  assert.ok(bytes < CHIBI_CONFIG_MAX_BYTES / 4, `worst-case config is ${bytes} bytes`);
  assert.deepEqual(validateChibiConfig(cfg), []);
});

// ── colours ──────────────────────────────────────────────────────────────────

test('darkenHex darkens channel-wise and stays a valid hex', () => {
  assert.equal(darkenHex('#ffffff', 0.5), '#808080');
  assert.equal(darkenHex('#000000', 0.5), '#000000');
  assert.equal(darkenHex('#c3cdb9', 1), '#c3cdb9');
  // Two-tone derivations used by the outfit recipes.
  for (const c of CHIBI_OUTFIT_COLORS) {
    for (const k of [0.6, 0.72, 0.88]) {
      assert.match(darkenHex(c.hex, k), /^#[0-9a-f]{6}$/);
    }
  }
});

test('effectiveChibiColors: custom passes through, auto substitutes outfit+hair but NEVER skin', () => {
  const base = defaultChibiConfig('g7');
  const custom = effectiveChibiColors({ ...base, colorMode: 'custom' });
  assert.equal(custom.skin, base.skinTone);
  assert.equal(custom.hair, base.hairColor);
  assert.equal(custom.outfit, base.outfitColor);
  assert.equal(custom.shoes, CHIBI_SHOE_COLOR);
  const auto = effectiveChibiColors({ ...base, colorMode: 'auto' });
  assert.equal(auto.skin, base.skinTone); // identity choice — never themed
  assert.equal(auto.hair, CHIBI_AUTO_COLORS.hairColor);
  assert.equal(auto.outfit, CHIBI_AUTO_COLORS.outfitColor);
});

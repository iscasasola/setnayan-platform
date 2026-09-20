import { test } from 'node:test';
import assert from 'node:assert/strict';

import { roleChipStyle } from './role-chip-style';
import { ROLE_GROUP_CHIP } from './role-groups';
import type { RolePalette } from './mood-board';

/**
 * These tests exist because of one screen: the couple and their parents both
 * wore `bg-danger-*` red, on an event whose mood board had already named a
 * colour for each of them. The property that matters is not "a style object is
 * returned" — it is that two roles the couple coloured DIFFERENTLY now look
 * different, and that a couple who coloured nothing sees no change at all.
 *
 * 🔑 THE CONTRAST MATH IS RE-IMPLEMENTED BELOW ON PURPOSE. Asserting AA with
 * the same `ensureContrast` the code calls would pass on any bug inside it —
 * the test and the defect would share a blind spot. This is the WCAG formula
 * written independently from the spec, so it can disagree with ours.
 */
function srgbToLinear(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminanceOf(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrastRatio(a: string, b: string): number {
  const la = luminanceOf(a);
  const lb = luminanceOf(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** A mood board where the couple and their parents are deliberately unlike. */
const PALETTE: RolePalette = {
  bride: ['#8E5B9F'], // amethyst
  groom: ['#2F4858'], // slate
  parents_immediate_family: ['#B08D57'], // champagne — pale, the AA hard case
  wedding_party: ['#C24E25'], // terracotta
  bridesmaids: ['#E8B4BC'], // blush — a filled SPLIT key
};

// --- the defect this shipped for ------------------------------------------
test('the couple and their parents no longer wear the same chip', () => {
  const bride = roleChipStyle('bride', PALETTE);
  const parents = roleChipStyle('bride_parents', PALETTE);

  assert.ok(bride.style, 'bride resolved no palette colour');
  assert.ok(parents.style, 'bride_parents resolved no palette colour');
  assert.notEqual(
    bride.style.backgroundColor,
    parents.style.backgroundColor,
    'the couple and their parents are still the same colour',
  );
});

test("both roles the owner reported land on the couple's parents colour, not red", () => {
  // bride_parents and groom_immediate_family share ONE palette key by design
  // (parents_immediate_family) — so they SHOULD match each other, and must not
  // match the fixed vip_family red they used to wear.
  const parents = roleChipStyle('bride_parents', PALETTE);
  const inLaws = roleChipStyle('groom_immediate_family', PALETTE);

  assert.deepEqual(parents.style, inLaws.style);
  assert.equal(parents.tintClass, null);
  assert.notEqual(parents.style?.backgroundColor, undefined);
});

// --- nothing changes for a couple who coloured nothing ---------------------
test('an empty palette keeps the EXACT class every chip renders today', () => {
  for (const role of ['bride', 'bride_parents', 'groomsman', 'guest'] as const) {
    const { tintClass, style } = roleChipStyle(role, {});
    assert.equal(style, null, `${role} invented a tint from an empty palette`);
    assert.ok(tintClass, `${role} lost its fallback class`);
    assert.ok(
      Object.values(ROLE_GROUP_CHIP).includes(tintClass),
      `${role} fell back to a class that is not in ROLE_GROUP_CHIP`,
    );
  }
});

test('a malformed hex falls back rather than painting a chip with no tint', () => {
  const { tintClass, style } = roleChipStyle('bride', { bride: ['not-a-colour'] });
  assert.equal(style, null);
  assert.ok(tintClass);
});

// --- the invariant the callers rely on ------------------------------------
test('exactly one of tintClass / style is ever set', () => {
  const cases = [
    roleChipStyle('bride', PALETTE),
    roleChipStyle('bride', {}),
    roleChipStyle('officiant', PALETTE), // a key the fixture leaves empty
    roleChipStyle('flower_girl', {}),
  ];
  for (const c of cases) {
    assert.equal(
      (c.tintClass === null) !== (c.style === null),
      true,
      'a chip would paint a Tailwind tint and an inline tint at once',
    );
  }
});

// --- legibility, measured independently ------------------------------------
test('every label clears WCAG AA on the wash it actually sits on', () => {
  const roles = ['bride', 'groom', 'bride_parents', 'bridesmaid', 'groomsman'] as const;
  for (const role of roles) {
    const { style } = roleChipStyle(role, PALETTE);
    assert.ok(style, `${role} resolved no palette colour`);
    const ratio = contrastRatio(style.color, style.backgroundColor);
    assert.ok(
      ratio >= 4.5,
      `${role}: label ${style.color} on ${style.backgroundColor} is ${ratio.toFixed(2)}:1`,
    );
  }
});

test('champagne — the pale case that breaks naive contrast — still clears AA', () => {
  // A pale accent used as its own label fails badly (#B08D57 on its own 16%
  // wash is about 1.3:1). This is the case ensureContrast exists for.
  const { style } = roleChipStyle('bride_parents', PALETTE);
  assert.ok(style);
  assert.ok(contrastRatio(style.color, style.backgroundColor) >= 4.5);
  assert.notEqual(
    style.color.toLowerCase(),
    '#b08d57',
    'the pale accent was used raw as the label',
  );
});

test('darkening for AA does not collapse different colours into the same near-black', () => {
  // 🔑 The failure mode of a contrast fix is uniformity: solve every hue to the
  // same bar and everything ends up equally loud and equally alike. Two pale
  // accents from different families must still read as different chips.
  const pale: RolePalette = {
    bride: ['#B08D57'], // pale gold
    groom: ['#A8C0B0'], // pale sage
  };
  const a = roleChipStyle('bride', pale).style;
  const b = roleChipStyle('groom', pale).style;
  assert.ok(a && b);
  assert.notEqual(a.color, b.color);
  assert.notEqual(a.backgroundColor, b.backgroundColor);
});

// --- the split key both call sites disagreed about -------------------------
test('a filled SPLIT key beats the shared wedding_party fallback', () => {
  // bridesmaids is filled (#E8B4BC) and wedding_party is filled (#C24E25);
  // a bridesmaid must get the blush she chose, not the party terracotta.
  const bridesmaid = roleChipStyle('bridesmaid', PALETTE).style;
  const groomsman = roleChipStyle('groomsman', PALETTE).style;
  assert.ok(bridesmaid && groomsman);
  assert.notEqual(
    bridesmaid.backgroundColor,
    groomsman.backgroundColor,
    'bridesmaid fell through to the wedding_party colour',
  );
});

test('an UNFILLED split key reaches wedding_party — the case the old chip lost', () => {
  // `roleGroupOf('groomsman')` is `groomsmen`, its own group since the
  // wedding-party split. The old chip asked for the group and therefore never
  // reached `wedding_party`, so a couple who filled ONLY the shared key saw a
  // plain terracotta class while the seating lab dressed the man in their
  // colour. Resolving through resolveAttirePaletteColor is what closes that.
  const onlyShared: RolePalette = { wedding_party: ['#C24E25'] };
  const groomsman = roleChipStyle('groomsman', onlyShared);
  assert.ok(groomsman.style, 'groomsman still cannot reach wedding_party');
  assert.equal(groomsman.tintClass, null);

  // And it agrees with what that man is dressed in.
  assert.deepEqual(
    roleChipStyle('bridesmaid', onlyShared).style,
    groomsman.style,
    'two entourage roles sharing one fallback colour rendered differently',
  );
});

test('a ring is always an inset shadow, never a Tailwind ring class', () => {
  const { style } = roleChipStyle('bride', PALETTE);
  assert.ok(style);
  assert.match(style.boxShadow, /^inset 0 0 0 1px #[0-9a-f]{6}$/i);
});

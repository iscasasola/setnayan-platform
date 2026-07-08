/**
 * Palette taxonomy v2 (owner-locked 2026-07-08). Guards the pure palette logic:
 * the split wedding-party keys + parents/immediate-family + Nikah-cast keys, the
 * role→key resolver, the STRICT attire fallback chain, the room-dressing
 * resolver, and — the NON-NEGOTIABLE part — that legacy `wedding_party`-only
 * payloads round-trip and resolve exactly as before.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeRolePalette,
  getPrimaryColor,
  paletteKeyForRole,
  resolveAttirePaletteColor,
  resolveRoomDressing,
  sideAttireColor,
  PALETTE_ORDER,
  PALETTE_LIMITS,
  type RolePalette,
} from './mood-board';

// ── sanitize: backward compat + new keys ────────────────────────────────────

test('sanitize preserves a legacy wedding_party-only payload byte-for-byte', () => {
  const legacy = { wedding_party: ['#C97B4B', '#824A2A', '#D08654'] };
  const out = sanitizeRolePalette(legacy);
  // Nothing added, nothing dropped, nothing recased.
  assert.deepEqual(out, { wedding_party: ['#C97B4B', '#824A2A', '#D08654'] });
});

test('sanitize accepts the new split + parents + Nikah keys, upper-casing them', () => {
  const out = sanitizeRolePalette({
    maid_of_honor: ['#aaaaaa'],
    best_man: ['#bbbbbb'],
    bridesmaids: ['#c1c1c1', '#c2c2c2', '#c3c3c3'],
    groomsmen: ['#d1d1d1', '#d2d2d2', '#d3d3d3'],
    parents_immediate_family: ['#be185d'],
    muslim_principals: ['#059669'],
  });
  assert.equal(out.maid_of_honor?.[0], '#AAAAAA');
  assert.equal(out.best_man?.[0], '#BBBBBB');
  assert.deepEqual(out.bridesmaids, ['#C1C1C1', '#C2C2C2', '#C3C3C3']);
  assert.deepEqual(out.groomsmen, ['#D1D1D1', '#D2D2D2', '#D3D3D3']);
  assert.equal(out.parents_immediate_family?.[0], '#BE185D');
  assert.equal(out.muslim_principals?.[0], '#059669');
});

test('sanitize clamps a new key to its per-key max', () => {
  const eight = Array.from({ length: 8 }, (_, i) => `#00000${i}`.slice(0, 7));
  const out = sanitizeRolePalette({ bridesmaids: eight });
  assert.equal(out.bridesmaids?.length, PALETTE_LIMITS.bridesmaids.max);
});

test('sanitize drops unknown/invalid keys but keeps every real color key', () => {
  const out = sanitizeRolePalette({
    wedding_party: ['#111111'],
    not_a_key: ['#222222'],
    bride: ['zzz', '#333333'],
  });
  assert.deepEqual(out, { bride: ['#333333'], wedding_party: ['#111111'] });
});

test('sanitize preserves + validates room_dressing overrides', () => {
  const out = sanitizeRolePalette({
    room_dressing: { linens: '#abcdef', chairs: 'not-a-hex', florals: '#123456' },
  });
  assert.deepEqual(out.room_dressing, { linens: '#ABCDEF', florals: '#123456' });
});

test('sanitize omits room_dressing when no field is valid', () => {
  const out = sanitizeRolePalette({ room_dressing: { linens: 'nope' } });
  assert.equal(out.room_dressing, undefined);
});

// ── getPrimaryColor: real keys + group normalization ────────────────────────

test('getPrimaryColor returns the muslim_principals color (no longer excluded)', () => {
  const p: RolePalette = { muslim_principals: ['#059669'] };
  assert.equal(getPrimaryColor(p, 'muslim_principals'), '#059669');
});

test('getPrimaryColor maps the vip_family GROUP to the parents palette key', () => {
  const p: RolePalette = { parents_immediate_family: ['#BE185D'] };
  assert.equal(getPrimaryColor(p, 'vip_family'), '#BE185D');
});

test('getPrimaryColor still returns undefined for couple / other_roles', () => {
  const p: RolePalette = { bride: ['#FAF7F2'] };
  assert.equal(getPrimaryColor(p, 'couple'), undefined);
  assert.equal(getPrimaryColor(p, 'other_roles'), undefined);
});

// ── paletteKeyForRole mapping table ─────────────────────────────────────────

test('paletteKeyForRole maps roles to their taxonomy-v2 keys', () => {
  const cases: Array<[Parameters<typeof paletteKeyForRole>[0], string]> = [
    ['bride', 'bride'],
    ['groom', 'groom'],
    ['maid_of_honor', 'maid_of_honor'],
    ['matron_of_honor', 'maid_of_honor'], // MoH covers maid + matron
    ['best_man', 'best_man'],
    ['bridesmaid', 'bridesmaids'],
    ['groomsman', 'groomsmen'],
    ['bride_parents', 'parents_immediate_family'],
    ['groom_immediate_family', 'parents_immediate_family'],
    ['wali', 'muslim_principals'],
    ['imam', 'muslim_principals'],
    ['witness', 'muslim_principals'],
    ['wakil', 'muslim_principals'],
    ['principal_sponsor', 'principal_sponsors'],
    ['candle_sponsor', 'secondary_sponsors'],
    ['ring_bearer', 'bearers_flower_girl'],
    ['flower_girl', 'bearers_flower_girl'],
    ['officiant', 'officiants'],
    ['soloist_musician', 'officiants'],
    ['host', 'guest'], // generic roles collapse to the guest palette
    ['guest', 'guest'],
  ];
  for (const [role, key] of cases) {
    assert.equal(paletteKeyForRole(role), key, `${role} → ${key}`);
  }
});

// ── resolveAttirePaletteColor: the STRICT chain ─────────────────────────────

test('attire chain: a specific role key wins over everything', () => {
  const p: RolePalette = { bridesmaids: ['#111111'], wedding_party: ['#222222'] };
  assert.equal(resolveAttirePaletteColor('bridesmaid', p, '#333333'), '#111111');
});

test('attire chain: falls back to wedding_party when the specific key is unset', () => {
  const p: RolePalette = { wedding_party: ['#222222'] };
  assert.equal(resolveAttirePaletteColor('bridesmaid', p, '#333333'), '#222222');
});

test('attire chain: falls back to the side color when no party palette', () => {
  assert.equal(resolveAttirePaletteColor('bridesmaid', {}, '#333333'), '#333333');
});

test('attire chain: terminal is null (kit default) when nothing resolves', () => {
  assert.equal(resolveAttirePaletteColor('bridesmaid', {}, null), null);
});

test('attire chain: wedding_party-only dresses gowns AND suits identically (v2 intent)', () => {
  const p: RolePalette = { wedding_party: ['#C97B4B'] };
  // Gown-class + suit-class both degrade to the shared fallback.
  assert.equal(resolveAttirePaletteColor('bridesmaid', p, null), '#C97B4B');
  assert.equal(resolveAttirePaletteColor('groomsman', p, null), '#C97B4B');
});

test('sideAttireColor picks bride/groom by side, preferring bride for both', () => {
  const p: RolePalette = { bride: ['#B1B1B1'], groom: ['#212121'] };
  assert.equal(sideAttireColor(p, 'bride'), '#B1B1B1');
  assert.equal(sideAttireColor(p, 'groom'), '#212121');
  assert.equal(sideAttireColor(p, 'both'), '#B1B1B1');
  assert.equal(sideAttireColor({}, 'bride'), null);
});

// ── resolveRoomDressing: derived vs override ────────────────────────────────

test('room dressing derives every surface from the reception palette', () => {
  const p: RolePalette = { reception: ['#D0D0D0', '#E1E1E1', '#F2F2F2'] };
  const rd = resolveRoomDressing(p);
  assert.equal(rd.linens, '#E1E1E1'); // Supporting
  assert.equal(rd.chairs, '#F2F2F2'); // Accent
  assert.equal(rd.florals, '#D0D0D0'); // Dominant
  assert.equal(rd.lighting_warmth, '#D0D0D0'); // Dominant (warm wash)
});

test('room dressing honors a per-field override, deriving the rest', () => {
  const p: RolePalette = {
    reception: ['#D0D0D0', '#E1E1E1', '#F2F2F2'],
    room_dressing: { linens: '#AAAAAA' },
  };
  const rd = resolveRoomDressing(p);
  assert.equal(rd.linens, '#AAAAAA'); // override
  assert.equal(rd.chairs, '#F2F2F2'); // still derived
});

test('room dressing falls back to warm-neutral defaults with no reception palette', () => {
  const rd = resolveRoomDressing({});
  assert.equal(rd.linens, '#F3EFE9');
  assert.equal(rd.chairs, '#E7E1D8');
  assert.equal(rd.florals, '#C89B6C');
  assert.equal(rd.lighting_warmth, '#FBE9D8');
});

// ── ordering ────────────────────────────────────────────────────────────────

test('PALETTE_ORDER carries the new keys (so sanitize round-trips them)', () => {
  for (const k of [
    'parents_immediate_family',
    'muslim_principals',
    'maid_of_honor',
    'best_man',
    'bridesmaids',
    'groomsmen',
    'wedding_party',
  ] as const) {
    assert.ok(PALETTE_ORDER.includes(k), `PALETTE_ORDER includes ${k}`);
  }
  // Specific wedding-party sub-keys sort BEFORE the shared fallback.
  assert.ok(
    PALETTE_ORDER.indexOf('bridesmaids') < PALETTE_ORDER.indexOf('wedding_party'),
    'bridesmaids before wedding_party',
  );
});

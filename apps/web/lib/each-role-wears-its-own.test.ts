/**
 * EACH ROLE WEARS ITS OWN — owner, 2026-09-20: "each role has their specific
 * color code, and outfit style to wear … if they have a role, only show their
 * specific role and what their role is."
 *
 * The rule is executed here. The source checks exist because the two ways this
 * goes wrong are not in the rule: a widget that shows the whole palette to
 * somebody who already has their own line, and a style this product guessed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ATTIRE_STYLES,
  ATTIRE_STYLE_LABEL,
  STYLE_UNSET_LINE,
  isAttireStyle,
  resolveGuestDressCode,
  sanitizeRoleAttire,
} from './role-dress-code';
import { roleLabel } from './entourage';
import type { GuestRole } from './guests';
import type { RolePalette } from './mood-board';

const known = (v: string) => roleLabel(v as GuestRole) !== null;
const PALETTE: RolePalette = {
  principal_sponsors: ['#842334'],
  wedding_party: ['#3A5746'],
  room_dressing: {},
  touched_roles: [],
} as unknown as RolePalette;

test('the owner’s three words are in the vocabulary, and each has a label', () => {
  for (const style of ['long_gown', 'suit', 'filipiniana'] as const) {
    assert.ok((ATTIRE_STYLES as readonly string[]).includes(style), style);
    assert.ok(ATTIRE_STYLE_LABEL[style].length > 0);
  }
  assert.equal(ATTIRE_STYLE_LABEL.filipiniana, 'Filipiniana');
  assert.equal(ATTIRE_STYLE_LABEL.long_gown, 'Long gown');
  assert.equal(isAttireStyle('ballgown'), false, 'not free text');
});

test('a ninang is told her role, her outfit and her colour', () => {
  const mine = resolveGuestDressCode({
    role: 'principal_sponsor_ninang',
    roles: { principal_sponsor_ninang: { style: 'filipiniana', note: 'ivory, not white' } },
    palette: PALETTE,
  });
  assert.ok(mine);
  assert.equal(mine.roleLabel, 'Ninang');
  assert.equal(mine.styleLabel, 'Filipiniana');
  assert.equal(mine.note, 'ivory, not white');
  assert.equal(mine.hex, '#842334', 'the colour comes from their own mood board');
});

test('two roles that share a palette key can still wear different things', () => {
  const roles = {
    principal_sponsor_ninong: { style: 'barong_tagalog' },
    principal_sponsor_ninang: { style: 'filipiniana' },
  } as const;
  const ninong = resolveGuestDressCode({ role: 'principal_sponsor_ninong', roles, palette: PALETTE });
  const ninang = resolveGuestDressCode({ role: 'principal_sponsor_ninang', roles, palette: PALETTE });
  assert.equal(ninong?.styleLabel, 'Barong Tagalog');
  assert.equal(ninang?.styleLabel, 'Filipiniana');
  assert.equal(ninong?.hex, ninang?.hex, 'same palette key, same colour — that part is shared');
});

test('NOTHING IS GUESSED: an unset role gets a state, not an assumption', () => {
  const mine = resolveGuestDressCode({ role: 'principal_sponsor_ninong', roles: {}, palette: PALETTE });
  assert.ok(mine, 'the role and colour are still worth showing');
  assert.equal(mine.style, null);
  assert.equal(mine.styleLabel, null);
  assert.match(STYLE_UNSET_LINE, /has(n’t| not) said/i);
});

test('a plain guest gets no personal panel at all', () => {
  assert.equal(resolveGuestDressCode({ role: 'guest', roles: {}, palette: PALETTE }), null);
  assert.equal(resolveGuestDressCode({ role: null, roles: {}, palette: PALETTE }), null);
});

test('stored config is data, not a promise about shape', () => {
  assert.deepEqual(sanitizeRoleAttire(null, known), {});
  assert.deepEqual(sanitizeRoleAttire('nope', known), {});
  assert.deepEqual(sanitizeRoleAttire({ bridesmaid: { style: 'space_suit' } }, known), {});
  assert.deepEqual(sanitizeRoleAttire({ not_a_role: { style: 'suit' } }, known), {});
  assert.deepEqual(sanitizeRoleAttire({ bridesmaid: { style: 'long_gown' } }, known), {
    bridesmaid: { style: 'long_gown' },
  });
  const long = sanitizeRoleAttire({ bridesmaid: { style: 'long_gown', note: 'x'.repeat(400) } }, known);
  assert.equal(long.bridesmaid?.note?.length, 120, 'a note is bounded');
});

test('the invitation shows a role-holder THEIR line instead of the whole palette', () => {
  const src = readFileSync(join(__dirname, '..', 'app', '[slug]', '_components', 'dress-code-widget.tsx'), 'utf8');
  assert.match(src, /\{!mine && palette\.length > 0 \?/, 'the general palette stands down for a role-holder');
  assert.match(src, /You are \{mine\.roleLabel/, 'and their role is named');
  assert.match(src, /STYLE_UNSET_LINE/, 'an unset style says so rather than showing nothing');
});

test('the editor offers only the roles this wedding actually has', () => {
  const page = readFileSync(
    join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'website', 'dress-code', 'page.tsx'),
    'utf8',
  );
  assert.match(page, /from\('guests'\)/, 'it reads the real guest list');
  assert.match(page, /roleLabel\(role\) === null/, 'unpublished roles are not offered');
  const field = readFileSync(
    join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'website', 'dress-code', '_components', 'role-attire-field.tsx'),
    'utf8',
  );
  assert.match(field, /value=""[\s\S]{0,40}Not set/, '"Not set" is offered and is the default');
});

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
  formatCallTime,
  isAttireStyle,
  resolveGuestDressCode,
  sanitizeCallTime,
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

test('a config with ONLY roles still renders — seen on a real event, 2026-09-20', () => {
  // The couple set outfits for ninong and ninang and nothing else. Before this
  // fix, `hasAnything` was decided without looking at roles, so every sponsor
  // was told "your hosts haven't shared the dress code yet" while their own
  // answer sat in the config.
  const src = readFileSync(join(__dirname, '..', 'app', '[slug]', '_components', 'dress-code-widget.tsx'), 'utf8');
  const minedAt = src.indexOf('const mine = resolveGuestDressCode');
  const decidedAt = src.indexOf('const hasAnything =');
  assert.ok(minedAt > 0 && decidedAt > 0, 'precondition: both exist');
  assert.ok(minedAt < decidedAt, 'the personal answer is computed BEFORE the empty-state decision');
  const decision = src.slice(decidedAt, src.indexOf(';', decidedAt));
  assert.match(decision, /mine !== null/, 'and a role answer counts as a dress code');

  // And the rule itself answers for that config.
  const real = { principal_sponsor_ninong: { style: 'suit' as const, note: 'in the wedding colours' } };
  const mine = resolveGuestDressCode({ role: 'principal_sponsor_ninong', roles: real, palette: PALETTE });
  assert.equal(mine?.styleLabel, 'Suit');
  assert.equal(mine?.note, 'in the wedding colours');
});

/* ══════════════════════════════════════════════════════════════════════════
   CALL TIME — owner, 2026-09-23: "what she needs most is her call time"
   ══════════════════════════════════════════════════════════════════════════ */

test('⏰ a ninang is told WHEN, and it is the time the couple typed', () => {
  const roles = sanitizeRoleAttire(
    { principal_sponsor_ninang: { style: 'filipiniana', callTime: '13:00' } },
    known,
  );
  assert.equal(roles.principal_sponsor_ninang?.callTime, '13:00', 'stored as HH:MM, not reformatted on the way in');
  const mine = resolveGuestDressCode({
    role: 'principal_sponsor_ninang' as GuestRole,
    roles,
    palette: PALETTE,
  });
  assert.equal(mine?.callTime, '1:00 PM', 'and read back the way a person says it');
});

test('⛔ NOTHING IS REPAIRED: a half-typed time is dropped, never guessed into an hour', () => {
  // A call time is a number somebody sets an alarm by. "7" repaired into 07:00
  // is a WRONG alarm, and a ninang who arrives six hours early because this
  // product guessed is worse off than one who was told nothing at all.
  for (const bad of ['7', '1pm', '1:00 PM', '25:00', '12:60', '7:5', '', '  ', '13:00:00']) {
    assert.equal(sanitizeCallTime(bad), null, `"${bad}" must be refused, not repaired`);
  }
  for (const bad of [130, null, undefined, {}, ['13:00'], true]) {
    assert.equal(sanitizeCallTime(bad), null, 'stored config is data, not a promise about type');
  }
  const roles = sanitizeRoleAttire(
    { principal_sponsor_ninang: { style: 'filipiniana', callTime: '1pm' } },
    known,
  );
  assert.equal(roles.principal_sponsor_ninang?.style, 'filipiniana', 'the rest of the row still saves');
  assert.equal(roles.principal_sponsor_ninang?.callTime, undefined, 'but the unreadable time is simply not there');
  const mine = resolveGuestDressCode({
    role: 'principal_sponsor_ninang' as GuestRole,
    roles,
    palette: PALETTE,
  });
  assert.equal(mine?.callTime, null, 'and she is told no time rather than a wrong one');
});

test('⏰ the clock reads the way a person says it, including both noon edges', () => {
  assert.equal(formatCallTime('00:15'), '12:15 AM', 'midnight is 12, never 0');
  assert.equal(formatCallTime('09:05'), '9:05 AM');
  assert.equal(formatCallTime('12:00'), '12:00 PM', 'noon is PM, and it is 12, never 0');
  assert.equal(formatCallTime('13:00'), '1:00 PM');
  assert.equal(formatCallTime('23:59'), '11:59 PM');
  assert.equal(formatCallTime(null), null);
});

test('⏰ the time reaches the PANEL, and it reads BEFORE the outfit', () => {
  // The whole point of the owner's sentence is priority: she can decide what to
  // wear later and cannot decide when to leave the house later. A resolver
  // returning a call time changes nothing if it renders under the hex.
  const src = readFileSync(
    join(__dirname, '..', 'app', '[slug]', '_components', 'dress-code-widget.tsx'),
    'utf8',
  );
  const timeAt = src.indexOf('mine.callTime');
  const outfitAt = src.indexOf('mine.styleLabel');
  assert.ok(timeAt > 0, 'the call time is rendered at all');
  assert.ok(outfitAt > 0, 'precondition: the outfit is rendered');
  assert.ok(timeAt < outfitAt, 'the call time must come first in the panel');
});

test('⛔ the editor submits a call time for EVERY role, so the zip cannot slip', async () => {
  /*
    `actions.ts` zips FOUR parallel arrays by index — role_key, role_style,
    role_note, role_call_time. A control that vanished when blank would shift
    every later role's time onto the wrong person: a ninang told the bearer's
    call time, silently, with nothing red anywhere.

    🪤 THIS WAS A SOURCE GREP AND THE SABOTAGE WALKED STRAIGHT PAST IT. The
    first version took a window from `<input` FORWARD to `name="role_call_time"`
    and asserted no ternary sat inside it. But a conditional wrapper sits
    BEFORE the tag — `{current?.callTime ? <input …}` — so the window faced away
    from the exact mutation it was written to catch, and the sabotage run came
    back green. Precedent: a source-guard's window must face the sabotage.

    So it RENDERS the component and counts. One role with a time, one without;
    both must emit an input. A wrapper that hides the blank one drops the count
    to 1 and this fails, which is the entire point.
  */
  const React = (await import('react')).default;
  (globalThis as unknown as { React: unknown }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { RoleAttireField } = await import(
    '../app/dashboard/[eventId]/website/dress-code/_components/role-attire-field'
  );

  const html = renderToStaticMarkup(
    React.createElement(RoleAttireField, {
      roles: [
        { role: 'principal_sponsor_ninang' as GuestRole, label: 'Ninang', count: 4 },
        { role: 'principal_sponsor_ninong' as GuestRole, label: 'Ninong', count: 4 },
      ],
      saved: sanitizeRoleAttire(
        { principal_sponsor_ninang: { style: 'filipiniana', callTime: '13:00' } },
        known,
      ),
    }),
  );

  const count = (name: string) => html.split(`name="${name}"`).length - 1;
  assert.equal(count('role_key'), 2, 'precondition: two roles rendered');
  assert.equal(
    count('role_call_time'),
    2,
    'BOTH roles submit a call time — the one with a value and the one without',
  );
  assert.equal(count('role_style'), 2, 'and the arrays it is zipped against are the same length');
  assert.equal(count('role_note'), 2);
  assert.match(html, /value="13:00"/, 'the set time is the one that comes back');

  const actions = readFileSync(
    join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'website', 'dress-code', 'actions.ts'),
    'utf8',
  );
  assert.match(actions, /getAll\('role_call_time'\)/, 'the action reads the fourth array');
  assert.match(actions, /sanitizeCallTime\(roleCallTimes\[i\]\)/, 'by the SAME index as the style');
});

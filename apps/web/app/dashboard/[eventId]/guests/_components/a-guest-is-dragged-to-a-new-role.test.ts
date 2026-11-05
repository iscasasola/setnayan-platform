/**
 * ✋ GUESTS › LIST: DRAG TO CHANGE ROLE (owner 2026-11-01, DECISION_LOG "GUESTS › LIST: DRAG TO CHANGE ROLE · HONOUR
 * ATTENDANTS GET THEIR OWN GROUP", part 1 — verbatim: *"guests list can also be dragged and dropped to they can change
 * their role accordingly"*; and on "Guests of [Role]": *"they get to that group only if they do not have a role and
 * their role is guest"*).
 *
 *   1 · A drop on a role section gives that section's role, and the guest is then DRAWN there (the List's own
 *       `rosterSections`, run again on the changed row). Sabotage: `rolesForSection` returning the guest's own role → red.
 *   2 · A section with several roles (👯 Honour attendants) answers all of them — the List asks which with a PickMenu —
 *       and only roles the event offers. Sabotage: drop the `offeredRoles` filter → red.
 *   3 · "Guests of [Role]": a plain guest becomes someone's +1 (whose → "Whose guest?" when several); a guest with a role,
 *       or one who brings their own +1, is REFUSED with one line. Sabotage: drop the `g.role !== 'guest'` check → red.
 *   4 · The couple and the honoree are never picked up (nor a seat with no name yet); a drop on them is refused.
 *   5 · A role they ALSO hold that ranks first is said, not silently ignored.
 *   6 · The server checks it all again: the offered-role check `addSingleGuest` uses runs before any write; a drag refuses
 *       the couple; "Guests of" refuses anybody but a plain guest; the link moves BEFORE each "+N" is recounted (the
 *       database's +N-is-the-rows rule). Sabotage: move the offered check below the read → red.
 *   7 · The screen wears it: Role grouping only, the ONE shared drag piece (edge scroll), press-and-hold, tap · move,
 *       a PickMenu for the question, an Undo for every change, the optimistic overlay (a save never resets the screen).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { rosterSections } from '@/lib/guest-roster-view';
import { mayDragForRole, planRoleDrop, rolesForSection, type RoleDropFacts } from '@/lib/guest-role-drop';
import { resolveRoleSet } from '@/lib/role-sets';
import { HONOUR_ATTENDANT_ROLES } from '@/lib/role-groups';
import type { GuestRole, GuestRow } from '@/lib/guests';
import { stripComments } from '@/lib/strip-comments';

const HERE = __dirname;
const read = (rel: string) => readFileSync(join(HERE, rel), 'utf8');

const WEDDING = resolveRoleSet('wedding').offeredRoles;
let n = 0;
const guest = (role: GuestRole, extra: Partial<GuestRow> = {}): GuestRow =>
  ({
    guest_id: `g${++n}`,
    role,
    extra_roles: [],
    side: 'bride',
    first_name: `${role}${n}`,
    last_name: 'Reyes',
    rsvp_status: 'attending',
    plus_one_count: 0,
    plus_one_of_guest_id: null,
    ...extra,
  }) as unknown as GuestRow;

const bride = guest('bride');
const groom = guest('groom', { side: 'groom' });
const juan = guest('groomsman', { side: 'groom', first_name: 'Juan', plus_one_count: 1 });
const pedro = guest('groomsman', { side: 'groom', first_name: 'Pedro' });
const ana = guest('bridesmaid', { first_name: 'Ana' });
const lola = guest('guest', { first_name: 'Lola' });
const tito = guest('guest', { first_name: 'Tito', plus_one_count: 1 });
const titosPlus = guest('guest', { first_name: 'Bea', plus_one_of_guest_id: tito.guest_id });
const juansPlus = guest('guest', { first_name: 'Mia', plus_one_of_guest_id: juan.guest_id });
const tba = guest('guest', { first_name: 'TBA', last_name: '+1', plus_one_of_guest_id: pedro.guest_id });
const sponsor = guest('bridesmaid', { first_name: 'Rosa', extra_roles: ['principal_sponsor'] as GuestRole[] });
/** A bridesmaid who is ALSO the bride's mother: the VIP family role ranks first, so she is drawn there. */
const mother = guest('bridesmaid', { first_name: 'Carmen', extra_roles: ['bride_parents'] as GuestRole[] });
const ROSTER = [bride, groom, juan, pedro, ana, lola, tito, titosPlus, juansPlus, sponsor, mother];

const FACTS: RoleDropFacts = { roster: ROSTER, offeredRoles: WEDDING, roleNames: null, nameOf: (g) => g.first_name ?? '' };
const SECTION_FACTS = { roleNames: null, hasSides: true, groupsOf: () => [], tableOf: () => null };
const sectionOf = (list: GuestRow[], id: string) => rosterSections(list, 'role', SECTION_FACTS).find((s) => s.guests.some((g) => g.guest_id === id))?.key;

test('1 · a drop on a role section gives its role — and the List then draws them there', () => {
  const keys = rosterSections(ROSTER, 'role', SECTION_FACTS).map((s) => s.key);
  assert.ok(keys.includes('role:bridesmaids') && keys.includes('role:groomsmen') && keys.includes('role:guest'), `anti-vacuity: sections ${keys.join(' · ')}`);
  let checked = 0;
  for (const [who, to] of [[lola, 'role:bridesmaids'], [ana, 'role:groomsmen'], [pedro, 'role:guest'], [juan, 'role:principal_sponsors']] as const) {
    const plan = planRoleDrop(who, to, FACTS);
    assert.equal(plan.kind, 'role', `${who.first_name} → ${to}: ${JSON.stringify(plan)}`);
    if (plan.kind !== 'role') continue;
    for (const c of plan.roles) {
      const moved = ROSTER.map((g) => (g.guest_id === who.guest_id ? { ...g, role: c.key as GuestRole } : g));
      assert.equal(sectionOf(moved, who.guest_id), to, `${who.first_name} given ${c.key} is drawn in ${sectionOf(moved, who.guest_id)}, not ${to}`);
      checked++;
    }
  }
  assert.ok(checked >= 5, `anti-vacuity: only ${checked} drops were followed through`);
  assert.deepEqual(planRoleDrop(ana, 'role:bridesmaids', FACTS), { kind: 'stay' }, 'a drop back where they are changes something');
});

test('2 · a section with several roles answers every one it holds — and only roles the event offers', () => {
  const plan = planRoleDrop(lola, 'role:honour_attendants', FACTS);
  assert.equal(plan.kind, 'role');
  if (plan.kind !== 'role') return;
  const roles = plan.roles.map((r) => r.key);
  assert.ok(roles.length > 1, 'Honour attendants offered one role — the PickMenu would never ask');
  assert.deepEqual(new Set(roles), new Set(HONOUR_ATTENDANT_ROLES.filter((r) => WEDDING.includes(r))));
  // Only roles the event offers: a set without the best woman never offers her.
  const without = WEDDING.filter((r) => r !== 'best_woman');
  assert.ok(!rolesForSection('role:honour_attendants', without).includes('best_woman'), 'a role the event does not offer was offered');
  // Every section's roles are a subset of what is offered, and never the couple.
  for (const key of ['role:groomsmen', 'role:bridesmaids', 'role:principal_sponsors', 'role:vip_family', 'role:guest']) {
    const rs = rolesForSection(key, WEDDING);
    assert.ok(rs.length > 0, `${key} gives no role`);
    for (const r of rs) assert.ok(WEDDING.includes(r) && r !== 'bride' && r !== 'groom', `${key} gives ${r}`);
  }
});

test('3 · "Guests of [Role]": only a guest with no role of their own — anybody else is refused in one line', () => {
  const key = 'role:guests-of:groomsmen';
  assert.ok(rosterSections(ROSTER, 'role', SECTION_FACTS).some((s) => s.key === key), 'anti-vacuity: no Guests of Groomsmen section drawn');
  const ok = planRoleDrop(lola, key, FACTS);
  assert.equal(ok.kind, 'guests_of', JSON.stringify(ok));
  if (ok.kind === 'guests_of') assert.deepEqual(ok.hosts.map((h) => h.label).sort(), ['Juan', 'Pedro'], 'whose guest: not every groomsman offered');
  // Already Juan's +1 → only Pedro is left to choose.
  const mia = planRoleDrop(juansPlus, 'role:guests-of:bridesmaids', FACTS);
  assert.equal(mia.kind, 'guests_of');
  for (const [who, why] of [[ana, /Bridesmaid/], [sponsor, /only a guest with no role/], [tito, /brings their own \+1/]] as const) {
    const plan = planRoleDrop(who, key, FACTS);
    assert.equal(plan.kind, 'refuse', `${who.first_name} was let into ${key}`);
    if (plan.kind === 'refuse') {
      assert.match(plan.words, why);
      assert.ok(!plan.words.includes('\n') && plan.words.length < 140, `not one line: ${plan.words}`);
    }
  }
  // A +1 who is already where the drop is, stays.
  assert.deepEqual(planRoleDrop(juansPlus, key, FACTS), { kind: 'stay' });
  // A roleless +1 of a groomsman dropped on Guests is told where they are counted, never moved silently.
  const p = planRoleDrop(juansPlus, 'role:guest', FACTS);
  assert.equal(p.kind, 'refuse');
  if (p.kind === 'refuse') assert.match(p.words, /Guests of Groomsmen/);
});

test('4 · the couple and the honoree are never picked up — nor a seat that has no name yet', () => {
  for (const g of [bride, groom, guest('celebrant')]) {
    assert.equal(mayDragForRole(g), false, `${g.role} can be picked up`);
    assert.equal(planRoleDrop(g, 'role:guest', FACTS).kind, 'refuse', `${g.role} was moved`);
  }
  assert.equal(mayDragForRole(tba), false, 'an unnamed +1 seat can be picked up');
  for (const g of [juan, ana, lola, juansPlus]) assert.equal(mayDragForRole(g), true, `${g.first_name} cannot be picked up`);
});

test('5 · a role they also hold that ranks first is said — never a drop that does nothing', () => {
  assert.equal(sectionOf(ROSTER, mother.guest_id), 'role:vip_family', 'anti-vacuity: the extra role does not rank first');
  const plan = planRoleDrop(mother, 'role:groomsmen', FACTS);
  assert.equal(plan.kind, 'refuse', JSON.stringify(plan));
  if (plan.kind === 'refuse') assert.match(plan.words, /^Carmen is also .+, which comes first — change that on their card\.$/);
  // An extra role that does NOT rank first moves with them — no refusal.
  assert.equal(planRoleDrop(sponsor, 'role:groomsmen', FACTS).kind, 'role');
});

test('6 · the server checks again: offered roles first, the couple, the owner’s "Guests of" rule, the link before the +N', () => {
  const src = stripComments(read('../quick-add-actions.ts'));
  const at = src.indexOf('export async function setGuestPrimaryRole(');
  assert.ok(at > 0, 'setGuestPrimaryRole is gone');
  const body = src.slice(at, src.indexOf('\nexport async function', at + 10) > 0 ? src.indexOf('\nexport async function', at + 10) : undefined);
  const offered = body.indexOf('roleSet.offeredRoles.includes(role)');
  const firstRead = body.indexOf(".from('guests')");
  assert.ok(offered > 0 && firstRead > offered, 'the offered-role check does not run before the guest is read and written');
  assert.match(body, /resolveRoleSetForEvent\(eventId\)/, 'not the check addSingleGuest uses');
  assert.match(body, /drag && isHonoreeRole\(role\)/, 'a drag may give the couple’s role');
  assert.match(body, /drag && isHonoreeRole\(g\.role/, 'a drag may move the couple');
  assert.match(body, /'broughtBy' in ask/, 'the Guests of drop has no path');
  const link = src.slice(src.indexOf('async function bringAsPlusOne('));
  assert.match(link, /g\.role !== 'guest' \|\| \(g\.extra_roles \?\? \[\]\)\.length > 0\) return \{ ok: false, error: ONLY_A_PLAIN_GUEST \}/, 'the server lets a role holder become a +1');
  const move = link.indexOf('plus_one_of_guest_id: hostId');
  const recount = link.indexOf('plus_one_count: Math.min(');
  const locked = link.indexOf('checkExtraSeats(');
  assert.ok(locked > 0 && move > locked && recount > move, 'the link must be checked (finalized list), then moved, then each +N recounted');
  // No new server action: the budget has no room (lint-server-action-budget).
  assert.doesNotMatch(src, /export async function (dropGuest|moveGuest|linkPlusOne)/);
});

test('7 · the List wears it: Role grouping, the one drag piece, hold, tap · move, PickMenu, Undo, no reset', () => {
  const screen = stripComments(read('guests-screen.tsx'));
  assert.match(screen, /roleDragOn = gview === 'list' && view === 'role' && !selectMode && !writesOff/, 'the drag is not limited to Role grouping');
  assert.match(screen, /useGuestRoleDrag\(\{/, 'the List does not use the drag');
  assert.match(screen, /\{roleDragBar\}/, 'the question and the tap · move bar are never drawn');
  const drag = stripComments(read('guest-role-drag.tsx'));
  assert.match(drag, /from '@\/lib\/drag-edge-scroll'/, 'not the ONE shared drag piece');
  assert.match(drag, /dragEdgeStep\(h\.y, seenBand\(h\.scroller\)/, 'the list does not scroll by itself near its edges');
  assert.match(drag, /const band = dragBandOf\(scroller\)/, 'the band is not the shared piece’s, less what covers it');
  assert.match(drag, /setTimeout\(\(\) => lift\(e\.clientX, e\.clientY\), ROLE_HOLD_MS\)/, 'no press and hold');
  assert.match(drag, /if \(!h\.wandered\) \{[\s\S]{0,200}setCarried\(/, 'no tap · move fallback');
  assert.match(drag, /<PickMenu[\s\S]{0,400}dataAttr="data-role-drop-pick"/, 'a section with several roles does not ask with the PickMenu');
  assert.equal((drag.match(/pushUndo\(\{/g) ?? []).length, 2, 'each kind of change does not offer its Undo');
  assert.match(drag, /guestOptimistic\.apply\(moved\)/, 'the row does not move at once');
  assert.match(drag, /mayDragForRole\(g\)/, 'the couple can be picked up');
  assert.match(drag, /\{ via: 'list-drag' \}/, 'the role write does not say it is a drag (the server cannot refuse the couple)');
  assert.doesNotMatch(drag, /router\.(refresh|push|replace)|location\.(reload|assign)/, 'a drop resets the screen');
});

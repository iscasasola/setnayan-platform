/**
 * 🧍‍♀️➡️🧍 A PROXY WEARS THE ROLE — every reader of a guest's dress code, call time or role word goes through the ONE
 * effective-role reading (`effectiveRoleOf`, lib/guest-proxy.ts) for a guest who stands in (owner, 2026-10-27: *"the dress
 * code, call time, will be same as their proxy role"* · *"catherine sacdalan's invitation will indicate they are proxying for
 * XXX. giving them the role and dress code, call time, etc"*), and the proxy is offered ONLY to a role holder (*"this only
 * works if they have role and not guest"*), on the card, on the reply and in the server.
 *
 * The readers, named (each one a place a proxy would otherwise be told the Guests' dress code or the doors' time):
 *   · the guest page (site-body.tsx): Me's four parts (`guestMeFacts`), the look (`guestRole`, twice), the checklist
 *     (`guestChecklistItems`), the greeting's role line (`roleCode`) — `dressRole`, never `guest.role`;
 *   · the host's card (guest-card-data.ts): the attire line (`guestOutfitOf`) and the call time (`guestArriveBy`);
 *   · the ticket (pass-card.server.ts): one card (`readPassCardGuest`) and the couple's zip (`eligiblePassCardGuests`)
 *     wear the stand-in role before `passCardPass` reads Arrive; the reminder email's checklist does the same.
 *
 * Sabotage (2026-10-27): `role: guest.role ?? null` put back into `guestMeFacts` → test 1 red; `role: guest.role` into
 * the card's `guestOutfitOf` → test 2 red; the `wearTheirStandInRoles` call dropped from `readPassCardGuest` → test 3 red;
 * the `holdsARole` check dropped from `setGuestProxy` → test 4 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('1 · the guest page reads the role a guest DRESSES as — never their stored role — for every dress / call-time reader', () => {
  const src = read('app/[slug]/_components/site-body.tsx');
  assert.match(src, /const dressRole = effectiveRoleOf\(guest, standIn\?\.standingInFor\);/);
  assert.match(src, /guestMeFacts\(\{\s*role: dressRole/);
  assert.equal((src.match(/guestRole: dressRole/g) ?? []).length, 2, 'a "look" still reads the stored role');
  assert.match(src, /guestChecklistItems\(\{\s*role: dressRole,/);
  assert.match(src, /roleCode: dressRole,/);
  // The one place the stored role is still read is the comparison that builds `guestAsRole`.
  const stored = (src.match(/\bguest\.role\b/g) ?? []).length;
  assert.equal(stored, 1, `${stored} readers on the guest page still read guest.role — a proxy would be told the Guests' dress code`);
  // …and the proxy is SAID: "Standing in for …" / "… is standing in for you".
  assert.match(src, /standingInWords\(standIn\.standingInFor\.name/);
  assert.match(src, /standsInForYouWords\(standIn\.representedBy\.name\)/);
});

test('2 · the host’s card dresses a proxy as the role and says the role’s call time', () => {
  const src = read('app/dashboard/[eventId]/guests/_components/guest-card-data.ts');
  assert.match(src, /const dressRole = effectiveRoleOf\(guest, standingInFor\);/);
  assert.match(src, /guestOutfitOf\(\{\s*role: dressRole,/);
  assert.doesNotMatch(src, /guestOutfitOf\(\{\s*role: guest\.role/);
  assert.match(src, /guestArriveBy\(\{ role: dressRole,/);
});

test('3 · the ticket — one card and the zip — reads Arrive from the stand-in role', () => {
  const src = read('lib/pass-card.server.ts');
  const one = src.slice(src.indexOf('export async function readPassCardGuest'));
  assert.match(one.slice(0, 900), /await wearTheirStandInRoles\(admin, \[read\]\)/);
  const zip = src.slice(src.indexOf('export async function eligiblePassCardGuests'));
  assert.match(zip.slice(0, 1400), /await wearTheirStandInRoles\(admin, filterEligible\(/);
  assert.match(src, /arrive: guestArriveBy\(\{ role: g\.role as GuestRole \| null/);
  // …and the reminder email's checklist (the same ticket reading, before `guestChecklistItems`).
  const reminder = read('lib/guest-reminder-emails.ts');
  assert.match(reminder, /const guests = await wearTheirStandInRoles\(admin, /);
});

test('4 · a proxy is offered — and accepted — ONLY for a guest who holds a role', () => {
  const action = read('app/dashboard/[eventId]/guests/proxy-actions.ts');
  assert.match(action, /if \(move\.kind !== 'remove' && move\.kind !== 'keep' && !holdsARole\(h\)\) return \{ ok: false, error: PROXY_NEEDS_A_ROLE \};/);
  const card = read('app/dashboard/[eventId]/guests/_components/guest-card-data.ts');
  assert.match(card, /const offerProxy = holdsARole\(guest\) && !guest\.plus_one_of_guest_id && !holderRow;/);
  const reply = read('app/[slug]/_components/rsvp-widget.tsx');
  assert.match(reply, /holdsARole\(\{ role: guest\.role, extra_roles: guest\.extra_roles \?\? \[\] \}\)/);
  assert.match(reply, /\{offerStandIn \? \(/);
  const save = read('app/[slug]/actions.ts');
  assert.match(save, /holdsARole\(\{ role: before!\.role as GuestRole/);
  assert.match(save, /status === 'declined' && mayNameAStandIn/);
});

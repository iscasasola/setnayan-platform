/**
 * 🃏 SHOP › SERVICES: THE CARD, A ROW UNDER IT, SWIPE LEFT TO DELETE (owner 10 Nov on PR #7464, verbatim: *"Use the
 * service card. Add a row under. Create 2 buttons for edit and share and a toggle for offline and online and swipe left
 * to delete"* · *"Edit icon, share icon, toggle to online and offline."* · *"You cannot delete a service card until all
 * booked are complete. You cannot turn off a service card until all booked completed."* · *"You must also warn
 * them…"*).
 *
 * Fails if:
 *   • a frame (border / rounded box / fill) comes back around the card and its row;
 *   • the row is anything but TWO icon ActionButtons (Edit · Share to a client) and ONE worded Online/Offline switch;
 *   • the switch stops being the shipped `toggleVendorServiceActive` behind its door, or a refused Go online names only
 *     the FIRST unmet requirement;
 *   • swipe-left stops being the shipped `SwipeToDelete` + `deleteWithUndo`, or skips the warning, or deletes / warns
 *     on a card with an open booking;
 *   • the server stops refusing delete or go-offline while a booking is open, or the refusal stops naming each one;
 *   • Duplicate stops being reachable inside the Card Maker.
 *
 * Source-scanned where a node render cannot load the server registry; the booking rule and its words run for real.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripComments } from '@/lib/strip-comments';
import {
  PUBLISH_COACH_MESSAGE,
  PUBLISH_REFUSAL_MESSAGE,
  PUBLISH_REQUIREMENTS,
  publishRefusalFor,
  unmetPublishRequirements,
} from '@/lib/service-publish-gate';
import {
  OPEN_BOOKING_STATUSES,
  deleteWarningLines,
  openBookingsRefusal,
  readCardBookings,
} from '@/lib/service-open-bookings';

const read = (...p: string[]) => stripComments(readFileSync(join(__dirname, ...p), 'utf8'));
const MANAGER = read('_components', 'services-manager.tsx');
const ITEM = read('_components', 'service-card-item.tsx');
const ROW = read('_components', 'service-card-menu-row.tsx');
const MAKER = read('_components', 'canvas-maker.tsx');
const ACTIONS = read('actions.ts');

/** A function's body in actions.ts, from its signature to the next top-level declaration. */
function body(sig: string): string {
  const at = ACTIONS.indexOf(sig);
  assert.ok(at > 0, `${sig} was not found — re-anchor this guard`);
  const next = ACTIONS.slice(at + sig.length).search(/\n(export )?(async )?function /);
  return ACTIONS.slice(at, next < 0 ? undefined : at + sig.length + next);
}

/** The manager's use of the card item — from `<ServiceCardItem` to its close. */
function managerItem(): string {
  const at = MANAGER.indexOf('<ServiceCardItem');
  assert.ok(at > 0, 'the manager no longer renders ServiceCardItem — re-anchor this guard');
  return MANAGER.slice(at, MANAGER.indexOf('\n                />', at));
}

test('NO FRAME: the card and its row sit in an <li> that draws nothing', () => {
  const li = ITEM.slice(ITEM.indexOf('<li'), ITEM.indexOf('>', ITEM.indexOf('<li')));
  assert.match(li, /data-shop-card=""/, 'the card <li> lost the hook Shop’s thumb row narrows by');
  // A DIVIDER between cards is the prototype (one bottom rule); a box around the card + row is not.
  assert.doesNotMatch(li, /\bborder(?!-b\b|-ink\/)|rounded-|bg-|background|overflow-hidden|\bp-\d|px-\d|py-\d|\bborder-(?:t|l|r|x|y)\b/, `the card is framed again: ${li}`);
  assert.match(li, /border-b border-ink\/10 pb-5 last:border-b-0/, 'the divider between cards is gone');
  // The manager no longer draws the old framed <li> or a bordered strip around the row.
  assert.doesNotMatch(MANAGER, /className="scroll-mt-24 overflow-hidden rounded-2xl border"/, 'the old framed <li> is back');
  assert.doesNotMatch(managerItem(), /border-t px-4 py-3/, 'a bordered strip is back around the row');
  // Order: the card, then the row directly under it.
  const face = ITEM.indexOf('{face}');
  const row = ITEM.indexOf('<ServiceCardMenuRow {...row}');
  assert.ok(face > 0 && row > face, 'the row is not directly under the card');
});

test('the card face opens the Card Maker — the same door as Edit', () => {
  const item = managerItem();
  assert.match(item, /<ServiceCardView\b/, 'the list stopped drawing the couple’s own card');
  assert.match(item, /href=\{editHref\}[\s\S]{0,300}data-card-face-opens=""/, 'tapping the card face no longer opens the maker');
  assert.match(item, /\n\s+editHref,/, 'Edit and the card face point at different places');
  assert.match(MANAGER, /const editHref = `\/vendor-dashboard\/services\/\$\{svc\.vendor_service_id\}/, 'editHref is not the Card Maker');
  assert.doesNotMatch(MANAGER, /Edit · every field/, 'the old "Edit · every field" row is back');
  assert.doesNotMatch(MANAGER, /\?from=\$\{svc\.vendor_service_id\}/, 'a "start a new card from this one" door is back on the list');
});

test('the row is TWO icon buttons (Edit · Share to a client) and ONE worded Online/Offline switch', () => {
  const at = ROW.indexOf('data-card-menu-line=""');
  assert.ok(at > 0, 'the row line was not found — re-anchor this guard');
  const line = ROW.slice(ROW.lastIndexOf('<div', at), ROW.indexOf('<StayForm', at));
  const buttons = line.match(/<ActionButton\b/g) ?? [];
  assert.equal(buttons.length, 2, 'the row should hold exactly two ActionButtons: Edit and Share');
  assert.equal((line.match(/\biconOnly\b/g) ?? []).length, 2, 'Edit and Share are icon buttons');
  assert.match(line, /\[&>\.ab\]:h-10 \[&>\.ab\]:min-h-10 \[&>\.ab\]:w-10/, 'the two icon buttons are not one 40×40 size');
  const edit = line.indexOf('name="Edit"');
  const share = line.indexOf('name="Share to a client"');
  const sw = line.indexOf('role="switch"');
  assert.ok(edit > 0 && share > edit && sw > share, 'the row is not Edit · Share · switch, in that order');
  assert.equal((line.match(/role="switch"/g) ?? []).length, 1, 'the row holds one switch');
  assert.match(line, /<SwitchTrack on=\{isActive\} words=\{\{ on: 'Online', off: 'Offline' \}\} \/>/, 'the switch is not the worded Online/Offline track (T20)');
  assert.match(line, /className=\{SWITCH_BUTTON\}/, 'the switch is not the shipped SWITCH_BUTTON');
  assert.match(line, /\{held \? \(\s*<PlanHoldTag \/>/, 'a card the plan holds no longer shows "On hold" in place of the switch');
  assert.doesNotMatch(line, /Go online|Go offline/, 'a worded Go online button is back in place of the switch');
  assert.match(ROW, /import \{[^}]*\bPencil\b[^}]*\bShare\b[^}]*\} from 'lucide-react';/, 'Edit/Share lost the house icons');
  assert.doesNotMatch(ROW, /\bShare2\b/, 'Share2 is not the share icon (T19)');
});

test('Share does NOT share a link to anyone (owner: "It is share to an client event")', () => {
  assert.doesNotMatch(ROW, /shareShopLink|navigator\.share|clipboard/, 'Share is a system share / link copy again');
  // Wired 2026-11-11 (DECISION_LOG 🔗): it opens "Share to a client event" — share-posts-the-card-into-a-client-chat.test.ts.
  assert.match(ROW, /<ServiceCardShareSheet\b/, 'Share no longer opens the client-event sheet');
});

test('the switch is the shipped toggle behind its door, its form OUTSIDE the row', () => {
  assert.match(managerItem(), /action=\{toggleVendorServiceActive\}/, 'the switch is no longer the shipped toggleVendorServiceActive');
  assert.match(ROW, /door="svServices\.toggleVendorServiceActive"/, 'the switch is not saved in place through its door');
  assert.match(ROW, /type="submit"\s+form=\{formId\}/, 'the switch no longer submits the form outside the row');
});

test('SWIPE LEFT TO DELETE is the shipped swipe + Undo — warned first, refused on an open booking', () => {
  assert.match(ITEM, /import \{ SwipeToDelete \} from '@\/app\/_components\/swipe-to-delete';/, 'not the shipped SwipeToDelete');
  assert.match(ITEM, /import \{ deleteWithUndo[^}]*\} from '@\/app\/_components\/undo\/delete-with-undo';/, 'not the shipped deleteWithUndo');
  assert.match(ITEM, /import \{ Sheet \} from '@\/app\/_components\/sheet';/, 'the warning is not the house bottom sheet');
  assert.doesNotMatch(ITEM, /onPointerDown|onTouchStart|addEventListener\('pointer/, 'new gesture code — use SwipeToDelete');
  assert.match(ITEM, /<SwipeToDelete[^>]*onDelete=\{onSwipeDelete\}[^>]*>\s*\{face\}\s*<\/SwipeToDelete>/, 'the swipe does not wrap the card face');

  const swipe = ITEM.slice(ITEM.indexOf('function onSwipeDelete'), ITEM.indexOf('function confirmDelete'));
  const refused = swipe.indexOf('if (deleteRefusal)');
  const warn = swipe.indexOf('setWarn(true)');
  assert.ok(refused > 0 && warn > refused, 'the swipe warns before checking open bookings');
  assert.match(swipe.slice(refused, warn), /setRefusal\(deleteRefusal\);\s*return;/, 'an open booking does not stop the swipe');
  assert.doesNotMatch(swipe, /deleteWithUndo|remove\(/, 'the swipe deletes without the warning');

  // Only Delete in the warning calls the server; Cancel (and closing the sheet) only closes it.
  const sheet = ITEM.slice(ITEM.indexOf('<Sheet open={warn}'), ITEM.indexOf('</Sheet>'));
  assert.ok(sheet.length > 0, 'the warning sheet was not found — re-anchor this guard');
  assert.match(sheet, /onClose=\{\(\) => setWarn\(false\)\}/, 'closing the warning does more than close it');
  assert.match(sheet, /label="Cancel" onClick=\{\(\) => setWarn\(false\)\}/, 'Cancel does more than close the warning');
  assert.match(sheet, /tone="danger" main icon=\{Trash2\} label="Delete" onClick=\{confirmDelete\}/, 'Delete is not the destructive answer');
  assert.match(sheet, /<EqualRow\b/, 'Cancel and Delete are not at equal width');
  assert.equal((ITEM.match(/confirmDelete/g) ?? []).length, 2, 'confirmDelete is reached from somewhere other than the sheet’s Delete');
  const confirm = ITEM.slice(ITEM.indexOf('function confirmDelete'), ITEM.indexOf('return (', ITEM.indexOf('function confirmDelete')));
  assert.match(confirm, /remove\(row\.vendorServiceId\)/, 'Delete does not call the server');

  assert.match(managerItem(), /remove=\{removeVendorServiceFromList\}/, 'the swipe is not the shipped delete');
  assert.match(MANAGER, /<UndoToastHost \/>/, 'the Undo toast host is not mounted');
});

test('the warning says the four facts, and only true ones', () => {
  const never = deleteWarningLines(0).join(' ');
  assert.match(never, /Events linked to this card and its inspirations leave the card\./);
  assert.match(never, /Its reviews and stats leave the card\. They stay on your shop\./);
  assert.match(never, /can’t move to a new card — events sync only to the card that was booked\. There is no manual upload\./);
  // A card a couple ever picked is HIDDEN, not deleted — nothing leaves it, so the sheet must not say it does.
  const picked = deleteWarningLines(2).join(' ');
  assert.doesNotMatch(picked, /leave the card/, 'the warning says links leave a card the server only hides');
  assert.match(picked, /hidden instead of deleted/);
  assert.match(ITEM, /\{`Delete “\$\{row\.cardName\}”\?`\}/, 'the warning does not name the card');
});

test('an open booking blocks delete and go-offline; each is named on its own line', () => {
  assert.deepEqual([...OPEN_BOOKING_STATUSES], ['contracted', 'deposit_paid', 'delivered'], 'open = booked and not complete');
  const open = [
    { eventName: 'Maria & Juan’s Wedding', eventDate: '2026-12-12' },
    { eventName: 'Ana’s Debut', eventDate: '2027-01-09' },
  ];
  const lines = openBookingsRefusal(open)!.split('\n');
  assert.deepEqual(lines, ['2 bookings still open — finish them first', 'Maria & Juan’s Wedding · 12 Dec 2026', 'Ana’s Debut · 9 Jan 2027']);
  assert.equal(openBookingsRefusal(open.slice(0, 1))!.split('\n')[0], '1 booking still open — finish it first');
  // All complete → no refusal: delete and go-offline go ahead.
  assert.equal(openBookingsRefusal([]), null);
});

test('readCardBookings: complete, cancelled and deleted-event bookings are not open; a refused read is null', async () => {
  const rows = [
    { service_id: 'a', status: 'contracted', event_id: 'e1' },
    { service_id: 'a', status: 'complete', event_id: 'e2' },
    { service_id: 'a', status: 'considering', event_id: 'e3' }, // a save, or a booking cancelled back out of the set
    { service_id: 'a', status: 'deposit_paid', event_id: null }, // the couple deleted their event
    { service_id: 'b', status: 'complete', event_id: 'e4' },
  ];
  const events = [{ event_id: 'e1', display_name: 'Maria & Juan’s Wedding', event_date: '2026-12-12' }];
  const fake = (fail: 'none' | 'rows' | 'events') =>
    ({
      from: (t: string) => ({
        select: () => ({
          in: async () =>
            t === 'event_vendors'
              ? fail === 'rows' ? { data: null, error: { message: 'x' } } : { data: rows, error: null }
              : fail === 'events' ? { data: null, error: { message: 'x' } } : { data: events, error: null },
        }),
      }),
    }) as unknown as SupabaseClient;

  const got = (await readCardBookings(fake('none'), ['a', 'b', 'c']))!;
  assert.equal(got.get('a')!.picked, 4);
  assert.deepEqual(got.get('a')!.open, [{ eventName: 'Maria & Juan’s Wedding', eventDate: '2026-12-12' }]);
  assert.deepEqual(got.get('b'), { picked: 1, open: [] }, 'every booking complete → nothing open');
  assert.deepEqual(got.get('c'), { picked: 0, open: [] });
  assert.equal(await readCardBookings(fake('rows'), ['a']), null, 'a refused read became "nobody booked"');
  // `event_vendors` admits no shop: every caller reads it on the ADMIN client, or every card would look unbooked.
  for (const [name, src] of [['actions.ts', ACTIONS], ['services-manager.tsx', MANAGER], ['[serviceId]/page.tsx', read('[serviceId]', 'page.tsx')]] as const) {
    const calls = src.match(/readCardBookings\(([^,]+),/g) ?? [];
    assert.ok(calls.length > 0, `${name} no longer reads the card's bookings`);
    for (const c of calls) assert.match(c, /readCardBookings\(createAdminClient\(\),/, `${name} reads bookings on a session client: ${c}`);
  }
  assert.equal(await readCardBookings(fake('events'), ['a']), null, 'a refused events read became "nobody booked"');
});

test('the SERVER refuses delete and go-offline while a booking is open — before it writes', () => {
  const del = body('async function deleteOrRetireOwnService(');
  const gate = del.indexOf('openBookingsRefusal(bookings.open)');
  const write = del.search(/\.update\(\{ is_active: false|\.delete\(\)/);
  assert.ok(gate > 0 && write > gate, 'the delete writes before refusing an open booking');
  assert.match(del, /if \(!bookings\) return \{ ok: false, error: BOOKINGS_UNREAD \}/, 'an unread read is taken for "nobody booked"');
  assert.match(body('export async function deleteVendorService('), /deleteOrRetireOwnService\(/, 'the maker’s Delete skips the gate');
  assert.match(body('export async function removeVendorServiceFromList('), /deleteOrRetireOwnService\(/, 'the swipe skips the gate');

  const toggle = body('export async function toggleVendorServiceActive(');
  const offGate = toggle.indexOf('if (!is_active) {');
  const offWrite = toggle.indexOf('.update({ is_active,');
  assert.ok(offGate > 0 && offWrite > offGate, 'the switch turns a card off before checking its bookings');
  assert.match(toggle.slice(offGate, offWrite), /offlineRefusal\(/);
  assert.match(body('async function offlineRefusal('), /openBookingsRefusal\(bookings\.open\)/);

  // The Card Maker's "Couples can see it" switch is the same go-offline.
  assert.match(body('export async function commitVendorService('), /offlineRefusal\(supabase, profile\.vendor_profile_id, serviceId\)/);
});

test('the Card Maker’s Delete says the same: refused on an open booking, else warned', () => {
  assert.match(MAKER, /deleteGate\?\.refusal \? \(/, 'the maker’s delete sheet ignores open bookings');
  assert.match(MAKER, /data-maker-delete-warning=""/, 'the maker’s delete sheet lost the warning');
  const refusalFace = MAKER.slice(MAKER.indexOf('deleteGate?.refusal ? ('), MAKER.indexOf(') : (', MAKER.indexOf('deleteGate?.refusal ? (')));
  assert.doesNotMatch(refusalFace, /deleteVendorService|SupplierSubmit/, 'a card with an open booking can still be deleted from the maker');
});

test('Duplicate stays reachable inside the Card Maker', () => {
  assert.match(MAKER, /href=\{`\/vendor-dashboard\/services\/new\/\$\{category\}\?from=\$\{editing\.serviceId\}`\}/);
  assert.match(MAKER, /data-maker-copy=""/);
});

test('a refused Go online names EVERY unmet requirement at once', () => {
  // Frame F: "Not ready to go Online", then each missing thing on its own line, in the Maker's own words.
  const unmet = unmetPublishRequirements({ hasCover: false, hasPrice: true, hasInclusions: false });
  assert.deepEqual(publishRefusalFor(unmet)!.split('\n'), ['Not ready to go Online', PUBLISH_COACH_MESSAGE.cover, PUBLISH_COACH_MESSAGE.inclusions]);
  const all = publishRefusalFor([...PUBLISH_REQUIREMENTS])!.split('\n');
  assert.deepEqual(all, ['Not ready to go Online', ...PUBLISH_REQUIREMENTS.map((r) => PUBLISH_COACH_MESSAGE[r])]);
  for (const r of PUBLISH_REQUIREMENTS) assert.equal(publishRefusalFor([r]), PUBLISH_REFUSAL_MESSAGE[r]);
  assert.equal(publishRefusalFor([]), null);

  const toggle = body('export async function toggleVendorServiceActive(');
  assert.match(toggle, /publishRefusalFor\(unmet\)/, 'the toggle no longer refuses with every unmet requirement');
  assert.doesNotMatch(toggle, /unmet\[0\]/, 'the toggle picks only the first unmet requirement again');
});

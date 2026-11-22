/**
 * 🧭 THE COORDINATOR'S SEAT FOLLOWS THE BOOKING (ship review of #8094 — 21 Nov 2026 items 1 and 4; 22 Nov 2026 fix 3).
 *   1 · "is this booking a coordinator's?" is the DATABASE's rule — the shop's services (`isCoordinatorTrade`, the
 *       mirror of `services_make_a_coordinator`), never the couple's category alone; an unread shop opens nothing;
 *   2 · ONE shared door opens the seat (`openTheCoordinatorsSeatForBooking`, lib/coordinator-grant.ts): it reads the
 *       booking fresh, does nothing unless the row is BOOKED and a coordinator's, stamps the seat with the booking
 *       (`opened_by_event_vendor_id`) so the database closes that seat — and only it — when the booking is cancelled
 *       (proved in tests/db/only-a-host-books-…db.test.ts), never throws, and logs a refused read;
 *   3 · "ACCESS IS AUTOMATIC ON BOOKING" — EVERY DOOR: every server path that moves an `event_vendors` row into the
 *       booked set calls that one function, AFTER its own write. Until 22 Nov the seat had ONE call site
 *       (`updateVendorStatus`, on the move into downpaid), so a coordinator booked by the supplier's yes, a booked-QR
 *       claim, the wizard, a package, the chat's Book or a logged payment got no seat;
 *   4 · `autoInviteCoordinator` has ONE call site — inside the shared door — and is not exported, so no file can
 *       grow a second one;
 *   5 · A NEW DOOR IS FOUND, NOT REMEMBERED: any file under app/ or lib/ that writes a booked status into
 *       `event_vendors` (or calls an RPC that does) must be a door of test 3 or a NAMED exemption whose reason is
 *       checked here — never trusted.
 *
 * 🛡 SABOTAGE (each turns this file red): delete the `openTheCoordinatorsSeatForBooking(` line from ANY door of test 3
 *    → 3 red (it names the door) · move that line above the door's own write → 3 red · `export` `autoInviteCoordinator`
 *    again, or call it a second time anywhere in coordinator-grant.ts → 4 red · drop the booked check or the try/catch
 *    from the shared door → 2 red · add `status: 'contracted'` to an `event_vendors` write in a file that is not
 *    listed → 5 red · give the budget's hand-typed supplier a `contact_email` → 5 red · drop the `removed_by_host`
 *    return, or put `.is('removed_at', null)` back on the invite dedupe → 4b red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripComments } from './strip-comments';
import { BOOKED_EVENT_VENDOR_STATUSES, bookingIsACoordinators, isBookedEventVendorStatus } from './coordinator-trade';

const WEB = process.cwd();
/** Comments removed: a guard that matches the comment explaining it cannot fail. */
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function shop(result: { data: unknown; error: { message: string } | null }): SupabaseClient {
  const b: Record<string, unknown> = { select: () => b, eq: () => b, maybeSingle: async () => result };
  return { from: () => b } as unknown as SupabaseClient;
}

test('1 · a shop is a coordinator by its SERVICES; a supplier with no shop by the same list; unread = no', async () => {
  const coordinatorShop = shop({ data: { services: ['day_of_coordinator'] }, error: null });
  const floristShop = shop({ data: { services: ['florist'] }, error: null });
  // The couple filed a florist under "planner_coordinator": the shop's services decide, as in the database.
  assert.equal(await bookingIsACoordinators(floristShop, { category: 'planner_coordinator', marketplaceVendorId: 'shop' }), false);
  // …and a coordinator filed under another category is still the coordinator.
  assert.equal(await bookingIsACoordinators(coordinatorShop, { category: 'misc', marketplaceVendorId: 'shop' }), true);
  // No shop: only the category exists, read through the same list.
  assert.equal(await bookingIsACoordinators(floristShop, { category: 'planner_coordinator', marketplaceVendorId: null }), true);
  assert.equal(await bookingIsACoordinators(floristShop, { category: 'photographer', marketplaceVendorId: null }), false);
  // A shop that could not be read opens nothing.
  const unread = shop({ data: null, error: { message: 'timeout' } });
  assert.equal(await bookingIsACoordinators(unread, { category: 'planner_coordinator', marketplaceVendorId: 'shop' }), false);
});

const GRANT = 'lib/coordinator-grant.ts';
const DOOR_DECL = 'export async function openTheCoordinatorsSeatForBooking(';
const DOOR_CALL = 'openTheCoordinatorsSeatForBooking(';

test('2 · the ONE shared door: a fresh read, BOOKED and a coordinator’s or nothing, stamped with the booking, never throws', () => {
  // BOOKED is the four statuses the migrations open and close the seat by — and nothing else.
  assert.deepEqual([...BOOKED_EVENT_VENDOR_STATUSES], ['contracted', 'deposit_paid', 'delivered', 'complete']);
  for (const s of BOOKED_EVENT_VENDOR_STATUSES) assert.equal(isBookedEventVendorStatus(s), true);
  for (const s of ['considering', 'shortlisted', 'cancelled', 'released', '', null, undefined]) {
    assert.equal(isBookedEventVendorStatus(s), false, `${String(s)} opens a seat`);
  }

  const grant = code(GRANT);
  const start = grant.indexOf(DOOR_DECL);
  const end = grant.indexOf('async function autoInviteCoordinator(');
  assert.ok(start > 0 && end > start, 'the shared door is gone, or no longer sits above the function it guards');
  const door = grant.slice(start, end);

  // It reads the row itself — a caller's belief about the status is never taken.
  assert.match(door, /\.from\('event_vendors'\)[\s\S]{0,260}\.eq\('vendor_id', p\.eventVendorId\)/, 'the door no longer reads the booking fresh');
  // BOOKED first, then the database's coordinator rule, then — only then — the seat.
  const booked = door.indexOf('if (!isBookedEventVendorStatus(row.status)) return');
  const trade = door.indexOf('if (!(await bookingIsACoordinators(admin,');
  const open = door.indexOf('await autoInviteCoordinator(admin,');
  assert.ok(booked > 0, 'a row that is not booked opens a seat');
  assert.ok(trade > booked, 'the coordinator rule is asked before (or instead of) the booked check');
  assert.ok(open > trade, 'the seat is opened before the two checks');
  // The seat carries the booking that opened it; a booked SHOP is handed through even with no contact email.
  assert.match(door, /eventVendorId: p\.eventVendorId,/, 'the seat no longer carries the booking that opened it');
  assert.match(door, /shopProfileId: row\.marketplace_vendor_id \?\? null,/);
  assert.match(door, /email: row\.contact_email \?\? '',/);
  // The inviter is the host who booked; a supplier-side door hands none and the row's own asker is used, else NULL.
  assert.match(door, /invitedByUserId: p\.actorUserId \?\? row\.lock_requested_by_user_id \?\? null,/);
  // Best-effort: one try around everything, no throw; a refused read is logged with its reason.
  assert.match(door, /\{\s*try \{[\s\S]*\} catch \(e\) \{[\s\S]*console\.error\([\s\S]*return 'failed';\s*\}\s*\}\s*$/, 'the door can throw into the booking write');
  assert.doesNotMatch(door, /\bthrow\b/);
  assert.match(door, /if \(error\) \{\s*console\.error\([^)]*error\.message[\s\S]{0,120}return 'unread';/, 'a refused read is silent');

  assert.equal(grant.match(/opened_by_event_vendor_id:/g)?.length, 3, 'every seat this file opens (invite · seat · revive) carries the booking');
});

/** One function's body: from its declaration to the first line that closes a top-level block. */
function fnBody(src: string, decl: string): string {
  const a = src.indexOf(decl);
  if (a < 0) return '';
  const b = src.indexOf('\n}\n', a);
  return src.slice(a, b < 0 ? undefined : b);
}

const VENDORS = 'app/dashboard/[eventId]/vendors/actions.ts';
/**
 * EVERY BOOKING DOOR — the server paths that move an `event_vendors` row into the booked set. `after` is the door's own
 * write: the shared call must come AFTER it (the function reads the row the write just made). `actor` is what the door
 * hands as the inviter — the host who pressed; `null` at the one door a host does not press.
 */
const DOORS: ReadonlyArray<{ name: string; file: string; decl: string; after: string; actor: string }> = [
  { name: 'updateVendorStatus (a host moves the status)', file: VENDORS, decl: 'async function updateVendorStatus(', after: '.update({ status, updated_at:', actor: 'user.id' },
  { name: 'finalizeVendor (Book / Lock)', file: VENDORS, decl: 'export async function finalizeVendor(', after: 'status: LOCKED_STATUS,', actor: 'user.id' },
  { name: 'recordDeposit (a host logs the payment)', file: VENDORS, decl: 'export async function recordDeposit(', after: 'deposit_recorded_at: ev.deposit_recorded_at ??', actor: 'user.id' },
  { name: 'vendorAgreeToLock (the supplier’s yes)', file: 'app/vendor-dashboard/clients/[eventId]/actions.ts', decl: 'export async function vendorAgreeToLock(', after: "rpc('vendor_agree_to_lock'", actor: 'null' },
  { name: 'claimLockedQr (the booked-QR claim)', file: 'app/vendor/lock/[token]/actions.ts', decl: 'export async function claimLockedQr(', after: "rpc('vendor_claim_locked_qr'", actor: 'user.id' },
  { name: 'lockPackage (a package)', file: 'app/dashboard/[eventId]/vendors/packages/actions.ts', decl: 'export async function lockPackage(', after: '.insert(eventVendorRows)', actor: 'user.id' },
  { name: 'the wizard’s marketplace pick', file: 'app/dashboard/[eventId]/wizard-actions.ts', decl: 'async function completeVendorPickFromMarketplace(', after: "status: handshakeAsk ? 'considering' : 'contracted',", actor: 'user.id' },
  { name: 'the wizard’s own supplier', file: 'app/dashboard/[eventId]/wizard-actions.ts', decl: 'async function completeVendorPickFromCustom(', after: '.insert(insertPayload)', actor: 'user.id' },
  { name: 'lockDeal (the chat’s Book)', file: 'app/_components/negotiation-actions.ts', decl: 'export async function lockDeal(', after: 'await bookVendorAtChatLock(', actor: 'ctx.userId' },
  { name: 'answerClaimAccess (the couple approves a supplier from their link)', file: 'app/dashboard/[eventId]/access-requests/actions.ts', decl: 'async function answerClaimAccess(', after: "rpc('answer_claim_access_request'", actor: 'user.id' },
];

test('3 · EVERY booking door opens the seat through the one shared function, after its own write', () => {
  for (const d of DOORS) {
    const body = fnBody(code(d.file), d.decl);
    assert.ok(body.length > 0, `${d.name}: the function moved — find it and keep its door`);
    const write = body.indexOf(d.after);
    assert.ok(write > 0, `${d.name}: its booking write changed shape — re-anchor this door, do not drop it`);
    const calls = body.split(DOOR_CALL).length - 1;
    assert.equal(calls, 1, `${d.name}: a coordinator booked through this door gets no seat (or the door calls twice) — ${calls} call(s)`);
    const call = body.indexOf(DOOR_CALL);
    assert.ok(call > write, `${d.name}: the seat is asked for BEFORE the booking is written — it would read an unbooked row`);
    // ONE line, no copied logic: the booking's id and the actor, nothing else.
    const line = body.slice(call, body.indexOf('\n', call));
    assert.match(line, /^openTheCoordinatorsSeatForBooking\((?:createAdminClient\(\)|admin), \{ eventVendorId(?:: [\w.?]+)?, actorUserId: [\w.]+ \}\);$/, `${d.name}: the door is more than one plain call — ${line}`);
    assert.ok(line.includes(`actorUserId: ${d.actor} }`), `${d.name}: the actor is no longer ${d.actor} — ${line}`);
    // No door decides who is a coordinator, or opens a seat, by itself.
    assert.doesNotMatch(body, /bookingIsACoordinators\(|autoInviteCoordinator\(/, `${d.name}: the door carries its own copy of the rule`);
  }
  // The supplier's yes is the one door a host does not press: the door names nobody as the inviter.
  assert.deepEqual(DOORS.filter((d) => d.actor === 'null').map((d) => d.decl), ['export async function vendorAgreeToLock(']);
});

test('4 · autoInviteCoordinator has ONE call site — inside the shared door — and cannot gain another', () => {
  const grant = code(GRANT);
  assert.doesNotMatch(
    grant,
    /export\s+(?:async\s+)?function\s+autoInviteCoordinator\b|export\s*\{[^}]*\bautoInviteCoordinator\b/,
    'autoInviteCoordinator is exported again — a second call site can appear in any file',
  );
  const uses = grant.split('autoInviteCoordinator(').length - 1;
  assert.equal(uses, 2, `autoInviteCoordinator( appears ${uses} times in ${GRANT} — its declaration and ONE call are the whole of it`);
  const door = grant.slice(grant.indexOf(DOOR_DECL), grant.indexOf('async function autoInviteCoordinator('));
  assert.equal(door.split('await autoInviteCoordinator(').length - 1, 1, 'the one call is not inside the shared door');
  // The shared door is the only thing this file hands out.
  assert.deepEqual(
    [...grant.matchAll(/^export (?:async )?(?:function|const|type) (\w+)/gm)].map((m) => m[1]).sort(),
    ['SeatForBookingOutcome', 'openTheCoordinatorsSeatForBooking'],
  );
});

test('4b · many doors, one seat: a seat the HOSTS took away is never re-opened by a later door', () => {
  // Every booking door calls the shared function, so a host who removed the coordinator and then logs a payment (or
  // moves the status along) must not find them back. Only the seat the booking's own cancel closed comes back.
  const grant = code(GRANT);
  const shopDoor = grant.slice(grant.indexOf('async function openForTheBookedShop('));
  const taken = shopDoor.indexOf("if (closed && !closedByCancel) return 'removed_by_host';");
  assert.ok(taken > 0 && taken < shopDoor.indexOf('.insert('), 'a seat the hosts removed is written again by the next door');
  assert.ok(taken < shopDoor.indexOf('removed_at: null,'), 'a seat the hosts removed is revived');
  assert.match(shopDoor, /closedByCancel = closed\?\.role_subtype === 'wedding_planner_external' && closed\.removal_reason === 'booking_cancelled';/);
  // The emailed invite (a coordinator not on Setnayan): the same rule, and an unread list writes nothing.
  const invite = grant.slice(grant.indexOf('async function autoInviteCoordinator('), grant.indexOf('async function tellTheCoordinator('));
  assert.match(invite, /\(r\.removed_at === null \|\| r\.removal_reason !== 'booking_cancelled'\)/, 'an invite the hosts removed is sent again by the next door');
  assert.doesNotMatch(invite.slice(0, invite.indexOf('if (already) return')), /\.is\('removed_at', null\)/, 'the dedupe only sees live invites again');
  const unread = invite.indexOf('if (existingError) {');
  assert.ok(unread > 0 && unread < invite.indexOf('.insert({'), 'an unread invite list is read as "nobody is invited"');
});

// ── 5 · A NEW DOOR IS FOUND, NOT REMEMBERED ─────────────────────────────────────────────────────────────────────────

/** Source that writes a booked status into `event_vendors`, or calls something that does. */
const BOOKS: readonly RegExp[] = [
  /status:\s*(?:\(?\s*\w+\s*\?\s*'considering'\s*:\s*)?'(?:contracted|deposit_paid)'/,
  /status:\s*LOCKED_STATUS\b/,
  /\.from\('event_vendors'\)\s*\.update\(\{\s*status\s*[,}]/,
  /rpc\('(?:vendor_agree_to_lock|vendor_claim_locked_qr|answer_claim_access_request)'/,
  /\bbookVendorAtChatLock\(/,
];

/** Files that match and are NOT doors — each with its reason, and the reason is asserted in test 5, never trusted. */
const NOT_A_DOOR: Readonly<Record<string, string>> = {
  'lib/chat-lock-booking.server.ts': 'the write `lockDeal` makes — `lockDeal` is the door (test 3), and it is the only caller',
  'app/dashboard/[eventId]/budget/cost-actions.ts': 'a supplier typed on a cost: no shop and no contact, so there is nobody to seat',
  'lib/onboarding/venue-picks.ts': 'the couple’s own venue: a venue category, no shop and no contact — never a coordinator',
};

function walk(rel: string, out: string[] = []): string[] {
  for (const e of readdirSync(join(WEB, rel), { withFileTypes: true })) {
    const next = `${rel}/${e.name}`;
    if (e.isDirectory()) {
      // The labs under app/dev draw booked rows from fixtures; they write nothing.
      if (next !== 'app/dev' && e.name !== 'node_modules') walk(next, out);
    } else if (/\.tsx?$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name)) out.push(next);
  }
  return out;
}

test('5 · every file that books is a door of test 3 or a named exemption whose reason still holds', () => {
  const doorFiles = new Set(DOORS.map((d) => d.file));
  const found: string[] = [];
  for (const file of [...walk('app'), ...walk('lib')]) {
    const raw = readFileSync(join(WEB, file), 'utf8');
    // A cheap pre-filter on the raw text, then the real test on the code alone (a comment books nobody).
    if (!BOOKS.some((re) => re.test(raw))) continue;
    const src = stripComments(raw);
    if (BOOKS.some((re) => re.test(src))) found.push(file);
  }
  const unknown = found.filter((f) => !doorFiles.has(f) && !(f in NOT_A_DOOR));
  assert.deepEqual(
    unknown,
    [],
    'these files move an event_vendors row into BOOKED and are not a known door: add ONE line — openTheCoordinatorsSeatForBooking(…) — after the write and list the door in DOORS (or name in NOT_A_DOOR why it is not one)',
  );
  // Neither list goes stale: a door or an exemption that no longer books is taken off, not left to rot.
  for (const f of [...doorFiles, ...Object.keys(NOT_A_DOOR)]) assert.ok(found.includes(f), `${f} no longer books — take it off the list`);

  // The reasons, checked.
  assert.match(code('lib/chat-lock-booking.server.ts'), /export async function bookVendorAtChatLock\(/);
  const callers = found.filter((f) => f !== 'lib/chat-lock-booking.server.ts' && /\bbookVendorAtChatLock\(/.test(code(f)));
  assert.deepEqual(callers, ['app/_components/negotiation-actions.ts'], 'bookVendorAtChatLock has a caller that is not the lockDeal door');

  const cost = code('app/dashboard/[eventId]/budget/cost-actions.ts');
  const costFrom = cost.indexOf(".from('event_vendors')");
  const costInsert = cost.slice(costFrom, cost.indexOf(".select('vendor_id')", costFrom));
  assert.match(costInsert, /status: 'contracted'/);
  assert.doesNotMatch(costInsert, /contact_email|marketplace_vendor_id/, 'the budget’s typed supplier now carries a shop or a contact — it is a door: call the shared function');

  const venue = code('lib/onboarding/venue-picks.ts');
  const venueFrom = venue.indexOf('vendor: (manualVendorId: string) => ({');
  const venueRow = venue.slice(venueFrom, venue.indexOf('}),', venueFrom));
  assert.match(venueRow, /category: VENUE_CATEGORY\[venue\.role\],/, 'the own-venue row is no longer a venue category');
  assert.doesNotMatch(venueRow, /contact_email|marketplace_vendor_id/, 'the own-venue row now carries a shop or a contact — it is a door');
});

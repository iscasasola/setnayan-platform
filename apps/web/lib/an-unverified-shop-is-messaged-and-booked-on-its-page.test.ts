/**
 * 💬🧾 AN UNVERIFIED SHOP IS MESSAGED AND BOOKED ON ITS OWN PAGE — DECISION_LOG 2026-11-15 "🌐 AN UNVERIFIED SHOP HAS THE
 * SAME WEBSITE AS A VERIFIED ONE — … INQUIRE, ADD TO EVENT AND BOOKING (WITH THE BOOKING FEE)", and the owner the same
 * day: *"We allow booking. Since they can get bookings on their website"* · *"Yes, build booking"*. SUPERSEDES the
 * 2026-11-07 half that kept booking verified-only (this file was `an-unverified-shop-takes-messages-not-bookings`).
 *
 * What this holds:
 *   1. `shopTakesMessages` opens messaging for an undecided shop opened by its own link/QR, never for a demo,
 *      rejected, archived or fraud-frozen shop;
 *   2. `shopBookingRefusal` — the ONE booking rule every server door asks (`isMarketplaceVendorBookable`) — books an
 *      undecided shop that is not archived and not fraud-frozen, and still refuses rejected and demoted ones;
 *   3. on the shop page `bookable` IS that rule, every booking door (packages Lock, package asks, the waitlist, the
 *      booth) asks it, and Check a date stays verified-only (`dateCheckable`, the 15 Nov row's "no Check a date");
 *   4. the couple's thread head carries the one quiet "not yet verified" line, from a READ row, in-app only, and its ⓘ
 *      no longer says booking waits for verification.
 * The database half — the trigger books an undecided shop and refuses a rejected one — is
 * `tests/db/an-unverified-shop-is-booked-on-its-page-and-found-only-once-verified.db.test.ts`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { shopTakesMessages, threadShowsNotYetVerified, NOT_YET_VERIFIED_INFO, NOT_YET_VERIFIED_LINE } from './findable-shop';
import { isBookable, shopBookingRefusal } from './vendor-visibility';

const WEB = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const count = (src: string, needle: string) => src.split(needle).length - 1;

const FREE = { fraud_suspended_at: null, fraud_banned_at: null, fraud_tombstoned: false } as const;

test('shopTakesMessages: an undecided shop takes messages — locked or not — and a closed one never does', () => {
  const undecided = { public_visibility: 'hidden', verification_state: 'unverified', find_locked_at: null, ...FREE };
  assert.equal(shopTakesMessages(undecided, false), true, 'an unverified shop found in a list cannot be messaged');
  assert.equal(shopTakesMessages({ ...undecided, verification_state: 'pending_review' }, false), true);
  assert.equal(
    shopTakesMessages({ ...undecided, find_locked_at: '2026-11-07T00:00:00Z' }, false),
    true,
    'a locked unverified shop cannot be messaged from its own link/QR (ruling 3)',
  );
  assert.equal(shopTakesMessages({ ...undecided, is_demo: true }, false), false, 'a demo shop left its own rule');
  assert.equal(shopTakesMessages({ ...undecided, verification_state: 'rejected' }, false), false);
  assert.equal(shopTakesMessages({ ...undecided, verification_state: 'demoted' }, false), false);
  assert.equal(shopTakesMessages({ ...undecided, public_visibility: 'archived' }, false), false);
  assert.equal(shopTakesMessages({ ...undecided, fraud_suspended_at: '2026-11-01T00:00:00Z' }, false), false);
  assert.equal(shopTakesMessages({ ...undecided, fraud_tombstoned: true }, false), false);
  // A short select (fraud columns not read) fails CLOSED.
  assert.equal(shopTakesMessages({ public_visibility: 'hidden', verification_state: 'unverified' }, false), false);
  assert.equal(shopTakesMessages(null, false), false);
  // A bookable shop always takes messages, exactly as before.
  assert.equal(shopTakesMessages(null, true), true);
});

test('the one booking rule books an undecided shop that is open, and refuses the rest', () => {
  const open = { public_visibility: 'hidden', verification_state: 'unverified', fraud_suspended_at: null, fraud_banned_at: null };
  assert.equal(shopBookingRefusal(open), null, 'an unverified shop cannot be booked on its own page');
  assert.equal(shopBookingRefusal({ ...open, verification_state: 'pending_review' }), null);
  assert.equal(shopBookingRefusal({ ...open, public_visibility: 'archived' }), 'not_listed', 'a closed unverified shop can be booked');
  assert.equal(shopBookingRefusal({ ...open, public_visibility: undefined }), 'not_listed', 'an unread visibility books');
  assert.equal(shopBookingRefusal({ ...open, verification_state: 'rejected' }), 'not_verified');
  assert.equal(shopBookingRefusal({ ...open, verification_state: 'demoted' }), 'not_verified');
  assert.equal(shopBookingRefusal({ ...open, fraud_suspended_at: '2026-11-01T00:00:00Z' }), 'suspended');
  assert.equal(shopBookingRefusal({ ...open, fraud_banned_at: '2026-11-01T00:00:00Z' }), 'banned');
  assert.equal(shopBookingRefusal({ ...open, fraud_suspended_at: undefined }), 'suspended', 'an unread fraud column books');
  // A verified shop still needs to be listed; `isBookable` (visibility only) is now the Check a date gate alone.
  assert.equal(shopBookingRefusal({ ...open, verification_state: 'verified' }), 'not_listed');
  assert.equal(shopBookingRefusal({ ...open, verification_state: 'verified', public_visibility: 'verified' }), null);
  assert.equal(isBookable('verified'), true);
  assert.equal(isBookable('hidden'), false);
});

test('the ⓘ says an unverified shop can be booked — never that booking waits for verification', () => {
  assert.doesNotMatch(NOT_YET_VERIFIED_INFO, /booking opens once|once Setnayan verifies them|can.t be booked/i);
  assert.match(NOT_YET_VERIFIED_INFO, /book/i);
  assert.match(NOT_YET_VERIFIED_INFO, /booking fee/i);
});

test('threadShowsNotYetVerified: only a read, non-demo, not-verified row draws the line', () => {
  assert.equal(threadShowsNotYetVerified({ verification_state: 'unverified', is_demo: false }), true);
  assert.equal(threadShowsNotYetVerified({ verification_state: 'pending_review' }), true);
  assert.equal(threadShowsNotYetVerified({ verification_state: 'verified' }), false);
  assert.equal(threadShowsNotYetVerified({ verification_state: 'unverified', is_demo: true }), false);
  assert.equal(threadShowsNotYetVerified(null), false, 'an unreadable row claimed the shop is not verified');
  assert.equal(threadShowsNotYetVerified({}), false, 'a row without the state claimed the shop is not verified');
  assert.equal(NOT_YET_VERIFIED_LINE, 'This shop is not yet verified by Setnayan');
});

test('the shop page: message doors ask canMessage, booking doors ask the one rule, Check a date stays verified', () => {
  const page = read('app/v/[slug]/page.tsx');
  assert.equal(count(page, 'const canMessage = shopTakesMessages(vendor, bookable);'), 1, 'canMessage is not derived from the one helper');
  assert.equal(count(page, 'const bookable = isShopBookable(vendor);'), 1, 'bookable is not the one booking rule');
  assert.equal(count(page, 'const dateCheckable = isBookable(visibility) && bookable;'), 1, 'Check a date left the verified gate');

  // MESSAGE doors.
  // The inline composers and the reads only they used are gone (13 Nov 2026); the pop-up's event list is on canMessage.
  assert.match(page, /const inquireEventState = canMessage && viewerSignedIn \? await resolveAddShopToEvent\(slug\) : null;/, 'the pop-up\'s event list is not on canMessage');
  // 13 Nov 2026 ("Yes, only one"): no Inquire section and no hero Inquire — the ONE Inquire is in the action row below,
  // and the pop-up it opens is mounted on canMessage.
  assert.match(page, /\{canMessage \? \(\s*<InquireSheet\b/, 'the Inquire pop-up is not on canMessage');
  assert.match(page, /\{canMessage \? \(\s*<span className="inline-flex items-center gap-1">\s*<MessageCircle/, '"Replies in your Setnayan inbox" is not on canMessage');
  assert.match(page, /\{canMessage \? \(\s*<div\s+className="flex flex-wrap items-center gap-2 pt-4"/, 'the primary actions row is not on canMessage');

  // BOOKING doors.
  assert.match(page, /isComingSoon=\{isComingSoon \|\| !bookable\}/, 'the packages Lock button left the booking rule');
  assert.match(page, /\{dateCheckable \? \(\s*<CheckADateLink/, 'Check a date is not verified-only (15 Nov: no Check a date on the unverified page)');
  assert.match(page, /\{dateCheckable && search\.dates === '1' \? \(/, 'the Check a date sheet opens for an unverified shop');
  assert.match(page, /\{bookable && canShowBooth \? \(/, 'the booth link is not on bookable');
  assert.match(page, /if \(detailsEnabled && bookable && coupleEventId\)/, 'package asks are not on bookable');
  assert.match(page, /user &&\s*bookable &&\s*coupleEventDate/, 'the waitlist is not on bookable');
  // canMessage never reaches a booking component.
  for (const door of ['<LockPackageModal', '<CheckADateLink', 'joinVendorWaitlist']) {
    const at = page.indexOf(door);
    assert.ok(at > 0, `${door} is gone from the shop page — re-anchor this guard`);
  }
  assert.ok(!/canMessage[^\n]*(LockPackageModal|CheckADateLink|packageAskTargets|waitlist)/.test(page), 'canMessage opened a booking door');
});

test('the couple’s thread: the one quiet line rides the shipped head’s `below` slot, from a read row, in-app only', () => {
  const thread = read('app/dashboard/[eventId]/messages/[threadId]/page.tsx');
  assert.equal(
    count(thread, 'below={shopNotYetVerified ? <NotYetVerifiedThreadLine /> : null}'),
    1,
    'the thread head does not carry the not-yet-verified line in its below slot',
  );
  const head = thread.indexOf('<ChatThreadHead');
  const slot = thread.indexOf('below={shopNotYetVerified');
  const end = thread.indexOf('actions={', head);
  assert.ok(head > 0 && slot > head && slot < end, 'the line is not inside the shipped ChatThreadHead');
  assert.match(
    thread,
    /const shopNotYetVerifiedRead = readThreadShopNotYetVerified\(decisionAdmin, thread\.vendor_profile_id\);/,
    'the thread does not read the shop state through the one reader',
  );
  assert.match(thread, /shopNotYetVerifiedRead,\s*\]\);/, 'the read is not part of the one wait');
  const reader = read('lib/not-yet-verified.server.ts');
  assert.match(reader, /\.select\('verification_state, is_demo'\)/, 'the reader reads more than the state and the demo flag');
  assert.match(reader, /return threadShowsNotYetVerified\(data\);/, 'the line is not decided by the one predicate');
  assert.match(reader, /if \(error\) \{\s*logQueryError\('readThreadShopNotYetVerified'[\s\S]{0,160}return false;/, 'an unreadable row is not logged and drawn as nothing');

  const line = read('app/_components/chat/not-yet-verified-line.tsx');
  assert.match(line, /<InfoTip label=\{NOT_YET_VERIFIED_LINE\}/, 'the line is not the shared words behind the one ⓘ');
  assert.match(line, /\{NOT_YET_VERIFIED_INFO\}/, 'the ⓘ does not carry the shared details');
  for (const src of [line, thread, reader]) {
    assert.ok(!/resend|sendEmail|emailTemplate/i.test(src), 'the not-yet-verified notice reached an email path');
  }
});

test('the server booking doors ask the one booking rule', () => {
  for (const rel of [
    'app/dashboard/[eventId]/vendors/packages/actions.ts',
    'app/dashboard/[eventId]/vendors/actions.ts',
  ]) {
    assert.ok(read(rel).includes('isMarketplaceVendorBookable('), `${rel} no longer asks isMarketplaceVendorBookable`);
  }
  // The inquiry path saves the shop as 'considering' only — never a booking status the trigger would refuse.
  const inquiry = read('app/v/[slug]/inquiry-actions.ts');
  assert.match(inquiry, /status: 'considering',/, 'the inquiry no longer saves the shop as considering');
  assert.ok(!/status: '(contracted|deposit_paid|delivered|complete)'/.test(inquiry), 'the inquiry path writes a booking status');
});

test('the Book press asks the server — no client short-circuit refuses an unverified shop before it is asked', () => {
  // AccordionLockButton (every card's Book) used to stop an unverified shop in the browser with "completing
  // verification and can't be booked just yet" and draw a "Verifying — can't book yet" pill, never reaching the
  // server that now books it.
  const lock = read('app/dashboard/[eventId]/vendors/_components/accordion-lock.tsx');
  assert.doesNotMatch(lock, /isVerified === false/, 'the Book press refuses an unverified shop on the client again');
  assert.doesNotMatch(lock, /Verifying — can/, 'the "can’t book yet" pill is back on the Book button');
});

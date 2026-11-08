/**
 * 💬 AN UNVERIFIED SHOP TAKES MESSAGES, NEVER BOOKINGS — DECISION_LOG 2026-11-07 rulings (1) and (4).
 *
 * Owner: *"they will be found for their first inquiry"* — the first inquiry is a couple's first MESSAGE, so a shop
 * Setnayan has not decided yet must be message-able from its page — and *"When they chat the business. we will also
 * message them that this shop is not yet verified"*. Booking and payment stay verified-only.
 *
 * What this holds, so the two halves cannot drift into each other:
 *   1. `shopTakesMessages` opens messaging for an undecided shop (found in a list OR, once locked, by its own
 *      link/QR — ruling (3)), never for a demo, rejected, archived or fraud-frozen shop, and never widens booking;
 *   2. `isBookable` is still verified-only;
 *   3. on the shop page every MESSAGE door asks `canMessage`, and every BOOKING door (packages Lock, Check a date,
 *      the booth, the waitlist, package asks) still asks `bookable`;
 *   4. the couple's thread head carries the one quiet "not yet verified" line in the shipped head's `below` slot,
 *      drawn only from a READ row (an unreadable row draws nothing), and it is in-app only — no email;
 *   5. the server booking doors still refuse an unverified shop (`isMarketplaceVendorBookable`).
 * The database half — a real couple session messages, the lock is stamped, the booking is refused — is
 * `tests/db/an-unverified-shop-is-findable-until-its-first-inquiry.db.test.ts`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { shopTakesMessages, threadShowsNotYetVerified, NOT_YET_VERIFIED_LINE } from './findable-shop';
import { isBookable } from './vendor-visibility';

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

test('isBookable is still verified-only — messaging never widened booking', () => {
  assert.equal(isBookable('verified'), true);
  for (const v of ['hidden', 'archived', 'coming_soon', null, undefined] as const) {
    assert.equal(isBookable(v as never), false, `isBookable(${String(v)}) opened booking`);
  }
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

test('the shop page: message doors ask canMessage, booking doors keep bookable', () => {
  const page = read('app/v/[slug]/page.tsx');
  assert.equal(count(page, 'const canMessage = shopTakesMessages(vendor, bookable);'), 1, 'canMessage is not derived from the one helper');
  assert.equal(count(page, 'const bookable = isBookable(visibility);'), 1, 'bookable no longer comes from isBookable');

  // MESSAGE doors.
  assert.match(page, /const showInquiryComposer =\s*canMessage && coupleEventId !== null/, 'the composer is not on canMessage');
  assert.match(page, /anonComposerServices: AnonComposerService\[\] =\s*canMessage && coupleEventId === null/, 'the signed-out composer is not on canMessage');
  assert.match(page, /\{canMessage \? 'Inquire' : 'Not yet bookable'\}/, 'the get-in-touch heading is not on canMessage');
  assert.match(page, /\{canMessage \? \(\s*<a\s+href="#get-in-touch"\s+className="mt-5/, 'the cinematic hero Inquire is not on canMessage');
  assert.match(page, /\{canMessage \? \(\s*<span className="inline-flex items-center gap-1">\s*<MessageCircle/, '"Replies in your Setnayan inbox" is not on canMessage');
  assert.match(page, /\{canMessage \? \(\s*<div\s+className="flex flex-wrap items-center gap-2 pt-4"/, 'the primary actions row is not on canMessage');

  // BOOKING doors.
  assert.match(page, /isComingSoon=\{isComingSoon \|\| !bookable\}/, 'the packages Lock button can show on an unverified shop');
  assert.match(page, /\{bookable \? \(\s*<CheckADateLink/, 'Check a date is not on bookable');
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

test('the server booking doors still refuse an unverified shop', () => {
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

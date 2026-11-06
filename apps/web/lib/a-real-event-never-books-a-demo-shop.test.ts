/**
 * EVERY WRITE THAT PAIRS AN EVENT WITH A SHOP ASKS THE DEMO RULE FIRST — and the database holds it underneath.
 *
 * Owner, DECISION_LOG 2026-11-06 "DEMO SHOPS + DEMO EVENTS": demo shops show publicly, marked "(DEMO ONLY)", and
 * *"a couple can never book or pay a demo shop"*; "DEMO CATALOGUE — scope": *"the demo events can only see demo
 * suppliers"*. One rule (`lib/demo-scope.ts`): an event and a shop meet only when `events.is_sample` equals
 * `vendor_profiles.is_demo`.
 *
 * This guard pins the APP half per function, not per file: each write path below must call `demoBookingRefusal` (or
 * `bookingScopeRefusal` on rows it already read) INSIDE the named function, before its write. A file-level match could
 * not say which function still holds the call. It also pins that the migration puts the trigger on every table the app
 * writes pairings into, so the two halves cannot drift apart. The database half is exercised for real by
 * `tests/db/a-real-event-never-books-a-demo-shop.db.test.ts`.
 *
 * It replaces `scripts/check-no-demo-in-prod.mjs` (retired 2026-11-06): that script hard-failed on ANY demo shop from
 * 2026-12-01, which the owner's ruling made wrong — demo shops are permanent. What must never exist is a real event
 * paired with one (`scripts/check-no-demo-cross-booking.mjs` audits production for exactly that).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const WEB = path.resolve(import.meta.dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(WEB, rel), 'utf8');

/** The body of one top-level function: from its declaration to the next top-level declaration. */
function bodyOf(src: string, fn: string): string {
  const start = src.search(new RegExp(`^(export )?async function ${fn}\\b`, 'm'));
  assert.ok(start >= 0, `function ${fn} not found — renamed? point this guard at its new name`);
  const rest = src.slice(start + 1);
  const next = rest.search(/^(export |async function |function |const |type |interface )/m);
  return next < 0 ? src.slice(start) : src.slice(start, start + 1 + next);
}

const ASKS = /\b(demoBookingRefusal|bookingScopeRefusal)\(/;

/** [file, function] — every write path that pairs an event with a marketplace shop. */
const WRITE_PATHS: ReadonlyArray<readonly [string, string, string]> = [
  ['app/dashboard/[eventId]/vendors/actions.ts', 'finalizeVendor', 'Lock / book a supplier'],
  ['app/dashboard/[eventId]/vendors/actions.ts', 'attachMarketplaceVendorToCategory', 'add a marketplace shop to a row'],
  ['app/dashboard/[eventId]/vendors/actions.ts', 'recordDeposit', 'record a payment to the shop'],
  ['app/dashboard/[eventId]/vendors/actions.ts', 'raiseChangeOrder', 'money against a booked shop'],
  ['app/dashboard/[eventId]/vendors/packages/actions.ts', 'lockPackage', "book a shop's package"],
  ['app/dashboard/[eventId]/vendors/_actions/unlock-category.ts', 'unlockCategoryWithInquiry', 'add + ask shops for a category'],
  ['app/dashboard/[eventId]/wizard-actions.ts', 'completeVendorPickFromMarketplace', "the wizard's Lock this vendor"],
  ['app/v/[slug]/inquiry-actions.ts', 'startServiceInquiry', 'message a shop from its page'],
  ['app/dashboard/[eventId]/messages/actions.ts', 'startThreadByVendorEmail', 'message a shop by email'],
  ['app/_components/negotiation-actions.ts', 'lockDeal', 'a chat Deal is a booking'],
  ['app/vendor-dashboard/proposals/actions.ts', 'createProposal', 'a shop quotes an event'],
  ['lib/proposal-send.ts', 'gateVendorProposalThread', 'a shop quotes in chat (both senders pass this gate)'],
  ['app/(shell)/explore/actions.ts', 'saveVendorToPicks', 'Save a shop from Explore into the event'],
  ['app/onboarding/wedding/actions.ts', 'commitOnboardingWedding', "onboarding's venue shortlist"],
];

test('every write path that pairs an event with a shop asks the demo rule inside its own function', () => {
  const missing: string[] = [];
  for (const [file, fn, what] of WRITE_PATHS) {
    const src = read(file);
    assert.match(src, /from '@\/lib\/demo-scope'/, `${file} does not import the demo rule`);
    if (!ASKS.test(bodyOf(src, fn))) missing.push(`${file} · ${fn} (${what})`);
  }
  console.log(`${WRITE_PATHS.length - missing.length}/${WRITE_PATHS.length} write paths ask the demo rule`);
  assert.deepEqual(missing, [], 'a write path pairs an event with a shop without asking lib/demo-scope.ts');
});

test('both chat quote senders pass through the gate that asks', () => {
  const src = read('lib/proposal-send.ts');
  for (const fn of ['sendProposalCore', 'sendCustomProposalCore']) {
    assert.match(bodyOf(src, fn), /await gateVendorProposalThread\(/, `${fn} no longer passes the demo-checking gate`);
  }
});

test("the couple's purchase at checkout pairs no shop, and the pay sheet writes nothing — so neither needs the rule", () => {
  // Pinned so the reason stays true: if checkout ever bills a shop, or the pay sheet ever writes, this goes red and the
  // path joins WRITE_PATHS above.
  const checkout = bodyOf(read('app/dashboard/[eventId]/checkout/actions.ts'), 'submitOrderAction');
  assert.match(checkout, /vendorProfileId: null/, 'checkout now mints an order against a shop — add the demo rule');
  const paySheet = read('app/dashboard/[eventId]/vendors/_actions/pay-sheet.ts');
  assert.doesNotMatch(paySheet, /\.(insert|upsert|update|delete)\(/, 'the pay sheet now writes — add the demo rule');
});

test('the migration puts the trigger on every table those paths write a pairing into', () => {
  const dir = path.resolve(WEB, '../../supabase/migrations');
  const file = fs.readdirSync(dir).find((f) => f.endsWith('_a_real_event_never_books_a_demo_shop.sql'));
  assert.ok(file, 'the a_real_event_never_books_a_demo_shop migration is gone');
  const sql = fs.readFileSync(path.join(dir, file!), 'utf8');
  const covered = new Map(
    [...sql.matchAll(/ON public\.(\w+)\s+FOR EACH ROW EXECUTE FUNCTION public\.refuse_demo_cross_booking\(([^)]*)\)/g)].map(
      (m) => [m[1]!, m[2]!.split(',').map((s) => s.trim().replace(/'/g, ''))],
    ),
  );
  const expected: Record<string, string[]> = {
    event_vendors: ['event_id', 'marketplace_vendor_id', 'linked_vendor_profile_id'],
    chat_threads: ['event_id', 'vendor_profile_id'],
    vendor_proposals: ['event_id', 'vendor_profile_id'],
    orders: ['event_id', 'vendor_profile_id'],
    booking_fee_charges: ['event_id', 'vendor_profile_id'],
    vendor_contracts: ['event_id', 'vendor_profile_id'],
    vendor_payment_asks: ['event_id', 'vendor_profile_id'],
  };
  assert.deepEqual(Object.fromEntries(covered), expected);
  // The words the app translates (lib/demo-scope.ts demoRefusalFromDbError) are the words the trigger raises.
  assert.match(sql, /'demo_cross_booking: demo shop on a real event'/);
  assert.match(sql, /'demo_cross_booking: real shop on a demo event'/);
});

test('the retired Dec-1 demo deadline is gone, and the cross-booking audit replaced it', () => {
  assert.equal(fs.existsSync(path.join(WEB, 'scripts/check-no-demo-in-prod.mjs')), false, 'the retired script is back');
  assert.doesNotMatch(read('lib/demo-mode.ts'), /export const DEMO_MODE_CLEANUP_DEADLINE/, 'the Dec-1 cleanup deadline is back');
  const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
  assert.equal(pkg.scripts['check:no-demo-in-prod'], undefined);
  assert.equal(pkg.scripts['check:no-demo-cross-booking'], 'node scripts/check-no-demo-cross-booking.mjs');
});

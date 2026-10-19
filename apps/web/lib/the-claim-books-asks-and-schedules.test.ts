/**
 * A CLAIMED SUPPLIER ARRIVES BOOKED IF PAID, ASKS FOR ACCESS ON ITS OWN, AND
 * SHOWS ON THE SCHEDULE AS BOOKED OR SHORTLISTED (owner 2026-10-20).
 *
 * The three properties, each held by its MECHANISM, not by a phrasing:
 *
 *   A · BOOKED IF PAID — the resolver decides it (pure cases below), and every
 *       couple read that draws a supplier's standing passes its rows through it
 *       at the LOAD: the Suppliers page (`fetchEventVendors`), Budget
 *       (`fetchBudgetSnapshot` + the money resolver's I/O wrapper), Home
 *       (`EventDashboard`), the schedule (`readScheduleSuppliers`). A loader
 *       that reads `event_vendors.status` for those screens without it would
 *       show a paid supplier as not booked on one screen and booked on another.
 *   B · ASKS FOR ACCESS — the approval card is drawn on Event Details › Event
 *       access AND the Access requests page, from ONE read; Home's doorway
 *       counts the same read. (The claim/bond half is
 *       `the-claim-links-through-one-call.test.ts`; the SQL is the db test.)
 *   C · THE SCHEDULE NAMES THE SUPPLIER — by shop name + standing, through one
 *       helper, on the item's sheet and on the rail row.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import {
  isBookedSupplier,
  paidSupplierIds,
  supplierStandingWord,
  withBookedByPayment,
  withEmbeddedPayments,
} from './booked-by-payment';
import { scheduleSuppliersFrom } from './schedule-suppliers';
import { claimAskLine, claimAsksDoorwayTitle } from './claim-access-asks';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

// ── A · the resolver ───────────────────────────────────────────────────────
const manual = { vendor_id: 'm', status: 'shortlisted', marketplace_vendor_id: null, manual_vendor_id: 'card' };
const claimed = { vendor_id: 'c', status: 'considering', marketplace_vendor_id: 'shop', manual_vendor_id: 'card' };
const found = { vendor_id: 'f', status: 'considering', marketplace_vendor_id: 'shop2', manual_vendor_id: null };

test('A1 · a hand-added supplier with a payment is booked; without one it is as filed', () => {
  const paid = paidSupplierIds([{ vendor_id: 'm' }]);
  assert.equal(isBookedSupplier(manual, paid), true);
  assert.equal(supplierStandingWord(manual, paid), 'Booked');
  assert.equal(isBookedSupplier(manual, new Set()), false);
  assert.equal(supplierStandingWord(manual, new Set()), 'Shortlisted');
});

test('A2 · it stays booked after the claim links it to the shop (the contact card rides along)', () => {
  assert.equal(isBookedSupplier(claimed, paidSupplierIds([{ vendor_id: 'c' }])), true);
});

test('A3 · a supplier found on Setnayan is never booked by a payment alone (the supplier agrees)', () => {
  assert.equal(isBookedSupplier(found, paidSupplierIds([{ vendor_id: 'f' }])), false);
});

test('A4 · a payment the supplier refused does not book', () => {
  assert.equal(isBookedSupplier(manual, paidSupplierIds([{ vendor_id: 'm', payment_refused_at: '2027-01-01' }])), false);
});

test('A5 · the load pass reads the status as booked and keeps the stored one; others are untouched', () => {
  const [m, f] = withBookedByPayment([manual, found], [{ vendor_id: 'm' }, { vendor_id: 'f' }]);
  assert.equal(m!.status, 'contracted');
  assert.equal(m!.stored_status, 'shortlisted');
  assert.equal(f, found, 'a row the payment does not book must come back as the same object');
  const [e] = withEmbeddedPayments([{ ...manual, vendor_payments: [{ payment_refused_at: null }] }]);
  assert.equal(e!.status, 'contracted');
  const [booked] = withBookedByPayment([{ ...manual, status: 'deposit_paid' }], [{ vendor_id: 'm' }]);
  assert.equal(booked!.status, 'deposit_paid', 'a real booking is never rewritten');
});

const LOADERS: Array<[string, string, RegExp]> = [
  ['Suppliers page · fetchEventVendors', 'lib/vendors.ts', /export async function fetchEventVendors[\s\S]*?withBookedByPayment\(/],
  ['Budget · fetchBudgetSnapshot', 'lib/budget.ts', /export async function fetchBudgetSnapshot[\s\S]*?withBookedByPayment\(/],
  ['Budget · the money resolver', 'lib/budget-truth.ts', /vendorRows = withBookedByPayment\(vendorRows, paymentRows\)/],
  ['Home · EventDashboard', 'app/dashboard/[eventId]/_components/event-dashboard.tsx', /const eventVendors = withEmbeddedPayments\(/],
  ['Schedule · scheduleSuppliersFrom', 'lib/schedule-suppliers.ts', /supplierStandingWord\(r, paid\)/],
  ['Schedule · readScheduleSuppliers', 'lib/schedule-suppliers-read.ts', /return scheduleSuppliersFrom\(rows, names\)/],
];

test('A6 · every couple read that draws a supplier\'s standing goes through the resolver', () => {
  for (const [what, file, mark] of LOADERS) assert.match(read(file), mark, `${what} reads the status without the booked-if-paid resolver`);
  // The payments it needs are actually READ, not assumed.
  assert.match(read('lib/vendors.ts'), /from\('event_vendor_payments'\)\.select\('vendor_id,payment_refused_at'\)/);
  assert.match(read('app/dashboard/[eventId]/_components/event-dashboard.tsx'), /\$\{BOOKED_BY_PAYMENT_EMBED\}/);
  assert.match(read('lib/budget-truth.ts'), /amount_php,paid_at,payment_refused_at/);
  assert.match(read('lib/budget.ts'), /created_at,payment_refused_at/);
});

// ── B · the approval card ──────────────────────────────────────────────────
test('B1 · the card is drawn on Event access and on Access requests, from one read', () => {
  const details = read('app/dashboard/[eventId]/details/page.tsx');
  assert.match(details, /readClaimAccessAsks\(supabase, eventId\)/, 'Event Details no longer reads who is waiting');
  assert.match(details, /claims=\{claims\}/, 'Event access is not handed who is waiting');
  assert.match(read('app/dashboard/[eventId]/details/_components/people-with-access.tsx'), /<ClaimAccessCard /);
  const page = read('app/dashboard/[eventId]/access-requests/page.tsx');
  assert.match(page, /readClaimAccessAsks\(supabase, eventId\)/);
  assert.match(page, /<ClaimAccessCard /);
  assert.match(read('app/dashboard/[eventId]/_components/access-requests-doorway.tsx'), /readClaimAccessAsks\(supabase, eventId\)/, "Home's doorway does not count who joined from the link");
});

test('B2 · the card offers exactly Approve and Decline, each its own answer', () => {
  const card = read('app/dashboard/[eventId]/access-requests/_components/claim-access-card.tsx');
  assert.match(card, /onClick=\{\(\) => answer\(true\)\}[\s\S]*?Approve/);
  assert.match(card, /onClick=\{\(\) => answer\(false\)\}[\s\S]*?Decline/);
  assert.match(card, /answerClaimAccess\(eventId, ask\.requestId, approve\)/);
});

test('B3 · the card says what Approve gives', () => {
  assert.equal(claimAskLine({ coordinator: true, categoryLabel: 'Coordinator' }), 'Approve to give them the same access as you.');
  assert.match(claimAskLine({ coordinator: false, categoryLabel: 'Photographer' }), /booked photographer/);
  assert.equal(claimAsksDoorwayTitle([{ name: 'The Wedding Planner' }]), 'The Wedding Planner joined from your link');
  assert.equal(claimAsksDoorwayTitle([]), null);
});

// ── C · the schedule ───────────────────────────────────────────────────────
test('C1 · an item names its supplier by shop name and standing — booked first', () => {
  const out = scheduleSuppliersFrom(
    [
      { vendor_id: 'a', vendor_name: 'Typed Name', status: 'shortlisted', marketplace_vendor_id: 'shopA', manual_vendor_id: 'card', vendor_payments: [] },
      { vendor_id: 'b', vendor_name: 'Tita Lorna', status: 'considering', marketplace_vendor_id: null, manual_vendor_id: 'card2', vendor_payments: [{ payment_refused_at: null }] },
    ],
    new Map([['shopA', 'The Wedding Planner']]),
  );
  assert.deepEqual(out, [
    { vendor_id: 'b', vendor_name: 'Tita Lorna', standing: 'Booked' },
    { vendor_id: 'a', vendor_name: 'The Wedding Planner', standing: 'Shortlisted' },
  ]);
});

test('C2 · the schedule reads its suppliers through that, and draws them with one helper', () => {
  assert.match(read('app/dashboard/[eventId]/schedule/page.tsx'), /readScheduleSuppliers\(supabase, eventId\)/);
  const inspector = read('app/dashboard/[eventId]/schedule/_components/moment-inspector.tsx');
  assert.match(inspector, /\{supplierOnItem\(s\)\}/, "the item's sheet no longer shows the standing");
  assert.match(read('app/dashboard/[eventId]/schedule/_components/day-rail.tsx'), /data-rail-supplier[\s\S]{0,200}supplierOnItem\(s\)/, 'the rail row no longer names the supplier');
  assert.match(read('lib/schedule-suppliers-read.ts'), /\.is\('archived_at', null\)/, 'a merged (archived) record is offered again');
  assert.match(read('lib/schedule-suppliers-read.ts'), /\$\{BOOKED_BY_PAYMENT_EMBED\}/, 'the schedule reads no payments, so nothing is booked by one');
});

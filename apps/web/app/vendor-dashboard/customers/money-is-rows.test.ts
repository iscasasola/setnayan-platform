/**
 * money-is-rows.test.ts — Customers › Money (S-PR4): payday + earnings + the booking-fee bills as ONE segment of rows.
 *
 * Record: corpus `SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md` § 2 (Customers: "`#bookings` BookingsSurface ·
 * `#payday` PaydaySurface · `earnings/surface.tsx` — Merge into Customers › Money: Received · To come in · one meter;
 * 'Next in ▾' rows …; 'Setnayan' group = booking-fee bills + 'This year' fold (months). Legacy payouts → inside 'This
 * year' only if any exist") · § 6 S-PR4 · § 10 ("Log a payment: Money › row › Log a payment = 3") · prototype frames
 * 05 · 30 · 15 · owner look calls 2026-10-12 ("APPROVE ALL": 1 every main is terracotta · 7 badges have no border ·
 * 8 lists are hairline rows · 11 buying is confirm + pay) and 2026-10-13 (ONE terracotta main per screen — the audit
 * found two green mains on Money; read-only rows are not buttons) · control templates round 2 kind 26 / kind 32 (no
 * frames; a meter fills with its number beside it).
 *
 *   1 · ONE SEGMENT — Money is the segment switch's last branch and draws the Money view; the old Payday and Earnings
 *       surfaces are gone, Shop no longer mounts a second copy, and every old address lands on Money.
 *   2 · ONE MAIN — the thumb row's Log a payment is the only main on the screen; the fee row's Pay is not one, and
 *       the view itself holds no button at all (its rows are rows).
 *   3 · ROWS, NOT BOXES — every list on Money is the shared hairline row; no tile, no framed card.
 *   4 · ONE DROPDOWN — "Next in ▾" is one PickMenu over the three windows, each its own address.
 *   5 · THE FEE IS THE FEE LANE'S — Money words and sums no fee: the rows are `BookingFeeBills` / `WaivedFeeRows`
 *       (compact), their words from `feeDueCopy` / `waivedFeeCopy`; the compact bill keeps its door to the pay page.
 *   6 · THE SHIPPED DOOR — Log a payment opens the conversation's payment band (`#pending-payments`), the customer
 *       card's own "Log payment" place; no second form.
 *   7 · ONLY WHEN PRESENT — the pre-2026 payout records draw only when there are any; an unread list is said.
 *   8 · NOTHING LOST — the Bookings queue (the only home of "Add to prep schedule") is a Money fold, loaded on open.
 *
 * 🪤 `globalThis.React` before the DYNAMIC import — tsconfig sets `"jsx": "preserve"`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { MONEY_WINDOWS } from '@/lib/vendor-money';
import { feeDueCopy, waivedFeeCopy, type DueFeeBill } from '@/lib/booking-fee-disclosure';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = dirname(fileURLToPath(import.meta.url));
const VD = join(HERE, '..');
const APP = join(VD, '..');
const code = (abs: string) => stripComments(readFileSync(abs, 'utf8'));
const PAGE = code(join(HERE, 'page.tsx'));
const SEGMENT = code(join(HERE, '_components', 'money-segment.tsx'));
const VIEW = code(join(HERE, '_components', 'money-view.tsx'));
const LOG = code(join(HERE, '_components', 'money-log.tsx'));
const FIGURES = code(join(HERE, '_components', 'money-figures.tsx'));
const NOTICE = code(join(APP, '_components', 'booking-fee-notice.tsx'));
const count = (s: string, re: RegExp) => (s.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)) ?? []).length;

/** The compact branch of a fee component — from `if (compact) {` to the end of its first `return (…);`. */
function compactBranch(src: string, fn: string): string {
  const body = src.slice(src.indexOf(`export function ${fn}(`));
  const at = body.indexOf('if (compact) {');
  assert.ok(at > 0, `${fn} lost its compact branch`);
  const rest = body.slice(at);
  return rest.slice(0, rest.indexOf(');\n') + 3);
}

// SABOTAGE: mount `<PaydaySurface />` back under Money → RED (the file is gone; the import cannot resolve, and the
// page names it). SABOTAGE: send /earnings back to Shop → RED.
test('1 · Money is one segment: the old surfaces are gone, Shop draws no copy, every old address lands here', () => {
  assert.match(PAGE, /<CustomersDates search=\{search\} \/>[\s\S]{0,120}\) : \(\s*<div id="payday"[^>]*>\s*<CustomersMoney search=\{sp\} \/>/);
  assert.equal(count(PAGE, /<CustomersMoney\b/), 1);
  assert.doesNotMatch(PAGE, /PaydaySurface|EarningsSurface/, 'Customers still draws an old money surface');
  for (const gone of ['payday/surface.tsx', 'earnings/surface.tsx', 'payday/_components/payday-summary.tsx']) {
    assert.ok(!existsSync(join(VD, gone)), `${gone} is back — Money is the one money page`);
  }
  assert.doesNotMatch(code(join(VD, 'shop', 'page.tsx')), /<EarningsSurface\b|earnings\/surface/, 'Shop draws a second copy of the money');
  assert.match(code(join(VD, 'earnings', 'page.tsx')), /qs\.set\('seg', 'money'\)[\s\S]*redirect\(`\/vendor-dashboard\/customers\?/, '/earnings does not land on Money');
  assert.match(code(join(VD, 'payday', 'page.tsx')), /qs\.set\('tab', 'payday'\)[\s\S]*redirect\(`\/vendor-dashboard\/customers\?/, '/payday does not land on Money');
});

// SABOTAGE: give the compact fee row's Pay `main` (or tone="brand") → RED. SABOTAGE: add an ActionButton to the view → RED.
test('2 · ONE main on Money: Log a payment; the fee row’s Pay is not one, and the view holds no button', () => {
  assert.equal(count(LOG, /<ActionButton\b/), 1);
  assert.match(LOG, /<ActionButton\s+tone="brand"\s+main\s+icon=\{Check\}\s+label="Log a payment"/, 'Log a payment is not the screen’s main');
  for (const src of [VIEW, FIGURES]) {
    assert.doesNotMatch(src, /<ActionButton\b|<button\b|<SupplierSubmit\b/, 'a read-only Money row became a button');
  }
  const bill = compactBranch(NOTICE, 'BookingFeeBillRow');
  assert.match(bill, /<ActionButton\s+tone="neutral"/, 'the compact fee row’s Pay must be neutral — the screen has one main');
  assert.doesNotMatch(bill, /\bmain\b/, 'the compact fee row’s Pay became a second main');
  assert.match(bill, /href=\{vendorBookingFeePayPath\(bill\.orderId\)\}/, 'the compact fee row lost its door to the pay page');
  // The waived row has nothing to pay, so nothing to press.
  assert.doesNotMatch(compactBranch(NOTICE, 'WaivedFeeRows'), /<ActionButton\b|<Link\b|<button\b/);
  // Exactly one SupplierThumbRow on Money, holding the log.
  assert.match(SEGMENT, /<SupplierThumbRow name="money" label="Money actions">\s*<MoneyLog customers=\{logCustomers\} \/>\s*<\/SupplierThumbRow>/);
});

// SABOTAGE: wrap the rows in `sn-tile` / a bordered rounded box → RED.
test('3 · rows, not boxes: every list is the shared hairline row; no tile, no framed card', () => {
  assert.ok(count(VIEW, /<DatesRow\b/) >= 6, 'Money’s lists are not the shared hairline row');
  assert.doesNotMatch(VIEW, /sn-tile|sn-row|shopCardClass|rounded-(xl|2xl) border|<article\b/, 'a framed box crept back onto Money');
  // The two figures count to their value with the exact peso (never the rounded counter format), and the meter fills.
  assert.match(FIGURES, /format=\{\(n\) => formatPhp\(n === Math\.round\(value\) \? value : n\)\}/);
  assert.doesNotMatch(FIGURES, /format="peso"/, 'the counter’s rounded peso hides centavos on money owed');
  assert.match(VIEW, /<MoneyFill value=\{totals\.pct\}/);
});

// SABOTAGE: draw the three windows as a pill row → RED.
test('4 · one dropdown: "Next in ▾" over the three windows, each its own address', () => {
  assert.deepEqual([...MONEY_WINDOWS], ['month', 'next', 'all']);
  assert.equal(count(VIEW, /<CustomersPick\b/), 1);
  assert.match(VIEW, /MONEY_WINDOWS\.map\(\(w\) => \(\{ key: w, label: MONEY_WINDOW_LABEL\[w\], href: data\.windowHref\(w\) \}\)\)/);
  assert.doesNotMatch(VIEW, /<PillTrack\b|<PillLink\b/, 'a set of choices is ONE dropdown, never a pill row');
  assert.match(SEGMENT, /`\$\{HUB\}\?seg=money&next=\$\{window\}`/);
});

// SABOTAGE: type a peso figure or call feePesos/bookingFeePhp in the Money files → RED.
test('5 · the fee is the fee lane’s: Money words and sums no fee, and shows every bill it read', () => {
  for (const [name, src] of [['segment', SEGMENT], ['view', VIEW], ['log', LOG]] as const) {
    assert.doesNotMatch(src, /feePesos|bookingFeePhp|totalDuePhp|amountPhp \*|₱\d/, `the Money ${name} words or sums a fee itself`);
  }
  assert.match(VIEW, /<BookingFeeBills compact bills=\{fees\.bills\} copyFor=\{fees\.copyFor\} \/>/);
  assert.match(VIEW, /<WaivedFeeRows compact charges=\{fees\.waived\.slice\(0, WAIVED_SHOWN\)\} \/>/);
  assert.match(SEGMENT, /copyFor: \(b\) => feeDueCopy\(b, manilaToday\(\), feeEnforced\)/);
  // An unread bill list is a "couldn't load" row, never "you owe nothing".
  assert.match(VIEW, /\{fees\.billsRead \? \(\s*<BookingFeeBills/);
  assert.match(SEGMENT, /billsRead: feeBillsRead !== FEE_BILLS_UNREADABLE/);
});

// The compact rows, painted: the bill's own headline (amount + date in it) and Pay; the waived one names its amount.
test('5b · the compact fee rows say the fee lane’s sentence, and the bill keeps its pay door', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { BookingFeeBills, WaivedFeeRows } = await import('@/app/_components/booking-fee-notice');
  const bill: DueFeeBill = { orderId: 'S89O-TEST000001', amountPhp: 837.5, eventId: 'e1', coupleName: 'Cruz', dueOn: '2026-10-10' };
  const html = renderToStaticMarkup(React.createElement(BookingFeeBills, { compact: true, bills: [bill], copyFor: (b: DueFeeBill) => feeDueCopy(b, '2026-10-02', true) }));
  assert.ok(html.includes(feeDueCopy(bill, '2026-10-02', true).headline.replace(/&/g, '&amp;')), 'the compact row reworded the bill');
  assert.match(html, /₱837\.50/, 'the exact peso did not reach the compact row');
  assert.match(html, /data-fee-bill-compact=""/);
  assert.match(html, /href="\/vendor-dashboard\/booking-fees\/[^"]*S89O-TEST000001/);
  const waived = { chargeId: 'c1', eventId: 'e1', coupleName: 'Cruz', computedPhp: 2500, ordinal: 2, waivedOn: '2026-09-02' };
  const w = renderToStaticMarkup(React.createElement(WaivedFeeRows, { compact: true, charges: [waived] }));
  assert.ok(w.includes(waivedFeeCopy(waived).headline.replace(/&/g, '&amp;')));
  assert.match(w, />Waived</);
});

// SABOTAGE: point a customer at `/vendor-dashboard/clients/<id>?tab=payments` only (no thread door) → RED.
test('6 · Log a payment opens the shipped door: the conversation’s payment band, else the card', () => {
  assert.match(SEGMENT, /`\/vendor-dashboard\/messages\/\$\{threadOf\.get\(c\.eventId\)\}#pending-payments`/);
  assert.match(SEGMENT, /: `\/vendor-dashboard\/clients\/\$\{c\.eventId\}`/);
  // …and the card's own door is the same place (the one this sheet mirrors).
  assert.match(code(join(VD, 'clients', '[eventId]', 'page.tsx')), /href=\{`\/vendor-dashboard\/messages\/\$\{threadId\}#pending-payments`\}/);
  assert.doesNotMatch(LOG, /<form\b|action=\{/, 'Log a payment grew a second form');
});

// SABOTAGE: draw the legacy block whenever `data.legacy` is an array (drop `.length > 0`) → RED.
test('7 · the older payouts draw only when any exist; an unread list is said', () => {
  assert.match(VIEW, /\{data\.legacy === null \? \([\s\S]{0,260}\) : data\.legacy\.length > 0 \? \(/);
  assert.match(SEGMENT, /legacy = payoutsMeasured \? /);
});

// SABOTAGE: drop the 'bookings' case from CustomerSectionBody → RED.
test('8 · nothing lost: the Bookings queue (prep schedule) is a Money fold, loaded on open', () => {
  assert.match(PAGE, /key: 'bookings',\s*label: 'Bookings',/);
  assert.match(PAGE, /case 'bookings':\s*return <BookingsSurface searchParams=\{pass as never\} \/>;/);
  assert.match(code(join(HERE, 'segments.ts')), /const FOLD_KEYS = \[[^\]]*'bookings'/);
  assert.match(code(join(VD, 'bookings', 'surface.tsx')), /<VendorPrepForBooking\b/, 'the prep add left the Bookings queue — find its new home first');
});

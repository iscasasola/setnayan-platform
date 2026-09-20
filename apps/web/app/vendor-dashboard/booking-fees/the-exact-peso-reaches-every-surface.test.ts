/**
 * the-exact-peso-reaches-every-surface.test.ts — a charge that carries centavos
 * must print its centavos on every surface that names it, and no number on the
 * money path may be rounded to the peso before it is shown, written or matched.
 *
 * ── The defect (owner, live, 2026-09-20) ────────────────────────────────────
 * Order `S89O-DW67KBQADN` / reference `SN9B7485DD`, the booking fee for a real
 * contracted booking. `booking_fee_charges.amount_charged_centavos = 83750`,
 * `orders.requested_total_php = 837.50`, `payments.amount_php = 837.50`. The
 * supplier's page printed **₱838** three times: under the headline "Amount to
 * send", again inside the copyable PAYMENT INSTRUCTIONS block, and once more on
 * the payment-log row.
 *
 * 🔑 THAT IS NOT A WRONG LABEL — IT IS AN INSTRUCTION TO SEND A DIFFERENT
 * AMOUNT than the system recorded. A supplier who does as told transfers ₱838
 * against a ₱837.50 charge and every reconciliation after it is 50 centavos
 * out, on the one screen whose entire job is to name the figure to type into
 * GCash. PR #5737 found the same `maximumFractionDigits: 0` in the notification
 * title and fixed it THERE; the pages, the log and the admin desk were not
 * covered.
 *
 * ── What this suite pins ────────────────────────────────────────────────────
 *  1. The shared formatter is EXACT — executed, not grepped — and agrees with
 *     the two copies of the same rule that already existed: SQL
 *     `booking_fee_php_text` and `pesoText` in `lib/setnayan-gift.ts`.
 *  2. Every formatter the fee/payment path actually calls keeps the centavos.
 *  3. The mounts are COUNTED: two "Amount to send" blocks and one payment-log
 *     amount on the fee detail page, all through the shared formatter.
 *  4. The copyable value is the exact two-decimal string — never rounded, and
 *     above all never rounded DOWN, which would underpay the charge.
 *  5. No surface on the path re-implements a peso formatter or hands one a
 *     peso-rounded number.
 *  6. Nothing COMPARES a rounded amount. That rule is executed, not grepped:
 *     it lives in the pure `lib/payment-amount-forms.ts` precisely so a guard
 *     can run it instead of reading a `'use client'` component's source.
 *
 * Source scans go through `stripComments` so a sentence in a docblock — this
 * file's own quotations included — can never satisfy or trip an assertion.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatPhp } from '@/lib/orders';
import { payAmount } from '@/lib/pay-amount';
import { formatPhpFromString } from '@/lib/receipts';
import {
  paymentAmountMatchForms,
  haystackCarriesAmount,
} from '@/lib/payment-amount-forms';
import { stripComments } from '@/lib/strip-comments';

const WEB = process.cwd();
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const code = (rel: string) => stripComments(read(rel));

/** The owner's own row, to the centavo. */
const CHARGE_CENTAVOS = 83_750;
const CHARGE_PHP = CHARGE_CENTAVOS / 100; // 837.5

/** The surfaces that name this charge. */
const FEE_DETAIL = 'app/vendor-dashboard/booking-fees/[orderId]/page.tsx';
const FEE_HUB = 'app/vendor-dashboard/booking-fees/page.tsx';
const ADMIN_QUEUE = 'app/admin/payments/page.tsx';
const ADMIN_MATCHER = 'app/admin/payments/_components/inbox-matcher.tsx';
const ADMIN_ACTIONS = 'app/admin/payments/actions.ts';
const ADMIN_LEDGER = 'app/admin/money/_components/transactions-ledger.tsx';

/* ═══ 1 · THE FORMATTER ITSELF, EXECUTED ═════════════════════════════════════ */

test('the shared formatter prints the charge to the centavo', () => {
  // SABOTAGE: restore `maximumFractionDigits: 0` in lib/orders.ts → "₱838".
  assert.equal(formatPhp(CHARGE_PHP), '₱837.50');
  assert.equal(formatPhp(837.05), '₱837.05');
  assert.equal(formatPhp(0.5), '₱0.50');
  assert.equal(formatPhp(1_234_567.89), '₱1,234,567.89');
});

test('a whole peso is untouched — this fix changes no screen that was right', () => {
  // The blast radius IS the point: ~100 call sites share this helper, and a
  // figure with no centavos must render byte-for-byte as it did before.
  // SABOTAGE: make the `.00` branch unconditional → "₱2,499.00".
  assert.equal(formatPhp(2499), '₱2,499');
  assert.equal(formatPhp(50), '₱50');
  assert.equal(formatPhp(100000), '₱100,000');
  assert.equal(formatPhp(0), '₱0');
});

test('an absent or unreadable figure still says nothing, never ₱0', () => {
  // "don't guess" — an absence may not become a number.
  for (const absent of [null, undefined, Number.NaN]) {
    assert.equal(formatPhp(absent as number | null | undefined), '—');
  }
});

test('it agrees with the two copies of this rule that already existed', () => {
  // SQL `public.booking_fee_php_text` (migration 20271177298989) documents
  // itself as: 100000 → '₱100,000' · 50 → '₱50' · 1500.5 → '₱1,500.50'.
  // `pesoText` in lib/setnayan-gift.ts is its TypeScript mirror. A third copy
  // that disagreed with either would put two numbers on one bill.
  assert.equal(formatPhp(100000), '₱100,000');
  assert.equal(formatPhp(50), '₱50');
  assert.equal(formatPhp(1500.5), '₱1,500.50');

  const sql = read(
    '../../supabase/migrations/20271177298989_the_owner_sets_the_booking_fee.sql',
  );
  assert.match(
    sql,
    /booking_fee_php_text/,
    'the SQL mirror this rule is pinned to has moved or been renamed',
  );
});

test('a half-centavo is taken from toFixed, the same rounding the QR uses', () => {
  // `Intl` rounds the decimal value, `toFixed` rounds the binary double: 2.675
  // is "2.68" to Intl and "2.67" to toFixed. `payAmount` — the figure the /pay
  // QR carries in EMV tag 54 — is built on toFixed, and /pay is where a
  // supplier lands FROM the fee page. Agreement has to be structural.
  // SABOTAGE: format with Intl at 2 decimals instead → 2.675 disagrees.
  for (const php of [2.675, 1.005, 837.5, 49.05, 0.5]) {
    assert.equal(
      formatPhp(php).replace('₱', '').replace(/,/g, ''),
      payAmount(php).replace('₱', '').replace(/,/g, '').replace(/\.00$/, ''),
      `the fee page and the /pay QR disagree at ${php}`,
    );
  }
});

/* ═══ 2 · EVERY FORMATTER ON THE PATH KEEPS THE CENTAVOS ═════════════════════ */

test('no formatter the money path calls drops the fraction', () => {
  // The three that a booking fee actually passes through, end to end:
  // the pages + admin desk (formatPhp), the /pay screen and its QR
  // (payAmount), and the receipt issued after approval (formatPhpFromString).
  // SABOTAGE: any one of them back to 0 fraction digits → that entry fails.
  const formatters: [string, (n: number) => string][] = [
    ['lib/orders.ts · formatPhp', (n) => formatPhp(n)],
    ['lib/pay-amount.ts · payAmount', payAmount],
    ['lib/receipts.ts · formatPhpFromString', (n) => formatPhpFromString(n)],
  ];
  for (const [name, f] of formatters) {
    const out = f(CHARGE_PHP);
    assert.ok(
      out.includes('837.50'),
      `${name} printed ${out} for a ₱837.50 charge — the centavos are gone`,
    );
    assert.ok(!out.includes('838'), `${name} printed ${out} — a number nobody recorded`);
  }
});

/* ═══ 3 · THE MOUNTS, COUNTED ════════════════════════════════════════════════ */

test('the fee detail page names the amount three times, all through the shared formatter', () => {
  const src = code(FEE_DETAIL);

  // Two "Amount to send" blocks — the headline tile and the copyable PAYMENT
  // INSTRUCTIONS block — plus the payment-log row. All three printed ₱838.
  // A count, not a presence: the owner saw it TWICE, so one fixed mount and one
  // missed mount is the exact failure this has to catch.
  // SABOTAGE: revert either headline to a private `₱${Math.round(...)}` → 2 or 1.
  const headline = src.match(/formatPhp\(totals\.headlineTotal\)/g) ?? [];
  assert.equal(headline.length, 2, `expected 2 headline mounts, found ${headline.length}`);

  const logRow = src.match(/formatPhp\(p\.amount_php\)/g) ?? [];
  assert.equal(logRow.length, 1, `expected 1 payment-log mount, found ${logRow.length}`);

  const amountToSend = src.match(/Amount to send/g) ?? [];
  assert.equal(
    amountToSend.length,
    2,
    `expected 2 "Amount to send" labels, found ${amountToSend.length}`,
  );

  assert.match(
    src,
    /formatPhp,?\n?/,
    'the fee detail page no longer imports the shared formatter',
  );
});

test('the copyable value is the exact two decimals — never rounded, never rounded down', () => {
  const src = code(FEE_DETAIL);
  // SABOTAGE: back to `String(totals.headlineTotal)` → "837.5", or to
  // `Math.round(...)` → "838". Both fail here.
  assert.match(
    src,
    /<CopyButton value=\{totals\.headlineTotal\.toFixed\(2\)\}/,
    'the "Amount to send" copy value is not the exact two-decimal string',
  );
  assert.ok(
    !/CopyButton value=\{String\(totals\.headlineTotal\)\}/.test(src),
    'the copy value is back to String(), which drops a trailing zero',
  );
  // And the decision itself, executed: what is copied is what is charged.
  assert.equal(CHARGE_PHP.toFixed(2), '837.50');
  assert.ok(Number('837.50') === CHARGE_CENTAVOS / 100, 'the copied digits are the charge');
});

/* ═══ 4 · NOBODY RE-IMPLEMENTS OR PRE-ROUNDS ════════════════════════════════ */

test('no surface on the fee/payment path carries its own peso formatter', () => {
  // The admin matcher had one — min 0 / max 2 — so the same ₱837.50 charge read
  // ₱838 on the fee page, ₱837.5 on the desk and 837.50 in the QR: three
  // spellings of one number, on screens an admin compares by eye.
  // SABOTAGE: re-add a local `new Intl.NumberFormat(... currency: 'PHP' ...)`
  // to any of these files.
  for (const rel of [FEE_DETAIL, FEE_HUB, ADMIN_QUEUE, ADMIN_MATCHER, ADMIN_LEDGER]) {
    const src = code(rel);
    assert.ok(
      !/currency:\s*'PHP'/.test(src),
      `${rel} defines its own currency formatter instead of using lib/orders formatPhp`,
    );
    assert.ok(
      !/maximumFractionDigits:\s*0/.test(src),
      `${rel} formats a peso figure with the centavos switched off`,
    );
  }
});

test('nothing on the path rounds an amount to the peso before printing it', () => {
  // `Math.round(x * 100)` is centavo precision and is CORRECT — the ban is on
  // rounding to whole pesos, i.e. a round/floor/ceil/toFixed(0) applied to a
  // figure already expressed in pesos.
  // SABOTAGE: `formatPhp(Math.round(totals.headlineTotal))` in the fee page.
  const banned =
    /(Math\.(round|floor|ceil)\((?![^)]*\*\s*100)[^)]*(amount|total|owed|php|Php|PHP)[^)]*\)|toFixed\(0\))/;
  for (const rel of [FEE_DETAIL, FEE_HUB, ADMIN_QUEUE, ADMIN_MATCHER, ADMIN_LEDGER]) {
    const src = code(rel);
    const hit = src.match(banned);
    assert.equal(hit, null, `${rel} rounds a peso figure to the whole peso: ${hit?.[0]}`);
  }
});

test('the admin desk and the supplier read the SAME formatter', () => {
  // Both ends. A fee that reads ₱837.50 to the supplier and ₱838 to the desk is
  // a reconciliation argument waiting to happen.
  // SABOTAGE: point either import at a local helper.
  for (const rel of [FEE_DETAIL, FEE_HUB, ADMIN_QUEUE, ADMIN_MATCHER, ADMIN_LEDGER, ADMIN_ACTIONS]) {
    assert.match(
      code(rel),
      /from '@\/lib\/orders'/,
      `${rel} does not import the shared money formatter`,
    );
  }
});

/* ═══ 5 · NOTHING COMPARES A ROUNDED AMOUNT ═════════════════════════════════ */

test('the amount-match forms are truncations of the real digits, never neighbours', () => {
  // SABOTAGE: `String(Math.round(n))` back in paymentAmountMatchForms → "838".
  assert.deepEqual(paymentAmountMatchForms(CHARGE_PHP), ['837.50']);
  assert.deepEqual(paymentAmountMatchForms(3999), ['3999.00', '3999']);
  assert.deepEqual(paymentAmountMatchForms(Number.NaN), []);
  for (const form of paymentAmountMatchForms(CHARGE_PHP)) {
    assert.ok(!form.includes('838'), `the matcher would hunt for ${form}, a number nobody recorded`);
  }
});

test("somebody else's ₱838 transfer is not offered as a match for a ₱837.50 fee", () => {
  // The live consequence, executed. This is the whole reason a rounded
  // comparison is a data bug and not a cosmetic one.
  // SABOTAGE: restore the rounded form → this notification matches.
  const otherPersonsAlert = 'you received php838.00 from j*** d***. ref 9921334455';
  assert.equal(haystackCarriesAmount(otherPersonsAlert, CHARGE_PHP), false);

  // And the fee's OWN notification still matches, on the exact digits.
  const ourAlert = 'you received php837.50 from s*** s***. ref 8821334455';
  assert.equal(haystackCarriesAmount(ourAlert, CHARGE_PHP), true);
});

test('a whole-peso amount still matches a note written without decimals', () => {
  // The reason the bare form exists at all; removing it would quietly retire
  // the tier for every whole-peso payment.
  // SABOTAGE: return only [fixed] from paymentAmountMatchForms.
  assert.equal(haystackCarriesAmount('gcash: php3999.00 received', 3999), true);
  assert.equal(haystackCarriesAmount('gcash: php3999 received', 3999), true);
  // Comma-stripping is the caller's job; the forms carry no commas of their own.
  assert.ok(paymentAmountMatchForms(3999).every((f) => !f.includes(',')));
});

test('the 3-digit floor on the weakest tier is unchanged', () => {
  // ₱50 is the booking fee's own minimum and stays below the floor, exactly as
  // before: two digits appear in almost any notification by accident, and this
  // tier is explicitly not decisive.
  // SABOTAGE: measure the floor on the full "50.00" string → 5 ≥ 3 → matches.
  assert.equal(haystackCarriesAmount('php50.00 received', 50), false);
  assert.equal(haystackCarriesAmount('php100.00 received', 100), true);
});

test('the client matcher calls the pure rule rather than keeping its own copy', () => {
  const src = code(ADMIN_MATCHER);
  // SABOTAGE: inline the comparison back into the component.
  assert.match(src, /haystackCarriesAmount\(noCommas, p\.amount_php\)/);
  assert.ok(
    !/Math\.round\(p\.amount_php\)/.test(src),
    'the rounded amount key is back in the matcher',
  );
});

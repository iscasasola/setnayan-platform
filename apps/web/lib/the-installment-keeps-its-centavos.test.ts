/**
 * the-installment-keeps-its-centavos.test.ts — an INSTALLMENT is money a couple
 * is later asked to pay, so it must survive to the centavo everywhere it is
 * resolved, stored, compared and printed; and a total nobody could read must
 * never render as ₱0.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * PR #5744 made the booking-fee path print exact centavos (₱837.50, not ₱838)
 * after the owner caught a real bill lying about itself, and fixed an admin
 * matcher that compared a ROUNDED amount and could therefore offer somebody
 * else's genuine ₱838 transfer as a match for a ₱837.50 charge. It deliberately
 * left the INSTALLMENT sites alone because three other PRs were rewriting those
 * files. Those PRs merged (#5737, #5741) or are merging (#5742). This is the
 * follow-up, and it is bigger than the display bug it was sent to fix:
 *
 * 🔴 THE ROUNDING WAS NOT ONLY ON THE SCREEN. THREE SITES ROUNDED BEFORE
 * STORING, which outranks any display:
 *
 *  1. `computePlanInstances` freezes the couple's payment plan into
 *     `event_vendor_payment_plan.instances_json` at lock. It rounded every
 *     installment to the whole peso on the way in, so the stored plan — the one
 *     the couple pays off, one transfer at a time — held the wrong figures for
 *     the life of the booking.
 *  2. `rowToDraft` fills the supplier's schedule EDITOR from the stored row and
 *     Save sends it back through `phpToCentavos`. Opening a schedule whose
 *     `amount_centavos` was 1340050 and pressing Save WITHOUT TOUCHING IT wrote
 *     back 1340100. A read-only visit moved the money.
 *  3. `parseScheduleDraft` — the SERVER's sanitizer for a quote's schedule —
 *     coerced `amountPhp` with `Math.round`, so a ₱13,400.50 installment
 *     arrived correct on the wire and was persisted as ₱13,401.
 *
 * 🔑 CENTAVOS ARE REACHABLE BY CONSTRUCTION, NOT BY ACCIDENT.
 * `vendor_service_payment_schedules.amount_centavos` is `BIGINT`, and accepting
 * a proposal writes `event_vendors.total_cost_php = v_total_centavos::numeric /
 * 100.0`. A percent installment off such a total lands on a centavo routinely:
 * 30% of ₱187,501 is ₱56,250.30. Nothing exotic is required.
 *
 * 🔑 AND THE SECOND SHAPE IS THE SAME DISEASE WEARING A ZERO. `Number(total ??
 * 0)` reaches `formatPhp` before its own `—` branch can, so "we could not read
 * this" prints as **₱0** — a bill that says it costs nothing. That is the
 * failure-renders-as-fact class seven merged PRs were spent on.
 *
 * ── What this suite pins ────────────────────────────────────────────────────
 *  1. Every centavo-exact helper, EXECUTED on a centavo-bearing installment.
 *  2. The resolvers end-to-end: wire → sanitize → resolve → stored shape, and
 *     the editor round trip that used to move money on a no-op Save.
 *  3. The RENDER, executed: `PaymentPlanStepper` rendered to HTML, on both its
 *     mounts, because a log line never changed a pixel.
 *  4. The mounts are COUNTED per surface — a presence check passes while one of
 *     two identical spellings keeps the defect, which this repo has shipped.
 *  5. No money surface maps an absent total to 0.
 *  6. Nothing on the installment path rounds to the peso before storing.
 *
 * Every source scan goes through `stripComments`, so a sentence in a docblock —
 * this file's own quotations included — can never satisfy or trip an assertion.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatPhp } from '@/lib/orders';
import { stripComments } from '@/lib/strip-comments';
import {
  centavosToPhp,
  phpToCentavos,
  pctOfTotalPhp,
  computePlanInstances,
  rowToDraft,
  rowToCoupleFacing,
  type PaymentScheduleItemRow,
} from '@/lib/vendor-service-payment-schedules';
import {
  sanitizeAndResolveSchedule,
  resolveSchedule,
  type InstallmentDraft,
} from '@/lib/proposal-payment-schedule';
import {
  feeOrderTotalPhp,
  sumFeeOrderTotalsPhp,
} from '@/lib/vendor-booking-fees';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request.endsWith('.css') || request === 'server-only' || request === 'client-only') {
      return {};
    }
    return load.call(this, request, ...rest);
  };
}

const WEB = process.cwd();
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const code = (rel: string) => stripComments(read(rel));

/** The worked example throughout: an installment that genuinely carries centavos. */
const INSTALLMENT_CENTAVOS = 1_340_050;
const INSTALLMENT_PHP = 13_400.5;
/** A total an accepted proposal really can write, and a percent off it. */
const TOTAL_PHP = 187_501;
const THIRTY_PCT_BPS = 3_000;
const THIRTY_PCT_PHP = 56_250.3;

/** The surfaces an installment figure reaches. */
const STEPPER = 'app/_components/payment-plan-stepper.tsx';
const PROPOSAL_MAKER = 'app/_components/proposal-maker.tsx';
const CHAT_STREAM = 'app/_components/chat-message-stream.tsx';
const VENDOR_OVERVIEW = 'app/vendor-dashboard/_components/overview-sections.tsx';
const SCHEDULE_LIB = 'lib/vendor-service-payment-schedules.ts';
const PROPOSAL_SCHEDULE_LIB = 'lib/proposal-payment-schedule.ts';
const LOCK_ACTION = 'app/dashboard/[eventId]/vendors/actions.ts';
const FEE_HUB = 'app/vendor-dashboard/booking-fees/page.tsx';
const PAPIC_ORDER = 'app/papic/order/[token]/page.tsx';

/* ═══ 1 · THE HELPERS, EXECUTED ══════════════════════════════════════════════ */

test('centavos → pesos keeps the centavos', () => {
  // SABOTAGE: restore `Math.round(centavos / 100)` in lib/vendor-service-payment-schedules.ts.
  assert.equal(centavosToPhp(INSTALLMENT_CENTAVOS), INSTALLMENT_PHP);
  assert.equal(centavosToPhp(83_750), 837.5);
  assert.equal(centavosToPhp(5), 0.05);
  // And a whole peso is untouched — the blast radius IS the assertion.
  assert.equal(centavosToPhp(249_900), 2499);
  assert.equal(centavosToPhp(0), 0);
});

test('it agrees with its identically-named sibling in lib/payouts.ts', async () => {
  // 🔑 TWO EXPORTED FUNCTIONS, ONE NAME, AND ONLY ONE OF THEM WAS WRONG. The
  // payouts copy already read `Math.round(centavos) / 100`; this pins them
  // together so a future edit to either cannot re-open the gap.
  const payouts = await import('@/lib/payouts');
  for (const c of [INSTALLMENT_CENTAVOS, 83_750, 5, 249_900, 0, 1]) {
    assert.equal(
      centavosToPhp(c),
      payouts.centavosToPhp(c),
      `the two centavosToPhp disagree at ${c} centavos`,
    );
  }
});

test('the peso ⇄ centavo round trip is lossless', () => {
  // SABOTAGE: either direction rounding to the peso breaks this.
  for (const c of [INSTALLMENT_CENTAVOS, 83_750, 5, 199_995, 249_900]) {
    assert.equal(phpToCentavos(centavosToPhp(c)), c, `round trip lost centavos at ${c}`);
  }
});

test('a percent installment resolves to the centavo', () => {
  // SABOTAGE: `Math.round((total * bps) / 10000)` → 56250, not 56250.3.
  assert.equal(pctOfTotalPhp(TOTAL_PHP, THIRTY_PCT_BPS), THIRTY_PCT_PHP);
  assert.equal(pctOfTotalPhp(100, 3_000), 30);
  assert.equal(pctOfTotalPhp(13_333, 1_500), 1_999.95);
  // Multiplying to centavos BEFORE rounding is what keeps this integral.
  assert.equal(pctOfTotalPhp(TOTAL_PHP, 10_000), TOTAL_PHP);
});

test('the formatter then prints what was resolved', () => {
  // The two halves are separate mechanisms and both must hold: an exact
  // resolver feeding a rounding formatter reads exactly like the bug.
  assert.equal(formatPhp(centavosToPhp(INSTALLMENT_CENTAVOS)), '₱13,400.50');
  assert.equal(formatPhp(pctOfTotalPhp(TOTAL_PHP, THIRTY_PCT_BPS)), '₱56,250.30');
  assert.equal(formatPhp(pctOfTotalPhp(13_333, 1_500)), '₱1,999.95');
  assert.equal(formatPhp(centavosToPhp(249_900)), '₱2,499');
});

/* ═══ 2 · THE STORE PATHS, EXECUTED ══════════════════════════════════════════ */

const scheduleRow = (over: Partial<PaymentScheduleItemRow>): PaymentScheduleItemRow =>
  ({
    schedule_item_id: 'si_1',
    vendor_service_id: 'vs_1',
    vendor_profile_id: 'vp_1',
    created_at: '2026-09-20T00:00:00Z',
    updated_at: '2026-09-20T00:00:00Z',
    seq: 0,
    label: 'Downpayment',
    amount_kind: 'fixed',
    percent_bps: null,
    amount_centavos: null,
    due_anchor: 'on_lock',
    due_offset_days: 0,
    cancellation_terms: null,
    downpayment_non_refundable: false,
    refund_window_days: null,
    no_show_forfeit: false,
    ...over,
  }) as PaymentScheduleItemRow;

test('the plan frozen at lock holds the exact installment, not a rounded one', () => {
  // This output is written straight into event_vendor_payment_plan.instances_json.
  // SABOTAGE: `Math.round(row.amount_centavos / 100)` → 13401.
  const instances = computePlanInstances({
    scheduleRows: [
      scheduleRow({ seq: 0, amount_centavos: INSTALLMENT_CENTAVOS }),
      scheduleRow({
        schedule_item_id: 'si_2',
        seq: 1,
        label: 'Balance',
        amount_kind: 'percent',
        percent_bps: THIRTY_PCT_BPS,
        amount_centavos: null,
      }),
    ],
    totalCostPhp: TOTAL_PHP,
    lockDateIso: '2026-09-20',
    eventDateIso: '2027-02-14',
  });
  assert.equal(instances[0].amount_php, INSTALLMENT_PHP);
  assert.equal(instances[1].amount_php, THIRTY_PCT_PHP);
  // An unresolvable percent stays null — never 0, which would read "free".
  const noTotal = computePlanInstances({
    scheduleRows: [
      scheduleRow({ amount_kind: 'percent', percent_bps: THIRTY_PCT_BPS, amount_centavos: null }),
    ],
    totalCostPhp: null,
    lockDateIso: '2026-09-20',
    eventDateIso: null,
  });
  assert.equal(noTotal[0].amount_php, null, 'an unresolved installment became a number');
});

test('opening the supplier schedule editor and saving it unchanged moves no money', () => {
  // 🔴 THE ONE THAT NEEDED NO USER MISTAKE AT ALL. rowToDraft → (no edit) →
  // phpToCentavos was a lossy round trip, so a read-only visit rewrote the row.
  // SABOTAGE: restore `Math.round(centavos / 100)` → 1340100 ≠ 1340050.
  for (const c of [INSTALLMENT_CENTAVOS, 199_995, 83_750, 5]) {
    const draft = rowToDraft(scheduleRow({ amount_centavos: c }));
    assert.equal(
      phpToCentavos(draft.amount_php as number),
      c,
      `a no-op Save rewrote ${c} centavos as ${phpToCentavos(draft.amount_php as number)}`,
    );
  }
});

test('the couple-facing schedule row names the same figure the supplier stored', () => {
  const row = scheduleRow({ amount_centavos: INSTALLMENT_CENTAVOS });
  assert.equal(rowToCoupleFacing(row).amount_php, INSTALLMENT_PHP);
  assert.equal(rowToDraft(row).amount_php, rowToCoupleFacing(row).amount_php);
});

test("the server's wire sanitizer keeps a quote installment's centavos", () => {
  // 🔑 THE SERVER RE-RESOLVES FROM THE RAW DRAFT ON SEND, and the module's own
  // header says "the persisted numbers are authoritative, never the client's
  // arithmetic" — so THIS is the number that reaches the database, whatever the
  // editor did. It is fed untyped, exactly as the wire delivers it.
  // SABOTAGE: `int(d.amountPhp)` in lib/proposal-payment-schedule.ts → 1340100.
  const resolved = sanitizeAndResolveSchedule({
    manual: [
      {
        label: 'First payment',
        kind: 'fixed',
        amountPhp: INSTALLMENT_PHP,
        percent: null,
        due: 'on_lock',
        offsetDays: 0,
      } satisfies InstallmentDraft,
    ],
    autoBalance: { label: 'Final balance', due: 'on_event', offsetDays: 0 },
    baseCentavos: 5_000_000,
    creditCentavos: 0,
  });
  assert.ok(resolved, 'the sanitizer refused a well-formed draft');
  assert.equal(resolved.installments[0].amount_centavos, INSTALLMENT_CENTAVOS);
  // A string off the wire is the realistic shape, and must survive identically.
  const fromWire = sanitizeAndResolveSchedule({
    manual: [
      { label: 'First payment', kind: 'fixed', amountPhp: '13400.50', due: 'on_lock', offsetDays: 0 },
    ],
    autoBalance: { label: 'Final balance', due: 'on_event', offsetDays: 0 },
    baseCentavos: 5_000_000,
    creditCentavos: 0,
  });
  assert.equal(fromWire?.installments[0].amount_centavos, INSTALLMENT_CENTAVOS);
});

test('a centavo-bearing schedule still pays to exactly zero', () => {
  // The pay-to-zero guarantee is the module's headline promise, and a centavo
  // that goes missing shows up here as a residual the couple never agreed to.
  const base = 5_000_099; // ₱50,000.99
  const resolved = resolveSchedule({
    manual: [
      {
        label: 'First payment',
        kind: 'fixed',
        amountPhp: INSTALLMENT_PHP,
        percent: null,
        due: 'on_lock',
        offsetDays: 0,
      },
    ],
    autoBalance: { label: 'Final balance', due: 'on_event', offsetDays: 0 },
    baseCentavos: base,
    creditCentavos: 0,
  });
  const sum = resolved.installments.reduce((s, r) => s + r.amount_centavos, 0);
  assert.equal(sum, base, `the schedule totalled ${sum} against a base of ${base}`);
});

/* ═══ 3 · THE RENDER, EXECUTED ═══════════════════════════════════════════════ */

async function renderStepper(amountPhp: number | null): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PaymentPlanStepper } = await import('@/app/_components/payment-plan-stepper');
  return renderToStaticMarkup(
    React.createElement(PaymentPlanStepper as never, {
      clearedAt: null,
      steps: [
        {
          seq: 0,
          label: 'Downpayment',
          amount_php: amountPhp,
          amount_kind: 'fixed',
          percent_bps: null,
          due_date: '2026-10-01',
          state: 'due',
        },
      ],
    } as never),
  );
}

test('the payment-plan stepper DRAWS the centavos', async () => {
  // 🔑 A LOG LINE NEVER CHANGED A PIXEL — so this renders the component and
  // reads the HTML, rather than asserting that a helper exists.
  // SABOTAGE: restore the private `maximumFractionDigits: 0` formatter → ₱13,401.
  const html = await renderStepper(INSTALLMENT_PHP);
  assert.ok(html.includes('₱13,400.50'), `the stepper drew: ${html}`);
  assert.ok(!html.includes('₱13,401'), 'the stepper rounded the installment up');
  assert.ok(!html.includes('₱13,400<'), 'the stepper dropped the centavos');
});

test('the stepper never prints ₱0 for an installment that has not resolved', async () => {
  // A percent installment with no booking total has no amount YET. `₱0` would
  // tell a couple the payment is free; the row must say why instead.
  // SABOTAGE: `formatPHP(value ?? 0)` → "₱0".
  const html = await renderStepper(null);
  assert.ok(!html.includes('₱0'), `an unresolved installment rendered as ₱0: ${html}`);
  assert.ok(
    html.includes('Amount TBD') || html.includes('% of total'),
    `an unresolved installment said nothing about why: ${html}`,
  );
});

test('a whole-peso installment renders exactly as it always did', async () => {
  const html = await renderStepper(2499);
  assert.ok(html.includes('₱2,499'), `a whole peso changed: ${html}`);
  assert.ok(!html.includes('₱2,499.00'), 'a whole peso grew a .00 it never had');
});

/* ═══ 4 · THE MOUNTS, COUNTED ════════════════════════════════════════════════ */

test('both stepper mounts render the same component — the couple end and the supplier end', () => {
  // 🔑 A COUNT, NOT A PRESENCE. This repo has shipped a fix to one of two
  // identical spellings while the second kept the defect, and a file-level match
  // cannot say which component still holds it.
  // SABOTAGE: give either surface its own inline installment list → 1 or 0.
  const mounts: Array<[string, number]> = [
    ['app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx', 1],
    ['app/vendor-dashboard/messages/[threadId]/_components/vendor-payment-live.tsx', 1],
  ];
  let total = 0;
  for (const [rel, expected] of mounts) {
    const found = (code(rel).match(/<PaymentPlanStepper\b/g) ?? []).length;
    assert.equal(found, expected, `${rel}: expected ${expected} stepper mounts, found ${found}`);
    total += found;
  }
  assert.equal(total, 2, `expected 2 stepper mounts app-wide, found ${total}`);
});

test('every installment surface routes its centavos through a named helper', () => {
  // Each entry: the file, the helper call it must make, and HOW MANY TIMES.
  // SABOTAGE: revert any one site to `Math.round(x / 100)` and its count drops.
  const sites: Array<[string, RegExp, number]> = [
    // "Add payment · splits the balance" and the ₱/% toggle both materialise a
    // resolved centavos figure into a fixed installment. TWO call sites — the
    // arrow-function DEFINITION reads `centavosToPesos = (centavos`, so it does
    // not match and cannot inflate the count into a false pass.
    [PROPOSAL_MAKER, /centavosToPesos\(/g, 2],
    // The quote decision card in the thread, and the never-sent draft card.
    [CHAT_STREAM, /Math\.round\(card\.totalCentavos\) \/ 100/g, 1],
    [VENDOR_OVERVIEW, /Math\.round\(card\.totalCentavos\) \/ 100/g, 1],
    // The plan snapshot + the reservation-terms evidence snapshot.
    [LOCK_ACTION, /centavosToPhp\(|pctOfTotalPhp\(/g, 2],
  ];
  for (const [rel, pattern, expected] of sites) {
    const found = (code(rel).match(pattern) ?? []).length;
    assert.equal(found, expected, `${rel}: expected ${expected} exact-centavo sites, found ${found}`);
  }
});

test('the installment field admits centavos', () => {
  // `step` defaults to 1 on type="number", so without this the control declares
  // itself invalid for exactly the amounts the two toggles now put in it.
  // SABOTAGE: drop `step="0.01"`.
  const src = code(PROPOSAL_MAKER);
  const window = src.slice(src.indexOf('aria-label="Installment amount"') - 400);
  assert.match(
    window.slice(0, 500),
    /step="0\.01"/,
    'the installment amount field cannot accept a centavo',
  );
});

/* ═══ 5 · AN ABSENT TOTAL IS NEVER ₱0 ════════════════════════════════════════ */

test('a fee order with no readable total is null, and prints a dash', () => {
  // SABOTAGE: restore `Number(a ?? b ?? 0)` → 0, which formatPhp prints as ₱0.
  assert.equal(feeOrderTotalPhp({ confirmed_total_php: null, requested_total_php: null }), null);
  assert.equal(feeOrderTotalPhp({ confirmed_total_php: undefined, requested_total_php: undefined }), null);
  assert.equal(feeOrderTotalPhp({ confirmed_total_php: null, requested_total_php: 'oops' }), null);
  assert.equal(formatPhp(feeOrderTotalPhp({ confirmed_total_php: null, requested_total_php: null })), '—');
  // And a readable one is unchanged, to the centavo — including a real ₱0.
  assert.equal(feeOrderTotalPhp({ confirmed_total_php: null, requested_total_php: 837.5 }), 837.5);
  assert.equal(feeOrderTotalPhp({ confirmed_total_php: 900.25, requested_total_php: 837.5 }), 900.25);
  assert.equal(feeOrderTotalPhp({ confirmed_total_php: null, requested_total_php: 0 }), 0);
});

test('a sum is null if ANY term is unreadable — never a smaller number that looks whole', () => {
  // 🔑 Skipping the unreadable one yields a figure a supplier would pay and
  // still be in arrears on. An empty set is a REAL zero and stays 0.
  // SABOTAGE: `continue` instead of `return null` → 837.5.
  assert.equal(sumFeeOrderTotalsPhp([]), 0);
  assert.equal(
    sumFeeOrderTotalsPhp([
      { confirmed_total_php: null, requested_total_php: 837.5 },
      { confirmed_total_php: null, requested_total_php: 49.05 },
    ]),
    886.55,
  );
  assert.equal(
    sumFeeOrderTotalsPhp([
      { confirmed_total_php: null, requested_total_php: 837.5 },
      { confirmed_total_php: null, requested_total_php: null },
    ]),
    null,
  );
});

test('no money surface maps an absent total to 0', () => {
  // The shape is `Number(<something money> ?? 0)` reaching a formatter. It beats
  // formatPhp's own `—` branch to the value, so "unreadable" prints as "free".
  // SABOTAGE: put `Number(o.requested_total_php ?? 0)` back on either page.
  const banned =
    /Number\([^)]*(total|amount|php|Php|PHP|centavos|Centavos|price|Price)[^)]*\?\?\s*0\s*\)/i;
  for (const rel of [FEE_HUB, PAPIC_ORDER, STEPPER]) {
    const hit = code(rel).match(banned);
    assert.equal(hit, null, `${rel} renders an unreadable amount as zero: ${hit?.[0]}`);
  }
});

test('the fee hub says it could not load the total, instead of totalling it wrong', () => {
  // SABOTAGE: drop the null branch and the banner silently under-states the debt.
  const src = code(FEE_HUB);
  assert.match(src, /sumFeeOrderTotalsPhp\(due\)/, 'the hub no longer sums honestly');
  assert.match(src, /totalDue === null/, 'the hub has no branch for an unreadable total');
  assert.match(read(FEE_HUB), /couldn&rsquo;t load the total/, 'the hub does not say so in words');
});

test('the guest Papic order withholds its Copy button when it has no figure', () => {
  // A button that pastes "0.00" into a bank app is worse than no button.
  // SABOTAGE: unconditional `<CopyButton value={amount.toFixed(2)}`.
  const src = code(PAPIC_ORDER);
  assert.match(
    src,
    /amount === null \? null : <CopyButton/,
    'the Copy button is offered for an amount nobody could read',
  );
});

/* ═══ 6 · NOTHING ROUNDS BEFORE STORING ══════════════════════════════════════ */

test('no installment path rounds a peso figure to the whole peso', () => {
  // `Math.round(x * 100)` is CENTAVO precision and is correct; `Math.round(x)`
  // and `Math.round(x / 100)` on a money figure are not.
  // SABOTAGE: `Math.round(row.amount_centavos / 100)` anywhere below.
  const banned = /Math\.(round|floor|ceil)\([^)]*(centavos|Centavos)\s*\/\s*100[^)]*\)/;
  for (const rel of [
    SCHEDULE_LIB,
    PROPOSAL_SCHEDULE_LIB,
    PROPOSAL_MAKER,
    CHAT_STREAM,
    VENDOR_OVERVIEW,
    LOCK_ACTION,
    STEPPER,
  ]) {
    const hit = code(rel).match(banned);
    assert.equal(hit, null, `${rel} divides centavos under a round: ${hit?.[0]}`);
  }
});

test('no installment surface switches the centavos off in a formatter', () => {
  // SABOTAGE: re-add a private `new Intl.NumberFormat(… maximumFractionDigits: 0)`.
  for (const rel of [STEPPER, PROPOSAL_MAKER, CHAT_STREAM, VENDOR_OVERVIEW]) {
    const src = code(rel);
    assert.ok(
      !/maximumFractionDigits:\s*0/.test(src),
      `${rel} formats an installment with the centavos switched off`,
    );
    assert.ok(
      !/currency:\s*'PHP'/.test(src),
      `${rel} carries its own currency formatter instead of lib/orders formatPhp`,
    );
  }
});

test('the wire sanitizer does not send money through the integer coercion', () => {
  // `int()` is for seq and day counts. It was used on `amountPhp`, which is the
  // single line that made every quote installment whole-peso on the server.
  // SABOTAGE: `amountPhp: … int(d.amountPhp)`.
  const src = code(PROPOSAL_SCHEDULE_LIB);
  assert.ok(
    !/amountPhp:\s*[^;\n]*\bint\(/.test(src),
    'a quote installment amount is coerced to an integer before it is stored',
  );
  assert.match(src, /amountPhp:[^;\n]*php2\(/, 'the centavo-preserving coercion is gone');
  // And `int` is still doing its real job, so this was a narrowing not a delete.
  assert.match(src, /offsetDays:[^;\n]*int\(/, 'int() lost the day counts it exists for');
});

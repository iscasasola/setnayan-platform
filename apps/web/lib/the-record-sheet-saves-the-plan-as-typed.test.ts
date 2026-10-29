/**
 * THE RECORD SHEET SAVES THE PAYMENT PLAN AS TYPED — or says, in view, why not.
 * (owner 2026-10-29, on a ₱395,000 stylist he added himself: "i tried fixing
 * the payment plans there but did not save properly" · "the payment scheme
 * there should properly update and save")
 *
 * Measured in production before the fix: that supplier had NO plan row at all,
 * although the sheet had been saved (its contact card's `updated_at` moved).
 * Every way the sheet's plan could fail to land is pinned here, each by the
 * function the save itself runs — not by a re-statement of it:
 *
 *  1. A peso amount typed with commas ("100,000") was NaN → the whole plan was
 *     refused "Every payment needs an amount above zero", and the running total
 *     silently skipped the row.                       → `planAmountNumber`
 *  2. Removing every payment posted no rows, the save read that as "nothing
 *     asked", and the OLD plan stayed.                → `planSaveStep` 'clear'
 *  3. The lock's own 50/50 estimate re-opened as blank-dated rows, so every
 *     later save of the sheet was refused.            → `planInstancesToRows`
 *  4. A plan typed over that estimate kept `is_default_seeded = true`, so a
 *     re-lock replaced it and the Booked row ignored it. → `couplePlanUpsert`
 *  5. The refusal read "Saved — except Your payments add up to….." — and sat a
 *     screen below the Save button on a phone.        → `partialSaveSentence`
 *                                                       + the footer guard
 *  6. A price with centavos re-opened as a hundred times itself.
 *                                                     → `priceDigitsForSheet`
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import {
  PLAN_AMOUNT_REQUIRED,
  PLAN_EMPTY,
  buildCouplePaymentPlan,
  couplePlanUpsert,
  lockMayOverwritePlan,
  partialSaveSentence,
  planAmountNumber,
  planInstancesToRows,
  planPreviewTotal,
  planSaveStep,
  priceDigitsForSheet,
  type CouplePlanRowInput,
  type EditablePlanRow,
} from './self-added-payment-plan';
import { computePlanInstances, defaultPaymentScheduleRows } from './vendor-service-payment-schedules';

const LOCK = '2026-10-29';
const EVENT = '2026-12-18';
const PRICE = 395_000;

const toInput = (r: EditablePlanRow): CouplePlanRowInput => ({
  label: r.label,
  amount_kind: r.kind,
  value: r.value,
  due_anchor: r.anchor,
  due_offset_days: r.days,
});
const build = (rows: CouplePlanRowInput[], totalPhp: number | null = PRICE) =>
  buildCouplePaymentPlan({ rows, totalPhp, lockDateIso: LOCK, eventDateIso: EVENT });

/** Save → store (JSON) → re-open: what the couple sees the next time. */
const reopen = (rows: CouplePlanRowInput[], totalPhp: number | null = PRICE) => {
  const built = build(rows, totalPhp);
  assert.ok(built.ok, built.ok === false ? built.message : '');
  return planInstancesToRows(JSON.parse(JSON.stringify(built.instances)));
};

describe('1 · a peso amount is read the way pesos are written', () => {
  const typed: CouplePlanRowInput[] = [
    { label: 'First payment', amount_kind: 'fixed', value: '100,000', due_anchor: 'on_lock', due_offset_days: '0' },
    { label: 'Balance', amount_kind: 'fixed', value: '₱295,000', due_anchor: 'before_event', due_offset_days: '7' },
  ];

  it('saves "100,000" and "₱295,000" as the amounts they say', () => {
    const r = build(typed);
    assert.ok(r.ok, r.ok === false ? r.message : '');
    assert.deepEqual(r.instances.map((i) => i.amount_php), [100_000, 295_000]);
  });

  it('a "%" typed after a percentage is the percentage', () => {
    const r = build([
      { label: 'First payment', amount_kind: 'percent', value: '30%', due_anchor: 'on_lock', due_offset_days: '0' },
      { label: 'Balance', amount_kind: 'percent', value: '70 %', due_anchor: 'before_event', due_offset_days: '14' },
    ]);
    assert.ok(r.ok, r.ok === false ? r.message : '');
    assert.deepEqual(r.instances.map((i) => i.amount_php), [118_500, 276_500]);
  });

  it('the running total counts the same rows the server counts', () => {
    assert.equal(
      planPreviewTotal(typed.map((t) => ({ kind: t.amount_kind, value: t.value })), PRICE),
      PRICE,
    );
  });

  it('still refuses what is not an amount — a typo is never guessed at', () => {
    for (const bad of ['', '1o0', '100k', 'abc']) assert.ok(Number.isNaN(planAmountNumber(bad)), bad);
    const r = build([{ ...typed[0]!, value: '100k' }, typed[1]!]);
    assert.equal(r.ok, false);
    assert.equal(r.ok === false ? r.message : '', PLAN_AMOUNT_REQUIRED);
  });

  it('re-opens showing exactly what was typed', () => {
    assert.deepEqual(reopen(typed), [
      { label: 'First payment', kind: 'fixed', value: '100,000', anchor: 'on_lock', days: '0' },
      { label: 'Balance', kind: 'fixed', value: '₱295,000', anchor: 'before_event', days: '7' },
    ]);
  });
});

describe('2 · removing every payment saves a plan with none', () => {
  it('an emptied editor is a CLEAR, not "nothing asked"', () => {
    assert.equal(planSaveStep({ editorPresent: true, postedLabels: [], postedValues: [] }), 'clear');
    assert.equal(planSaveStep({ editorPresent: true, postedLabels: ['', ' '], postedValues: ['', ''] }), 'clear');
  });

  it('a form that never carried the editor changes nothing', () => {
    assert.equal(planSaveStep({ editorPresent: false, postedLabels: [], postedValues: [] }), 'skip');
  });

  it('an amount with no name is a plan to refuse for its name — never cleared away', () => {
    assert.equal(planSaveStep({ editorPresent: true, postedLabels: [''], postedValues: ['50'] }), 'save');
    assert.equal(planSaveStep({ editorPresent: true, postedLabels: ['Balance'], postedValues: [''] }), 'save');
  });

  it('without the editor an empty plan is still refused, as before', () => {
    const r = build([]);
    assert.equal(r.ok, false);
    assert.equal(r.ok === false ? r.message : '', PLAN_EMPTY);
  });
});

describe('3 · the lock\'s 50/50 estimate re-opens as its rule, not blank dates', () => {
  const estimate = JSON.parse(
    JSON.stringify(
      computePlanInstances({
        scheduleRows: defaultPaymentScheduleRows(),
        totalCostPhp: PRICE,
        lockDateIso: LOCK,
        eventDateIso: EVENT,
      }),
    ),
  );

  it('comes back as 50% after you book and 50% fourteen days before', () => {
    const rows = planInstancesToRows(estimate, { defaultSeeded: true });
    assert.deepEqual(
      rows.map((r) => [r.kind, r.value, r.anchor, r.days]),
      [
        ['percent', '50', 'on_lock', '0'],
        ['percent', '50', 'before_event', '14'],
      ],
    );
  });

  it('saving the sheet untouched keeps the same money and the same days', () => {
    const rows = planInstancesToRows(estimate, { defaultSeeded: true });
    const again = build(rows.map(toInput));
    assert.ok(again.ok, again.ok === false ? again.message : '');
    assert.deepEqual(
      again.instances.map((i) => [i.amount_php, i.due_date]),
      estimate.map((i: { amount_php: number; due_date: string }) => [i.amount_php, i.due_date]),
    );
  });

  it('a legacy percent instance keeps its percent', () => {
    const [r] = planInstancesToRows([
      { seq: 0, label: 'Downpayment', amount_php: 118_500, due_date: LOCK, amount_kind: 'percent', percent_bps: 3000 },
    ]);
    assert.deepEqual(r, { label: 'Downpayment', kind: 'percent', value: '30', anchor: '', days: '0' });
  });
});

describe('4 · a plan the couple saves is theirs, not an estimate', () => {
  it('the row written says is_default_seeded: false', () => {
    const built = build([
      { label: 'All of it', amount_kind: 'percent', value: '100', due_anchor: 'on_lock', due_offset_days: '0' },
    ]);
    assert.ok(built.ok);
    const row = couplePlanUpsert({ eventId: 'e', vendorId: 'v', instances: built.instances, nowIso: '2026-10-29T00:00:00Z' });
    assert.equal(row.is_default_seeded, false);
    // …which is exactly what keeps a re-lock from replacing it.
    assert.equal(
      lockMayOverwritePlan({ onPlatform: false, existingInstances: row.instances_json, existingIsDefaultSeeded: row.is_default_seeded }),
      false,
    );
  });

  it('the save action writes that row, and nothing hand-built', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const src = stripComments(
      readFileSync(
        path.join(here, '..', 'app', 'dashboard', '[eventId]', 'vendors', '[vendorId]', 'workspace', 'payment-plan-actions.ts'),
        'utf8',
      ),
    );
    const at = src.indexOf('.upsert(');
    assert.ok(at > 0, 'could not find the plan upsert in saveSelfAddedPaymentPlan');
    assert.match(src.slice(at, at + 40), /\.upsert\(\s*couplePlanUpsert\(/);
  });
});

describe('5 · a refusal says what did not save, then why — in view', () => {
  it('names the field, then the plan\'s own sentence with its figures', () => {
    assert.equal(
      partialSaveSentence([
        { what: 'the payment plan', why: 'Your payments add up to ₱100,000 of ₱395,000 — ₱295,000 is unaccounted for.' },
      ]),
      'Saved — except the payment plan. Your payments add up to ₱100,000 of ₱395,000 — ₱295,000 is unaccounted for.',
    );
    assert.equal(
      partialSaveSentence([{ what: 'the price' }, { what: 'what they cover' }, { what: 'the payment plan' }]),
      'Saved — except the price, what they cover and the payment plan.',
    );
    assert.equal(partialSaveSentence([]), null);
  });

  it('the sheet draws its answer INSIDE the pinned footer, beside Save', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const src = stripComments(
      readFileSync(path.join(here, '..', 'app', 'dashboard', '[eventId]', '_components', 'new-manual-vendor-modal.tsx'), 'utf8'),
    );
    const footer = src.indexOf('data-record-sheet-footer');
    const said = src.indexOf('data-record-sheet-said');
    const save = src.indexOf("'Save changes'");
    assert.ok(footer > 0 && said > 0 && save > 0, 're-point this guard: footer / answer / Save not found');
    assert.ok(footer < said && said < save, 'the save answer left the pinned footer — on a phone it scrolls out of view again');
    assert.match(src.slice(footer, footer + 160), /sticky bottom-0/, "the footer is no longer pinned");
    assert.equal(src.split('role="alert"').length - 1 >= 1, true);
    // Only one place answers the save; a second copy above the footer is the old bug.
    assert.equal(src.split('{errorMsg}').length - 1, 1, 'the save answer is drawn in more than one place');
  });
});

describe('6 · the price re-opens as itself', () => {
  it('whole pesos, never centavos glued on', () => {
    assert.equal(priceDigitsForSheet('395000'), '395000');
    assert.equal(priceDigitsForSheet('80000.5'), '80000');
    assert.equal(priceDigitsForSheet(''), '');
    assert.equal(priceDigitsForSheet(undefined), '');
  });
});

describe('the sheet sends what the save needs to tell an emptied plan apart', () => {
  it('the plan editor posts plan_present, and the last payment can be removed', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const src = stripComments(
      readFileSync(path.join(here, '..', 'app', 'dashboard', '[eventId]', '_components', 'payment-plan-rows.tsx'), 'utf8'),
    );
    assert.match(src, /name=\{PLAN_PRESENT_FIELD\}/);
    const bin = src.indexOf('label={`Remove payment');
    assert.ok(bin > 0, 'could not find the remove button');
    assert.doesNotMatch(src.slice(bin, bin + 200), /rows\.length\s*<=\s*1/, 'the last payment cannot be removed again');
  });

  it('the update save runs the plan AFTER the price, so it checks the new price', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const src = stripComments(
      readFileSync(path.join(here, '..', 'app', 'dashboard', '[eventId]', 'vendors', 'actions.ts'), 'utf8'),
    );
    const a = src.indexOf('export async function updateSelfAddedSupplier(');
    assert.ok(a > 0);
    const body = src.slice(a, src.indexOf('export async function readSupplierInvite(', a));
    const price = body.indexOf('await updateVendorCosts(costFd)');
    const plan = body.indexOf('await saveSelfAddedPaymentPlan(planFd)');
    assert.ok(price > 0 && plan > price, 'the plan is saved before the price it must add up to');
    assert.match(body, /planSaveStep\(/);
  });
});

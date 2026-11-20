/**
 * 💳 SHOP › TEMPLATES › PAYMENT STRATEGIES (Card Maker part 4; controller ruling 20 Nov under the owner's delegation)
 * — the rules it is held to:
 *   · it is the THIRD tile of main's Templates row (Forms Maker · Offer Maker · Payment Strategies), the same tile and
 *     tap as the other two, its body server-drawn while `?maker=plans`;
 *   · ONE place per tool: no second door into the Forms Maker or the Offer Maker (the old part-4 "Templates" panel's
 *     Quick Forms and Discounts and Promos kinds are gone) — the Forms Maker's own rows swipe-delete with Undo;
 *   · it reads honestly (a refused read is said, never "none yet") and deletes with Undo through the shipped
 *     `formsAction` (no new server action), retiring only a live plan of THIS shop and checking the row count.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripComments } from '@/lib/strip-comments';
import { paymentLine, planDeletedLine, planRowLine, type PlanTemplate } from '@/lib/pay-plan-templates';
import type { ScheduleItemDraft } from '@/lib/vendor-service-payment-schedules';

const read = (p: string) => stripComments(readFileSync(new URL(p, import.meta.url), 'utf8'));
const TEMPLATES = read('./_components/shop-pay-plans.tsx');
const BODY = read('./_components/shop-pay-plans-body.tsx');
const PAGE = read('./page.tsx');
const MAKERS = read('./_components/shop-makers.tsx');
const FORMS = read('../forms/_components/forms-page-body.tsx');
const ACTIONS = read('../forms/actions.ts');
const READER = read('../../../lib/pay-plan-templates.server.ts');

const pay = (o: Partial<ScheduleItemDraft>): ScheduleItemDraft => ({
  seq: 0,
  label: 'Reservation',
  amount_kind: 'percent',
  percent: 30,
  amount_php: null,
  due_anchor: 'on_lock',
  due_offset_days: 0,
  cancellation_terms: null,
  downpayment_non_refundable: false,
  refund_window_days: null,
  no_show_forfeit: false,
  ...o,
}) as ScheduleItemDraft;

const plan = (o: Partial<PlanTemplate> = {}): PlanTemplate => ({
  id: '00000000-0000-4000-8000-000000000001',
  name: 'My 3-step plan',
  items: [pay({}), pay({ seq: 1, label: 'Balance', amount_kind: 'fixed', percent: null, amount_php: 20000, due_anchor: 'before_event', due_offset_days: 14 })],
  cardCount: 2,
  ...o,
});

test('Payment Strategies is the third Templates tile — the same tile and tap, its body read only while open', () => {
  const row = MAKERS.slice(MAKERS.indexOf('const list:'), MAKERS.indexOf('];', MAKERS.indexOf('const list:')));
  const order = ['Forms Maker', 'Offer Maker', 'Payment Strategies'].map((t) => row.indexOf(`title: '${t}'`));
  assert.ok(order.every((i) => i > 0) && order[0]! < order[1]! && order[1]! < order[2]!, `the Templates row is not Forms · Offers · Payment Strategies: ${order}`);
  assert.match(MAKERS, /const writes = k === 'forms' \|\| k === 'plans';/, 'the plans tile does not write ?maker=plans');
  assert.match(MAKERS, /cur\.k === 'plans'\s*\?\s*\(plansBody \?\?/);
  assert.match(BODY, /return sp\.maker === 'plans' \? <ShopPayPlansBody \/> : null;/);
  assert.match(PAGE, /plansBody=\{shopPayPlansBody\(sp\)\}/);
});

test('one place per tool — no second door into the Forms Maker or the Offer Maker', () => {
  assert.doesNotMatch(TEMPLATES, /ShopFormsBody|ShopFormsMaker|ChosenRow|Quick Forms|Discounts and Promos|OfferMaker|offers/);
  assert.doesNotMatch(MAKERS, /title: '(Templates|Saved templates|Quick Forms|Discounts and Promos)'/);
  assert.doesNotMatch(MAKERS, /offersOver|TemplatesOffersContext/);
});

test('a payment reads in plain words', () => {
  assert.equal(paymentLine(pay({})), 'Reservation · 30% · when they book');
  assert.equal(paymentLine(pay({ label: 'Balance', amount_kind: 'fixed', percent: null, amount_php: 20000, due_anchor: 'before_event', due_offset_days: 14 })), 'Balance · ₱20,000 · 14 days before the event');
  assert.equal(paymentLine(pay({ due_offset_days: 1 })), 'Reservation · 30% · 1 day after they book');
  assert.equal(planRowLine(plan()), '2 payments · on 2 cards');
  assert.equal(planRowLine(plan({ cardCount: 0 })), '2 payments · not used yet');
  assert.match(planDeletedLine(plan()), /cards keep the payments/);
});

test('the Forms Maker\'s own rows swipe-delete with Undo (part 4, kept in its one place)', () => {
  assert.match(FORMS, /onRetire \? \(\s*<SwipeToDelete/);
  assert.match(FORMS, /deleteWithUndo\(\{[\s\S]*?fd\.set\('op', 'retire'\)/);
  assert.match(FORMS, /onRetire=\{retire\}/);
});

test('Payment Strategies deletes through the shipped dispatcher — a live plan of THIS shop, one row or it says so', () => {
  const op = ACTIONS.slice(ACTIONS.indexOf("op === 'plan-retire'"), ACTIONS.indexOf("op === 'use'"));
  assert.ok(op.length > 0);
  assert.match(op, /\.from\('vendor_pay_plans'\)/);
  assert.match(op, /\.eq\('vendor_profile_id', shop\)/);
  assert.match(op, /\.is\('retired_at', null\)/);
  assert.match(op, /data\.length !== 1/);
  assert.match(TEMPLATES, /deleteWithUndo\(\{[\s\S]*?fd\.set\('op', 'plan-retire'\)/);
  for (const src of [TEMPLATES, BODY]) assert.doesNotMatch(src, /['"]use server['"]/, 'no new server action');
});

test('the plan read is honest: a refused read is unread, never an empty list', () => {
  assert.match(READER, /if \(plansRes\.error \|\| cardsRes\.error\)[\s\S]*?return \{ status: 'unread' \}/);
  assert.match(READER, /\.is\('retired_at', null\)/);
});

test('the panel says each state — a refused read is said, never "none yet"', () => {
  // (A static render would pull the server action's `server-only` imports into node; the states are pinned in source.)
  const list = TEMPLATES.slice(TEMPLATES.indexOf('function PlanList'));
  const unread = list.indexOf("plans.status === 'unread'");
  const none = list.indexOf('None yet');
  assert.ok(unread > 0 && none > unread, 'the unread branch returns before the empty line can draw');
  assert.match(list, /could not be read just now/);
  assert.match(list, /plans === null\)[\s\S]*?Opening your Payment Strategies/);
  assert.match(TEMPLATES, /data-templates-plan=\{p\.id\}/);
  assert.match(TEMPLATES, /<SwipeToDelete key=\{p\.id\} as="li"/);
});

test('supplier copy only — never "vendor" on screen', () => {
  const words = [...TEMPLATES.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]).join(' ');
  assert.doesNotMatch(words, /\bvendor/i);
});

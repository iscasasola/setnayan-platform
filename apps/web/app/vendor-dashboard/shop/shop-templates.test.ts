/**
 * 🗂 SHOP › TEMPLATES (Card Maker part 4) — the rules the panel is held to:
 *   · the three kinds carry the owner's 17 Nov names, in the drawing's order, picked from ONE dropdown;
 *   · Quick Forms IS the Forms Maker's body (never a second list), and its rows now swipe-delete with Undo;
 *   · Payment Strategies reads honestly (a refused read is said, never "none yet") and deletes with Undo through the
 *     shipped `formsAction` (no new server action), retiring only a live plan of THIS shop and checking the row count;
 *   · Discounts and Promos raises the shipped Offer Maker — no second offers list.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripComments } from '@/lib/strip-comments';
import { TEMPLATE_KINDS, paymentLine, planDeletedLine, planRowLine, type PlanTemplate } from '@/lib/pay-plan-templates';
import type { ScheduleItemDraft } from '@/lib/vendor-service-payment-schedules';

const read = (p: string) => stripComments(readFileSync(new URL(p, import.meta.url), 'utf8'));
const TEMPLATES = read('./_components/shop-templates.tsx');
const BODY = read('./_components/shop-templates-body.tsx');
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

test('the three kinds carry the ruled names, in the drawing order', () => {
  assert.deepEqual(
    TEMPLATE_KINDS.map((k) => k.label),
    ['Quick Forms', 'Discounts and Promos', 'Payment Strategies'],
  );
  assert.match(TEMPLATES, /<ChosenRow[\s\S]*?name="Show"/, 'one dropdown picks the kind');
});

test('a payment reads in plain words', () => {
  assert.equal(paymentLine(pay({})), 'Reservation · 30% · when they book');
  assert.equal(paymentLine(pay({ label: 'Balance', amount_kind: 'fixed', percent: null, amount_php: 20000, due_anchor: 'before_event', due_offset_days: 14 })), 'Balance · ₱20,000 · 14 days before the event');
  assert.equal(paymentLine(pay({ due_offset_days: 1 })), 'Reservation · 30% · 1 day after they book');
  assert.equal(planRowLine(plan()), '2 payments · on 2 cards');
  assert.equal(planRowLine(plan({ cardCount: 0 })), '2 payments · not used yet');
  assert.match(planDeletedLine(plan()), /cards keep the payments/);
});

test('Quick Forms IS the Forms Maker body, and its rows swipe-delete with Undo', () => {
  assert.match(BODY, /forms=\{<ShopFormsBody \/>\}/);
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

test('Discounts and Promos raises the shipped Offer Maker — no second offers list', () => {
  assert.doesNotMatch(TEMPLATES, /offerMaker\(/, 'Templates never reads or writes offers itself');
  assert.match(MAKERS, /open: \(\) => setOffersOver\(true\)/);
  assert.match(MAKERS, /\(open === 'offers' \|\| offersOver\) && offers\?\.verified/);
});

test('the panel says each state — a refused read is said, never "none yet"', () => {
  // (A static render would pull the server action's `server-only` imports into node; the states are pinned in source.)
  const list = TEMPLATES.slice(TEMPLATES.indexOf('function PlanList'));
  const unread = list.indexOf("plans.status === 'unread'");
  const none = list.indexOf('None yet');
  assert.ok(unread > 0 && none > unread, 'the unread branch returns before the empty line can draw');
  assert.match(list, /could not be read just now/);
  assert.match(list, /plans === null\)[\s\S]*?Opening your Payment Strategies/);
  assert.match(TEMPLATES, /const kinds = TEMPLATE_KINDS\.filter\(\(k\) => k\.key !== 'offers' \|\| offers\)/, 'no offers kind without the Offer Maker door');
  assert.match(TEMPLATES, /data-templates-plan=\{p\.id\}/);
  assert.match(TEMPLATES, /<SwipeToDelete key=\{p\.id\} as="li"/);
});

test('supplier copy only — never "vendor" on screen', () => {
  const words = [...TEMPLATES.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]).join(' ');
  assert.doesNotMatch(words, /\bvendor/i);
});

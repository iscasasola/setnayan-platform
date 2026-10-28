/**
 * The website-only welcome price — the rule (owner 2026-10-28, DECISION_LOG
 * "ONE PRICE EVERYWHERE = THE APP STORE PRICE; A WEBSITE-ONLY WELCOME −40%").
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  countsAsPurchase,
  decideWelcome,
  setupPriceAppliesAtCreate,
  welcomeCentavos,
  WELCOME_ELIGIBLE_SOURCES,
} from './welcome-discount';
import { setupPricePhp } from './onboarding-discount';
import { stripComments } from './strip-comments';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

test('the first purchase on the website is the welcome price; the second is not', () => {
  assert.deepEqual(decideWelcome({ enabled: true, storeShell: false, paidOrders: 0, pct: 40 }), { kind: 'welcome', pct: 40 });
  assert.deepEqual(decideWelcome({ enabled: true, storeShell: false, paidOrders: 1, pct: 40 }), { kind: 'regular', why: 'not_first' });
});

test('switch OFF → no welcome price anywhere; an unreadable history → no welcome price', () => {
  assert.deepEqual(decideWelcome({ enabled: false, storeShell: false, paidOrders: 0, pct: 40 }), { kind: 'regular', why: 'off' });
  assert.deepEqual(decideWelcome({ enabled: true, storeShell: false, paidOrders: null, pct: 40 }), { kind: 'regular', why: 'read_error' });
});

test('a ₱0 grant, a comp, a draft and a withdrawn bill are not purchases; a bill out for payment and a refund are', () => {
  const row = (status: string, php: number, comp: string | null = null) => ({ status, requested_total_php: php, comp_grant_id: comp });
  assert.equal(countsAsPurchase(row('fulfilled', 0)), false, 'the free Papic grant would spend every new couple’s welcome');
  assert.equal(countsAsPurchase(row('paid', 499, 'comp-1')), false, 'a comp is not a purchase');
  assert.equal(countsAsPurchase(row('draft', 499)), false);
  assert.equal(countsAsPurchase(row('cancelled', 499)), false);
  for (const s of ['submitted', 'awaiting_payment', 'paid', 'fulfilled', 'refunded', 'lapsed']) {
    assert.equal(countsAsPurchase(row(s, 95)), true, s);
  }
  assert.equal(countsAsPurchase({ status: 'paid', requested_total_php: '95.00' }), true, 'NUMERIC arrives as a string');
});

test('the welcome price IS the shipped set-up rule on the regular figure — cheaper wins, centavo rounding', () => {
  // ₱95 (the owner's App Store example) at 40% → ₱57.00
  assert.equal(welcomeCentavos(9500n, null, 40), 5700);
  // The same function the create flow uses — no second percentage.
  for (const [regular, explicit, pct] of [[2499, 1499, 40], [2499, null, 40], [5000, 3500, 40], [70, null, 33]] as const) {
    assert.equal(welcomeCentavos(BigInt(regular * 100), explicit, pct), Math.round(setupPricePhp(regular, explicit, pct) * 100));
  }
  // Centavo rounding, as shipped: ₱2,499 × 60 % = ₱1,499.40, not ₱1,499.
  assert.equal(welcomeCentavos(249900n, null, 40), 149940);
  // An override above the regular price never charges more.
  assert.equal(welcomeCentavos(100000n, 150000 / 100, 0), 100000);
});

test('the welcome never stacks on the Setnayan AI comeback offer', () => {
  assert.equal(WELCOME_ELIGIBLE_SOURCES.has('setnayan_ai_comeback'), false);
  assert.equal(WELCOME_ELIGIBLE_SOURCES.has('welcome_first_purchase'), false, 'never applied to itself');
  assert.equal(WELCOME_ELIGIBLE_SOURCES.has('retail_catalog'), true);
});

test('the create flow: switch OFF behaves as shipped (set-up price for everyone on the web); ON → first purchase only', () => {
  const welcome = { kind: 'welcome', pct: 40 } as const;
  const notFirst = { kind: 'regular', why: 'not_first' } as const;
  const off = { kind: 'regular', why: 'off' } as const;
  const app = { kind: 'regular', why: 'app' } as const;
  assert.equal(setupPriceAppliesAtCreate(false, off), true);
  assert.equal(setupPriceAppliesAtCreate(true, welcome), true);
  assert.equal(setupPriceAppliesAtCreate(true, notFirst), false);
  assert.equal(setupPriceAppliesAtCreate(false, app), false, 'the app never gets a set-up price, switch or not');
  assert.equal(setupPriceAppliesAtCreate(true, app), false);
});

test('the switch is held strict and server-only', () => {
  const src = read('lib/welcome-discount-flag.ts');
  assert.match(src, /process\.env\.WELCOME_DISCOUNT_ENABLED === 'true'/);
  assert.ok(!/NEXT_PUBLIC_WELCOME/.test(src), 'a NEXT_PUBLIC_ switch would ship in the bundle and be readable by the app');
});

test('the checkout charge: welcome decided server-side, never stacks with a voucher, refuses a screen/charge disagreement', () => {
  const src = stripComments(read('app/dashboard/[eventId]/checkout/actions.ts'));
  const at = src.indexOf('export async function submitOrderAction(');
  const body = src.slice(at);
  assert.match(body, /decision: await readWelcomeDecision\(user\.id\)/, 'the decision comes from the verified session');
  assert.match(body, /const welcome = voucherRequested\s*\?\s*null/, 'a voucher replaces the welcome — never both');
  assert.match(
    body,
    /if \(welcomeApplied !== \(formData\.get\('welcome_quoted'\) === '1'\)\) \{\s*return \{\s*ok: false/,
    'a screen that showed one price and a server that decided another must refuse, not bill',
  );
  // The flag never SETS a price — it is compared, not consumed.
  assert.ok(!/welcome_quoted[\s\S]{0,120}?requested_total_php/.test(body));
});

/**
 * THE PLAN IS ROWS (simpler supplier dashboard step 6; owner-APPROVED 2026-10-14; prototype SCREENS.plan).
 *
 * Held:
 *   · the plan is ONE dropdown and the cycle is ONE dropdown (`PickMenu`), not cards and not a pill track;
 *   · Pay posts ONLY `sku_code` to the shipped `startSubscriptionPurchase` (the RPC re-reads the price);
 *   · prices arrive from the catalogue — no peso is typed in the page or the picker;
 *   · the booking-fee line is the LIVE standing through `bookingFeeRow` (never `FEE_RATE`, never a flat ₱);
 *   · "What <plan> gives you" is `planGivesLines` (TIER_CAPS) — not typed copy;
 *   · every job keeps its door: receipts → /receipts, Custom plan, add-ons (the shipped cards stay, under #add-ons),
 *     Papic credits → the Event Hub, the scheduled-change notice (Keep my current plan).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url)); // app/vendor-dashboard/subscription
const PAGE = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));
const PICKER = stripComments(readFileSync(join(HERE, '_components/plan-picker.tsx'), 'utf8'));
const ROWS = stripComments(readFileSync(join(HERE, '_components/plan-rows.tsx'), 'utf8'));

test('the plan and its cycle are one dropdown each', () => {
  assert.match(PICKER, /<PickMenu\s+label="Your plan"/);
  assert.match(PICKER, /<PickMenu\s+label="Cycle"/);
  assert.ok(!existsSync(join(HERE, '_components/subscription-cards.tsx')), 'the plan cards are back');
  assert.ok(!existsSync(join(HERE, '_components/cycle-toggle.tsx')), 'the cycle pill track is back');
  assert.match(PAGE, /<PlanPicker[\s\S]*?action=\{startSubscriptionPurchase\}/);
});

test('Pay posts only the SKU — never an amount', () => {
  const form = PICKER.slice(PICKER.indexOf('<form action={action}'), PICKER.indexOf('</form>', PICKER.indexOf('<form action={action}')));
  assert.match(form, /name="sku_code"/);
  assert.doesNotMatch(form, /name="(amount|price)[^"]*"/);
});

test('no peso is typed on the plan screen', () => {
  for (const [name, src] of [['page.tsx', PAGE], ['plan-picker.tsx', PICKER], ['plan-rows.tsx', ROWS]] as const) {
    assert.doesNotMatch(src, /₱\s?\d/, `${name} types a peso amount`);
  }
});

test('the booking fee is the live standing, worded by bookingFeeRow', () => {
  assert.match(PAGE, /resolveBookingFeeStanding\(/);
  assert.match(PAGE, /bookingFeeRow\(feeStanding, bookingFeeDueCount\)/);
  assert.doesNotMatch(PAGE, /FEE_RATE|0\.05/);
});

test('what the plan gives is read from the plan table', () => {
  assert.match(PAGE, /planGivesLines\(currentTier, isVendorFeatureGateEnabled\(\)\)/);
});

test('every job keeps its door', () => {
  assert.match(ROWS, /href=\{r\.receiptId \? `\/receipts\/\$\{r\.receiptId\}` : null\}/);
  assert.match(ROWS, /href="\/vendor-dashboard\/subscription\/custom"/);
  assert.match(ROWS, /href="#add-ons"/);
  assert.match(PAGE, /id="add-ons"/);
  assert.match(PAGE, /<PlanRows/);
  assert.match(PAGE, /<AiAddonCard/);
  assert.match(PAGE, /<BoothAddonCard/);
  assert.match(PAGE, /<PapicChallengeCard/);
  assert.match(ROWS, /href="\/vendor-dashboard\/on-the-day"/);
  assert.match(PAGE, /<PlanChangeNotice/);
});

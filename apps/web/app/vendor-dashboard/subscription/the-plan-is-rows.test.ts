/**
 * THE PLAN IS ROWS (simpler supplier dashboard step 6; owner-APPROVED 2026-10-14; prototype SCREENS.plan).
 *
 * Held:
 *   · THE PLAN SHEET (Build 5 · Lane B, Door 2, owner 10 Nov): the plans are ROWS THAT OPEN IN PLACE (`Fold`), the
 *     shop's own first and open, each other one with What changes and What you pay; the cycle is ONE dropdown
 *     (`PickMenu`, "Pay every"); never cards, never a pill track, never the bare "Your plan ▾" dropdown again;
 *   · an unverified shop sees every paid plan with the shared 🔒 (`LockButton`), never a hidden one;
 *   · Pay posts ONLY `sku_code` to the shipped `startSubscriptionPurchase` (the RPC re-reads the price);
 *   · prices arrive from the catalogue — no peso is typed in the page or the picker;
 *   · the booking-fee line is the LIVE standing through `bookingFeeRow` (never `FEE_RATE`, never a flat ₱);
 *   · "What <plan> gives you" is `planGivesLines` (TIER_CAPS) — not typed copy;
 *   · every job keeps its door: receipts → /receipts, add-ons (the shipped cards stay, under #add-ons),
 *     Papic credits → the Event Hub, the scheduled-change notice (Keep my current plan).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url)); // app/vendor-dashboard/subscription
// 🏪 The Plan screen moved into `_components/plan-screen.tsx` (2026-10-31) — the page and the Shop ⚙ both mount it.
const PAGE = stripComments(readFileSync(join(HERE, '_components', 'plan-screen.tsx'), 'utf8'));
const PICKER = stripComments(readFileSync(join(HERE, '_components/plan-sheet.tsx'), 'utf8'));
const ROWS = stripComments(readFileSync(join(HERE, '_components/plan-rows.tsx'), 'utf8'));

test('the plans are rows that open in place, and the cycle is one dropdown', () => {
  assert.match(PICKER, /<Fold\b[\s\S]*?defaultOpen=\{isCurrent\}/);
  assert.match(PICKER, /What changes/);
  assert.match(PICKER, /What you pay/);
  assert.match(PICKER, /<PickMenu\s+label="Pay every"/);
  assert.doesNotMatch(PICKER, /<PickMenu\s+label="Your plan"/, 'the bare plan dropdown is back');
  assert.match(PICKER, /<LockButton\b[\s\S]*?lock="plans"/);
  assert.ok(!existsSync(join(HERE, '_components/subscription-cards.tsx')), 'the plan cards are back');
  assert.ok(!existsSync(join(HERE, '_components/cycle-toggle.tsx')), 'the cycle pill track is back');
  assert.match(PAGE, /<PlanSheet[\s\S]*?action=\{startSubscriptionPurchase\}/);
  assert.match(PAGE, /planChanges\(currentTier, t, paywallOn\)/);
  assert.match(PAGE, /payToday\(\{/);
});

test('Pay posts only the SKU — never an amount', () => {
  const form = PICKER.slice(PICKER.indexOf('<form action={action}'), PICKER.indexOf('</form>', PICKER.indexOf('<form action={action}')));
  assert.match(form, /name="sku_code"/);
  assert.doesNotMatch(form, /name="(amount|price)[^"]*"/);
});

test('no peso is typed on the plan screen', () => {
  const ULTRA = stripComments(readFileSync(join(HERE, '_components/ultra-addons-card.tsx'), 'utf8'));
  for (const [name, src] of [['page.tsx', PAGE], ['plan-sheet.tsx', PICKER], ['plan-rows.tsx', ROWS], ['ultra-addons-card.tsx', ULTRA]] as const) {
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
  // The Custom plan door went 2026-11-06 with the plan itself (owner: "from the app") — it must not come back.
  assert.doesNotMatch(ROWS, /subscription\/custom/);
  assert.match(ROWS, /href="#add-ons"/);
  assert.match(PAGE, /id="add-ons"/);
  assert.match(PAGE, /<PlanRows/);
  assert.match(PAGE, /<AiAddonCard/);
  assert.match(PAGE, /<BoothAddonCard/);
  assert.match(PAGE, /<PapicChallengeCard/);
  // Every Ultra add-on, from the catalogue (owner 2026-11-06, "ULTRA ADD-ON PRICES").
  assert.match(PAGE, /<UltraAddonsCard rows=\{ultraRows\}/);
  assert.match(PAGE, /ultraAddOns\(supabase\)/);
  assert.match(ROWS, /href="\/vendor-dashboard\/on-the-day"/);
  assert.match(PAGE, /<PlanChangeNotice/);
});

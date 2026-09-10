/**
 * THE 3D PLAN IS FREE FOR COUPLES — and nothing in the tree still tries to sell
 * it to them.
 *
 * ── THE DECISION (owner 2026-09-05) ─────────────────────────────────────────
 * Couples pay nothing for the room. Vendors pay for BRANDED presence in it —
 * ₱500 per event or ₱3,000 per 4-week cycle (`vendor_3d_booth`). The couple's
 * published room is the shelf the vendor pays to be on; charging the couple
 * ₱1,500 to build that shelf taxed the inventory the vendor add-on sells into.
 *
 * ── WHAT WAS MEASURED BEFORE DECIDING ───────────────────────────────────────
 * The ₱1,500 `SEATING_3D` charge gated NOTHING at any layer: the latest
 * `public_venue_scene` definer checks only `published_at`; `/[slug]/venue` adds
 * only the event privacy gate; `publishSeating` has no entitlement check; the
 * lab and the 2D→3D segment are gated only on the `NEXT_PUBLIC_SEATING_3D`
 * kill-switch. The SKU had ZERO orders in its history. The buy card was,
 * functionally, a donation button — and the two published plans in production
 * both belong to internal-hosted events that owned every SKU anyway.
 *
 * ── WHAT THIS PINS ──────────────────────────────────────────────────────────
 * 1 · The switch itself: SEATING_3D in FREE_FOR_ALL_SKUS, the SAME mechanism
 *     LIVE_WALL / KWENTO / EDITORIAL_PRO already use. No new schema.
 * 2 · No couple-facing buy surface survives — not the card, not the notice, not
 *     a mount in the lab page.
 * 3 · The vendor-unlocks-couple ₱1,000 discount path is gone end to end: the
 *     lib, its actions, its section, its button, AND the branch in the catalogue
 *     price resolver that honoured it. A discount on a free thing is a sentence
 *     that cannot be true, and a resolver branch nobody reaches is exactly the
 *     "both ends built, no wire" shape this codebase keeps paying for.
 * 4 · The vendor still has the thing they DO pay for: the 3D Booth add-on card
 *     on the subscription page is untouched.
 *
 * Pure source reading — no DB, no React (the lib/figure-rig.ts discipline).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FREE_FOR_ALL_SKUS } from './entitlements';
import { stripComments } from './strip-comments';

const ROOT = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(ROOT, rel), 'utf8'));

test('SEATING_3D is free for every couple — the same switch the other free SKUs use', () => {
  assert.ok(FREE_FOR_ALL_SKUS.has('SEATING_3D'), 'the 3D Plan must sit in FREE_FOR_ALL_SKUS');
  // The neighbours are still there: this is an addition to a set, not a rewrite.
  for (const still of ['LIVE_WALL', 'KWENTO', 'EDITORIAL_PRO']) {
    assert.ok(FREE_FOR_ALL_SKUS.has(still), `${still} stays free`);
  }
});

test('no couple-facing buy surface for the 3D Plan survives', () => {
  for (const gone of [
    'app/dashboard/[eventId]/seating/lab/_components/couple-3d-plan-buy.tsx',
    'app/dashboard/[eventId]/seating/lab/_components/couple-3d-plan-unlock-notice.tsx',
  ]) {
    assert.ok(!existsSync(join(ROOT, gone)), `${gone} must be retired, not left orphaned`);
  }
  const lab = read('app/dashboard/[eventId]/seating/lab/page.tsx');
  assert.ok(!/Couple3dPlan(Buy|UnlockNotice)/.test(lab), 'the lab page must mount no buy card or unlock notice');
  assert.ok(!lab.includes('couple-3d-plan'), 'the lab page must import nothing from the retired components');
});

test('the vendor-unlocks-couple discount path is gone end to end', () => {
  for (const gone of [
    'lib/vendor-3d-plan-unlock.ts',
    'app/vendor-dashboard/clients/[eventId]/vendor-3d-plan-unlock-actions.ts',
    'app/vendor-dashboard/clients/[eventId]/_components/vendor-3d-plan-unlock-section.tsx',
    'app/vendor-dashboard/clients/[eventId]/_components/vendor-3d-plan-unlock-button.tsx',
  ]) {
    assert.ok(!existsSync(join(ROOT, gone)), `${gone} must be retired`);
  }
  const vendorPage = read('app/vendor-dashboard/clients/[eventId]/page.tsx');
  assert.ok(!vendorPage.includes('Vendor3dPlanUnlock'), 'the vendor client page must mount no unlock section');

  // The resolver branch — the half that would have kept "charging" a discount
  // on a free SKU if only the UI had been removed.
  const catalog = read('lib/v2-catalog.ts');
  assert.ok(!catalog.includes('VENDOR_3D_PLAN_UNLOCK_SERVICE_KEY'), 'v2-catalog must not branch on the retired key');
  assert.ok(!catalog.includes('vendor-3d-plan-unlock'), 'v2-catalog must not import the retired lib');
});

test('the vendor still has the thing they DO pay for', () => {
  // Retiring the couple price must not take the vendor product with it.
  assert.ok(
    existsSync(join(ROOT, 'app/vendor-dashboard/subscription/_components/booth-addon-card.tsx')),
    'the 3D Booth add-on card stays on the subscription page',
  );
  assert.ok(existsSync(join(ROOT, 'lib/vendor-3d-booth-pricing.ts')), 'booth pricing stays');
});

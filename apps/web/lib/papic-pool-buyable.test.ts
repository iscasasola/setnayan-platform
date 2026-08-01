/**
 * Papic Pool — the ADVERTISED-vs-BUYABLE invariant.
 *
 * Papic Pool shipped as a fake door and stayed one for days. Every part worked:
 *
 *   • three `PAPIC_GUEST*` rows, is_active=true at owner-set prices;
 *   • `papic_pass_tiers` rows resolving each to a point bucket;
 *   • `grantPapicPassPoints` wired in the activation map for all three, ready to
 *     write a `papic_event_point_grants` row the moment an order was approved;
 *   • an onboarding services card printing the whole ladder;
 *   • a Suite card whose CTA read "Open the pool ›".
 *
 * And no server action anywhere that could mint the order. The chain was
 * complete at both ends and severed in the middle, so nothing failed — the
 * couple simply arrived at a page that did not mention the product they had
 * just been sold. No test could see it, because every test asserted a PART.
 *
 * These assertions are about the SEAM. They fail if a Pool rung is sellable with
 * no activation hook (money in, no shots out — the worse direction), or if the
 * buy surface stops existing while the catalog still advertises the rungs.
 *
 * ⚠ Deliberately source-level, like lib/papic-copy-guardrails.test.ts. The point
 * is to fail in CI on a repo that no longer wires the two ends together, without
 * standing up a database.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

const ACTIONS = 'app/dashboard/[eventId]/studio/papic/actions.ts';
const POOL_CARD = 'app/dashboard/[eventId]/studio/papic/_components/papic-pool-card.tsx';
const PAPIC_PAGE = 'app/dashboard/[eventId]/studio/papic/page.tsx';
const ACTIVATION = 'lib/sku-activation.ts';

/**
 * The rungs the owner priced for sale on 2026-07-29. Spelled here ON PURPOSE —
 * this file is the place that asserts the wiring, so it must name what it is
 * asserting about. (The copy guardrails forbid literals in DISPLAY surfaces;
 * this is not one.)
 */
const POOL_RUNGS = ['PAPIC_GUEST', 'PAPIC_GUEST_6K', 'PAPIC_GUEST_10K'] as const;

test('every sellable Pool rung has an activation hook', () => {
  const src = read(ACTIVATION);
  for (const sku of POOL_RUNGS) {
    assert.match(
      src,
      new RegExp(`\\b${sku}\\s*:\\s*grantPapicPassPoints\\b`),
      `${sku} is on the Pool ladder but has no activation hook in ${ACTIVATION}. ` +
        `An approved order would take the couple's money and grant zero shots — ` +
        `the one failure mode worse than the fake door this file exists to prevent.`,
    );
  }
});

test('the Pool buy doorway exists and reaches a server action', () => {
  const card = read(POOL_CARD);
  assert.match(
    card,
    /action=\{purchasePapicPoolTopUp\}/,
    `${POOL_CARD} must post to purchasePapicPoolTopUp. Papic Pool is advertised ` +
      `in onboarding ("Top up any time from your Papic studio") and in Suite ` +
      `("Open the pool"), and BOTH land on the Papic studio — a card here that ` +
      `cannot mint an order re-opens the fake door.`,
  );
  assert.match(
    read(ACTIONS),
    /export async function purchasePapicPoolTopUp\(/,
    `${ACTIONS} must export purchasePapicPoolTopUp — the card imports it.`,
  );
});

test('the Papic studio mounts the Pool card', () => {
  assert.match(
    read(PAPIC_PAGE),
    /<PapicPoolCard\b/,
    `${PAPIC_PAGE} must render <PapicPoolCard>. This is the assertion that would ` +
      `have caught the original defect: the component, the action, the catalog ` +
      `rows and the activation hook can all be perfect while nothing MOUNTS the ` +
      `card, and the couple sees a studio with no pool in it.`,
  );
});

test('the Pool action resolves points and price server-side (SEC-4)', () => {
  const src = read(ACTIONS);
  const body = src.slice(src.indexOf('export async function purchasePapicPoolTopUp('));
  assert.ok(body.length > 0, 'purchasePapicPoolTopUp not found');

  // The browser posts a CHOICE (service_code); the server resolves the amount.
  assert.match(
    body,
    /fetchPapicPassTiers\(/,
    'points must come from papic_pass_tiers, never from the form',
  );
  assert.match(
    body,
    /platform_retail_catalog_v2/,
    'price must come from the catalog — the single billing source',
  );
  assert.match(
    body,
    /is_active\s*!==\s*true/,
    'the action must reject an inactive catalog row BEFORE an order exists — ' +
      'resolveRetailChargeCentavos prices by service_code alone, so a retired ' +
      'rung would otherwise still quote.',
  );
  // Nothing resembling an amount may be read off the submitted form.
  assert.doesNotMatch(
    body,
    /formData\.get\(\s*['"](?:amount|price|points|total)/i,
    'the client must never supply an amount',
  );
});

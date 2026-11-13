/**
 * 💳 EVENT ULTRA UPGRADE — PAY THE DIFFERENCE (owner 2026-11-13, DECISION_LOG row of that name: *"Pay the difference"*).
 *
 * An event that already paid Event Plus or Event Pro pays Ultra's row price minus its current plan's row price. The
 * prices below are SAMPLE numbers fed to the pure function — the real ones are only ever read from
 * `platform_retail_catalog_v2` (held by the source checks at the bottom).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ultraUpgradeCharge, ultraUpgradeLine } from '@/lib/event-ultra';
import { stripComments } from '@/lib/strip-comments';

const HERE = import.meta.dirname;
const read = (rel: string) => stripComments(readFileSync(path.join(HERE, rel), 'utf8'));

const SAMPLE = { ultraPhp: 10_000, proPhp: 6_000, plusPhp: 3_000 };

test('Plus → Ultra: pays Ultra minus Plus', () => {
  const c = ultraUpgradeCharge({ ...SAMPLE, proPaid: false, plusPaid: true, paidTowardProPhp: SAMPLE.plusPhp });
  assert.deepEqual(c, { ok: true, php: 7_000, creditPhp: 3_000, from: 'plus' });
});

test('Pro → Ultra: pays Ultra minus Pro', () => {
  const c = ultraUpgradeCharge({ ...SAMPLE, proPaid: true, plusPaid: false, paidTowardProPhp: 0 });
  assert.deepEqual(c, { ok: true, php: 4_000, creditPhp: 6_000, from: 'pro' });
});

test('Plus, then Pro, then Ultra: the credit is Pro, never Plus + Pro', () => {
  const c = ultraUpgradeCharge({ ...SAMPLE, proPaid: true, plusPaid: true, paidTowardProPhp: SAMPLE.plusPhp });
  assert.deepEqual(c, { ok: true, php: 4_000, creditPhp: 6_000, from: 'pro' });
});

test('an event that paid toward no plan gets no upgrade price (Ultra row price applies)', () => {
  assert.equal(ultraUpgradeCharge({ ...SAMPLE, proPaid: false, plusPaid: false, paidTowardProPhp: 0 }), null);
});

test('a paid plan whose price was not read refuses — never a silent ₱0 credit', () => {
  assert.deepEqual(ultraUpgradeCharge({ ...SAMPLE, proPhp: null, proPaid: true, plusPaid: false, paidTowardProPhp: 0 }), {
    ok: false,
    why: 'unpriced',
  });
  assert.deepEqual(ultraUpgradeCharge({ ...SAMPLE, plusPhp: null, proPaid: false, plusPaid: true, paidTowardProPhp: 0 }), {
    ok: false,
    why: 'unpriced',
  });
  assert.deepEqual(ultraUpgradeCharge({ ...SAMPLE, ultraPhp: null, proPaid: true, plusPaid: false, paidTowardProPhp: 0 }), {
    ok: false,
    why: 'unpriced',
  });
});

test('the difference is never below ₱0', () => {
  const c = ultraUpgradeCharge({ ultraPhp: 5_000, proPhp: 6_000, plusPhp: 3_000, proPaid: true, plusPaid: false, paidTowardProPhp: 0 });
  assert.ok(c && c.ok && c.php === 0);
});

test('the checkout says it plainly, with the amount it was handed', () => {
  assert.equal(ultraUpgradeLine('₱4,000.00', 'pro'), 'You pay ₱4,000.00 — the difference from your Event Pro');
  assert.equal(ultraUpgradeLine('₱7,000.00', 'plus'), 'You pay ₱7,000.00 — the difference from your Event Plus');
});

test('the charge and the drawer quote read the same one reader, and no ₱ figure is typed', () => {
  const auth = read('order-charge-authority.ts');
  const ultraBlock = auth.slice(auth.indexOf('if (serviceKey === EVENT_ULTRA_SKU)'), auth.indexOf('// ── (2) The retail catalog'));
  assert.match(ultraBlock, /readUltraUpgradeCharge\(admin, eventId\)/);
  assert.match(ultraBlock, /'event_ultra_upgrade'/);
  const reader = auth.slice(auth.indexOf('export async function readUltraUpgradeCharge'));
  assert.match(reader, /resolveRetailChargeCentavos\(eventId, EVENT_ULTRA_SKU\)/);
  assert.match(reader, /hubPartPrices\(admin\)/);
  assert.doesNotMatch(reader, /\b\d{4,}\b|\d_\d{3}/, "no price literal in the upgrade reader (only the centavo ×100)");
  const actions = read('../app/dashboard/[eventId]/checkout/actions.ts');
  assert.match(actions, /readUltraUpgradeCharge\(createAdminClient\(\), eventIdClean\)/);
  const drawer = read('../app/dashboard/[eventId]/_components/inline-checkout-drawer.tsx');
  assert.match(drawer, /ultraUpgradeLine\(originalGrossDisplay, upgradeQuote\.from\)/);
});

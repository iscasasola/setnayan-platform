/**
 * YOUR OWN WEB ADDRESS IS A ◆ PRO ITEM (owner 2026-10-15, DECISION_LOG "SIX OWNER ANSWERS" (3)).
 *
 * The shipped Pro pattern on Your page, applied to the web-address part:
 *   · the ◆ and the plan line are INFORMATION, asked through the ONE flag-aware question (`proAsks` =
 *     `vendorPaywallApplies(customWebsiteName)`, never in the App Store shell) — so while the owner's switch is off,
 *     nothing changes for anyone;
 *   · the FINAL action asks again (`addVendorDomain`), the payment-link pattern — a ◆ on the screen that the action
 *     does not hold would be a decoration, and an action that refuses without the ◆ would be a surprise.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url)); // app/vendor-dashboard/website
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));

test('1 · the web-address part wears the ◆ and says which press asks for Pro', () => {
  const parts = read('_components/page-parts.tsx');
  const at = parts.indexOf('anchor="domain"');
  assert.ok(at > 0, 'the web-address part is gone');
  const fold = parts.slice(at, parts.indexOf('</Fold>', at));
  assert.match(fold, /title=\{`Your web address\$\{diamond\(d\.proAsks\)\}`\}/, 'no ◆ on Your web address');
  assert.match(fold, /\{d\.proAsks \? <PlanAsk plan="Pro" when="[^"]+" \/> : null\}/, 'no plan line on Your web address');
});

test('2 · the ◆ is asked through the switch, from the plan’s own web-address cap, never in the store shell', () => {
  const page = read('page.tsx');
  assert.match(page, /proAsks: vendorPaywallApplies\(tierCaps\(asVendorTier\(d\.tier\)\)\.customWebsiteName\) && !d\.storeShell/);
});

test('3 · adding an address asks for Pro at the action, before anything is written', () => {
  const a = read('actions.ts');
  const body = a.slice(a.indexOf('export async function addVendorDomain('), a.indexOf('export async function verifyVendorDomain('));
  const ask = body.indexOf('vendorPaywallApplies(tierCaps(asVendorTier(tier)).customWebsiteName)');
  assert.ok(ask > 0, 'addVendorDomain never asks for Pro');
  assert.ok(ask < body.indexOf(".from('custom_domains')"), 'the domain row is written before Pro is asked');
  assert.ok(ask < body.indexOf('addProjectDomain('), 'the host is registered before Pro is asked');
  assert.match(body.slice(ask, ask + 200), /return \{ ok: false, error: OWN_ADDRESS_ASKS_FOR_PRO \}/);
});

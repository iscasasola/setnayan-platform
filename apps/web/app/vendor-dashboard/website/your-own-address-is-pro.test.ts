/**
 * YOUR OWN WEB ADDRESS IS A ◆ PLAN ITEM (owner 2026-10-15, DECISION_LOG "SIX OWNER ANSWERS" (3)) — Solo and up since
 * owner 2026-11-04 ("SUPPLIER PLAN ALLOWANCES": "website applies to solo as well"). It reads its own cap,
 * `customWebsiteName`; the Pro page parts read `premiumPage`, so the two ◆ no longer share one question.
 *
 * The shipped Pro pattern on Your page, applied to the web-address part:
 *   · the ◆ and the plan line are INFORMATION, asked through the ONE flag-aware question (`addressAsks` =
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

test('1 · the web-address part wears its own ◆ and names the plan from the table', () => {
  const parts = read('_components/page-parts.tsx');
  const at = parts.indexOf('anchor="domain"');
  assert.ok(at > 0, 'the web-address part is gone');
  const fold = parts.slice(at, parts.indexOf('</Fold>', at));
  assert.match(fold, /title=\{`Your web address\$\{diamond\(d\.addressAsks\)\}`\}/, 'no ◆ on Your web address');
  assert.match(fold, /\{d\.addressAsks \? <PlanAsk plan=\{d\.addressPlan\} when=\{`[^`]+`\} \/> : null\}/, 'no plan line on Your web address');
});

test('2 · the ◆ is asked through the switch, from the plan’s own web-address cap, never in the store shell', () => {
  const page = read('page.tsx');
  assert.match(page, /const ownAddressAsks = vendorPaywallApplies\(tierCaps\(asVendorTier\(d\.tier\)\)\.customWebsiteName\) && !d\.storeShell;/);
  assert.match(page, /addressAsks: ownAddressAsks,/);
  assert.match(page, /const addressPlan = TIER_LABEL\[firstPlanWith\(\(c\) => c\.customWebsiteName\) \?\? 'pro'\];/);
});

test('3 · adding an address asks for Pro at the action, before anything is written', () => {
  const a = read('actions.ts');
  const body = a.slice(a.indexOf('export async function addVendorDomain('), a.indexOf('export async function verifyVendorDomain('));
  const ask = body.indexOf('vendorPaywallApplies(tierCaps(asVendorTier(tier)).customWebsiteName)');
  assert.ok(ask > 0, 'addVendorDomain never asks for Pro');
  assert.ok(ask < body.indexOf(".from('custom_domains')"), 'the domain row is written before Pro is asked');
  assert.ok(ask < body.indexOf('addProjectDomain('), 'the host is registered before Pro is asked');
  assert.match(body.slice(ask, ask + 260), /return \{ ok: false, error: \(await isStoreShellRequest\(\)\) \? OWN_ADDRESS_ASKS_FOR_PRO_SHELL : OWN_ADDRESS_ASKS_FOR_PRO \}/);
  // The shell's refusal names no place to buy (the Plan route is refused there).
  // The plan's NAME is read from the table since 2026-11-04 (a template literal), so the words are checked around it.
  assert.doesNotMatch(a.match(/const OWN_ADDRESS_ASKS_FOR_PRO_SHELL = `([^`]*)`/)?.[1] ?? 'missing Plan', /Plan|pick|buy/i);
});

test('4 · W4 — while the ◆ asks, the domain card never also says "It’s free"', () => {
  const page = read('page.tsx');
  assert.match(page, /<DomainManager initial=\{d\.domains\} proAsks=\{ownAddressAsks\} \/>/, 'the domain card is not told the page asks for Pro');
  const dm = read('_domain-manager.tsx');
  const free = dm.match(/[^\n]*It’s free[^\n]*/g) ?? [];
  assert.ok(free.length > 0, 'the free line is gone — re-derive this test');
  for (const line of free) assert.match(line, /proAsks \? '' : ' It’s free\.'/, `an unconditional "It's free": ${line.trim()}`);
});

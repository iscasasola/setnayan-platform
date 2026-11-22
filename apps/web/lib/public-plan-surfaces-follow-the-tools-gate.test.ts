/**
 * 🧰 NO PUBLIC PLAN SURFACE SAYS A PLAN INCLUDES THE SPECIAL TOOLS UNLESS THE GATE DOES (fix pass on PR #8019, 22 Nov).
 *
 * THE FAULT. The owner moved the specialized tools to Pro and Ultra only (DECISION_LOG 21 Nov "SPECIAL TOOLS ARE
 * INCLUDED IN SUPPLIER PRO AND UP" · 22 Nov "THERE IS NO MAX PLAN"), and `SPECIALIZED_TOOLS_INCLUDED_TIERS` — the
 * TypeScript mirror of the database gate `vendor_specialized_tools_unlocked` — became `['pro', 'enterprise']`. Two
 * public pages had the line TYPED on the Plus row and went on promising it:
 *   · `/pricing` › For suppliers ........ Plus — "All specialized tools"
 *   · `/features` › Supplier plans ...... Plus — "All specialized tools included"
 * A typed line cannot follow a gate. Both are now placed by `lib/supplier-plan-public-words.ts`, which reads the list.
 *
 * WHAT THIS HOLDS, for every public surface that lists the supplier plans — `/pricing`, `/features`, `/for-suppliers`
 * (plan lines + the Plans table) and the Plan page's own "What <plan> gives you":
 *   1 · a plan OUTSIDE the list never says it includes the tools;
 *   2 · the first plan INSIDE the list does say it (the line did not simply vanish);
 *   3 · the words are not typed on a plan row in a page — they come from the one derived home.
 * It asks the LIST, never a typed plan name, so moving a plan in or out of the gate moves every surface with it.
 *
 * SABOTAGE THAT TURNS THIS RED (each run once, 22 Nov):
 *   · app/(shell)/pricing/page.tsx: type `what: 'All specialized tools'` on the Plus row again → "1 · /pricing" fails;
 *   · lib/features-page.ts: add 'All specialized tools included' to Plus's typed lines again → "2 · /features" fails;
 *   · lib/supplier-plan-public-words.ts: make `specializedToolsFromTier` answer 'solo' → all four tests fail.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { foldedLines } from '../app/for-suppliers/_components/supplier-front-data';
import { planTable } from '../app/for-suppliers/_components/plan-table-data';
import { SUPPLIER_PLANS } from './features-page';
import { SPECIALIZED_TOOLS_INCLUDED_TIERS } from './specialized-tools-access';
import { stripComments } from './strip-comments';
import {
  FEATURES_ALL_TOOLS_LINE,
  PAID_SUPPLIER_TIERS,
  featuresSupplierToolsLine,
  planHoldsWords,
  pricingSupplierPlanWhat,
  specializedToolsFromTier,
} from './supplier-plan-public-words';
import { planGivesLines, specializedToolsLine } from './vendor-plan-rows';
import { TIER_CAPS, TIER_LABEL, VENDOR_TIERS, type VendorTier } from './vendor-tier-caps';

const WEB = join(__dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const included = (t: VendorTier) => SPECIALIZED_TOOLS_INCLUDED_TIERS.includes(t);
/** "says this plan has ALL the special tools" — the claim the gate must back. */
const CLAIMS_ALL = /\ball (the )?speciali[sz]ed tools\b|\bspeciali[sz]ed tools,? included\b|^all included$/i;

test('the gate’s own list: Pro and Ultra — and the first paid plan it opens on is read from it, never typed', () => {
  // The owner's ruling, pinned once so a change to the list is a deliberate edit here too.
  assert.deepEqual([...SPECIALIZED_TOOLS_INCLUDED_TIERS], ['pro', 'enterprise']);
  assert.equal(specializedToolsFromTier(), PAID_SUPPLIER_TIERS.find(included) ?? null);
  assert.equal(specializedToolsFromTier(), 'pro');
});

test('1 · /pricing: only a plan in the gate’s list says "all specialized tools"; Plus says what Plus holds', () => {
  const first = specializedToolsFromTier();
  for (const t of PAID_SUPPLIER_TIERS) {
    const what = pricingSupplierPlanWhat(t);
    assert.ok(what.length > 0, `${t} has no line`);
    if (!included(t)) assert.doesNotMatch(what, /speciali[sz]ed tools/i, `/pricing promises the special tools on ${TIER_LABEL[t]}: "${what}"`);
  }
  assert.ok(first, 'no paid plan includes the tools — the line would be gone from /pricing');
  assert.match(pricingSupplierPlanWhat(first!), /all specialized tools/i, `/pricing no longer says ${TIER_LABEL[first!]} includes the special tools`);
  // Plus: its real numbers, from TIER_CAPS — the plan ladder's own nouns, no typed figure.
  assert.equal(pricingSupplierPlanWhat('solo'), planHoldsWords('solo'));
  const c = TIER_CAPS.solo;
  assert.equal(planHoldsWords('solo'), `${c.serviceCardsTotal} live cards · ${c.agentAccounts + 1} people · ${(c.storageBytes ?? 0) / 1e9} GB`);

  // The page asks the derived home for all three rows and types the claim on none of them.
  const page = src('app/(shell)/pricing/page.tsx');
  for (const t of PAID_SUPPLIER_TIERS) assert.match(page, new RegExp(`what: pricingSupplierPlanWhat\\('${t}'\\)`), `/pricing types the ${t} row again`);
  assert.doesNotMatch(page, /speciali[sz]ed tools/i, '/pricing carries a typed special-tools claim');
});

test('2 · /features: the tools line sits on the first plan the gate includes — and on no plan outside it', () => {
  const tierOf: Record<string, VendorTier> = { Free: 'free', Verified: 'verified', Plus: 'solo', Pro: 'pro', Ultra: 'enterprise' };
  assert.deepEqual(SUPPLIER_PLANS.map((p) => p.name), Object.keys(tierOf), 'a supplier plan column this guard does not know');
  const first = specializedToolsFromTier();
  for (const p of SUPPLIER_PLANS) {
    const t = tierOf[p.name]!;
    const claims = p.lines.filter((l) => CLAIMS_ALL.test(l));
    if (!included(t)) assert.deepEqual(claims, [], `/features promises the special tools on ${p.name}`);
    if (t === first) assert.deepEqual(claims, [FEATURES_ALL_TOOLS_LINE], `/features no longer says ${p.name} includes the special tools`);
  }
  // A paid plan below the gate says what it really has, in the Plan page's own words.
  assert.equal(featuresSupplierToolsLine('solo'), 'Specialized tools: the free set · all of them from Pro');
  assert.ok(SUPPLIER_PLANS.find((p) => p.name === 'Plus')!.lines.includes(featuresSupplierToolsLine('solo')!));
  assert.equal(specializedToolsLine('solo'), `The free set · all of them from ${TIER_LABEL[SPECIALIZED_TOOLS_INCLUDED_TIERS[0]!]}`);
  // The line is not typed in the page's data — it is placed by the derived home.
  const data = src('lib/features-page.ts');
  assert.doesNotMatch(data, /'[^'\n]*speciali[sz]ed tools included[^'\n]*'/i, 'lib/features-page.ts types the tools line on a plan again');
  assert.match(data, /lines: withTools\('solo',/);
  assert.match(data, /lines: withTools\('pro',/);
  assert.match(data, /lines: withTools\('enterprise',/);
});

test('3 · /for-suppliers and the Plan page: every plan line and table cell follows the same list', () => {
  for (const t of PAID_SUPPLIER_TIERS) {
    const folded = foldedLines(t).map((l) => l.text);
    const claims = folded.filter((l) => CLAIMS_ALL.test(l));
    if (!included(t)) assert.deepEqual(claims, [], `/for-suppliers promises the special tools under ${TIER_LABEL[t]}`);
    if (t === specializedToolsFromTier()) assert.equal(claims.length, 1, `/for-suppliers no longer says ${TIER_LABEL[t]} includes the special tools`);
  }
  // The Plans table: "All included" exactly on the gate's plans.
  const table = planTable({ paywallOn: true, prices: { monthly: {}, annual: {}, bySku: {} } });
  const row = table.flatMap((g) => g.rows).find((r) => r.key === 'tool:specialized');
  assert.ok(row, 'the Plans table lost its Specialized tools row');
  for (const [tier, cell] of Object.entries(row!.cells) as [VendorTier, { kind: string; text: string }][]) {
    assert.equal(cell.text === 'All included', included(tier), `the Plans table says "${cell.text}" for ${tier}`);
  }
  // The Plan page's "What <plan> gives you".
  for (const t of VENDOR_TIERS) {
    const line = planGivesLines(t, true).find((l) => l.key === 'tools')!.line;
    assert.equal(CLAIMS_ALL.test(line), included(t), `the Plan page says "${line}" for ${t}`);
  }
  // For Suppliers places its line by the list too (never a typed plan).
  assert.match(src('app/for-suppliers/_components/supplier-front-data.ts'), /GROW_TIERS\.find\(\(g\) => SPECIALIZED_TOOLS_INCLUDED_TIERS\.includes\(g\)\)/);
});

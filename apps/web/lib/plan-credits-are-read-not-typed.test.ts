/**
 * plan-credits-are-read-not-typed.test.ts — RW-12 (Controller re-walk, 2026-11-14).
 *
 * /pricing and /features name each event plan's Papic credits (Event Ultra's 3,500 among them) from the catalogue
 * row's `included_papic_credits`, never a typed count. The sample counts below are deliberately NOT the live ones,
 * so a page that typed the live number would not pass by luck.
 *
 *   1. /pricing's reads carry each plan's count from its row; a row with none, or no row, gives null.
 *   2. /features' plan columns swap the wordy credits line for the counted one when the row is read and active, and
 *      keep the wordy line when the rows are unread, inactive or carry no count.
 *   3. Source: neither page nor the plan data types a credit count ("<digits> Papic credits").
 *
 * SABOTAGE (run red, then restored): `credits()` in `ourPricesFrom` returning a typed 3500 → 1 RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ourPricesFrom } from '@/app/(shell)/pricing/_pricing-reads';
import { EVENT_PLANS, planLines } from '@/lib/features-page';
import type { CatalogueRow } from '@/lib/feature-pages/price';
import type { V2CustomerSku } from '@/lib/v2-catalog';
import { stripComments } from '@/lib/strip-comments';

const sku = (service_code: string, php: number, credits: number | null) =>
  ({ service_code, title: service_code, retail_price_php: php, onboarding_price_php: null, included_papic_credits: credits }) as unknown as V2CustomerSku;

test('1 · /pricing reads each plan’s credits from its row', () => {
  const p = ourPricesFrom([sku('EVENT_PLUS', 11, 1234), sku('COUPLE_WEBSITE_PRO', 22, 5678), sku('EVENT_ULTRA', 33, 4321)], []);
  assert.deepEqual(p.planCredits, { plus: 1234, pro: 5678, ultra: 4321 });
  const none = ourPricesFrom([sku('EVENT_PLUS', 11, null)], []);
  assert.deepEqual(none.planCredits, { plus: null, pro: null, ultra: null });
});

const ultra = EVENT_PLANS.find((p) => p.name === 'Event Ultra')!;
const plus = EVENT_PLANS.find((p) => p.name === 'Event Plus')!;
const row = (code: string, credits: number | null, active = true): CatalogueRow => ({ catalogue: 'retail', code, php: 10, period: 'one_time', active, credits });

test('2 · /features names the count when read, the wordy line otherwise', () => {
  assert.ok(planLines(ultra, [row('EVENT_ULTRA', 4321)]).includes('Everything in Pro, 4,321 Papic credits'));
  assert.ok(planLines(plus, [row('EVENT_PLUS', 1234)]).includes('1,234 Papic credits included'));
  assert.deepEqual(planLines(ultra, null), ultra.lines);
  assert.deepEqual(planLines(ultra, [row('EVENT_ULTRA', 4321, false)]), ultra.lines);
  assert.deepEqual(planLines(ultra, [row('EVENT_ULTRA', null)]), ultra.lines);
  assert.equal(planLines(ultra, [row('EVENT_ULTRA', 4321)]).length, ultra.lines.length);
});

test('3 · no page types a credit count', () => {
  const root = process.cwd();
  for (const f of ['app/(shell)/pricing/page.tsx', 'app/(shell)/pricing/_pricing-reads.ts', 'app/features/_plans-view.tsx', 'lib/features-page.ts']) {
    const src = stripComments(readFileSync(join(root, f), 'utf8'));
    assert.doesNotMatch(src, /\b\d[\d,]*\s+Papic credits/, `${f} types a credit count`);
  }
});

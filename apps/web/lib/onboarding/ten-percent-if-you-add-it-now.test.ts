/**
 * ten-percent-if-you-add-it-now.test.ts
 *
 * ⚖ Owner, 2026-08-28: *"we give them a 10% discount if they purchase now. They
 * can order later, but they will lose the 10% discount."* — then, on how wide it
 * goes: *"10% for all purchase on onboarding"*.
 *
 * 🔑 RULE 0: the mechanic already existed. `onboarding_price_php` has meant
 * "what this costs during the create flow" since it was built, and has been
 * charged for Setnayan AI the whole time. The Papic rungs never had one, and the
 * create flow read `retail_price_php` — quoting the LATER price at the one
 * moment the earlier one applies.
 *
 * 🔴 AND "10% FOR ALL" TAKEN LITERALLY WOULD HAVE RAISED THREE PRICES. Every
 * Setnayan AI tier already discounts 40–50% at sign-up; assigning 90% of retail
 * would have moved the flagship from ₱1,499 to ₱2,249. **A discount ruling must
 * never come out the other end as a price rise**, so it is written as a FLOOR:
 * at least a tenth off, and a better sign-up price already on the row wins.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildServicesStepView } from './services-step-data';
import { poolPriceAt, poolListPriceAt, poolStepOf, stepPool } from '../onboarding-services-selection';

const web = process.cwd();
const read = (rel: string) => readFileSync(join(web, rel), 'utf8');
const strip = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const TIERS = [
  { serviceCode: 'PAPIC_GUEST_1K', points: 1_000, isTopup: false },
  { serviceCode: 'PAPIC_GUEST_2K', points: 2_000, isTopup: false },
] as never[];

function view(price: Map<string, number>, list?: Map<string, number>) {
  return buildServicesStepView({
    eventWord: 'birthday',
    poolTiers: TIERS,
    oneTiers: [],
    pricePhpByCode: price,
    listPricePhpByCode: list,
    freePoolPoints: 50,
    freeOnePoints: 0,
    aiPricePhp: null,
  });
}

test('a rung quotes the sign-up price and remembers the later one', () => {
  const v = view(
    new Map([['PAPIC_GUEST_1K', 450], ['PAPIC_GUEST_2K', 900]]),
    new Map([['PAPIC_GUEST_1K', 500], ['PAPIC_GUEST_2K', 1_000]]),
  );
  const pool = v.papic.types.find((t) => t.id === 'pool')!;
  assert.deepEqual(
    pool.rungs.map((r) => [r.pricePhp, r.listPricePhp]),
    [[450, 500], [900, 1_000]],
  );
});

test('⛔ no invented "was" price when the rung has no discount', () => {
  // listPricePhp collapses onto pricePhp, so the card's saving is 0 and the
  // struck-through figure never renders. A "was" price nobody was ever charged
  // is the oldest trick in retail.
  const v = view(new Map([['PAPIC_GUEST_1K', 500], ['PAPIC_GUEST_2K', 1_000]]));
  const pool = v.papic.types.find((t) => t.id === 'pool')!;
  for (const r of pool.rungs) assert.equal(r.listPricePhp, r.pricePhp);
});

test('🪤 a list price BELOW what you pay is refused, not rendered', () => {
  // Bad data must not produce "save -₱50".
  const v = view(new Map([['PAPIC_GUEST_1K', 500]]), new Map([['PAPIC_GUEST_1K', 400]]));
  const pool = v.papic.types.find((t) => t.id === 'pool')!;
  assert.equal(pool.rungs[0]!.listPricePhp, 500);
});

test('the stepper reports both prices for the step it is on', () => {
  const v = view(
    new Map([['PAPIC_GUEST_1K', 450], ['PAPIC_GUEST_2K', 900]]),
    new Map([['PAPIC_GUEST_1K', 500], ['PAPIC_GUEST_2K', 1_000]]),
  );
  const pool = v.papic.types.find((t) => t.id === 'pool')!;
  let sel = stepPool(pool, { poolRungKey: null, papicOneRungKey: null, ai: false } as never, +1);
  const step = poolStepOf(pool, sel);
  assert.equal(poolPriceAt(pool, step), 450);
  assert.equal(poolListPriceAt(pool, step), 500);
  // The free floor is granted, not sold — it has no "later" price either.
  assert.equal(poolPriceAt(pool, 0), 0);
  assert.equal(poolListPriceAt(pool, 0), 0);
});

// ── the two ends must read the SAME column ─────────────────────────────────
test('🔴 the charge reads the sign-up price, not just the card', () => {
  // A discount shown on the card and not applied at checkout is a bill that
  // disagrees with the screen somebody agreed to — worse than never offering it.
  const src = strip(read('lib/onboarding-services-orders.ts'));
  assert.match(
    src,
    /\.select\('retail_price_php, onboarding_price_php, is_active'\)/,
    'the mint must read the sign-up price',
  );
  assert.match(src, /signup > 0 && signup <= retail \? signup : retail/,
    'and use it, falling back rather than charging MORE for buying early');
});

test('🪤 a NULL discount is never read as free', () => {
  // Most catalog rows carry no discount. Reading NULL as 0 would pass the
  // "priced above zero" gate at exactly the wrong moment.
  const src = strip(read('lib/onboarding-services-orders.ts'));
  assert.match(src, /if \(!Number\.isFinite\(php\) \|\| php <= 0\) return null;/,
    'an unpriced row must still be refused');
  const server = strip(read('lib/onboarding/services-step-server.ts'));
  assert.match(
    server,
    /typeof signup === 'number' && Number\.isFinite\(signup\) && signup > 0/,
    'the card must treat a missing discount as "no discount", never as zero',
  );
  /**
   * 🪤 AND THE RESOLVER MUST BE THE ONE ACTUALLY USED. This assertion is here
   * because its absence was caught by mutation, not by review: gutting the map
   * back to `Number(s.retail_price_php)` left `priceOfRow` DEFINED AND UNUSED
   * above it, every other assertion in this file still passed, and the card
   * quietly went back to quoting the later price. **A helper that exists is not
   * a helper that runs** — same shape as an import left standing after its call
   * site was deleted.
   */
  assert.match(
    server,
    /pricePhpByCode = new Map<string, number>\(\s*customerSkus\.map\(\(s\) => \[s\.service_code, priceOfRow\(s\)\]\)/,
    'the price the card shows must be BUILT from the sign-up resolver',
  );
  assert.match(
    server,
    /listPricePhpByCode = new Map<string, number>\(\s*customerSkus\.map\(\(s\) => \[s\.service_code, Number\(s\.retail_price_php\)\]\)/,
    'and the "later" price must be the retail one',
  );
});

test('the card names what you save and what it costs later', () => {
  const src = strip(read('app/onboarding/_shared/services-step.tsx'));
  assert.match(src, /You save \{peso\(saving\)\} by adding it now/, 'the saving is stated');
  assert.match(src, /it&rsquo;s \{peso\(listPricePhp!\)\} later/, 'and so is the later price');
  assert.match(src, /saving > 0 &&/, 'and only when there is one');
});

// ── the migration ──────────────────────────────────────────────────────────
test('🔴 the migration is a FLOOR, so it can never raise a sign-up price', () => {
  const sql = read('../../supabase/migrations/20271176315255_ten_percent_if_you_add_it_now.sql');
  assert.match(sql, /LEAST\(/, 'the discount must be a floor, not an assignment');
  assert.match(
    sql,
    /ended up costing MORE at sign-up/,
    'and the migration must refuse to commit if any AI tier rose',
  );
  // Scope is the IN-list, not the file: the docblock NAMES the renewal row to
  // explain why it is excluded, and a whole-file match would read that
  // explanation as the bug it is explaining.
  const inList = /service_code IN \(([^)]*)\)/.exec(sql)?.[1] ?? '';
  assert.ok(inList.length > 0, 'the AI tier list must exist');
  assert.ok(
    !inList.includes('SETNAYAN_AI_RENEW'),
    'a renewal is not an onboarding purchase — and it is the one row where 10% '
      + 'lands on a fraction of a peso',
  );
  // Derived, never re-typed: sixteen hand-copied prices is how two copies of one
  // number come to disagree.
  assert.match(sql, /retail_price_php \* 0\.90/, 'the figure comes off the retail price');
});

// ── it has to be READABLE, and its deadline has to be readable too ─────────
test('🔴 the discount is stated before you choose, on the item, and on the total', () => {
  // Owner, 2026-08-28: *"Onboarding discount should be visible and easy to
  // understand that this discount only applies on onboarding."* A discount
  // nobody notices is one we paid for and did not sell; one whose deadline is
  // not stated is one somebody feels tricked by later. Three places, because
  // those are the three moments a person looks.
  const src = strip(read('app/onboarding/_shared/services-step.tsx'));

  // 1 · before they choose
  assert.match(src, /Anything you add here is at least 10% off\./, 'the banner states the rule');
  assert.match(src, /it ends when you finish/, 'and its deadline');
  assert.match(src, /at the normal price/, 'and what happens if they wait');

  // 2 · on the item
  assert.match(src, /You save \{peso\(saving\)\} by adding it now/, 'each rung states its saving');
  assert.match(src, /off while you&rsquo;re setting up/, 'and so does the planner');

  // 3 · on the total, where they agree to it
  assert.match(src, /You save by setting up now/, 'the total states the saving');
  assert.match(
    src,
    /The same things cost \{peso\(laterPhp\)\} if you add them later/,
    'and names the other number, so the deadline is a figure and not a feeling',
  );
});

test('⛔ every one of those lines disappears when there is nothing to save', () => {
  // The whole comparison collapses when no row carries a discount, so a catalog
  // with the column empty renders exactly today's screen. There is no path here
  // that prints "save ₱0" or a struck-through figure nobody was charged.
  const src = strip(read('app/onboarding/_shared/services-step.tsx'));
  assert.match(src, /const savingPhp = Math\.max\(0, laterPhp - quote\.totalPhp\);/, 'never negative');
  assert.match(src, /\{savingPhp > 0 && \(/, 'the total line is conditional');
  assert.match(src, /\{ai\.listPricePhp > ai\.pricePhp && \(/, 'the planner line is conditional');
  assert.match(src, /saving > 0 && \(/, 'the rung line is conditional');
});

test('the later total is built from the later prices, not from a percentage', () => {
  // Re-deriving "10%" in the UI would be a second copy of the rule, and the two
  // copies would disagree the first time a single row's discount changed.
  const sel = strip(read('lib/onboarding-services-selection.ts'));
  assert.match(sel, /export function quoteServicesStepLaterSelection/, 'it must exist');
  assert.match(sel, /poolListPriceAt\(pool, poolStepOf\(pool, selection\)\)/, 'from the rung');
  assert.doesNotMatch(sel, /0\.9|\* 0\.90|10 \/ 100/, 'and never from a re-typed percentage');
});

/**
 * setnayan-ai-two-prices.test.ts — Setnayan AI has TWO prices and the public
 * surfaces must show both, honestly.
 *
 * ─── WHY THIS EXISTS ─────────────────────────────────────────────────────
 * The owner set a sign-up price on 2026-08-12: one figure if you take Setnayan
 * AI while creating your event, another afterwards. Both live on the catalog row
 * (`retail_price_php` / `onboarding_price_php`) and the sign-up one was already
 * being CHARGED by `lib/setnayan-ai-event-pricing.ts`.
 *
 * It reached no public surface, and the reason is the repo's own recurring
 * shape: `fetchV2CustomerCatalog` never SELECTED the column. Nothing errored —
 * a field you do not ask for is simply absent, and absence is indistinguishable
 * from "there is no sign-up price". The page showed one number and was wrong
 * about the product for weeks.
 *
 * ─── AND THE FIRST VERSION OF THIS WORK HAD NO GUARD AT ALL ──────────────
 * A mutation that forced `aiHasSignupPrice: false` LANDED (occurrences 0 → 1)
 * and every suite stayed green. The two-price story would have silently
 * collapsed back to one price and CI would have applauded. That is what this
 * file is for.
 *
 * ⚠ TESTING THE PRIMITIVE IS NOT TESTING THE CALLER. `resolveAiPrices` being
 * correct proves nothing if `/pricing` stops calling it or the catalog read
 * stops asking for the column — so the second half of this file anchors on both
 * call sites, by the ACT (the select naming the field, the page rendering the
 * second figure) and not merely by an import.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveAiPrices } from './pricing-data';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..', '..'); // apps/web (this file is app/_components/home/)
const read = (p: string) => readFileSync(resolve(WEB, p), 'utf8');

/* ─── THE FOUR RULES ─────────────────────────────────────────────────────── */

test('a sign-up price below the regular one is the one a visitor is quoted', () => {
  const r = resolveAiPrices({ retail_price_php: 2499, onboarding_price_php: 1499 });
  assert.equal(r.regularPhp, 2499);
  assert.equal(r.introPhp, 1499);
  assert.equal(r.hasSignupPrice, true);
});

test('NULL sign-up means no discount — never free, never zero', () => {
  // The direction that matters. Reading NULL as 0 hands the product away, and
  // it is the reading a careless `?? 0` produces.
  for (const row of [
    { retail_price_php: 2499, onboarding_price_php: null },
    { retail_price_php: 2499 },
    { retail_price_php: 2499, onboarding_price_php: 0 },
  ]) {
    const r = resolveAiPrices(row);
    assert.equal(r.introPhp, 2499, `${JSON.stringify(row)} must charge the regular price`);
    assert.equal(r.hasSignupPrice, false);
  }
});

test('a sign-up price at or ABOVE the regular one is ignored', () => {
  // It would punish buying early. Display must not be laxer than the charge,
  // which already refuses this crossing.
  for (const signup of [2499, 3999]) {
    const r = resolveAiPrices({ retail_price_php: 2499, onboarding_price_php: signup });
    assert.equal(r.introPhp, 2499);
    assert.equal(r.hasSignupPrice, false, `sign-up ${signup} must not be shown as a discount`);
  }
});

test('an unreadable row yields no figure at all — never an invented peso value', () => {
  for (const row of [null, undefined, {}, { retail_price_php: 0 }, { retail_price_php: null }]) {
    const r = resolveAiPrices(row);
    assert.equal(r.regularPhp, 0, `${JSON.stringify(row)} must not invent a price`);
    assert.equal(r.hasSignupPrice, false);
  }
});

test('hasSignupPrice cannot be true while the two figures are equal', () => {
  // The flag is what every surface branches on, so a surface must never be able
  // to announce a discount it is not showing.
  for (const [reg, sign] of [
    [2499, 1499],
    [2499, 2499],
    [2499, null],
    [0, 1499],
  ] as const) {
    const r = resolveAiPrices({ retail_price_php: reg, onboarding_price_php: sign });
    assert.equal(
      r.hasSignupPrice,
      r.regularPhp > 0 && r.introPhp < r.regularPhp,
      `flag disagrees with the figures for ${reg}/${sign}`,
    );
  }
});

/* ─── THE CALLERS ────────────────────────────────────────────────────────── */

test('the public catalog read actually ASKS for the sign-up price', () => {
  // 🔑 THE WHOLE DEFECT IN ONE LINE. A field the select does not name comes back
  // undefined, and undefined reads exactly like "this service has no sign-up
  // price" — no error, no log, a wrong price on the page. Anchored to the
  // select() call, not to the string appearing somewhere in the file, because a
  // docblock mentioning the column is not a read of it.
  const src = read('lib/v2-catalog.ts');
  const selects = [...src.matchAll(/\.select\(\s*'([^']*)'/g)].map((m) => m[1] ?? '');
  const customerSelect = selects.find((s) => s.includes('saas_overhead_cost_php'));
  assert.ok(customerSelect, 'the customer-catalog select() moved or was renamed');
  assert.match(
    customerSelect,
    /\bonboarding_price_php\b/,
    'fetchV2CustomerCatalog stopped selecting onboarding_price_php — every public ' +
      'surface silently reverts to one price, with nothing to notice it',
  );
});

test('/pricing renders BOTH figures, and gets them from the shared resolver', () => {
  const src = read('app/pricing/page.tsx');
  assert.match(
    src,
    /resolveAiPrices\s*\(/,
    '/pricing stopped using the shared resolver — it will drift from the nav overlay',
  );
  // The act, not the import: the card must actually render the second figure.
  assert.match(
    src,
    /\{aiSignupLabel\s*\?\?\s*aiRegularLabel\}/,
    'the headline figure is no longer the sign-up price when one exists',
  );
  assert.match(
    src,
    /\{aiRegularLabel\}<\/span>/,
    'the regular price is no longer shown beside the sign-up one — a visitor ' +
      'would discover it only after paying',
  );
});

test('the savings comparator quotes the REGULAR price, not the sign-up one', () => {
  // 🪤 A DEFECT INTRODUCED BY THIS VERY CHANGE, CAUGHT BY RE-READING THE
  // CONSUMERS. `aiIntroPhp` used to be an ALIAS of the regular price, so
  // `const mine = pricing.aiIntroPhp` was harmless. Giving the field its real
  // meaning silently repointed the comparator at the LOWER figure — on a panel
  // that already headlines `aiPrice` (the regular one). Two different prices on
  // one card with no explanation, and every "you save X" quietly grows.
  //
  // 🔑 CHANGING WHAT A SHARED FIELD MEANS CHANGES EVERY READER OF IT. Widening a
  // type is visible to the compiler; narrowing a MEANING is not.
  //
  // The regular price understates the saving, which is the safe direction for a
  // marketing claim. Making it larger is the owner's call, not a refactor's.
  const src = read('app/_components/home/HomeOverlays.tsx');
  assert.match(
    src,
    /const mine = pricing\.aiRegularPhp;/,
    'the savings comparator must value Setnayan AI at the REGULAR price — using ' +
      'the sign-up price inflates every "you save X" on the panel and contradicts ' +
      'the headline figure shown beside it',
  );
});

test('no peso literal was reintroduced as a Setnayan AI fallback', () => {
  // The ₱499 that stood here was FIVE TIMES off the live ₱2,499 and nothing
  // checked it, because it was declared a non-price. Comments are stripped: a
  // docblock explaining the removal is not a reintroduction.
  const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const f of ['app/pricing/page.tsx', 'app/_components/home/pricing-data.ts']) {
    const near = code(read(f)).match(/(?:aiRegular|aiIntro|aiSignup|resolveAiPrices)[\s\S]{0,400}?₱[\d,]+/);
    assert.equal(near, null, `${f} reintroduced a hardcoded Setnayan AI peso figure: ${near?.[0]}`);
  }
});

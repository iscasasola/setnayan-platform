import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FREE_FOR_ALL_SKUS } from './entitlements';

/**
 * kwento-is-free.test.ts
 *
 * Owner, 2026-08-21, verbatim: **"kwento is free."**
 *
 * 🪤 THE TRAP THIS GUARDS IS THE OBVIOUS FIX. Every gate on Kwento asks whether
 * the event OWNS the SKU. Setting `is_active = false` — the way a genuinely
 * retired product is taken off sale — means nobody can buy it, therefore nobody
 * owns it, therefore **the feature goes DARK for everyone**: the exact opposite
 * of free. Free and retired are identical in that table and opposite in the
 * product. Both halves must ship together or not at all.
 *
 * 🛡 Mutation-checked by occurrence count.
 */

const WEB = dirname(dirname(fileURLToPath(import.meta.url)));
const code = (p: string) =>
  readFileSync(join(WEB, p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '');

test('Kwento is free for every event', () => {
  assert.ok(FREE_FOR_ALL_SKUS.has('KWENTO'), 'the switch that keeps the feature ON');
  // The precedent it copies must not be lost in the process.
  assert.ok(FREE_FOR_ALL_SKUS.has('LIVE_WALL'), 'LIVE_WALL stays free');
});

/*
  BOTH HALVES, OR NEITHER. The migration deactivates the row so nothing quotes a
  price; the set above keeps the feature switched on. A guard that checked only
  one would go green on the change that takes Kwento away from everybody.
*/
test('the catalog row is deactivated in the same change', () => {
  const dir = join(WEB, '..', '..', 'supabase', 'migrations');
  const file = readdirSync(dir).find((f) => f.endsWith('_kwento_is_free.sql'));
  assert.ok(file, 'the migration must exist alongside the code half');
  const raw = readFileSync(join(dir, file), 'utf8');
  /*
    🪤 COMMENTS STRIPPED — AND A MUTATION FOUND THIS HOLE, NOT A REVIEW.
    This migration explains itself at length, and its prose quotes the very
    clauses asserted below. Removing the real `IS DISTINCT FROM false` guard
    left the phrase standing in a comment, so the assertion went GREEN on prose
    while the statement had lost its idempotence. Raw: 2. Stripped: 1.
    A guard that reads a comment is a guard that reads the intention, not the act.
  */
  const sql = raw.replace(/^\s*--.*$/gm, '');
  assert.match(sql, /SET is_active\s*=\s*false/i);
  assert.match(sql, /service_code = 'KWENTO'/);
  assert.match(sql, /IS DISTINCT FROM false/i, 'idempotent — a re-apply is a no-op');
  assert.equal(
    (sql.match(/IS DISTINCT FROM false/gi) || []).length,
    1,
    'exactly one guard, in the statement — not one in the prose',
  );
  // The historical figure survives a reversal.
  assert.ok(!/retail_price_php\s*=\s*0/i.test(sql), 'do not zero the price; deactivate it');
  assert.match(raw, /299\.00/, 'the historical figure survives a reversal');
});

/*
  🪤 REMOVING THE ENTRY AND THE PROSE PRICE TOGETHER IS MANDATORY. Leaving the
  entry throws RetiredSkuError and drops the whole AI/GEO document to its stub;
  leaving the price call throws MissingSkuError for the same result. That is not
  theoretical — it happened in production with PAPIC_ADDON_STORIES.
*/
test('llms.txt stops requiring a price and stops printing one', () => {
  const src = readFileSync(join(WEB, 'lib/llms-txt.ts'), 'utf8');
  /*
    ⚠ `REQUIRED_RETAIL` is module-private, so importing it hands back
    `undefined` and every assertion on it passes vacuously. The first cut of
    this test did exactly that and threw — loudly, which is the only reason it
    was caught. Read the LIST OUT OF THE SOURCE instead of exporting a constant
    purely to test it.
  */
  const list = src.slice(src.indexOf('const REQUIRED_RETAIL = ['));
  const body = list.slice(0, list.indexOf('];'));
  assert.ok(body.length > 0, 'the list must still exist');
  assert.ok(
    !/^\s*'KWENTO',/m.test(body),
    'a retired row this file still requires drops the document to its stub',
  );
  // The neighbours prove the slice is really the list and not an empty match.
  assert.match(body, /^\s*'PAKANTA',/m);
  assert.match(body, /^\s*'PABATI',/m);
  /*
    🪤 STRIPPED, because the fix QUOTES the call it removed. On raw source this
    assertion failed on its own first run and reported the defect it had just
    repaired — the same trap `doors-are-designed.test.ts` was corrected for.
    Raw: 1. Stripped: 0. Zero is the true number.
  */
  assert.ok(
    !/R\('KWENTO'\)/.test(code('lib/llms-txt.ts')),
    'and the prose price call must go with it',
  );
  assert.match(src, /\*\*Kwento\*\* — free\./, 'the line stays, describing a free feature');
});

/*
  The paywall itself. Deleted, not hidden — it priced itself from a lookup that
  now returns null, with a `?? 500` fallback, so a branch left standing would
  quote ₱500 for something free.
*/
test('the buy drawer is gone from the moderation page, fallback and all', () => {
  const mod = code('app/dashboard/[eventId]/studio/papic/moderation/page.tsx');
  assert.ok(!/serviceKey="KWENTO"/.test(mod), 'no buy drawer');
  assert.ok(!/kwentoPricePhp|kwentoPriceLabel/.test(mod), 'no price plumbing left behind');
  assert.ok(!/\?\? 500/.test(mod), 'and no hardcoded fallback to quote');
});

/*
  The gate STAYS. It is the one place the rule is enforced, so a reversal is one
  set away rather than a hunt for every surface.
*/
test('the entitlement check is still asked, everywhere it was', () => {
  for (const f of [
    'app/api/papic/kwento/route.ts',
    'app/dashboard/[eventId]/studio/papic/moderation/page.tsx',
  ]) {
    assert.match(code(f), /eventKwentoEnabled\(/, `${f} must still ask`);
  }
  // And that helper must still route through the free-for-all short circuit.
  assert.match(code('lib/kwento-access.ts'), /eventSkuActive\(admin, eventId, 'KWENTO'\)/);
});

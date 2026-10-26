/**
 * 🆓 THE THANK-YOU VIDEO IS FREE FOR EVERY EVENT, WEB AND APP (owner 2026-10-26: *"let us remove thank you from the
 * inapp purchase"* → *"make it free for now"*).
 *
 * BOTH HALVES, OR NEITHER — the LIVE_WALL lesson (DECISION_LOG 2026-08-11): free and retired are the same catalogue
 * row and opposite products. Deactivating the row alone means nobody can buy it ⇒ nobody owns it ⇒ the film goes DARK
 * for everyone. So:
 *
 *   1. `PAPIC_ADDON_THANK_YOU` is in `FREE_FOR_ALL_SKUS`, and every ownership predicate answers yes with no order —
 *      without even asking the database;
 *   2. the migration deactivates the row ONLY so nothing quotes a price, and keeps the price for a reversal;
 *   3. the iPhone app never offers it: `com.setnayan.app.papic_thank_you` is retired (listed, never reused);
 *   4. the Thank You page draws no checkout for an owner — "Save to my phone" with no price;
 *   5. llms.txt says "free" and no longer quotes the row (a quoted inactive row drops the file to its stub);
 *   6. the Papic page carries no paid marker, and /pricing's paid row follows the (now inactive) row.
 *
 * Run: cd apps/web && node --import tsx --test lib/thank-you-video-is-free.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import { FREE_FOR_ALL_SKUS, eventOwnsSku, eventSkuActive } from './entitlements';
import { IAP_PRODUCT_IDS, RETIRED_IAP_PRODUCT_IDS, iapProductById, iapProductForServiceKey } from './iap/products';
import { stripComments } from './strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = join(WEB, '../../supabase/migrations');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const SKU = 'PAPIC_ADDON_THANK_YOU';

/** A client that fails the test if it is ever asked anything — free must answer before any read. */
const untouchable = new Proxy({}, {
  get: () => {
    throw new Error('the database was asked whether a FREE product is owned');
  },
}) as unknown as SupabaseClient;

test('1 · free for every event: owned and active with no order, before any read', async () => {
  assert.ok(FREE_FOR_ALL_SKUS.has(SKU), 'the Thank-You Video left the free set — with its row off, it is DARK for everyone');
  assert.equal(await eventSkuActive(untouchable, 'evt_any', SKU), true);
  assert.equal(await eventOwnsSku(untouchable, 'evt_any', SKU), true);
});

test('2 · the row is deactivated in a migration, the price kept — the other half', () => {
  const file = readdirSync(MIGRATIONS).find((f) => f.endsWith('_thank_you_video_is_free.sql'));
  assert.ok(file, 'the migration must exist alongside the free-set entry');
  const sql = stripComments(readFileSync(join(MIGRATIONS, file!), 'utf8'));
  assert.match(sql, /SET is_active\s*=\s*false/);
  assert.match(sql, /WHERE service_code = 'PAPIC_ADDON_THANK_YOU'/);
  assert.doesNotMatch(sql, /retail_price_php\s*=/, 'the price was overwritten — "for now" must be reversible with its figure');
});

test('3 · the iPhone app never offers it — the product is retired, its id kept and never reused', () => {
  const id = 'com.setnayan.app.papic_thank_you';
  assert.equal(iapProductById(id), null, 'Thank You is an App Store product again');
  assert.equal(iapProductForServiceKey(SKU), null);
  assert.ok(!IAP_PRODUCT_IDS.includes(id), 'StoreKit is asked for the retired Thank You product');
  assert.ok(RETIRED_IAP_PRODUCT_IDS.includes(id), 'the retired id is not listed — it could be reused');
});

test('4 · the Thank You page builds a checkout only for an event that does NOT own the film', () => {
  const page = code('app/dashboard/[eventId]/studio/thank-you/page.tsx');
  assert.match(page, /const owned = await eventSkuActive\(ent, eventId, SKU_CODE\);/);
  assert.match(page, /if \(!owned && appleIap\) \{/);
  assert.match(page, /\} else if \(!owned\) \{/);
  // …and the maker's Apple sheet and web drawer live only behind that checkout.
  const maker = code('app/dashboard/[eventId]/studio/thank-you/_components/thank-you-maker.tsx');
  assert.match(maker, /\{checkout \? \(/);
  assert.match(maker, /function SavePanel\(\{ eventId, checkout \}: \{ eventId: string; checkout: ThankYouSaveCheckout \}\)/);
});

test('5 · llms.txt says free and quotes no row', async () => {
  const src = code('lib/llms-txt.ts');
  assert.doesNotMatch(src, /'PAPIC_ADDON_THANK_YOU'/, 'llms.txt still requires the inactive row — the file would drop to its stub');
  assert.match(src, /\*\*Thank You Video\*\* — free\./);
});

test('6 · the public pages call it free — no paid marker; /pricing draws its paid row only from an ACTIVE row', () => {
  const papic = code('app/(shell)/papic/_papic-sections.tsx');
  assert.match(papic, /\{ t: 'A thank-you film', d: '[^']*Free\.' \}/, 'the Papic page still marks the film as paid');
  // /pricing's "Thank-you film ₱…" row is drawn only behind its price, read from the customer catalogue — which
  // reads ACTIVE rows only, so the row the migration turns off draws nothing.
  assert.match(code('app/(shell)/pricing/page.tsx'), /\{prices\.thankYou \? \(/);
  assert.match(code('lib/v2-catalog.ts'), /\.eq\('is_active', true\)/);
});

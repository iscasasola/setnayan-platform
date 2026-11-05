/**
 * GUARD — 🎁 YOUR GIFTS LIVES ON SHOP › PROMOTE, ONCE (owner 2026-11-05, DECISION_LOG "SHOP › PROMOTE IS THE HOME OF THE
 * SUPPLIER QR CODES, PRINTS AND GIFTS": one Promote place for every marketing tool).
 *
 *   1. Promote draws the shipped section (`ShopGiftsSection`) with its own reads (`loadShopGiftsSection`) — the same
 *      component that stood on the Plan page, never a redraw.
 *   2. The Plan page no longer draws it, reads it, or links to it ("Edit in X ↗" is banned) — one home, not two.
 *   3. The pinned row's gift figure is the SAME read's `stock.balance` — never typed, never a second read.
 *   4. A gift bought from the section refreshes Promote, not the Plan page it left.
 *   5. Giving a gift on a quote still reuses the section's Buy sheet (it stays in the quote — not moved).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(APP, rel), 'utf8'));

const PROMOTE = 'vendor-dashboard/shop/promote/page.tsx';
const PLAN = 'vendor-dashboard/subscription/_components/plan-screen.tsx';

test('1 · Promote draws the shipped gifts section with its own read', () => {
  const src = read(PROMOTE);
  assert.match(src, /import \{ ShopGiftsSection \} from '\.\/_components\/shop-gifts-section'/);
  assert.match(src, /loadShopGiftsSection\(supabase, profile\.vendor_profile_id\)/, 'Promote does not read the gifts');
  assert.equal([...src.matchAll(/<ShopGiftsSection\b/g)].length, 1, 'Promote does not draw the gifts section exactly once');
  assert.match(src, /<ShopGiftsSection data=\{gifts\} \/>/);
  assert.ok(!existsSync(join(APP, 'vendor-dashboard/subscription/_components/shop-gifts-section.tsx')), 'a copy of the section is back on Plan');
});

test('2 · the Plan page neither draws, reads nor links to the gifts', () => {
  const src = read(PLAN);
  assert.doesNotMatch(src, /ShopGiftsSection|shop-gifts-section/, 'Plan draws the gifts again — one home, Promote');
  assert.doesNotMatch(src, /fetchShopGift(Stock|Bought|Packs)|loadShopGiftsSection/, 'Plan still reads the gifts it no longer draws');
  assert.doesNotMatch(src, /shop\/promote/, 'Plan links to Promote — no go-elsewhere links');
});

test('3 · the row’s gift figure is the section’s own read', () => {
  const src = read(PROMOTE);
  assert.match(src, /const gifts = await giftsPromise;/);
  assert.match(src, /figures=\{promoteFigures\(\{\s*giftCredits:\s*gifts\.stock \? gifts\.stock\.balance : null\s*\}\)\}/, 'the figure is not the section’s stock (or an unread stock is not null)');
  assert.equal([...src.matchAll(/fetchShopGiftStock/g)].length, 0, 'a second stock read beside the section’s');
});

test('4 · buying a gift refreshes Promote, not the Plan page', () => {
  const src = read('vendor-dashboard/on-the-day/live/[eventId]/papic/portfolio-pack-actions.ts');
  assert.match(src, /if \(forGift\) revalidatePath\('\/vendor-dashboard\/shop\/promote'\)/);
  assert.doesNotMatch(src, /if \(forGift\) revalidatePath\('\/vendor-dashboard\/subscription'\)/);
});

test('5 · a quote still reuses the section’s Buy sheet (giving stays in the quote)', () => {
  assert.match(read('_components/quote-shop-gifts.tsx'), /import \{ BuyGiftsSheet \} from '@\/app\/vendor-dashboard\/shop\/promote\/_components\/shop-gifts-section'/);
});

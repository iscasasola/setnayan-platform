/**
 * 🔒 A SENT QUOTE IS A PRICE ON THE BENCH (couple walk on production, 13 Nov 2026 — event "TEST SetnaProd walk",
 * Suppliers → Mobile Bar, SetnaProd's quote S89J-TTSP5YNJTN, status sent, ₱6,750). The card's standing line said
 * "Quoted ₱6,750 · Sent today" while the SAME card said "Price on request" and "Ask for a price to add this to your
 * build": `priceBasisPhp` read `total_cost_php ?? starting_price_php` and never the live proposal.
 *
 * Fix: `withLiveQuotes` takes the amount the standing line already carries (`standingQuotePhp`, the stage segment's
 * `amountPhp`, off the same sent/viewed rows that decide the Quoted rung) as the card's price basis when it has none,
 * and marks the card `quotedPhp` — so the build action is Add, and the price slot never says "Price on request".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { withLiveQuotes, type ShortlistFolder, type ShortlistVendor } from './shortlist-taxonomy';
import { buildSupplierStanding, standingQuotePhp, standingSentence } from './supplier-standing';
import { resolveBenchCardActions } from './bench-card-actions';

const NOW = Date.parse('2026-11-13T08:00:00Z');

const card = (p: Partial<ShortlistVendor> = {}): ShortlistVendor =>
  ({
    vendorId: 'ev-mobile-bar',
    name: 'SetnaProd',
    status: 'considering',
    lockRequestState: null,
    marketplaceVendorId: 'vp-setnaprod',
    threadId: 't-1',
    inquiryStatus: 'accepted',
    planGroupId: 'bar',
    totalCostPhp: null,
    priceBasisPhp: null,
    includedWith: null,
    ...p,
  }) as ShortlistVendor;

const folders = (v: ShortlistVendor): ShortlistFolder[] =>
  [{ folder: 'f', label: 'F', slug: 'f', pickCount: 1, plannedCount: 0, hint: '', tiles: [{ tile: 't', label: 'Mobile bar', slug: 't', vendors: [v], exploreHref: '', category: 'bar', planned: false, hint: '' }] }] as unknown as ShortlistFolder[];

const quoted = buildSupplierStanding({ stage: 'quoted', hasThread: true, quotedAmountPhp: 6750, lastSpeaker: 'vendor', lastSaidAtMs: NOW, nowMs: NOW });

test('the standing line and the card read the SAME live quote', () => {
  assert.ok(quoted);
  assert.match(standingSentence(quoted!), /6,750/);
  assert.equal(standingQuotePhp(quoted), 6750);
  assert.equal(standingQuotePhp(null), null);
});

test('a card with a sent quote is never told to "Ask for a price" — it offers Add', () => {
  const before = folders(card())[0]!.tiles[0]!.vendors[0]!;
  assert.equal(resolveBenchCardActions({ enabled: true, vendor: before, inBuild: false }).build?.kind, 'needs_price', 'the fixture no longer reproduces the walk');

  const after = withLiveQuotes(folders(card()), () => standingQuotePhp(quoted))[0]!.tiles[0]!.vendors[0]!;
  assert.equal(after.quotedPhp, 6750);
  assert.equal(after.priceBasisPhp, 6750);
  assert.equal(resolveBenchCardActions({ enabled: true, vendor: after, inBuild: false }).build?.kind, 'add');
});

test('no quote, or a basis already there → the card is untouched', () => {
  const none = withLiveQuotes(folders(card()), () => null)[0]!.tiles[0]!.vendors[0]!;
  assert.equal(none.quotedPhp, undefined);
  assert.equal(none.priceBasisPhp, null);
  const priced = withLiveQuotes(folders(card({ priceBasisPhp: 9999 })), () => 6750)[0]!.tiles[0]!.vendors[0]!;
  assert.equal(priced.priceBasisPhp, 9999, 'a basis the card already had was replaced');
  const linked = withLiveQuotes(folders(card({ includedWith: 'Catering' })), () => 6750)[0]!.tiles[0]!.vendors[0]!;
  assert.equal(linked.priceBasisPhp, null, 'a linked card carries no money');
});

test('the card never draws "Price on request" while a quote is out, and the page feeds it the standing’s amount', () => {
  const cards = stripComments(readFileSync(join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'vendors', '_components', 'shortlist-categories.tsx'), 'utf8'));
  assert.match(cards, /\{look\.face && !hasRecordedPrice && !v\.includedWith && v\.quotedPhp == null \? \(/);
  const page = stripComments(readFileSync(join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'vendors', 'page.tsx'), 'utf8'));
  assert.match(page, /const shortlistFolders = withLiveQuotes\(benchFoldersAsRead, \(id\) => standingQuotePhp\(standingsByVendorId\[id\]\)\);/);
});

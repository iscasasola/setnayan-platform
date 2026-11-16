/**
 * 🧾 THE SHOP PAGE'S QUOTE FOLLOWS v16 (S3) — Add to quote and Inquire on each service card, the quote tray, and the
 * card's offer ribbon (owner 15 Nov 2026; prototype `shop_website_two_looks_2026-11-15` v16: `.sc .ft`, `syncQuote`,
 * `.dock .q`, `.sc .off`). One test per claim; each sabotaged red when written.
 *
 * Run: npx tsx --test lib/the-shop-quote-follows-v16-s3.test.ts   (from apps/web)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { WEB } from '@/lib/design-rules-scan';
import { quotePriceOf, quoteSummary, toggleQuote } from '@/lib/shop-quote';

const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const PAGE = src('app/v/[slug]/page.tsx');
const QUOTE = src('app/v/[slug]/_components/shop-quote.tsx');
const GALLERY = src('app/v/[slug]/_components/services-gallery.tsx');
const SHEET = src('app/v/[slug]/_components/inquire-sheet.tsx');
const CARDS = [
  { id: 'a', label: 'Photo booth', fromPhp: 25_000 },
  { id: 'b', label: 'Same-day edit', fromPhp: 20_000 },
  { id: 'c', label: 'Drone', fromPhp: null },
];

// Sabotage: drop the toggle's aria-pressed / rename "Add to quote" / point the card's door at no card → red.
test('each card: "Add to quote" (pressed → "In your quote") and "Choose this service" for that card', () => {
  assert.match(QUOTE, /onClick=\{onToggle\}\s*aria-pressed=\{inQuote\}/);
  assert.match(QUOTE, /\{inQuote \? 'In your quote' : 'Add to quote'\}/);
  // 13 Nov "Yes, only one": the card's door into the ONE Inquire reads the shipped words, never a second "Inquire".
  assert.match(QUOTE, /<a\s+href="#get-in-touch"\s+data-inquire-service=\{card\.id\}[\s\S]{0,300}Choose this service\s*<\/a>/);
  // Inside the card's frame (`ServiceFace` `footer`, v16 `.sc .ft`), above the card's door — never under the card.
  assert.match(GALLERY, /footer=\{\s*quote \? \(\s*<CardQuoteActions card=\{c\} inQuote=\{picked\.includes\(c\.id\)\} onToggle=\{\(\) => setPicked\(\(p\) => toggleQuote\(p, c\.id\)\)\} \/>/);
  assert.match(src('app/_components/service-card-view.tsx'), /<ServiceFace\s+footer=\{footer\}/);
  assert.match(GALLERY, /data-in-quote=\{picked\.includes\(c\.id\) \? '' : undefined\}/, 'a card in the quote is not marked');
});

// Sabotage: count an unpriced service as ₱0 / drop the names / lose the pick order → red.
test('the tray says "N services · from ₱X" and the names — never a guessed price', () => {
  assert.equal(quoteSummary([], CARDS), null);
  assert.deepEqual(quoteSummary(['b', 'a'], CARDS), { head: '2 services · from ₱45,000', names: 'Same-day edit · Photo booth' });
  assert.deepEqual(quoteSummary(['a', 'c'], CARDS), { head: '2 services · from ₱25,000 + price on request', names: 'Photo booth · Drone' });
  assert.deepEqual(quoteSummary(['c'], CARDS), { head: '1 service · price on request', names: 'Drone' });
  assert.deepEqual(quoteSummary(['zz'], CARDS), null, 'a stale pick drew a tray');
  assert.deepEqual(toggleQuote(toggleQuote(['a'], 'b'), 'a'), ['b']);
});

// Sabotage: show a hidden price / a ₱0 price in the sum → red.
test('the sum reads the same starting price the card shows (`starting_price_php`), and only when it is shown', () => {
  assert.equal(quotePriceOf({ starting_price_php: 25_000 }, false), 25_000);
  assert.equal(quotePriceOf({ starting_price_php: 25_000 }, true), null, 'a hidden price was summed');
  assert.equal(quotePriceOf({ starting_price_php: 0 }, false), null);
  assert.equal(quotePriceOf({ starting_price_php: null }, false), null);
  assert.match(PAGE, /fromPhp: row \? quotePriceOf\(row, props\.hidePrices\) : null/);
});

// Sabotage: give the tray its own Inquire / drop Clear / stop the one Inquire reading the quote → red.
test('the tray is v16’s `.dock .q` (count, names, Clear); the page’s ONE Inquire opens with every service in the quote', () => {
  assert.match(QUOTE, /<button type="button" onClick=\{onClear\}[^>]*>\s*Clear\s*<\/button>/);
  const tray = QUOTE.slice(QUOTE.indexOf('export function QuoteTray'));
  assert.doesNotMatch(tray, /get-in-touch|Inquire/, 'the tray grew a second Inquire');
  assert.match(GALLERY, /useEffect\(\(\) => \{\s*setShopQuote\(picked\);\s*\}, \[picked\]\);/);
  assert.match(SHEET, /const quoted = shopQuote\(\);\s*const picks = svc \? \[svc\] : quoted\.length > 0 \? \[\.\.\.quoted\] : undefined;/, 'the one Inquire does not open with the quote');
  assert.match(QUOTE, /className="fixed inset-x-0 bottom-0 z-20[^"]*max-md:pr-\[calc\(10rem\+var\(--sn-safe-r\)\)\]"/, 'the tray covers the floating Inquire on a phone');
  assert.doesNotMatch(QUOTE, /from '@\/app\/[^']*actions'|'use server'|startServiceInquiry/, 'the quote has its own send');
  assert.match(GALLERY, /\{quote \? <QuoteTray picked=\{picked\} cards=\{quote\.cards\} onClear=\{\(\) => setPicked\(\[\]\)\} \/> : null\}/);
});

// Sabotage: offer the quote where the page has no Inquire pop-up / keep the old subtitle → red.
test('the quote is offered only where the Inquire pop-up is, and the heading says so (v16 words)', () => {
  assert.match(PAGE, /const quote =\s*inquireMode === 'anchor'/);
  assert.match(PAGE, /const QUOTE_HINT = 'Add the ones you want to one quote — final quotes happen in chat\.';/);
  assert.match(PAGE, /Starting prices set by \{businessName\}\. \{quote \? QUOTE_HINT : 'Final quotes happen in chat\.'\}/);
  assert.match(PAGE, /inquireMode=\{canMessage \? 'anchor' : 'none'\}/);
});

// Sabotage: stop passing the shop's best offer to the card face → red (v16 `.sc .off` = the shop's own offer).
test('the card’s ribbon is the shop’s own best offer ("First booking · ₱5,000 off" is the drawing’s sample) — never typed', () => {
  assert.match(src('app/_components/service-card-view.tsx'), /discount=\{c\.discountLabel\}/);
  assert.doesNotMatch(PAGE + QUOTE + GALLERY, /First booking · /, 'the drawing’s sample offer was typed into the page');
});

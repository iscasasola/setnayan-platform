/**
 * the-quote-loads-the-card.test.ts — the "Your cards" picker is ON the quote
 * builder, mounted once, wired to the server seed, and the thread page feeds it.
 *
 * ⚖ OWNER, 2026-09-22: *"the quotation maker … can load 1 or multiple service
 * cards combined"*. The RULE (what a card puts on the quote) is executed in
 * `lib/quote-from-service-card.test.ts`. This file pins the MOUNTS — the part
 * a pure test cannot see: that the builder actually draws the picker, that
 * picking calls the loader that reads the event date on the server, that the
 * applied discount's reason reaches the couple's Discount line, and that the
 * thread page passes the cards in at all.
 *
 * 🔑 COUNTS AT A TAG BOUNDARY, NEVER A SUBSTRING. A guard that greps for a
 * label finds *a* mount, not *the* mount (the oldest trap in this repo's
 * toolkit). Every assertion below counts an exact attribute and states the
 * number it expects, so a second copy fails as loudly as a missing one.
 *
 * 🛡 Sabotage watched red: the picker mounted twice (count 2); the toggle
 * calling `loadPackageLinesForQuote` instead of the card loader; the page's
 * `cards=` prop removed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const maker = readFileSync(join(ROOT, 'app/_components/proposal-maker.tsx'), 'utf8');
const page = readFileSync(join(ROOT, 'app/vendor-dashboard/messages/[threadId]/page.tsx'), 'utf8');
const actions = readFileSync(join(ROOT, 'app/vendor-dashboard/messages/[threadId]/proposal-actions.ts'), 'utf8');

const count = (src: string, re: RegExp) => (src.match(re) ?? []).length;

test('the builder mounts the card picker exactly once, and only when the shop has a card', () => {
  assert.equal(count(maker, /data-testid="quote-card-picker"/g), 1);
  const at = maker.indexOf('data-testid="quote-card-picker"');
  const gate = maker.slice(Math.max(0, at - 200), at);
  assert.match(gate, /cards\.length > 0 \?/, 'the picker is gated on the shop having a card');
});

test('picking a card re-seeds through the SERVER loader (the event date is never trusted from the browser)', () => {
  const fn = maker.slice(maker.indexOf('function reseedFromCards('), maker.indexOf('const toggleCard'));
  assert.match(fn, /await loadServiceCardLinesForQuote\(\{/, 'the card loader, not the package loader');
  assert.doesNotMatch(fn, /loadPackageLinesForQuote/);
  assert.match(fn, /applyCardSeedToDraft\(seed,/, 'and the pure rule decides what the card overrides');
  // the loader reads the date server-side, after proving the thread is the supplier's
  const loader = actions.slice(actions.indexOf('export async function loadServiceCardLinesForQuote'), actions.indexOf('export async function sendCustomProposalFromChat'));
  assert.match(loader, /thread\.vendor_profile_id !== profile\.vendor_profile_id\) return null/);
  assert.match(loader, /\.select\('event_date'\)/);
  assert.doesNotMatch(loader, /input\.eventDate/, 'no event date arrives from the client');
});

test('the applied discount carries its reason to the couple (the Discount line\'s detail) and is cleared when typed over', () => {
  assert.match(maker, /\{ label: 'Discount', detail: discountReason, amount_centavos: -discountC \}/);
  assert.equal(count(maker, /data-testid="quote-discount-reason"/g), 1);
  const input = maker.slice(maker.indexOf('aria-label="Discount"') - 400, maker.indexOf('aria-label="Discount"'));
  assert.match(input, /setDiscountReason\(null\)/, 'a hand-edited figure is never captioned as the card\'s');
});

test('the card\'s reservation terms sit under the schedule they seeded — once', () => {
  assert.equal(count(maker, /data-testid="quote-card-terms"/g), 1);
});

test('the thread page passes the shop\'s ACTIVE cards to the builder — once, with add-ons and comes-with', () => {
  assert.equal(count(page, /cards=\{quoteCards\}/g), 1);
  const build = page.slice(page.indexOf('const activeServices'), page.indexOf('const proposalTemplates'));
  assert.match(build, /ownServices\.filter\(\(s\) => s\.is_active\)/);
  assert.match(build, /fetchAddonsByService\(supabase, activeIds\)/);
  assert.match(build, /from\('vendor_service_links'\)/);
  assert.match(build, /s\.title\?\.trim\(\) \|\| kindLabel\(s\.category\)/, 'labelled by the kind, never the raw key or "Untitled"');
});

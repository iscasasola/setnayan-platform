/**
 * THE SERVICE CARD ON THE COUPLE'S SUPPLIERS PAGE (owner 2026-10-07 · PR2).
 *
 * A card in a category row is the supplier's own service card: the service's
 * name and running offer, the price, what is included and what is not. Three
 * things this must never do, each of which renders as a perfectly ordinary card:
 *
 *   1. print a price a shop has chosen to hide from the public;
 *   2. advertise an offer that has ended, or "Untitled service", or "from ₱—";
 *   3. say "Price on request" because a READ failed.
 *
 * The first half executes the decision; the second reads the wiring.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { benchServiceCard, PRICE_ON_REQUEST } from '@/lib/bench-service-card';
import type { StoredServiceCard } from '@/lib/service-card-snapshot';

const NOW = new Date('2026-10-08T00:00:00Z');
const CATERING: StoredServiceCard = {
  title: 'Plated dinner · 150 guests',
  category: 'catering',
  pricing_basis: 'fixed',
  starting_price_php: 197000,
  crew_meal_included: true,
  transport_included: false,
  transport_flat_fee_php: 1500,
  includes_setnayan_gift: true,
  primary_photo_r2_key: 'r2://setnayan-media/cover.jpg',
};
const card = (over: Partial<Parameters<typeof benchServiceCard>[0]> = {}) =>
  benchServiceCard({ service: CATERING, hidePrices: false, coverUrl: 'https://cdn.example/cover.jpg', now: NOW, ...over });

test('the card says the service’s own name, its price, and what the price leaves out', () => {
  const c = card({
    inclusions: [{ label: 'Tasting for 4', worth_php: 4000 }, { label: 'Dessert bar' }],
  });
  assert.equal(c.name, 'Plated dinner · 150 guests');
  assert.equal(c.priceText, 'from ₱197,000');
  assert.equal(c.includesLine, 'Includes: Tasting for 4 · Dessert bar · ₱4,000 free');
  assert.deepEqual(c.notIncluded, ['transport (+₱1,500)']);
  assert.equal(c.givesSetnayanGift, true);
  assert.equal(c.coverUrl, 'https://cdn.example/cover.jpg');
});

test('🔑 a service with no title is named by its category — never "Untitled service"', () => {
  // `title` is NULL on live services (measured on production 2026-09-09).
  const c = card({ service: { ...CATERING, title: null } });
  assert.equal(c.name, 'Catering');
  assert.notEqual(card({ service: { ...CATERING, title: '   ' } }).name, 'Untitled service');
  assert.equal(card({ service: { ...CATERING, title: null, category: null } }).name, 'Service');
});

test('🔑 a card with no price set says nothing — never "from ₱—"', () => {
  const c = card({ service: { ...CATERING, starting_price_php: null } });
  assert.equal(c.priceText, null);
  assert.ok(PRICE_ON_REQUEST.length > 5);
});

test('🔑 a shop that hides its prices shows no peso figure anywhere on the card', () => {
  const c = card({
    hidePrices: true,
    discounts: [{ discount_type: 'early_booking', rate: 10, unit: 'pct' }],
    inclusions: [{ label: 'Tasting for 4', worth_php: 4000 }],
    brackets: [{ price_php: 150000 }],
  });
  assert.equal(c.priceText, null, 'the price leaked');
  assert.equal(c.discountBadge, null, 'a "10% off" gives the figure away');
  assert.equal(c.includesLine, 'Includes: Tasting for 4', 'the inclusion’s worth leaked');
  assert.deepEqual(c.notIncluded, ['transport'], 'the transport fee leaked, or a "by distance" claim was invented');
  const everything = JSON.stringify(c);
  assert.ok(!/₱|\d{3}/.test(everything.replace('150 guests', '')), `a figure survived: ${everything}`);
  // The gift line carries no peso, so it stays — and so does the name.
  assert.equal(c.givesSetnayanGift, true);
  assert.equal(c.name, 'Plated dinner · 150 guests');
});

test('🔑 an offer that has ended is not advertised; a running one is', () => {
  const ended = card({
    discounts: [{ discount_type: 'promo', rate: 20, unit: 'pct', expires_at: '2026-10-01T00:00:00Z' }],
  });
  assert.equal(ended.discountBadge, null);
  const running = card({
    discounts: [
      { discount_type: 'promo', rate: 20, unit: 'pct', expires_at: '2026-10-01T00:00:00Z' },
      { discount_type: 'early_booking', rate: 10, unit: 'pct', expires_at: '2026-12-01T00:00:00Z' },
      { discount_type: 'off_peak', rate: 5, unit: 'pct', expires_at: null },
    ],
  });
  assert.equal(running.discountBadge, 'Early booking · 10% off', 'the best RUNNING offer wins — not the ended 20%');
});

// ── the wiring ────────────────────────────────────────────────────────────
const WEB = join(import.meta.dirname, '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const BENCH = read('app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx');
const PAGE = read('app/dashboard/[eventId]/vendors/page.tsx');
const READER = read('lib/bench-service-cards.ts');

test('the scans read real files', () => {
  assert.ok(BENCH.length > 20000 && PAGE.length > 20000 && READER.length > 1500);
});

test('🔑 the reader returns only switched-on cards, and null — never {} — when a read fails', () => {
  const selects = READER.match(/\.from\('vendor_services'\)[\s\S]*?;/g) ?? [];
  assert.equal(selects.length, 2, 'expected the two reads (picks · market)');
  for (const q of selects) {
    assert.match(q, /\.eq\('is_active', true\)/, 'a switched-off card would reach a couple');
  }
  const failures = READER.match(/if \(error\) \{[\s\S]*?\}/g) ?? [];
  assert.equal(failures.length, 2);
  for (const f of failures) assert.match(f, /return null;/, 'a failed read came back as "no cards"');
  assert.equal((READER.match(/catch \(err\) \{[\s\S]*?return null;/g) ?? []).length, 2);
  assert.match(READER, /fetchVendorsHidingPricesPublicly\(admin, shopIds\)/);
  assert.match(READER, /hidePrices: hiding\.has\(row\.vendor_profile_id\)/);
  // Media is a stored ref — resolved, never handed to an <img> raw.
  assert.match(READER, /coverUrl: publicUrlForStoredAsset\(row\.primary_photo_r2_key\)/);
  assert.ok(!/createAdminClient/.test(READER), 'the reader mints its own admin client — pass it in');
});

test('🔑 the page reads cards only for the couple’s OWN picks, in the pass that already has the ids', () => {
  // `serviceIdByVendor` is built from the couple's RLS-scoped event_vendors read.
  assert.match(PAGE, /cardsAt \? fetchBenchServiceCards\(admin, serviceIdByVendor, cardsAt\) : Promise\.resolve\(null\)/);
  assert.match(PAGE, /fetchVendorPhotoMaps\(supabase, eventId, isExploreReplanEnabled\(\) \? new Date\(\) : null\)/);
  assert.match(PAGE, /serviceCardByVendorId=\{photoMaps\.serviceCardByVendorId\}/);
  assert.equal((PAGE.match(/fetchBenchServiceCards\(/g) ?? []).length, 1, 'a second read of the same cards');
});

test('🔑 the bench card wears the service card only on the one-screen page, and adds — never replaces', () => {
  assert.match(BENCH, /\(\) => \(\{ face: replan, cards: serviceCardByVendorId \}\)/);
  assert.match(BENCH, /const svc = look\.face \? \(look\.cards\?\.\[v\.vendorId\] \?\? null\) : null;/);
  // The name leads; the supplier's own name is still printed under it.
  const meta = BENCH.slice(BENCH.indexOf('<span className="meta">'), BENCH.indexOf('<CardStanding standing='));
  assert.ok(meta.indexOf('className="sc-name"') > 0 && meta.indexOf('className="sc-name"') < meta.indexOf('<span className="vn">{v.name}</span>'));
  assert.match(meta, /\{svc\?\.name \?\? tileLabel\}/);
  for (const line of ['svc?.discountBadge', 'svc.priceText', 'svc.includesLine', "svc.notIncluded.join(' · ')"]) {
    assert.ok(meta.includes(line), `the card stopped printing ${line}`);
  }
  // On this page every card has verbs, so it never takes the bare branch.
  assert.match(BENCH, /!actions \|\|\s*\(!look\.face &&\s*!actions\.build &&/);
});

test('🔑 "Price on request" is said only when the cards were READ, and never over a recorded price', () => {
  const meta = BENCH.slice(BENCH.indexOf('<span className="meta">'), BENCH.indexOf('<CardStanding standing='));
  assert.match(meta, /look\.face && !hasRecordedPrice && !v\.includedWith \?/);
  assert.match(meta, /\) : look\.cards \? \(\s*<span className="sc-price none">\{PRICE_ON_REQUEST\}<\/span>\s*\) : null/);
  // The marketplace card in "More to compare" obeys the same rule.
  assert.match(BENCH, /\) : cardsRead \? \(\s*<span className="sc-price none">\{PRICE_ON_REQUEST\}<\/span>\s*\) : null/);
  assert.match(BENCH, /cardsRead=\{moreCards !== null\}/);
  assert.equal((BENCH.match(/PRICE_ON_REQUEST\}/g) ?? []).length, 2, 'one per card shape — no third, unguarded one');
  assert.ok(!/Price on request/.test(BENCH), 'the words are typed in the bench — read them from the lib');
});

test('the gift is the one shared sentence, gated on the yes', () => {
  const mounts = BENCH.match(/\{svc\?\.givesSetnayanGift \? <SetnayanGiftLine className="sc-gift" \/> : null\}/g) ?? [];
  assert.equal(mounts.length, 2, 'both card shapes — the couple’s own and the marketplace one');
  assert.equal((BENCH.match(/<SetnayanGiftLine\b/g) ?? []).length, 2, 'a gift line that is not gated on the yes');
});

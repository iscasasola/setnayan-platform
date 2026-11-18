/**
 * 🗂 v16 S4 — THE VERIFIED SHOP'S DESKTOP SIDE CARD (owner-approved 15 Nov 2026; prototype
 * `shop_website_two_looks_2026-11-15/site.src.html` `<aside><div class="bk">`). One test per claim; each sabotage named.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { WEB } from '@/lib/design-rules-scan';
import { sideCardPrice, sideCardVerifiedLine, SIDE_CARD_WORDS } from '@/lib/shop-side-card';
import { SHOP_CALLING_CARD_CLASS, SHOP_CARD_COLUMN_CLASS, SHOP_COLUMNS_CLASS } from '@/app/v/[slug]/_components/shop-columns';

const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const PAGE = src('app/v/[slug]/page.tsx');
const CARD = src('app/v/[slug]/_components/shop-side-card.tsx');
const TRAY = src('app/v/[slug]/_components/shop-quote.tsx');
const SERVER = src('lib/check-a-date.server.ts');

// Sabotage: put the card back on the left / drop `md:order-last` / climb back onto the hero → red.
test('the card column is on the RIGHT on a tablet and up, sticky under the bars, never over the hero', () => {
  assert.match(SHOP_COLUMNS_CLASS, /md:grid-cols-\[minmax\(0,1fr\)_300px\]/);
  assert.match(SHOP_COLUMNS_CLASS, /lg:grid-cols-\[minmax\(0,1fr\)_360px\]/);
  assert.match(SHOP_CARD_COLUMN_CLASS, /md:order-last/);
  assert.match(SHOP_CARD_COLUMN_CLASS, /md:sticky md:top-\[calc\(var\(--shop-bar-h,0px\)\+4rem\)\]/);
  assert.doesNotMatch(SHOP_CALLING_CARD_CLASS, /md:-mt-/, 'the side card climbs onto the hero again');
});

// Sabotage: show a hidden price / count an unset price as ₱0 / pick the offer from another card → red.
test('"from ₱…" is the lowest price the page SHOWS, with that card’s best offer; no shown price → no line', () => {
  const rows = [
    { vendor_service_id: 'a', starting_price_php: 80000 },
    { vendor_service_id: 'b', starting_price_php: 45000 },
    { vendor_service_id: 'c', starting_price_php: null },
  ];
  const off = (id: string, php: number) =>
    ({ vendor_service_id: id, discount_type: 'promo', rate: php, unit: 'php', min_lead_months: null, expires_at: null, conditions_md: null, sort_order: 0 }) as never;
  const discounts = new Map([['a', [off('a', 9000)]], ['b', [off('b', 5000)]]]);
  const line = sideCardPrice(rows, false, discounts);
  assert.equal(line?.from, 'from ₱45,000');
  assert.ok(line?.offer && /5,000/.test(line.offer), `the offer is not the cheapest card's own: ${line?.offer}`);
  assert.equal(line?.offer, '₱5,000 off · limited-time');
  assert.equal(sideCardPrice(rows, true, discounts), null, 'a hidden price showed');
  assert.equal(sideCardPrice([{ vendor_service_id: 'c', starting_price_php: null }], false, new Map()), null, 'an unset price became ₱0');
  assert.match(PAGE, /price=\{sideCardPrice\(activeServices, hidePricesPublicly, discountsByService, \{ eventDate: coupleEventDate \}\)\}/);
});

// Sabotage: show stars past the Free-tier gate / from the raw stat → red.
test('the Verified line carries ★ only behind the page’s star gate and the trusted stat', () => {
  assert.equal(sideCardVerifiedLine(true, { trusted_avg_rating: 4.94, trusted_review_count: 1038 }), 'Setnayan Verified · ★ 4.9 · 1,038 reviews');
  assert.equal(sideCardVerifiedLine(false, { trusted_avg_rating: 4.9, trusted_review_count: 38 }), 'Setnayan Verified');
  assert.equal(sideCardVerifiedLine(true, { trusted_avg_rating: null, trusted_review_count: 0 }), 'Setnayan Verified');
  assert.match(PAGE, /verifiedLine=\{sideCardVerifiedLine\(viewerTierCaps\.reviewStarsCounted, trustedReviewStats\)\}/);
});

// Sabotage: read the mini month from anywhere but Check a date's own reads / draw every day green on a failure → red.
test('the mini month is Check a date’s own answer for this month, and a failed read says so', () => {
  assert.match(SERVER, /export async function readThisMonthNotBookable[\s\S]{0,700}readShopDateFacts\(admin, vendorProfileId[\s\S]{0,500}checkDateAnswer\(/);
  assert.match(SERVER, /checkDateWindow\(today, 1\)/);
  assert.match(CARD, /<SeatMonths[\s\S]{0,300}stateOf=\{\(d\) => checkDateStateOf\(d, \{ notBookable: closed, today: month\.today, to: month\.to \}\)\}/);
  assert.match(CARD, /\) : \(\s*<p[^>]*role="status"[^>]*data-side-card-month-unread="">\s*\{SIDE_CARD_WORDS\.unreadable\}/);
  assert.match(PAGE, /readThisMonthNotBookable\(vendor\.vendor_profile_id\)\.catch\(\(\) => \(\{ kind: 'unreadable' \}\) as const\)/);
  assert.equal(SIDE_CARD_WORDS.everyMonth, 'See every month →');
});

// Sabotage: drop `md:hidden` from the action row's Check a date / show the side card on a phone → red.
test('ONE Check a date per screen: the side card’s month on a computer, the action row’s on a phone', () => {
  assert.equal((PAGE.match(/<CheckADateLink/g) ?? []).length, 1);
  assert.match(PAGE, /<CheckADateLink[\s\S]{0,200}className=\{`button-secondary inline-flex items-center gap-2\$\{cinematicHero \? ' md:hidden' : ''\}`\}/);
  assert.match(CARD, /className="hidden w-full[^"]*md:block"[^>]*data-shop-side-card=""/);
  assert.match(PAGE, /\{cinematicHero \? \(\s*<ShopSideCard/, 'the side card is not verified-only (the unverified one is S6)');
  // A green day opens Check a date on that day; the link opens it on the first.
  assert.match(CARD, /onPick=\{\(d\) => \{\s*noteDatesFromShop\(\);\s*router\.push\(`\$\{datesHref\}&d=\$\{d\}`, \{ scroll: false \}\);\s*\}\}/);
  assert.match(PAGE, /datesHref=\{withShopArrival\(`\$\{shopPath\(vendor\.business_slug \?\? slug\)\}`, shopArrival, \{ dates: '1' \}\)\}/);
});

// Sabotage: keep the tray on a computer beside the side card / stop sending the summary to the side card → red.
test('the quote: in the side card on a computer, the S3 tray on a phone', () => {
  assert.match(CARD, /useSyncExternalStore\(subscribeShopQuote, shopQuoteSummary, \(\) => null\)/);
  assert.match(TRAY, /className=\{`\$\{phoneOnly \? 'md:hidden ' : ''\}fixed inset-x-0 bottom-0/);
  assert.match(src('app/v/[slug]/_components/services-gallery.tsx'), /setShopQuote\(picked, quote \? quoteSummary\(picked, quote\.cards\) : null\)/);
  assert.match(PAGE, /quoteInSideCard=\{cinematicHero\}/);
  assert.match(PAGE, /inSideCard: props\.quoteInSideCard === true,/);
});

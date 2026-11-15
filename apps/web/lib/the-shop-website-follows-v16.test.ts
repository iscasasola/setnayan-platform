/**
 * 🏬 THE SHOP WEBSITE FOLLOWS THE APPROVED v16 (owner 15 Nov 2026 — DECISION_LOG rows "SHOP WEBSITE: ONE BACK BUTTON,
 * NAMED FOR WHERE THE VISITOR CAME FROM", "SHOP WEBSITE TOP BAR, ONCE SCROLLED", "SHOP WEBSITE AWARDS ROW: THE BADGE +
 * ONE PLAIN FACT" and "SHOP WEBSITE: A 10-BRANCH SHOP …"; prototype shop_website_two_looks_2026-11-15, Supplier Website
 * Looks v16). One test per claim; each was broken on purpose and went red (the sabotage is named in each test).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { WEB } from '@/lib/design-rules-scan';
import { SETNAYAN_HOME_URL, shopColdDoorShows } from '@/lib/shop-back';
import { OWN_LINK_SRC } from '@/lib/supplier-qr-codes';
import { awardFact } from '@/lib/shop-award-fact';
import { milestoneBadge, type ShopBadge } from '@/lib/shop-badges';

const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const PAGE = src('app/v/[slug]/page.tsx');
const BAR = src('app/v/[slug]/_components/shop-top-bar.tsx');
const SAVE = src('app/(shell)/explore/_components/save-vendor-button.tsx');

// Sabotage: return true for every cold arrival (the old `!shopBack.back`) → the `journal` and `qr` cases go red.
test('"See more suppliers" shows only for the supplier’s own QR / link and a typed address', () => {
  assert.equal(OWN_LINK_SRC, 'own');
  assert.equal(shopColdDoorShows({ src: null, eventId: null }), true, 'a typed address');
  assert.equal(shopColdDoorShows({ src: 'own', eventId: null }), true, 'the supplier’s own QR');
  assert.equal(shopColdDoorShows({ src: 'discover', eventId: null }), false);
  assert.equal(shopColdDoorShows({ src: 'journal', eventId: null }), false, 'an arrival tag of ours is not a cold visit');
  assert.equal(shopColdDoorShows({ src: 'qr', eventId: null }), false);
  assert.equal(shopColdDoorShows({ src: null, eventId: 'e1' }), false, 'an event’s Suppliers has its own back');
  assert.match(PAGE, /\{shopColdDoorShows\(shopArrival\) \? \(\s*<Link href=\{shopBack\.href\}/);
});

// Sabotage: rename the heading "Your awards" / drop `awardFact(b)` / let the fact keep " · Gold" → red.
test('the Awards row: heading "Awards", each award its badge + one plain fact, no tier name in the row', () => {
  const at = PAGE.indexOf('data-shop-awards=""');
  assert.ok(at > 0, 'the Awards group is gone');
  const group = PAGE.slice(at, PAGE.indexOf('</ul>', at));
  assert.match(group, />Awards<\/p>/);
  assert.match(group, /<HeroBadge badge=\{b\} title=\{b\.label\} \/>\s*<span[^>]*>\{awardFact\(b\)\}<\/span>/);
  assert.doesNotMatch(PAGE, /Earned on Setnayan|tap one/i, 'instruction wording in a shop heading');
  const m100 = milestoneBadge(100);
  assert.equal(awardFact(m100), '100 bookings completed');
  assert.ok(m100.label.includes('·'), 'premise: the milestone label carries its tier name');
  assert.doesNotMatch(awardFact(m100), /·|Bronze|Silver|Gold|Ruby|Emerald|Diamond|Platinum/);
  assert.equal(awardFact({ key: 'verified', kind: 'verified', glyph: null, line1: '', line2: '', label: 'SETNAYAN Verified' } as ShopBadge), 'Setnayan Verified');
});

// Sabotage: observe the article instead of `#shop-top h1` / scroll to 120 / drop the check's button → red.
test('once the name scrolls under the bar: the shop’s logo + name go to the top, and the blue check brings up Verified', () => {
  assert.match(BAR, /document\.querySelector<HTMLElement>\('#shop-top h1'\)/);
  assert.match(BAR, /const toTop = \(\) => window\.scrollTo\(\{ top: 0, behavior: smooth\(\) \}\);/);
  assert.match(BAR, /<button\s+type="button"\s+onClick=\{toTop\}[\s\S]{0,300}\{logo\}\s*<span className="truncate">\{shopName\}<\/span>/);
  assert.match(BAR, /\{verified \? \(\s*<button\s+type="button"\s+onClick=\{showVerified\}[^>]*className="inline-flex h-11 w-11/);
  assert.match(BAR, /document\.getElementById\('shop-verified-award'\)/);
  assert.match(PAGE, /<li id="shop-verified-award"/, 'the Verified award the check brings up is not on the page');
  assert.match(PAGE, /logo=\{<TopBarLogo logoUrl=\{logoDisplayUrl\}/, 'the top bar does not show the shop’s own logo');
});

// Sabotage: show `acts` unconditionally / observe nothing → red.
test('Share + the heart join the top bar only after the page’s own buttons have scrolled away', () => {
  assert.match(BAR, /\{acts && acted \? \(/);
  assert.match(BAR, /document\.querySelector<HTMLElement>\('\[data-shop-quick\]'\)/);
  assert.match(PAGE, /data-shop-quick=""/);
});

// Sabotage: `<Link href="/">` around the wordmark, or a relative footer link → red.
test('SETNAYAN opens https://www.setnayan.com as an absolute address — top bar and footer', () => {
  assert.equal(SETNAYAN_HOME_URL, 'https://www.setnayan.com');
  assert.match(BAR, /<a href=\{SETNAYAN_HOME_URL\}[^>]*>\s*<Wordmark size=\{22\} \/>/);
  assert.match(PAGE, /<a href=\{SETNAYAN_HOME_URL\}[^>]*>\s*SETNAYAN\s*<\/a>/);
  assert.doesNotMatch(PAGE, /<Link href="\/"[^>]*>\s*<Wordmark/);
});

// Sabotage: put ReportPageButton back inside a <p>, or drop `triggerClassName` → red.
test('the footer’s "Report this shop" is its own outlined 44 px button, inside a <div>', () => {
  assert.match(
    PAGE,
    /<div className="pt-1">\s*<ReportPageButton\s+targetType="vendor"[\s\S]{0,160}label="Report this shop"\s+triggerClassName=\{actionButtonClass\('neutral', \{ extra: 'min-h-11' \}\)\}/,
  );
  const report = src('app/_components/report-page-button.tsx');
  assert.match(report, /className=\{\s*triggerClassName \?\?/);
});

// Sabotage: drop `icon="heart"` from either copy, or stop announcing the save → red.
test('the heart IS Add to event — on the body button and the top bar, and the copies stay in step', () => {
  assert.equal((PAGE.match(/label="Add to your event"\s+icon="heart"/g) ?? []).length, 2);
  assert.match(PAGE, /icon="heart"\s+iconOnly/);
  assert.match(SAVE, /window\.dispatchEvent\(new CustomEvent\(SAVED_EVENT/);
  assert.match(SAVE, /window\.addEventListener\(SAVED_EVENT, onSaved\)/);
});

// Sabotage: add an "after N days" line to the page → red.
test('the public shop page has no "after N days" line (owner: that line is for the shop owner only)', () => {
  assert.doesNotMatch(PAGE, /achieved this|after \$\{[^}]+\} days|after \d+ days/i);
});

// Sabotage: put the section bar back at `top-0` → red (it would slide under the sticky top bar).
test('the section menu sits under the sticky top bar, and lands sections under both', () => {
  const bar = src('app/v/[slug]/_components/shop-section-bar.tsx');
  assert.match(bar, /sticky top-\[var\(--shop-bar-h,0px\)\]/);
  assert.match(bar, /parseFloat\(getComputedStyle\(nav\)\.top\)/);
  assert.match(PAGE, /\['--shop-bar-h' as string\]: '3\.5rem'/);
  assert.match(BAR, /className="sticky top-0 z-30/);
});

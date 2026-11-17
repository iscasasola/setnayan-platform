/**
 * 🌄🌿 THE SHOP PAGE HAS TWO LOOKS (owner-approved 13 Nov 2026 — DECISION_LOG "THE SHOP WEBSITE HAS TWO LOOKS",
 * "THREE PAGES, ONE FAMILY", "ONE MAIN BUTTON — INQUIRE", "CHECKING A DATE IS FOR VERIFIED SHOPS ONLY", "SIMPLER TO
 * MOVE AROUND", "THREE PUBLIC PAGES APPROVED"; prototype `public_pages_three_2026-11-13`).
 *
 *   verified (Verified · Solo · Pro · Ultra alike)  hero + calling card + motion; About · Services · Portfolio · Reviews;
 *                                                   Check a date + the open-dates peek; Lock on package cards
 *   unverified                                      calm column; Services · Reviews · Where; NO Check a date,
 *                                                   NO peek, NO web address
 *
 * A look is a page nobody in CI can see, so its rulings get structural guards here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const PAGE = read('page.tsx');
const PANEL = read('_components/shop-can-do-panel.tsx');

// v16 S6 (owner 15 Nov, DECISION_LOG "AN UNVERIFIED SHOP HAS THE SAME WEBSITE AS A VERIFIED ONE", which SUPERSEDES the
// 13 Nov "two looks" for the LOOK): one look for every shop; only the CONTENT is gated, by `isVerifiedShop`.
test('one look for every shop — the hero is never behind a plan or verification; content is gated by isVerifiedShop', () => {
  assert.match(PAGE, /const isVerifiedShop = vendor\.verification_state === 'verified';/);
  assert.doesNotMatch(PAGE, /cinematicHero|isEnterprise \? \(\s*<ShopHero/, 'the hero went back behind a gate');
  assert.equal((PAGE.match(/<ShopHero\b/g) ?? []).length, 1);
  assert.doesNotMatch(PAGE, /\{\w+ \? \(\s*<ShopHero|\{\w+ \? <ShopHero/, 'the hero is drawn for some shops only');
});

test('Check a date exists only behind the verified + bookable gate; the old day strip is gone (15 Nov)', () => {
  // The action-row door keeps its own `bookable` gate (the-since-line-and-check-a-date.test.ts); the panel rides the
  // verified look AND bookable. "Their real calendar · Open Saturdays coming up" is gone: DECISION_LOG 2026-11-15
  // "THE OWNER APPROVES THE SUPPLIER WEBSITE DESIGN…" — the website's own day strip is gone.
  assert.match(PAGE, /\{isVerifiedShop && bookable \? \(\s*<ShopCanDoPanel\b/, 'the "can\'t do" panel left its gate');
  assert.equal((PAGE.match(/<ShopCanDoPanel\b/g) ?? []).length, 1);
  const sample = read('_components/sample-shop-page.tsx');
  for (const [name, src] of [['page', PAGE], ['sample', sample]] as const) {
    assert.doesNotMatch(src, /Their real calendar|Open Saturdays coming up|<OpenDatesPeek\b/i, `the ${name} draws the old day strip again`);
  }
  // RW-269 (owner-seen 14 Nov): the panel has NO Check a date door — the header's, beside Add to your event, is the one.
  assert.doesNotMatch(PANEL, /<CheckADateLink\b/);
});

test('Lock lives only on the package cards', () => {
  assert.equal((PAGE.match(/<LockPackageModal\b/g) ?? []).length, 1, 'a second Lock control on the page');
  const fn = PAGE.indexOf('function VendorPackagesSection(');
  const lock = PAGE.indexOf('<LockPackageModal');
  const end = PAGE.indexOf('\nfunction ', fn + 10);
  assert.ok(fn > 0 && lock > fn && lock < end, 'the Lock control left the package card section');
  assert.match(PAGE, /<PackageCard\s[\s\S]{0,120}ctaSlot=\{cta\}/, 'the Lock is no longer the package card\'s own slot');
  // Beside its price, as the prototype draws it (price left, Lock right) — not at the card's foot.
  assert.match(PAGE, /<PackageCard\s[\s\S]{0,160}ctaSlot=\{cta\}\s*ctaBesidePrice\b/, 'the Lock fell back to the card\'s foot');
  const card = stripComments(readFileSync(join(HERE, '../../_components/vendor-packages/package-card.tsx'), 'utf8'));
  const row = card.slice(card.indexOf('data-package-price-row'), card.indexOf('data-package-price-row') + 500);
  assert.match(row, /formatCentavosPhp\(pkg\.total_price_centavos\)[\s\S]*\{ctaSlot\}/, 'the price row does not hold the price, then the Lock');
  assert.match(card, /\{ctaSlot && !ctaBesidePrice \? <div className="mt-5">/, 'the Lock shows twice — in the price row and at the foot');
  // No page-level Lock door: the panel says what Lock does in words, it is not a button.
  assert.doesNotMatch(PANEL, /<button|<Link|LockPackageModal/, 'the panel grew a Lock door');
  const modal = stripComments(readFileSync(join(HERE, '../../_components/vendor-packages/lock-modal.tsx'), 'utf8'));
  // The prototype's "Lock" reads "Book" to a couple (owner d19, lib/the-couple-books-never-locks.test.ts).
  assert.match(modal, /<PackageIcon[^>]*\/>\s*\{\s*\}\s*Book this package/);
});

test('the section bar: verified About · Services · Portfolio · Reviews; unverified Services · Portfolio · About · Reviews · Where (v16 S6; no Inquire tab)', () => {
  assert.equal((PAGE.match(/<ShopSectionBar\b/g) ?? []).length, 1);
  const tabs = PAGE.slice(PAGE.indexOf('const shopSectionTabs'), PAGE.indexOf('const shopSectionTabs') + 900);
  const [ver, unv] = tabs.split(/\]\s*\n\s*:\s*\[/);
  const labels = (t: string | undefined) => [...(t ?? '').matchAll(/label: '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(labels(ver), ['About', 'Services', 'Portfolio', 'Reviews']);
  assert.deepEqual(labels(unv), ['Services', 'Portfolio', 'About', 'Reviews', 'Where']);
  // Every tab points at a section the page renders.
  for (const id of ['shop-about', 'shop-services', 'shop-portfolio', 'shop-reviews', 'shop-where']) {
    assert.match(PAGE, new RegExp(`id="${id}" data-shop-section=""`), `#${id} has no section`);
  }
  assert.doesNotMatch(tabs, /get-in-touch|Inquire/);
  const bar = read('_components/shop-section-bar.tsx');
  assert.doesNotMatch(bar, /history\.|localStorage|sessionStorage/, 'the bar writes history or storage');
});

test('the unverified page prints no web address, and its Where is the city alone — no map (15 Nov "no exact address")', () => {
  assert.match(PAGE, /\{isVerifiedShop \? <ShopAddresses setnayanAddress=\{setnayanAddress\} ownAddress=\{ownAddress\} \/> : null\}/);
  const where = PAGE.slice(PAGE.indexOf('id="shop-where"'), PAGE.indexOf('id="get-in-touch"'));
  assert.doesNotMatch(where, /<ShopReachMap\b|<DirectionsMenu\b/);
  assert.match(where, /<ShopReachLine\b/);
});

test('motion: CSS only, a complete resting state, and a full reduced-motion fallback', () => {
  const css = readFileSync(join(HERE, '_components/shop-motion.module.css'), 'utf8');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /animation-duration: var\(--sn-dur-rise-reduced\) !important;/);
  // Scroll motion only hides a part once the script has run (`data-shop-js`) — no JS, nothing hidden.
  for (const m of css.matchAll(/opacity: 0;/g)) {
    const before = css.slice(Math.max(0, css.lastIndexOf('}', m.index!)), m.index);
    assert.match(before, /data-shop-js|@keyframes|from \{/, 'a part is hidden without waiting for the script');
  }
  const bar = read('_components/shop-section-bar.tsx');
  assert.equal((bar.match(/new IntersectionObserver\(/g) ?? []).length, 1, 'one observer, not many');
  assert.match(bar, /io\.unobserve\(e\.target\)/, 'the observer must let go after adding .in once');
});

// README motion 3 and 8: the seal stamps, then its ring and tick draw; the reach ring draws, fills, and its "N km" tag
// fades in. Strokes with pathLength 1 whose keyframes only say where they START — so at rest (and under reduced motion,
// where everything is a 120 ms fade) the ring and tick are complete.
test('motion: the seal\'s ring and tick draw, and the reach ring draws itself — complete at rest', () => {
  const css = readFileSync(join(HERE, '_components/shop-motion.module.css'), 'utf8');
  for (const hook of ['data-badge-ring', 'data-badge-tick', 'data-reach-ring', 'data-reach-km']) {
    assert.match(css, new RegExp(`\\.verified :global\\(\\[${hook}\\]\\)`), `${hook} has no motion on the verified look`);
  }
  assert.match(css, /@keyframes drawStroke \{ from \{ stroke-dashoffset: 1; \} \}/, 'the draw must be from-only, so the rest is drawn');
  assert.doesNotMatch(css, /\.verified[^{]*\{[^}]*stroke-dashoffset: 1/, 'a stroke is hidden in a resting rule');
  const badge = stripComments(readFileSync(join(HERE, '../../_components/image-badge.tsx'), 'utf8'));
  assert.match(badge, /pathLength=\{1\}\s*strokeDasharray="1"[\s\S]{0,80}data-badge-ring=""/);
  assert.match(badge, /pathLength=\{1\}\s*strokeDasharray="1"\s*data-badge-tick=""/);
  assert.match(PAGE, /badge=\{verifiedBadge\(\)\}[\s\S]{0,140}\bdrawn\b/, 'the verified seal is not the drawn one');
  const map = stripComments(readFileSync(join(HERE, '../../vendor-dashboard/shop/_components/reach-map.tsx'), 'utf8'));
  assert.match(map, /pathLength=\{1\}\s*strokeDasharray="1"[\s\S]{0,80}data-reach-ring=""/);
  const reach = read('_components/shop-reach.tsx');
  assert.match(reach, /<ReachMap[\s\S]{0,260}\bkmTag\b/, 'the shop page\'s ring lost its km tag');
});

test('the shop page\'s reach ring is the map card: 9 : 5 capped at 250 px, the credit tag, the bigger-map door (re-walk 2026-11-14)', () => {
  const reach = read('_components/shop-reach.tsx');
  // The card's shape is asked for at the public caller only — the supplier's own "Where you work" map keeps 240 px.
  assert.match(reach, /<ReachMap[\s\S]{0,300}\bcard\b/, 'the shop page\'s ring lost the card shape (it drew 3 : 2 again)');
  assert.match(reach, /mapHref === null \? null : <BiggerMapButton href=\{openStreetMapUrl\(lat, lng, \d+\)\} \/>/, 'the bigger-map door must open OSM at the shop pin, and stay shut on the sample');
  assert.match(reach, /credit=\{mapHref !== null\}/, 'the sample\'s credit must be words, not a link');
  const map = stripComments(readFileSync(join(HERE, '../../vendor-dashboard/shop/_components/reach-map.tsx'), 'utf8'));
  assert.match(map, /card \? 'aspect-\[9\/5\] max-h-\[250px\]'/, 'the card shape is the map card\'s 9 : 5, never taller than 250 px');
  assert.match(map, /height: card \? undefined : H/, 'the dashboard map keeps its fixed height');
  assert.match(map, /<MapCredit link=\{credit\} \/>/);
  const dash = stripComments(readFileSync(join(HERE, '../../vendor-dashboard/shop/_components/service-radius-fields.tsx'), 'utf8'));
  assert.doesNotMatch(dash, /<ReachMap[^>]*\bcard\b/, 'the supplier\'s own Where you work map is not the public card');
});

test('the Where tab and the Where section share one answer — a shop with nowhere to show has neither (re-walk 2026-11-14)', () => {
  assert.match(PAGE, /const where = shopWhere\(/);
  assert.match(PAGE, /const hasWhere = where\.has;/);
  assert.match(PAGE, /\.\.\.\(hasWhere \? \[\{ id: 'shop-where', label: 'Where' \}\] : \[\]\)/, 'the Where tab is drawn whatever the shop has');
  assert.match(PAGE, /\{isVerifiedShop \|\| !hasWhere \? null : \(\s*<div id="shop-where"/, 'the Where section is drawn whatever the shop has');
});

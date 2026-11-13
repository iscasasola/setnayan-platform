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
import { nextSaturdays } from './_components/open-dates-peek';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const PAGE = read('page.tsx');
const PANEL = read('_components/shop-can-do-panel.tsx');
const PEEK = read('_components/open-dates-peek.tsx');

test('the verified look is every verified shop — not a plan', () => {
  assert.match(PAGE, /const cinematicHero = vendor\.verification_state === 'verified';/);
  assert.doesNotMatch(PAGE, /const cinematicHero = isEnterprise/, 'the hero went back behind Ultra');
  assert.match(PAGE, /\{cinematicHero \? \(\s*<ShopHero\b/, 'the hero is not drawn for the verified look');
});

test('Check a date and the peek exist only behind the verified + bookable gate', () => {
  // The action-row door keeps its own `bookable` gate (the-since-line-and-check-a-date.test.ts); the panel and the
  // peek ride the verified look AND bookable; the dates read itself never runs for an unverified shop.
  assert.match(PAGE, /\{cinematicHero && bookable \? \(\s*<ShopCanDoPanel\b/, 'the "can\'t do" panel left its gate');
  assert.match(PAGE, /\{cinematicHero && bookable \? <OpenDatesPeek\b/, 'the open-dates peek left its gate');
  assert.equal((PAGE.match(/<ShopCanDoPanel\b/g) ?? []).length, 1);
  assert.equal((PAGE.match(/<OpenDatesPeek\b/g) ?? []).length, 1);
  assert.match(PAGE, /if \(cinematicHero && bookable\) \{\s*const dates = await readCheckADate\(/);
  assert.equal((PAGE.match(/readCheckADate\(/g) ?? []).length, 1, 'a second, ungated dates read');
  // The panel's Check a date is the shipped door to the shipped landing.
  assert.match(PANEL, /<CheckADateLink href=\{checkHref\}/);
  assert.match(PEEK, /Check your own date/);
});

test('a failed dates read draws no days — never an open Saturday', () => {
  assert.match(PAGE, /if \(dates && dates\.kind === 'ok'\) \{/);
  assert.match(PEEK, /if \(days\.length === 0\) return null;/);
});

test('the peek lists the coming Saturdays, open unless the read says not bookable', () => {
  // 2026-11-13 is a Friday → first Saturday 14 Nov.
  const days = nextSaturdays('2026-11-13', { from: '2026-11-01', to: '2027-04-30' }, ['2026-11-21']);
  assert.deepEqual(
    days.map((d) => [d.iso, d.open]),
    [
      ['2026-11-14', true],
      ['2026-11-21', false],
      ['2026-11-28', true],
      ['2026-12-05', true],
      ['2026-12-12', true],
    ],
  );
  assert.equal(days[0]!.day, '14');
  // A Saturday today counts; the window's end stops the list.
  assert.deepEqual(
    nextSaturdays('2026-11-14', { from: '2026-11-01', to: '2026-11-22' }, []).map((d) => d.iso),
    ['2026-11-14', '2026-11-21'],
  );
  assert.deepEqual(nextSaturdays('nonsense', { from: 'x', to: 'y' }, []), []);
});

test('Lock lives only on the package cards', () => {
  assert.equal((PAGE.match(/<LockPackageModal\b/g) ?? []).length, 1, 'a second Lock control on the page');
  const fn = PAGE.indexOf('function VendorPackagesSection(');
  const lock = PAGE.indexOf('<LockPackageModal');
  const end = PAGE.indexOf('\nfunction ', fn + 10);
  assert.ok(fn > 0 && lock > fn && lock < end, 'the Lock control left the package card section');
  assert.match(PAGE, /<PackageCard\s[\s\S]{0,120}ctaSlot=\{cta\}/, 'the Lock is no longer the package card\'s own slot');
  // No page-level Lock door: the panel says what Lock does in words, it is not a button.
  assert.doesNotMatch(PANEL, /<button|<Link|LockPackageModal/, 'the panel grew a Lock door');
  const modal = stripComments(readFileSync(join(HERE, '../../_components/vendor-packages/lock-modal.tsx'), 'utf8'));
  assert.match(modal, /<PackageIcon[^>]*\/>\s*\{\s*\}\s*Lock this package/);
});

test('the section bar: verified About · Services · Portfolio · Reviews; unverified Services · Reviews · Where (no Inquire tab)', () => {
  assert.equal((PAGE.match(/<ShopSectionBar\b/g) ?? []).length, 1);
  const tabs = PAGE.slice(PAGE.indexOf('const shopSectionTabs'), PAGE.indexOf('const shopSectionTabs') + 900);
  const [ver, unv] = tabs.split(/\]\s*\n\s*:\s*\[/);
  const labels = (t: string | undefined) => [...(t ?? '').matchAll(/label: '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(labels(ver), ['About', 'Services', 'Portfolio', 'Reviews']);
  assert.deepEqual(labels(unv), ['Services', 'Reviews', 'Where']);
  // Every tab points at a section the page renders.
  for (const id of ['shop-about', 'shop-services', 'shop-portfolio', 'shop-reviews', 'shop-where']) {
    assert.match(PAGE, new RegExp(`id="${id}" data-shop-section=""`), `#${id} has no section`);
  }
  assert.doesNotMatch(tabs, /get-in-touch|Inquire/);
  const bar = read('_components/shop-section-bar.tsx');
  assert.doesNotMatch(bar, /history\.|localStorage|sessionStorage/, 'the bar writes history or storage');
});

test('the unverified page prints no web address and draws its map under Where', () => {
  assert.match(PAGE, /\{cinematicHero \? <ShopAddresses setnayanAddress=\{setnayanAddress\} ownAddress=\{ownAddress\} \/> : null\}/);
  const where = PAGE.slice(PAGE.indexOf('id="shop-where"'), PAGE.indexOf('id="get-in-touch"'));
  assert.match(where, /<ShopReachMap\b/);
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

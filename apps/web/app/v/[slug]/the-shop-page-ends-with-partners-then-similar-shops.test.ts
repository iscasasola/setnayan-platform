/**
 * 🔒 A SHOP PAGE ENDS WITH ITS PARTNERS, THEN SIMILAR SHOPS NEARBY (owner 2026-11-14, DECISION_LOG row of that name,
 * "APPROVED AS DRAWN"; prototype `shop_page_end_2026-11-14_fable.html`). The picking rule itself is executed by
 * `lib/similar-shops.test.ts`; this file holds the page to the drawing's ORDER, its ONE read, its reuse of Discover's
 * shipped card, and the carousel's promises — the parts a source test is the honest way to hold.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const noComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const PAGE = noComments(read('app/v/[slug]/page.tsx'));
const ROW = noComments(read('app/v/[slug]/_components/similar-shops-row.tsx'));
const CAROUSEL = noComments(read('app/v/[slug]/_components/trusted-by-carousel.tsx'));
const SERVER = noComments(read('lib/similar-shops.server.ts'));
const TRUSTED = noComments(read('lib/vendor-trusted-by.ts'));
const DATA = noComments(read('app/_components/frontdoor/data.ts'));

test('Trusted by left About — it is drawn at the end, then the similar row, then "See more suppliers"', () => {
  const services = PAGE.indexOf('id="shop-services"');
  const trusted = PAGE.indexOf('<TrustedBySection');
  const similar = PAGE.indexOf('<SimilarShopsRow');
  const coldDoor = PAGE.indexOf('data-shop-back="cold"');
  const footer = PAGE.indexOf('<footer');
  for (const [name, at] of Object.entries({ services, trusted, similar, coldDoor, footer })) {
    assert.ok(at !== -1, `${name} is gone from the page`);
  }
  assert.equal(PAGE.split('<TrustedBySection').length - 1, 1, 'Trusted by is drawn ONCE');
  assert.ok(trusted > services, 'Trusted by still sits in About (before Services) — it moved to the end');
  assert.ok(trusted < similar && similar < coldDoor && coldDoor < footer, 'the order is Trusted by → similar shops → the door → the footer');
});

test('Trusted by is still the shop\'s own choice, keeps "couldn\'t load", and is not drawn when empty', () => {
  assert.match(PAGE, /showTrustedBy \? \(\s*<TrustedBySection/);
  const fn = PAGE.slice(PAGE.indexOf('function TrustedBySection('), PAGE.indexOf('\nfunction ReviewsSection('));
  assert.ok(fn.indexOf('if (unreadable)') < fn.indexOf('if (vendors.length === 0) return null;'));
  assert.match(fn, /couldn&rsquo;t load/);
  assert.match(fn, /<TrustedByCarousel/);
});

test('each partner wears the app\'s own kind words, strongest first, and its round shop photo', () => {
  assert.match(PAGE, /kindLabel: PARTNERSHIP_PUBLIC_LABEL\[v\.relationshipType\]/);
  assert.match(TRUSTED, /PARTNERSHIP_RANK\[b\.relationshipType\] - PARTNERSHIP_RANK\[a\.relationshipType\]/, 'sorted by the one rank, strongest first');
  assert.match(TRUSTED, /logoRef: nameRevealed \?/, 'a still-hidden partner never shows its logo — it would name the shop');
  assert.match(PAGE, /logoUrl: v\.logoRef \? await resolveDisplayUrl\(v\.logoRef\) : null/);
  assert.match(PAGE, /initials: shopInitials\(/);
});

test('the carousel: native swipe, endless, arrows on a computer only, honours reduce-motion, each partner announced once', () => {
  assert.match(CAROUSEL, /snap-x snap-mandatory overflow-x-auto/, 'a native scroller with scroll-snap — the phone\'s own swipe');
  assert.match(CAROUSEL, /prefers-reduced-motion: reduce/);
  assert.match(CAROUSEL, /behavior: reducedMotion\(\) \? 'auto' : 'smooth'/, 'with reduce motion an arrow jumps');
  assert.equal((CAROUSEL.match(/hidden h-11 w-11[^"]*md:grid/g) ?? []).length, 2, 'two 44px arrows, drawn from 768 up only');
  assert.match(CAROUSEL, /loop \? \(\s*<button/, 'no arrows when everything fits');
  assert.match(CAROUSEL, /tiles\.length < 2/, 'one partner is one tile — never a carousel');
  assert.match(CAROUSEL, /aria-hidden=\{copy === middle \? undefined : true\}/, 'the wrap copies are hidden from a screen reader');
  assert.match(CAROUSEL, /tabIndex=\{hidden \? -1 : undefined\}/, 'and from the Tab key');
  assert.doesNotMatch(CAROUSEL, /setInterval|autoplay/i, 'nothing moves by itself');
});

test('the similar row is ONE remembered read: public, same kind of work, same demo-ness', () => {
  assert.equal((SERVER.match(/\.from\(/g) ?? []).length, 1, 'one request — owner: fewest requests per task');
  assert.match(SERVER, /\.match\(\{ \.\.\.LIVE_SHOP_GATE, is_demo: demo \}\)/, 'public only; a demo shop sees demo shops, a real one real shops');
  assert.match(SERVER, /\.contains\('services', \[service\]\)/, 'the marketplace\'s own category match');
  assert.match(SERVER, /rememberPublicRead\(readSimilarShopRows/);
  assert.match(SERVER, /tags: \[HOME_SHELF_TAGS\.shops\]/, 'cleared with the shop shelf when a listing changes');
  assert.match(SERVER, /throw new ReadRefused/, 'a refused read is never remembered as "none"');
  assert.match(PAGE, /rememberedSimilarShopRows\(similarService, vendor\.is_demo === true\)/);
});

test('the similar row draws Discover\'s SHIPPED card and grid words, with no badge-stats reads', () => {
  assert.match(ROW, /import \{ ShopCard \} from '@\/app\/_components\/frontdoor\/front-door-feed'/);
  assert.match(ROW, /<ShopCard key=\{s\.href\} s=\{s\} href=\{withShopArrival\(s\.href, arrival\)\} \/>/, 'back from a similar shop returns where the couple started');
  assert.match(ROW, /pickSimilarShops\(candidates, self, excludeIds\)/);
  assert.match(PAGE, /excludeIds=\{trustedBy\.map\(\(v\) => v\.vendorProfileId\)\}/, 'never a shop already under Trusted by');
  assert.match(ROW, /if \(picked\.shops\.length === 0\) return null;/, 'none → not drawn, no empty message');
  assert.match(ROW, /similarShopsSeeAllHref\(service\)/);
  assert.match(DATA, /return toFrontDoorShops\(rows, \{ badgeStats: false \}\);/);
  assert.match(DATA, /if \(opts\.badgeStats === false\) return null;/);
});

test('"See more suppliers" is unchanged', () => {
  assert.match(read('lib/shop-back.ts'), /export const SHOP_BACK_COLD: ShopBackDoor = \{ href: '\/explore', label: 'See more suppliers', back: false \};/);
  assert.match(PAGE, /\{!shopBack\.back \? \(\s*<Link href=\{shopBack\.href\} className="button-secondary" data-shop-back="cold">/);
});

// ── The card's CSS copy cannot drift from Discover's ────────────────────────────────────────────────────────────

type Rule = { selectors: string[]; decls: string };
function topLevelRules(css: string): Rule[] {
  const out: Rule[] = [];
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  // Top-level only: a rule whose selector starts at column 0 (the sheets indent everything inside @media).
  const re = /(?:^|\n)([.a-zA-Z][^{}\n]*(?:,\n[.a-zA-Z][^{}\n]*)*)\s*\{([^{}]*)\}/g;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    out.push({
      selectors: m[1]!.split(',').map((s) => s.trim().replace(/\s+/g, ' ')),
      decls: m[2]!
        .split(';')
        .map((d) => d.trim().replace(/\s+/g, ' '))
        .filter(Boolean)
        .join('; '),
    });
  }
  return out;
}

test('every card rule in shop-end.css is word for word its rule in front-door.css', () => {
  const original = topLevelRules(read('app/_components/frontdoor/front-door.css'));
  const copy = read('app/v/[slug]/_components/shop-end.css');
  const cardPart = copy.slice(copy.indexOf('THE CARD, copied from front-door.css'));
  const copied = topLevelRules(cardPart.slice(cardPart.indexOf('*/') + 2));
  assert.ok(copied.length >= 18, `expected the card's rules, found ${copied.length}`);
  for (const rule of copied) {
    const wanted = rule.selectors.map((s) => s.replace(/^\.sn-shopend /, ''));
    const match = original.find((o) => wanted.every((w) => o.selectors.includes(w)) && o.decls === rule.decls);
    assert.ok(
      match,
      `shop-end.css "${rule.selectors.join(', ')}" no longer matches front-door.css — the shop card changed there; copy it here.\n  copy: ${rule.decls}`,
    );
  }
});

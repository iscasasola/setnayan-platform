/**
 * 🪞 THE SAMPLE IS THE REAL PAGE (owner 13 Nov 2026, DECISION_LOG "THREE PUBLIC PAGES APPROVED — AND THE FRONT PAGES
 * FOLLOW": *"also adapt the frontpages that shows a sample page and where the websites are presented"*).
 *
 * `SampleShopPage` is the shop page every front page shows without a real shop behind it — the /for-suppliers plan
 * miniatures and their full-screen view, /dev/shop-plan-lab, and /for-coordinators "Your page is your marketing tool".
 * It must be drawn from the pieces `/v/[slug]` ships (#7574), so a change to the shop page reaches the samples, and the
 * samples can never quietly become a second, older drawing again (which is what this guard replaces: a plan-ladder
 * copy with an Ultra-only hero, a Pro-only cover band and a second Inquire on the photo).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { SAMPLE_SHOP_PLANS, samplePeekDays, samplePlanCaption, samplePlanShop } from './_components/sample-shop-plan';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const SAMPLE = read('app/v/[slug]/_components/sample-shop-page.tsx');
const PAGE = read('app/v/[slug]/page.tsx');

test('the sample mounts the shipped shop-page pieces — the same ones /v/[slug] imports', () => {
  for (const [piece, from] of [
    ['ShopHero', './shop-hero'],
    ['ShopSectionBar', './shop-section-bar'],
    ['ShopCanDoPanel', './shop-can-do-panel'],
    ['OpenDatesPeek', './open-dates-peek'],
    ['NotYetVerifiedNotice', './not-yet-verified-notice'],
  ] as const) {
    assert.match(SAMPLE, new RegExp(`import \\{[^}]*\\b${piece}\\b[^}]*\\} from '${from.replace('.', '\\.')}';`), `${piece} is not imported`);
    assert.match(SAMPLE, new RegExp(`<${piece}\\b`), `${piece} is imported but not drawn`);
    assert.match(PAGE, new RegExp(`<${piece}\\b`), `the shop page no longer draws ${piece} — re-read what it ships`);
  }
  for (const cls of ['SHOP_CALLING_CARD_CLASS', 'SHOP_CALM_COLUMN_CLASS', 'SHOP_CARD_SECTION_CLASS']) {
    assert.match(SAMPLE, new RegExp(`\\b${cls}\\b`), `the sample does not use ${cls} from shop-columns`);
  }
});

test('the look follows verified, like the page — never a plan', () => {
  assert.match(SAMPLE, /\{d\.verified \? \(\s*<ShopHero\b/, 'the verified hero is not drawn for every verified plan');
  assert.match(SAMPLE, /frame="sample"/, 'the sample hero must be the page-in-a-page frame (no second <h1>, no preload)');
  assert.doesNotMatch(SAMPLE, /cinematicHero|coverBand|isEnterprise|data-sample-hero/, 'the retired plan-ladder hero is back');
  for (const plan of SAMPLE_SHOP_PLANS) {
    const d = samplePlanShop(plan) as Record<string, unknown>;
    assert.equal(d.verified, plan !== 'free');
    assert.ok(!('cinematicHero' in d) && !('coverBand' in d), `${plan}: the decision still carries a plan-only hero`);
    assert.ok(samplePlanCaption(plan).length > 0);
  }
});

test('one Inquire, and a drawing has no door to a shop that does not exist', () => {
  assert.equal((SAMPLE.match(/^\s*Inquire\s*$/gm) ?? []).length, 1, 'the sample draws more than one Inquire');
  assert.doesNotMatch(SAMPLE, /<(a|Link)\b[^>]*href=/, 'the sample links somewhere — it is a drawing');
  assert.match(SAMPLE, /<OpenDatesPeek days=\{samplePeekDays\(todayInManila\(\)\)\} checkHref=\{null\} \/>/);
  assert.match(SAMPLE, /<ShopCanDoPanel hasPackages=\{false\}/);
  assert.match(SAMPLE, /<CheckADateLink href=\{null\}/);
  // RW-81 (walk 13 Nov 2026): the map's "View larger map →" too — every map the sample draws passes `mapHref={null}`,
  // and both map components honour it by drawing no <a>.
  const maps = SAMPLE.match(/<ShopReachMap\b[^>]*\/>/g) ?? [];
  assert.ok(maps.length >= 1, 'the sample no longer draws its map — re-anchor this check');
  for (const m of maps) assert.match(m, /mapHref=\{null\}/, `a sample map still links out: ${m}`);
  assert.doesNotMatch(SAMPLE, /<VendorLocationMap\b(?![^>]*mapHref=\{null\})[^>]*\/>/, 'a sample VendorLocationMap links out');
  for (const f of ['app/v/[slug]/_components/shop-reach.tsx', 'app/_components/vendor-location-map.tsx']) {
    assert.match(read(f), /mapHref === null \?/, `${f} no longer draws the map link without a link for the sample`);
  }
  // Its anchors are its own, per plan: five drawings on one page must not share an id or a ↑ Top target.
  assert.match(SAMPLE, /const id = \(part: string\) => `sample-\$\{plan\}-\$\{part\}`;/);
  assert.match(SAMPLE, /<ShopSectionBar tabs=\{tabs\} topId=\{id\('top'\)\} \/>/);
});

test('the sample peek shows both states on coming Saturdays', () => {
  const days = samplePeekDays('2026-11-13');
  assert.equal(days[0]!.iso, '2026-11-14');
  assert.deepEqual(days.map((d) => d.open), [true, false, true, true, true]);
});

test('/for-coordinators presents the page itself, through the same miniature row as /for-suppliers', () => {
  const fc = read('app/(shell)/for-coordinators/page.tsx');
  assert.match(fc, /<PlanPagePreview plan="verified"[^>]*ownTokens>\s*<SampleShopPage plan="verified"/);
  assert.match(fc, /from '@\/app\/for-suppliers\/_components\/plan-page-preview';/);
});

test('the section bar scrolls the sheet it sits in, and the shop page keeps the window', () => {
  const bar = read('app/v/[slug]/_components/shop-section-bar.tsx');
  assert.match(bar, /function scrollerOf\(nav: HTMLElement\): Scroller/);
  assert.match(bar, /el\.scrollHeight > el\.clientHeight \+ 1/, 'an overflow-x-only ancestor would be taken for the scroller');
  assert.match(bar, /topId = 'shop-top'/, 'the shop page lost its ↑ Top default');
});

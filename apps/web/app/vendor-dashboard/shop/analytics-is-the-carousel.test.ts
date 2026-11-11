/**
 * 🔒🎠 ANALYTICS IS THE CAROUSEL — AND THERE IS ONLY ONE (owner 11 Nov 2026: *"Analytics should be the carousel."* →
 * *"we want one long carousel"* → the window *"inside each card"* → *"Sliding switch"*; DECISION_LOG 2026-11-11
 * 🎠 · 📊✅ · 🎚✅; prototype `prototypes/analytics_option_b_2026-11-11/analytics-option-b.html`, option 3).
 *
 * Two analytics that disagree about one fact each pass their own tests, so this guard holds the SHAPE:
 *
 *   1 · The Shop tab streams the one Analytics section, and the badge row sits directly under it. Nothing else on the Shop
 *       page reads or draws analytics.
 *   2 · The carousel is one long row in the prototype's order — Opened · Asked · Booked as three cards of their own, then
 *       every graph once — and it is mounted by the section alone (no second Analytics anywhere in the app).
 *   3 · The window lives INSIDE each card: a card either carries its own sliding two-button switch (`PillSelector`, the
 *       house switch) or a fixed-window label; nothing sits above the carousel (no page-wide window menu).
 *   4 · The old Analytics page is a redirect onto the carousel, and every in-app door goes straight there.
 *   5 · An unverified shop: the counts and ONE shared lock card, the graphs not read at all.
 *
 * Source-reading, comments stripped (`stripComments`), so a docblock that MENTIONS a symbol never satisfies a pin.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { ONE_ANALYTICS_HREF, SHOP_SEGMENT_HREF } from './_components/shop-sections';
import { CARD_ORDER, FIXED_WINDOW } from '../performance/_components/analytics-cards';

const WEB = join(__dirname, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const PAGE = read('app/vendor-dashboard/shop/page.tsx');
const CAROUSEL = read('app/vendor-dashboard/performance/_components/analytics-carousel.tsx');
const SECTION = read('app/vendor-dashboard/performance/_components/one-analytics-section.tsx');
const OLD_PAGE = read('app/vendor-dashboard/performance/page.tsx');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}
const APP_FILES = walk(join(WEB, 'app')).filter((f) => !f.includes(join('app', 'dev')));

test('1 · the Shop tab streams the one Analytics, with the badge row directly under it', () => {
  const render = PAGE.slice(PAGE.indexOf('<ShopCover'));
  const analytics = render.indexOf('<OneAnalyticsSection');
  const badges = render.indexOf('<ShopBadgeRow');
  assert.ok(analytics > 0, 'the Shop tab does not draw the Analytics carousel');
  assert.ok(badges > analytics, 'the badge row is not under the carousel');
  assert.doesNotMatch(render.slice(analytics + 1, badges), /<(?!\/?Suspense\b)[A-Z]\w*/, 'something sits between the carousel and the badge row');
  assert.match(render.slice(0, analytics), /<Suspense fallback=\{<AnalyticsPlaceholder \/>\}>\s*$/, 'the carousel no longer streams in its own Suspense');
  assert.doesNotMatch(PAGE, /buildGrowthRecs|buildGrowthView|SnapCarousel|readNewGraphs/, 'the Shop page reads or draws analytics of its own');
});

test('2 · one long carousel in the prototype’s order, mounted by the section alone', () => {
  assert.deepEqual(
    [...CARD_ORDER],
    ['opened', 'asked', 'booked', 'sources', 'cardsell', 'reply', 'replyvs', 'quotes', 'split', 'calendar', 'lost', 'slow', 'rep', 'bench', 'price'],
    'the carousel’s cards moved, merged or went missing',
  );
  assert.match(CAROUSEL, /<SnapCarousel cards=\{cards\} label="Analytics"/, 'the Analytics is not one carousel');
  assert.equal((CAROUSEL.match(/<SnapCarousel\b/g) ?? []).length, 1, 'more than one carousel — the owner asked for ONE long one');
  const mounts = APP_FILES.filter((f) => /<AnalyticsCarousel\b/.test(stripComments(readFileSync(f, 'utf8')))).map((f) => relative(WEB, f));
  assert.deepEqual(mounts, ['app/vendor-dashboard/performance/_components/one-analytics-section.tsx'], `Analytics is drawn in more than one place: ${mounts.join(', ')}`);
  const old = APP_FILES.filter((f) => /<AnalyticsGrowing\b|<GraphSection\b|<GraphTile\b/.test(stripComments(readFileSync(f, 'utf8')))).map((f) => relative(WEB, f));
  assert.deepEqual(old, [], `the second Analytics surface is back: ${old.join(', ')}`);
});

test('3 · the window lives inside each card — a sliding switch, or a fixed label; nothing above the carousel', () => {
  // Every card gets `control(k, …)` — the switch or the label.
  const pushes = CAROUSEL.match(/cards\.push\(\{ key: k,[^\n]*/g) ?? [];
  assert.equal(pushes.length, 2, 'a card kind was added without passing through the one card builder');
  for (const p of pushes) assert.match(p, /control=\{control\(k, g\.title\)\}/, `a card has no window control: ${p}`);
  assert.match(CAROUSEL, /FIXED_WINDOW\[k\] \?[\s\S]*?data-analytics-fixed-window[\s\S]*?: \([\s\S]*?<PillSelector\b[^>]*options=\{WINDOW_OPTIONS\}/, 'a card’s window is not the sliding switch-or-label');
  assert.match(CAROUSEL, /WINDOW_OPTIONS[^=]*= GROWTH_WINDOWS\.map\(\(w\) => \(\{ key: w\.key, label: w\.label\.replace\(\/\^Last \/, ''\) \}\)\)/, 'the switch’s two buttons are not the one window list');
  // The counts always switch; a fixed card is never a count card.
  for (const k of ['opened', 'asked', 'booked'] as const) assert.equal(FIXED_WINDOW[k], undefined, `${k} lost its switch`);
  // Nothing above: the section header holds the eyebrow and the card count only.
  const head = CAROUSEL.slice(CAROUSEL.indexOf('<section'), CAROUSEL.indexOf('<SnapCarousel'));
  assert.doesNotMatch(head, /PickMenu|PillSelector|GrowthWindowScope|useGrowthWindow/, 'a window control sits above the carousel');
  assert.doesNotMatch(SECTION, /GrowthWindowScope|ShopSegments|PickMenu/, 'the section draws a page-wide window again');
});

test('4 · the old Analytics page lands on the carousel; doors go straight there', () => {
  assert.equal(ONE_ANALYTICS_HREF, '/vendor-dashboard/shop#analytics');
  assert.equal(SHOP_SEGMENT_HREF.insights, ONE_ANALYTICS_HREF, 'the Shop › Analytics segment does not open the carousel');
  assert.match(CAROUSEL, /id="analytics"/, 'the carousel lost its #analytics anchor');
  assert.match(OLD_PAGE, /redirect\('\/vendor-dashboard\/shop#analytics'\)/, 'the old address no longer lands on the carousel');
  assert.doesNotMatch(OLD_PAGE, /from '@\/lib\/supabase|\.from\(|\.rpc\(/, 'the old Analytics page reads again — a second Analytics');
  const bounced = APP_FILES.filter((f) => !f.endsWith(join('performance', 'page.tsx')))
    // A DOOR (a link, a redirect, a push) — not the Shop row's activeMatch list, which still lights Shop on the old URL.
    .filter((f) => /(?:href[=:]\s*\{?\s*|redirect\(\s*|push\(\s*)['"`]\/vendor-dashboard\/performance\b/.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => relative(WEB, f));
  assert.deepEqual(bounced, [], `a door still goes through the old page: ${bounced.join(', ')}`);
});

test('5 · an unverified shop: three counts and ONE lock card, no graph read', () => {
  const gate = SECTION.indexOf("canUse('analytics'");
  assert.ok(gate > 0, 'the section lost the shared analytics lock');
  const lockedReturn = SECTION.indexOf('<AnalyticsCarousel', gate);
  assert.match(SECTION.slice(lockedReturn, lockedReturn + 200), /locked=\{\{/, 'the unverified branch draws the full carousel');
  assert.doesNotMatch(SECTION.slice(gate, lockedReturn), /readNewGraphs|buildGrowthView/, 'the unverified branch reads the graphs it may not show');
  assert.match(CAROUSEL, /if \(props\.locked\) \{\s*cards\.push\([\s\S]*?<AnalyticsLock\b/, 'the lock is not one card of the carousel');
});

/**
 * 📜 THE INVITATION AND SAVE THE DATE ARE ONE PAGE — THE BAR JUMPS TO SECTIONS · ME STAYS ITS OWN PAGE.
 *
 * Owner 2026-10-15 (DECISION_LOG "THE INVITATION AND SAVE THE DATE BECOME ONE PAGE — THE BOTTOM BAR JUMPS TO
 * SECTIONS · ME STAYS ITS OWN PAGE · THE DAY KEEPS ITS TABS", then "ONE-PAGE INVITATION + SAVE THE DATE … —
 * APPROVED" on `prototypes/event_hub_one_page_and_desktop_2026-10-15_fable.html` §1 · §1b · §1c, with the five
 * answers: Home · Story · Me on Save the Date, Home jumps to the first section after the cover, the event-details
 * card stays first in Details). The Day keeps a page per tab — `each-tab-is-its-own-page.test.ts` holds that.
 *
 * Held on the REAL guest page (`SiteBody`, drawn by `lib/site-body-fixture-render.ts` with no database — the
 * fixture's Maria & Jose, a listed guest who has not replied, with a love story so Story has a chapter):
 *
 *   1 · the rules: the two stages are one page, The Day is tabs; a mark's address is its anchor, Me's is `?tab=me`.
 *   2 · the three anchors exist, ONCE each as a mark, in page order — Home after the cover, then Details (its first
 *       thing the event-details card), then Story — and every group of the three is on the one page, shown.
 *   3 · each slot's href is its anchor; Me is a page: `?tab=me` shows Me alone, and an old `?tab=details` address
 *       still draws the one page (the shell then scrolls it to Details).
 *   4 · Save the Date: Home · Story · Me — Story let through because the story IS on the page; Me opened there
 *       lifts the film.
 *   5 · the bar over the cover: the cover leads the page, the bar is the one the cover's rule holds off screen
 *       (`nav[aria-label="Site sections"]` under `sn-cover-wait`), and it slides in on the first swipe.
 *   6 · the lit item: one IntersectionObserver, the last mark crossed is lit (`litJumpMark`), `aria-current="true"`.
 *
 * SABOTAGES (each run once, seen red, put back — recorded in the PR body and the handover).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
/* FIRST, before anything that draws the guest page: this import installs the fixture's seam. */
import { renderSiteBodyFixture } from '@/lib/site-body-fixture-render';
import { FIXTURE_EVENT, fixtureStranger, fixtureWidgets } from '@/lib/site-body-fixture';
import { stripComments } from '@/lib/strip-comments';
import {
  ONE_PAGE_STAGES,
  OWN_PAGE_TABS,
  SCROLL_PAGE,
  TABBED_STAGES,
  activeHubTab,
  hubPageModeOf,
  hubPageOf,
  hubPagesOf,
  hubTabHref,
  hubTabsOn,
} from './hub-tabs';
import { LIT_LINE, litJumpMark } from './jump-marks';

const SLUG = join(__dirname, '..');
const WEB = join(SLUG, '..', '..');
const src = (...p: string[]) => stripComments(readFileSync(join(SLUG, ...p), 'utf8'));

/** The fixture with a love story, so the Story mark has a chapter to land on (`storyTabHasChapter`). */
const STORY = {
  event: { ...FIXTURE_EVENT, love_story: { moments: [{ id: 'm-1', line: 'We met at a friend’s wedding.', date: { y: 2019, m: 3 }, place: 'Tagaytay' }] } },
  widgets: [...fixtureWidgets(), { ...fixtureWidgets()[0]!, widget_id: 'fixture-our_love_story', widget_type: 'our_love_story' as const, display_order: 20, is_always_on: false }],
};

/** The pinned bottom bar's links, in order: label → href, and which one is lit. */
function barOf(html: string) {
  const bar = html.match(/<nav aria-label="Site sections" class="fixed inset-x-0 bottom-0[^"]*">[\s\S]*?<\/nav>/)?.[0] ?? '';
  return [...bar.matchAll(/<a href="([^"]*)"([^>]*)>[\s\S]*?<span[^>]*>([^<]*)<\/span><\/a>/g)].map((m) => ({
    label: m[3]!,
    href: m[1]!.replace(/&amp;/g, '&'),
    current: m[2]!.match(/aria-current="([^"]+)"/)?.[1] ?? null,
  }));
}

/** Every page group in order: its tab, its page, shown or hidden. */
function groupsOf(html: string) {
  return [...html.matchAll(/<div (?:id="[^"]*" )?data-hub-tab="([a-z]+)" data-hub-page="([a-z]+)"([^>]*)>/g)].map((m) => ({
    tab: m[1]!,
    page: m[2]!,
    hidden: / hidden=""/.test(m[3]!),
  }));
}

const at = (html: string, needle: string) => html.indexOf(needle);

/* ══ 1 · THE RULES ═══════════════════════════════════════════════════════════ */

test('1 · the Invitation and Save the Date are one page; The Day keeps its tabs', () => {
  assert.deepEqual([...ONE_PAGE_STAGES].sort(), ['rsvp', 'save_the_date']);
  assert.deepEqual([...TABBED_STAGES], ['event']);
  assert.equal(hubPageModeOf('rsvp'), 'one-page');
  assert.equal(hubPageModeOf('save_the_date'), 'one-page');
  assert.equal(hubPageModeOf('event'), 'tabs');
  assert.equal(hubPageModeOf('editorial'), null, 'Post Event is one page already, and not part of either ruling');
  // A mark's address is its section; Me keeps its own address.
  assert.equal(hubTabHref('home', true), '#site-home');
  assert.equal(hubTabHref('details', true), '#site-details');
  assert.equal(hubTabHref('story', true), '#site-story');
  assert.equal(hubTabHref('me', true), '?tab=me');
  assert.deepEqual([...OWN_PAGE_TABS], ['me']);
  // The pages: the one page and Me. An old `?tab=details` is the one page; `?tab=me` is Me.
  const pages = hubPagesOf(['home', 'details', 'story', 'me'], true);
  assert.deepEqual(pages, [SCROLL_PAGE, 'me']);
  for (const t of ['home', 'details', 'story']) assert.equal(hubPageOf(t, true), SCROLL_PAGE, `${t} is not on the one page`);
  assert.equal(activeHubTab('details', pages), SCROLL_PAGE);
  assert.equal(activeHubTab('me', pages), 'me');
  // Both stages are grouped (so Me can be a page) wherever the guest's bar is drawn — Save the Date under its film too.
  const on = { barDrawn: true, makerCanvas: false };
  assert.equal(hubTabsOn({ ...on, stage: 'rsvp', bodyNormal: true }), true);
  assert.equal(hubTabsOn({ ...on, stage: 'save_the_date', bodyNormal: false, bodyFilm: true }), true);
  assert.equal(hubTabsOn({ ...on, stage: 'save_the_date', bodyNormal: false, bodyFilm: false }), false);
  assert.equal(hubTabsOn({ ...on, stage: 'rsvp', bodyNormal: true, barDrawn: false }), false, 'no bar: one scroll, Me on it');
});

/* ══ 2 · THE THREE ANCHORS, IN ORDER, ON ONE PAGE ════════════════════════════ */

test('2 · the real Invitation: Home (after the cover) → Details (the event-details card first) → Story, all on the one page', async () => {
  const html = await renderSiteBodyFixture(STORY);
  for (const id of ['site-home', 'site-details', 'site-story']) assert.ok(at(html, `id="${id}"`) > 0, `#${id} is not on the page`);
  assert.equal(html.split('id="site-home"').length - 1, 1, '#site-home is drawn twice');
  assert.equal(html.split('id="site-details"').length - 1, 1, '#site-details is drawn twice');
  const cover = at(html, 'data-cover-scene=""');
  const [home, details, story] = ['site-home', 'site-details', 'site-story'].map((id) => at(html, `id="${id}"`));
  assert.ok(cover > 0, 'anti-vacuity: the cover is not on the page');
  assert.ok(cover < home!, 'Home jumps to the cover — it must land on the first section AFTER it');
  assert.ok(home! < details! && details! < story!, `the marks are out of order (home ${home} · details ${details} · story ${story})`);
  // Home's mark comes after the cover's one action too (the guest's RSVP), so Home never lands on the cover.
  assert.ok(at(html, 'data-arrival-action=') < home!, 'Home lands before the cover’s RSVP');
  // The event-details card is the first thing in Details.
  const afterDetails = html.slice(html.indexOf('>', details!) + 1, details! + 1500).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  assert.match(afterDetails, /^Event details Date /, `Details does not open on the event-details card: “${afterDetails.slice(0, 80)}”`);
  // Every group of Home · Details · Story is on the one page, and shown; Me is a page of its own, not shown.
  const groups = groupsOf(html);
  assert.ok(groups.length >= 5, `precondition: the page’s groups were found (${groups.length})`);
  for (const g of groups.filter((x) => x.tab !== 'me')) {
    assert.equal(g.page, SCROLL_PAGE, `a ${g.tab} group is not on the one page`);
    assert.equal(g.hidden, false, `a ${g.tab} group is hidden on the one page`);
  }
  assert.ok(groups.some((g) => g.tab === 'details') && groups.some((g) => g.tab === 'story'), 'Details or Story drew no group');
  assert.deepEqual(groups.filter((g) => g.tab === 'me').map((g) => [g.page, g.hidden]), [['me', true]], 'Me is not a page of its own');
  // The page's tabs, top first: never Details before Home's last group, never Story before Details'.
  const order = groups.filter((g) => g.tab !== 'me').map((g) => g.tab);
  const rank = (t: string) => ['home', 'details', 'story'].indexOf(t);
  for (let i = 1; i < order.length; i++) assert.ok(rank(order[i]!) >= rank(order[i - 1]!), `the one page runs ${order.join(' → ')}`);
});

/* ══ 3 · EACH SLOT'S HREF IS ITS ANCHOR · ME IS A PAGE ═══════════════════════ */

test('3 · the bar: Home · Details · Story are their anchors, Me is `?tab=me`; Me opens alone; an old ?tab=details is the one page', async () => {
  const html = await renderSiteBodyFixture(STORY);
  const bar = barOf(html);
  assert.deepEqual(bar.map((b) => `${b.label} ${b.href}`), ['Home #site-home', 'Details #site-details', 'Story #site-story', 'Me ?tab=me']);
  assert.deepEqual(bar.filter((b) => b.current).map((b) => `${b.label}=${b.current}`), ['Home=true'], 'the lit item is not Home, as a jump mark (`true`)');

  const me = await renderSiteBodyFixture({ ...STORY, activeTab: 'me' });
  const meGroups = groupsOf(me);
  assert.deepEqual(meGroups.filter((g) => !g.hidden).map((g) => g.tab), ['me'], 'Me is not a page of its own');
  assert.ok(me.includes('data-me-stage=""'), 'anti-vacuity: Me drew nothing');
  /* (Which item is lit on Me is read from the address in the browser — `useSearchParams` has no address in this
     static render, so it is walked in the lab, not asserted here.) */

  const old = await renderSiteBodyFixture({ ...STORY, activeTab: 'details' });
  assert.deepEqual(
    groupsOf(old).filter((g) => !g.hidden).map((g) => g.page).filter((p, i, a) => a.indexOf(p) === i),
    [SCROLL_PAGE],
    'an old ?tab=details address no longer draws the one page',
  );
  // …and the shell turns that address into the mark it now is, scrolled to it (the browser half: the lab walk).
  const SHELL = src('_components', 'hub', 'hub-shell.tsx');
  assert.match(SHELL, /if \(asked && isJumpMarkTab\(asked, true\) && keysRef\.current\.includes\(SCROLL_PAGE\)\)/);
  assert.match(SHELL, /go\(SCROLL_PAGE, 'replace', anchor && !window\.location\.hash \? anchor : window\.location\.hash\.slice\(1\) \|\| undefined\);/);
  assert.match(SHELL, /if \(onePage && key === SCROLL_PAGE\) url\.searchParams\.delete\(HUB_TAB_PARAM\);/, 'the one page’s address still carries ?tab=');
  // A stranger (no key, no Me) has the same one page: marks only.
  const stranger = await renderSiteBodyFixture({ ...STORY, identity: fixtureStranger() });
  assert.deepEqual(barOf(stranger).map((b) => `${b.label} ${b.href}`), ['Home #site-home', 'Details #site-details', 'Story #site-story']);
  assert.ok(groupsOf(stranger).every((g) => !g.hidden), 'a stranger’s one page hides a section');
});

/* ══ 4 · SAVE THE DATE ═══════════════════════════════════════════════════════ */

test('4 · Save the Date: Home · Story · Me — Story is there because the story is on the page; Me opened lifts the film', async () => {
  const std = await renderSiteBodyFixture({ ...STORY, lifecyclePhase: 'save_the_date', stdFilm: true });
  assert.deepEqual(barOf(std).map((b) => `${b.label} ${b.href}`), ['Home #site-home', 'Story #site-story', 'Me ?tab=me']);
  assert.ok(at(std, 'id="site-story"') > at(std, 'id="site-home"'), 'Story is not on the page below Home');
  // Without a story, no Story mark (a mark never lands on nothing).
  const bare = await renderSiteBodyFixture({ lifecyclePhase: 'save_the_date', stdFilm: true });
  assert.deepEqual(barOf(bare).map((b) => b.label), ['Home', 'Me']);
  // Me, opened on the Save the Date, is the guest's own page — the film is lifted for it.
  const BODY = src('_components', 'site-body.tsx');
  assert.match(BODY, /liftOnLanding=\{onePage && pageTabs\.active !== hubPageOf\('home', onePage\)\}/);
  const meStd = await renderSiteBodyFixture({ ...STORY, lifecyclePhase: 'save_the_date', stdFilm: true, activeTab: 'me' });
  assert.deepEqual(groupsOf(meStd).filter((g) => !g.hidden).map((g) => g.tab), ['me']);
});

/* ══ 5 · THE BAR OVER THE COVER ══════════════════════════════════════════════ */

test('5 · the bar is hidden over the cover and slides up on the first swipe (reduced motion: no slide)', async () => {
  const html = await renderSiteBodyFixture(STORY);
  // The page leads with the Cover Scene, and its bar is THE bar the cover's rule names.
  assert.ok(at(html, 'data-cover-scene=""') > 0 && at(html, 'data-cover-scene=""') < at(html, 'aria-label="Site sections"'));
  assert.ok(/<nav aria-label="Site sections" class="fixed inset-x-0 bottom-0/.test(html), 'the pinned bar is not the cover rule’s `nav[aria-label="Site sections"]`');
  const css = stripComments(readFileSync(join(WEB, 'app', 'globals.css'), 'utf8')).replace(/\s+/g, ' ');
  assert.match(css, /html\.sn-cover-wait:not\(\.sn-cover-open\):has\(header\[data-cover-scene\]\) nav\[aria-label='Site sections'\] \{ translate: 0 100%; opacity: 0; visibility: hidden; \}/, 'the bar is not held off the cover');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ html\.sn-cover-wait:has\(header\[data-cover-scene\]\) \[data-sticky-top\], html\.sn-cover-wait:has\(header\[data-cover-scene\]\) nav\[aria-label='Site sections'\] \{ transition: none; \}/, 'reduced motion still slides');
  // The bar slides in on the first swipe — the one mechanism (`cover-scene-menu.tsx`), mounted by the guest shell.
  const SHELL = src('_components', 'invitation-shell.tsx');
  assert.equal(SHELL.match(/<CoverSceneMenuWaits \/>/g)?.length, 2);
  const MENU = src('_components', 'cover-scene-menu.tsx');
  assert.match(MENU, /window\.scrollY>4/, 'the first swipe no longer opens the bars');
  // A jump made by the bar itself also opens it (a hash change is listened for), so Home never re-hides it.
  assert.match(MENU, /addEventListener\('hashchange',check\)/);
});

/* ══ 6 · THE LIT ITEM ════════════════════════════════════════════════════════ */

test('6 · scroll-spy: one IntersectionObserver on the marks, the last crossed is lit', () => {
  const vh = 800;
  const line = vh * LIT_LINE;
  const marks = (home: number, details: number, story: number) => [
    { key: 'home', top: home },
    { key: 'details', top: details },
    { key: 'story', top: story },
  ];
  assert.equal(litJumpMark(marks(900, 2400, 5000), vh), 'home', 'on the cover, Home (what the bar shows when it slides up)');
  assert.equal(litJumpMark(marks(line, 2400, 5000), vh), 'home');
  assert.equal(litJumpMark(marks(-1400, line - 1, 3000), vh), 'details');
  assert.equal(litJumpMark(marks(-4000, -2000, 100), vh), 'story');
  assert.equal(litJumpMark(marks(-4000, -2000, line + 1), vh), 'details', 'Story is lit before its mark reaches the line');
  assert.equal(litJumpMark([], vh), null);
  const BAR = src('_components', 'site-menu-bar.tsx');
  assert.equal(BAR.match(/new IntersectionObserver\(/g)?.length, 1, 'one observer, not one per mark');
  assert.match(BAR, /litJumpMark\(seen\.map\(\(t\) => \(\{ key: t\.key, top: t\.el\.getBoundingClientRect\(\)\.top \}\)\), window\.innerHeight\)/);
  assert.match(BAR, /if \(!onePage \|\| page !== SCROLL_PAGE\) return;/, 'the spy runs off the one page');
  assert.doesNotMatch(BAR, /addEventListener\('scroll'/, 'a scroll handler beside the observer');
  assert.match(BAR, /onePage && marks\.some\(\(m\) => m\.key === key\) \? 'true' : 'page'/, 'a lit mark is not `aria-current="true"`');
});

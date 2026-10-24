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
 *       (`nav[aria-label="Site sections"]` while `<style data-cover-menu="wait">`), it slides in on leaving the
 *       cover and hides again whenever the cover is back on screen (Q3) — the shipped script, executed.
 *   6 · the lit item: one IntersectionObserver on the marks, the last crossed is lit (`litJumpMark`), at the page's
 *       end the lowest on screen (a second observer on the foot), `aria-current="true"`.
 *   7 · a tap on Home lands with the cover FULLY gone, so the bars it was tapped on stay (Q3; 2026-10-16 "only once
 *       the cover is fully gone") — the jump's stop, computed from the stylesheet the page ships, is past the
 *       cover's edge with the top bar and without it.
 *       And where it lands, what follows the cover starts 8 px clear of the top bar.
 *   8 · a short page still gets its bars at its end, and a tap on a bar never takes them away.
 *   9 · (owner 2026-10-19 21:45, live cale-ice on his phone: both bars over the cover just after the unveil) a guest
 *       who arrives by a CLIENT-SIDE navigation still gets the wait — React inserts the server's script without running
 *       it, so the client re-runs that same text — and the page's end counts only where the cover cannot scroll away,
 *       after the guest's own move (never a load, a layout shift, or a scroll the page made itself).
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
  const bar = html.match(/<nav aria-label="Site sections" class="fixed inset-x-0 bottom-0[^"]*"[^>]*>[\s\S]*?<\/nav>/)?.[0] ?? '';
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

test('2 · the real Invitation: Home (after the cover) → Details → Story, all on the one page', async () => {
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
  // 🪪 Details no longer opens on an "Event details" card (owner 2026-10-24, "isn't this a dupe?" —
  // `the-details-tab-repeats-nothing.test.ts`): it opens on the couple's own scenes.
  const afterDetails = html.slice(html.indexOf('>', details!) + 1, details! + 1500).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  assert.ok(afterDetails.length > 0, 'anti-vacuity: Details opens on nothing');
  assert.doesNotMatch(afterDetails, /^Event details /, `Details still opens on the event-details card: “${afterDetails.slice(0, 80)}”`);
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

/** The shipped cover-menu script, as the page writes it. */
async function menuCode() {
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { CoverSceneMenuWaits } = await import('../_components/cover-scene-menu');
  return renderToStaticMarkup(React.createElement(CoverSceneMenuWaits)).replace(/^<script[^>]*>|<\/script>$/g, '').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}

const COVER_H = 800;
const VH = 812;

/** The script, run against a page with a shown cover `COVER_H` tall on a `VH` screen, the page `pageH` long. */
function menuSim(code: string, coverShown: boolean, withIo: boolean, pageH = 5000) {
  const attrs: Record<string, string> = {};
  const style = { setAttribute: (k: string, v: string) => void (attrs[k] = v), getAttribute: (k: string) => attrs[k] ?? null };
  const listeners: Record<string, Array<(e?: unknown) => void>> = {};
  const docListeners: Record<string, Array<(e?: unknown) => void>> = {};
  let rootTouched = false;
  let observers = 0;
  const win = { scrollY: 0, innerHeight: VH, addEventListener: (t: string, f: () => void) => void (listeners[t] ??= []).push(f), removeEventListener: () => {} };
  const header = { offsetParent: {}, getBoundingClientRect: () => ({ top: -win.scrollY, bottom: COVER_H - win.scrollY }) };
  const doc = {
    readyState: 'complete',
    head: { appendChild: () => {} },
    documentElement: new Proxy({}, { get: () => { rootTouched = true; return () => {}; } }),
    scrollingElement: { scrollHeight: pageH },
    createElement: () => style,
    querySelector: (sel: string) => (sel.startsWith('style') ? null : sel === 'header[data-cover-scene]' && coverShown ? header : null),
    addEventListener: (t: string, f: () => void) => void (docListeners[t] ??= []).push(f),
    removeEventListener: () => {},
  };
  /* A faithful threshold-0 observer: it reports the cover as intersecting while any of it is in [0, VH). */
  let observed: unknown = null;
  let fire: ((es: Array<{ target: unknown; isIntersecting: boolean }>) => void) | null = null;
  const report = () => fire?.([{ target: observed, isIntersecting: header.getBoundingClientRect().bottom > 0 && header.getBoundingClientRect().top < VH }]);
  class IO {
    constructor(cb: (es: Array<{ target: unknown; isIntersecting: boolean }>) => void, opts: { threshold: number }) {
      assert.equal(opts.threshold, 0, 'the observer does not fire at fully out (threshold 0)');
      observers++;
      fire = cb;
    }
    observe(t: unknown) { observed = t; }
    unobserve() { observed = null; }
  }
  new Function('window', 'document', 'addEventListener', 'removeEventListener', 'setTimeout', 'IntersectionObserver', code)(win, doc, win.addEventListener, win.removeEventListener, (f: () => void) => f(), withIo ? IO : undefined);
  report();
  const scrollTo = (y: number, ev = 'scroll') => {
    win.scrollY = Math.max(0, Math.min(y, pageH - VH));
    if (withIo) report();
    for (const f of listeners[ev] ?? []) f();
    return attrs['data-cover-menu'];
  };
  /** The guest's own touch (a tap's touchstart, or the start of a swipe). */
  const touch = () => { for (const f of listeners.touchstart ?? []) f(); };
  /** A click — on one of the bars, or on the page. */
  const click = (onBar: boolean) => {
    const target = { closest: (sel: string) => (onBar && /Site sections/.test(sel) ? {} : null) };
    for (const f of docListeners.click ?? []) f({ target });
    return attrs['data-cover-menu'];
  };
  return { now: () => attrs['data-cover-menu'], scrollTo, touch, click, rootTouched: () => rootTouched, scrollListened: () => (listeners.scroll ?? []).length, observers: () => observers, y: () => win.scrollY };
}

test('5 · the bars wait while ANY of the cover is on screen, come in once it is fully gone, hide again when it shows (reduced motion: no slide)', async () => {
  const html = await renderSiteBodyFixture(STORY);
  // The page leads with the Cover Scene, and its bar is THE bar the cover's rule names.
  assert.ok(at(html, 'data-cover-scene=""') > 0 && at(html, 'data-cover-scene=""') < at(html, 'aria-label="Site sections"'));
  assert.ok(/<nav aria-label="Site sections" class="fixed inset-x-0 bottom-0/.test(html), 'the pinned bar is not the cover rule’s `nav[aria-label="Site sections"]`');
  const css = stripComments(readFileSync(join(WEB, 'app', 'globals.css'), 'utf8')).replace(/\s+/g, ' ');
  const WAIT = "html:has(> head > style[data-cover-menu='wait']):has(header[data-cover-scene])";
  assert.ok(css.includes(`${WAIT} nav[aria-label='Site sections'] { translate: 0 100%; opacity: 0; visibility: hidden; }`), 'the bar is not held off the cover');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ html:has\(> head > style\[data-cover-menu\]\):has\(header\[data-cover-scene\]\) \[data-sticky-top\], html:has\(> head > style\[data-cover-menu\]\):has\(header\[data-cover-scene\]\) nav\[aria-label='Site sections'\] \{ transition: none; \}/, 'reduced motion still slides');
  // The one mechanism (`cover-scene-menu.tsx`), mounted by the guest shell.
  const SHELL = src('_components', 'invitation-shell.tsx');
  assert.equal(SHELL.match(/<CoverSceneMenuWaits \/>/g)?.length, 2);

  /* EXECUTED: the shipped script, run against a page with a shown cover 800 px tall. The marker is the ONE `<style>`
     in <head> (never the root: hydration-safe). Owner 2026-10-16 (DECISION_LOG "THE TOP AND BOTTOM BARS ARRIVE ONLY
     WHEN THE COVER IS FULLY GONE"): it stays `wait` while ANY pixel of the cover is on screen — 1 px left is still the
     cover — turns `open` only when the cover's bottom edge has passed the top, and is `wait` again the moment the
     cover shows (Q3, 2026-10-15). Both doors are run: the IntersectionObserver (threshold 0) every current browser
     takes, and the scroll measure a browser without one falls back to. A page whose cover is not shown (Me) is open. */
  const code = await menuCode();
  const run = (coverShown: boolean, withIo: boolean) => menuSim(code, coverShown, withIo);
  for (const withIo of [true, false]) {
    const how = withIo ? 'observer' : 'scroll measure';
    const page = run(true, withIo);
    assert.equal(page.now(), 'wait', `${how}: the bars are over the cover on landing`);
    assert.equal(page.scrollTo(360), 'wait', `${how}: the bars came in while the cover was still half on screen`);
    assert.equal(page.scrollTo(COVER_H - 1), 'wait', `${how}: the bars came in with the cover's last pixel still on screen`);
    assert.equal(page.scrollTo(COVER_H), 'open', `${how}: the cover is fully gone and the bars did not come in`);
    assert.equal(page.scrollTo(COVER_H - 40), 'wait', `${how}: the cover shows again and the bars did not hide`);
    assert.equal(page.scrollTo(1600), 'open', `${how}: leaving the cover again does not bring the bars back`);
    assert.equal(page.scrollTo(0), 'wait', `${how}: back at the top, the bars stayed over the cover`);
    assert.equal(page.rootTouched(), false, `${how}: the script touched <html> — hydration-unsafe`);
    assert.equal(run(false, withIo).now(), 'open', `${how}: a page without its cover on screen (Me) holds the bars back`);
    /* ONE gate on the cover: with an observer, exactly one, and the one scroll listener is the page's end (test 8);
       without one, that listener is the cover's measure too. */
    assert.equal(page.observers(), withIo ? 1 : 0, `${how}: a second observer was added on the cover`);
    assert.equal(page.scrollListened(), 1, `${how}: a second scroll gate was added`);
  }
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
  // At the page's end a short last section never reaches the line: the lowest mark on screen is lit.
  assert.equal(litJumpMark(marks(-4000, -1500, 500), vh, true), 'story', 'a tap on Story at the foot leaves Details lit');
  assert.equal(litJumpMark(marks(-4000, -1500, vh + 10), vh, true), 'details', 'at the end, a mark below the screen is lit');
  const BAR = src('_components', 'site-menu-bar.tsx');
  // One observer on the marks (never one per mark), and one on the page's foot (the bar's spacer).
  assert.equal(BAR.match(/new IntersectionObserver\(/g)?.length, 2, 'one observer on the marks + one on the foot');
  assert.match(BAR, /for \(const t of seen\) io\.observe\(t\.el\);/);
  assert.match(BAR, /<div ref=\{endRef\} aria-hidden className="h-\[calc\(3\.5rem\+env\(safe-area-inset-bottom\)\)\]/, 'the foot observed is not the bar’s own spacer');
  assert.match(BAR, /litJumpMark\(seen\.map\(\(t\) => \(\{ key: t\.key, top: t\.el\.getBoundingClientRect\(\)\.top \}\)\), window\.innerHeight, atEnd\)/);
  assert.match(BAR, /if \(!onePage \|\| page !== SCROLL_PAGE\) return;/, 'the spy runs off the one page');
  assert.doesNotMatch(BAR, /addEventListener\('scroll'/, 'a scroll handler beside the observer');
  assert.match(BAR, /onePage && marks\.some\(\(m\) => m\.key === key\) \? 'true' : 'page'/, 'a lit mark is not `aria-current="true"`');
});

/* ══ 7 · HOME LANDS PAST THE COVER, SO THE BARS STAY ═════════════════════════ */

/** A CSS length the stylesheet writes here — `4.5rem`, `-2px`, `calc(-4.5rem - 2px)`, `calc(4.5rem + 0.5rem + 2px - 3rem)` — in px (1rem = 16px). */
function px(v: string): number {
  const t = v.trim();
  const calc = t.match(/^calc\((.*)\)$/);
  const body = calc ? calc[1]!.trim() : t;
  const terms = body.match(/^(-?[\d.]+(?:rem|px)?)((?:\s+[+-]\s+[\d.]+(?:rem|px))*)$/);
  assert.ok(terms, `a length this guard cannot read: ${t}`);
  const one = (x: string) => {
    const m = x.match(/^(-?[\d.]+)(rem|px)?$/)!;
    return Number(m[1]) * (m[2] === 'rem' ? 16 : 1);
  };
  let sum = one(terms[1]!);
  for (const m of terms[2]!.matchAll(/\s+([+-])\s+([\d.]+(?:rem|px))/g)) sum += (m[1] === '-' ? -1 : 1) * one(m[2]!);
  return sum;
}

test('7 · a tap on Home lands with the cover fully gone — the bars it was tapped on stay', async () => {
  /* Seen live 2026-10-19 (maria-and-jose, 375 and the iPhone 13 engine): the jump stopped 152 px above Home's mark
     (the root's 4.5rem + the mark's own 5rem), the cover's door came back on screen and both bars left. */
  const html = await renderSiteBodyFixture(STORY);
  const mark = html.match(/<div id="site-home"([^>]*)>/)?.[1] ?? '';
  assert.match(mark, /data-home-after-cover=""/, 'Home’s mark is not the one after the cover');
  const cls = mark.match(/class="([^"]*)"/)?.[1] ?? '';
  assert.doesNotMatch(cls, /(?:^|\s)-?scroll-(?:mt|my|m)-/, `Home’s mark carries its own scroll margin (“${cls}”) — where it lands is said once, in globals.css`);
  /* The stylesheet the page ships: every rule, innermost blocks, in order (the last one for a selector wins). */
  const css = stripComments(readFileSync(join(WEB, 'app', 'globals.css'), 'utf8'));
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1]!.replace(/\s+/g, ' ').trim(), body: m[2]! }));
  const last = (sel: string, prop: string) => {
    let v: string | null = null;
    for (const r of rules) {
      if (!r.sel.split(',').map((x) => x.trim()).includes(sel)) continue;
      const d = r.body.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`));
      if (d) v = d[1]!.trim();
    }
    return v;
  };
  const STICKY = 'html:has([data-sticky-top])';
  const pad = last(STICKY, 'scroll-padding-top');
  assert.ok(pad, 'anti-vacuity: the root’s scroll padding for the pinned top bar was not found');
  assert.ok(px(pad) > 0, 'anti-vacuity: the root no longer pads jumps below the top bar — re-read this guard');
  for (const [how, rootPad, margin] of [
    ['with the pinned top bar', px(pad), last(`${STICKY} [data-home-after-cover]`, 'scroll-margin-top') ?? last('[data-home-after-cover]', 'scroll-margin-top')],
    ['without it', 0, last('[data-home-after-cover]', 'scroll-margin-top')],
  ] as const) {
    /* A jump stops at the target's top minus (root padding + the target's margin). The mark IS the cover's foot. */
    const past = -(rootPad + px(margin ?? '0'));
    assert.ok(past >= 1, `${how}: Home lands ${-past} px ABOVE the cover’s foot — the cover is on screen and the bars leave`);
    assert.ok(past <= 8, `${how}: Home lands ${past} px past the cover’s foot — it skips into the first section`);
  }
  /* 📏 …AND WHAT FOLLOWS THE COVER STARTS CLEAR OF THE TOP BAR (controller 2026-10-19: seen live, the countdown's
     heading under the bar after a Home tap). Where Home lands, the first section after the cover begins at the mark's
     height + the page's rhythm − how far past the mark it landed; that must be at least the bar's clearance + 8 px. */
  const rhythm = html.slice(0, html.indexOf('id="site-home"')).match(/<article[^>]*class="[^"]*\bspace-y-(\d+)\b[^"]*"[^>]*>(?![\s\S]*<article)/)?.[1];
  assert.ok(rhythm, 'anti-vacuity: the page’s rhythm above Home’s mark was not found');
  const height = last(`${STICKY} [data-home-after-cover]`, 'height');
  assert.ok(height, 'Home’s mark has no height of its own under the top bar');
  const landed = -(px(pad) + px(last(`${STICKY} [data-home-after-cover]`, 'scroll-margin-top') ?? '0'));
  const clear = px(height) + Number(rhythm) * 4 - landed;
  assert.ok(clear >= px(pad) + 8, `where Home lands the first section starts ${clear} px down — under the bar (${px(pad)} px + 8)`);
  assert.equal(px(last('[data-home-after-cover]', 'height') ?? '0'), 0, 'with no top bar to clear, Home’s mark still takes room');
});

/* ══ 8 · A SHORT PAGE STILL GETS ITS BARS · A TAP ON A BAR KEEPS THEM ═══════ */

test('8 · the bars come when the cover is gone OR the page’s end is reached; a tap on a bar never takes them away', async () => {
  /* Seen live 2026-10-19 (marco-marga, a Save the Date, signed out at 375): the page under the cover was shorter than a
     screen, so at its foot 305 px of the cover was still on screen and the bars — Me among them — never came. */
  const code = await menuCode();
  for (const withIo of [true, false]) {
    const how = withIo ? 'observer' : 'scroll measure';
    const short = menuSim(code, true, withIo, COVER_H + 500); // the page can scroll 488 px: never past the cover
    assert.equal(short.now(), 'wait', `${how}: a short page put its bars over the cover on landing`);
    short.touch(); // the guest's own swipe (test 9: the end counts only after one)
    assert.equal(short.scrollTo(200), 'wait', `${how}: the bars came mid-way down a short page with its cover on screen`);
    assert.equal(short.scrollTo(10_000), 'open', `${how}: at a short page’s end (cover still on screen) the bars did not come`);
    assert.ok(short.y() < COVER_H, 'precondition: the cover is still on screen at the end');
    assert.equal(short.scrollTo(short.y() - 200), 'wait', `${how}: back up from the end, with the cover showing, the bars stayed`);
    /* A page no taller than the screen has not been scrolled: its end is on screen, but the cover is the first screen. */
    assert.equal(menuSim(code, true, withIo, VH).now(), 'wait', `${how}: a page as short as the screen put its bars over the cover`);
    /* 👆 A tap on a bar keeps them: the jump's own scroll may bring the cover back on screen; the guest's next touch hands
       the bars back to the rule. A click elsewhere on the page does not. */
    const long = menuSim(code, true, withIo);
    assert.equal(long.scrollTo(1600), 'open');
    long.touch();
    long.click(true);
    assert.equal(long.scrollTo(COVER_H - 100), 'open', `${how}: a tap on a bar took the bars away`);
    long.touch();
    assert.equal(long.scrollTo(COVER_H - 150), 'wait', `${how}: after the guest’s own touch the cover showing did not hide the bars`);
    const page = menuSim(code, true, withIo);
    page.scrollTo(1600);
    page.click(false);
    assert.equal(page.scrollTo(COVER_H - 100), 'wait', `${how}: a click on the page (not a bar) held the bars`);
    assert.equal(long.rootTouched() || short.rootTouched(), false, `${how}: the script touched <html>`);
  }
  /* The Save the Date's bar carries Me for a guest with their own link — the bar the end of a short page brings in. */
  const std = await renderSiteBodyFixture({ ...STORY, lifecyclePhase: 'save_the_date', stdFilm: true });
  assert.ok(barOf(std).some((b) => b.label === 'Me' && b.href === '?tab=me'), 'the Save the Date’s bar has no Me');
});

/* ══ 9 · ARRIVING BY A CLIENT-SIDE NAVIGATION · THE END IS THE GUEST'S ════════════ */

/**
 * A page React has just inserted by a client-side navigation: its `<script data-cover-menu-script>` is in the DOM with
 * the shipped text and has NOT run (React never executes a script it inserts). Appending a NEW `<script>` element runs
 * its text, as a browser does. `coverAt` is when the Cover Scene is in the DOM: at once, or only after the script
 * looked (streamed in after it — the body's mutation then reveals it).
 */
function navSim(code: string, opts: { coverAt: 'now' | 'later' | 'never'; marker?: string | null; running?: boolean }) {
  const styles: Array<{ attrs: Record<string, string> }> = [];
  const win: Record<string, unknown> = { scrollY: 0, innerHeight: VH };
  const listeners: Record<string, Array<() => void>> = {};
  win.addEventListener = (t: string, f: () => void) => void (listeners[t] ??= []).push(f);
  win.removeEventListener = () => {};
  let coverIn = opts.coverAt === 'now';
  const header = { offsetParent: {}, getBoundingClientRect: () => ({ top: -(win.scrollY as number), bottom: COVER_H - (win.scrollY as number) }) };
  const mos: Array<() => void> = [];
  class MO {
    cb: () => void;
    constructor(cb: () => void) { this.cb = cb; }
    observe() { mos.push(this.cb); }
    disconnect() { const i = mos.indexOf(this.cb); if (i >= 0) mos.splice(i, 1); }
  }
  let runs = 0;
  const exec = (text: string) => {
    runs++;
    new Function('window', 'document', 'addEventListener', 'removeEventListener', 'setTimeout', 'IntersectionObserver', 'MutationObserver', text)(win, doc, win.addEventListener, win.removeEventListener, () => {}, undefined, MO);
  };
  const makeStyle = () => {
    const attrs: Record<string, string> = {};
    return { attrs, tag: 'style', setAttribute: (k: string, v: string) => void (attrs[k] = v), getAttribute: (k: string) => attrs[k] ?? null };
  };
  const doc = {
    readyState: 'complete',
    body: {},
    head: { appendChild: (el: { tag: string; textContent?: string; attrs?: Record<string, string> }) => { if (el.tag === 'script') exec(el.textContent ?? ''); else styles.push(el as never); } },
    documentElement: new Proxy({}, { get: () => () => {} }),
    scrollingElement: { scrollHeight: 5000 },
    createElement: (tag: string) => (tag === 'style' ? makeStyle() : { tag, textContent: '', remove: () => {} }),
    querySelector: (sel: string) => {
      if (sel === 'script[data-cover-menu-script]') return { textContent: code };
      if (sel.startsWith('style')) return styles[0] ?? null;
      if (sel === 'header[data-cover-scene]') return coverIn ? header : null;
      return null;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  if (opts.running) exec(code); // the page was first loaded whole: the server's script ran on its own
  if (opts.marker !== undefined && opts.marker !== null && styles[0]) styles[0].attrs['data-cover-menu'] = opts.marker;
  return {
    marker: () => (styles.length ? styles.map((x) => x.attrs['data-cover-menu']).join(',') : null),
    runs: () => runs,
    drawCover: () => { coverIn = true; for (const f of [...mos]) f(); },
    win: win as unknown as Window,
    doc: doc as unknown as Document,
  };
}

test('9 · a guest who arrives by a client-side navigation gets the wait; the end counts only where the cover cannot leave, after the guest’s own move', async () => {
  const code = await menuCode();
  const { runCoverMenuOnClient } = await import('../_components/cover-scene-menu-on-client');
  /* The shipped component carries its own client half — the one place a client-side navigation is caught. */
  const MENU = src('_components', 'cover-scene-menu.tsx');
  assert.equal(MENU.match(/<CoverSceneMenuOnClient \/>/g)?.length, 1, 'CoverSceneMenuWaits no longer mounts its client half');
  assert.match(MENU, /<script\s+\{\.\.\.\{ \[COVER_MENU_SCRIPT_ATTR\]: '' \}\}/, 'the server script is not findable by the client half');

  /* Live 2026-10-19 21:45: React inserted the page, its script never ran — no marker, both bars over the cover. */
  const notRun = navSim(code, { coverAt: 'now' });
  assert.equal(notRun.marker(), null, 'precondition: a script React inserts does not run');
  runCoverMenuOnClient(notRun.doc, notRun.win);
  assert.equal(notRun.marker(), 'wait', 'arrived by a client-side navigation, the bars are drawn over the cover');
  runCoverMenuOnClient(notRun.doc, notRun.win);
  assert.equal(notRun.runs(), 1, 'a second mount ran the script again (two sets of listeners)');
  assert.equal(notRun.marker(), 'wait', 'a second mount added a second marker');

  /* Already running (the guest first loaded a page whole, left it with the cover gone, came back): it looks again. */
  const back = navSim(code, { coverAt: 'now', running: true, marker: 'open' });
  assert.equal(back.marker(), 'open', 'precondition: the marker left open by the last page');
  runCoverMenuOnClient(back.doc, back.win);
  assert.equal(back.marker(), 'wait', 'back on a cover by a client-side navigation, the old page’s open marker stayed');
  assert.equal(back.runs(), 1, 'the running script was started a second time');

  /* The cover streams in after the script looked: the body's mutation brings the wait back. */
  const late = navSim(code, { coverAt: 'later' });
  runCoverMenuOnClient(late.doc, late.win);
  assert.equal(late.marker(), 'open', 'precondition: no cover yet, nothing to wait for');
  late.drawCover();
  assert.equal(late.marker(), 'wait', 'a cover drawn after the script looked got the bars over it');
  /* Me (no cover ever): open, as always. */
  const me = navSim(code, { coverAt: 'never' });
  runCoverMenuOnClient(me.doc, me.win);
  assert.equal(me.marker(), 'open', 'a page with no cover (Me) holds the bars back');

  /* The end is the guest's: a page not yet as tall as it will be (its sections still mounting) that the unveil or a
     layout shift nudged 10 px is at its "end" — but nobody moved it. */
  for (const withIo of [true, false]) {
    const how = withIo ? 'observer' : 'scroll measure';
    const nudged = menuSim(code, true, withIo, VH + 10);
    assert.equal(nudged.scrollTo(10), 'wait', `${how}: the page's end, reached by no move of the guest's, put the bars over the cover`);
    const short = menuSim(code, true, withIo, COVER_H + 500);
    assert.equal(short.scrollTo(10_000), 'wait', `${how}: a short page's end reached by the page itself put the bars over the cover`);
    short.touch();
    assert.equal(short.scrollTo(10_000), 'open', `${how}: at a short page's end after the guest's own swipe, the bars did not come`);
  }
});

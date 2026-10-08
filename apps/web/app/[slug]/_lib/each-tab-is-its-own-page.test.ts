/**
 * 📱 EACH MENU TAB IS ITS OWN FULL PAGE — owner 2026-09-30, verbatim: *"so this is
 * not a 1 page scroll jumping to different marks. this is each menu gets their
 * own full page scroll"*. DECISION_LOG rows "EACH MENU TAB IS ITS OWN FULL PAGE",
 * "THE GUEST MENUS, NAMED", "THE DAY'S MENU HAS FIVE: LIVE · WELCOME · CAMERA ·
 * GALLERY · ME", "THE INVITATION'S HOME IS THE GUEST'S OWN PAGE".
 *
 * Every rule of it, executed where it can be and read from source where the
 * rule IS a wiring (one shell, one bar, one address):
 *
 *   1 · the menus: Invitation = Welcome · Details · Our Love Story · Me;
 *       The Day = Live · Welcome · Camera · Gallery · Me; no RSVP slot, ever;
 *       the keys stay home/details/story/me.
 *   2 · each tab has its own address (`?tab=<key>`), and the address decides
 *       the tab — a bad or absent one is the first tab, never a blank page.
 *   3 · nothing is stranded: content asking for a tab this reader has not got
 *       lands on the nearest tab above it. Since 2026-10-08 (owner, DECISION_LOG
 *       "EIGHT OWNER ANSWERS" answer 5 — the guest's pages follow the Maker's
 *       filing: *"yes"*) a part asks for the PROTOTYPE's page first, so the
 *       whole order is: the prototype's page · the tab it asked for before ·
 *       the nearest tab above that · the first tab.
 *   4 · the day's Welcome: their look + the reminders + the walk + the venue +
 *       E-Gifts (their table is Me's since 2026-10-08 — prototype: Me · seats);
 *       the day's Live leads with Directions until the programme begins.
 *   5 · ONE shell (hub-shell.tsx, both frames), ONE bar (SiteMenuBar), ONE
 *       state (the address) — and never in the Maker's editing canvas.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  HUB_TAB_ORDER,
  TABBED_STAGES,
  activeHubTab,
  directionsLead,
  hubTabFor,
  hubTabHref,
  hubTabOfHref,
  hubTabsOn,
  inPageTabs,
  isHubTabHref,
} from './hub-tabs';
import { resolveSiteNav, navPhaseFor, type NavInput, type NavSlot } from './site-nav';
import { STAGE_BAR } from './stage-bar';
import { welcomePartsOnTheDay, welcomeCarriesGifts } from '@/lib/invitation-welcome';
import { makerGuestPages } from '@/lib/maker-guest-pages';
import { makerStagesPages, readerPageOf } from '@/lib/maker-stage-filing';
import { resolveSiteBodyPlan } from '@/lib/site-body-plan';
import { stripComments } from '@/lib/strip-comments';

const SLUG = join(__dirname, '..');
const read = (...p: string[]) => readFileSync(join(SLUG, ...p), 'utf8');

const guestAt = (stage: 'rsvp' | 'event', over: Partial<NavInput> = {}): NavSlot[] =>
  resolveSiteNav({
    viewer: { kind: 'guest' },
    phase: navPhaseFor({ dayOfPhase: stage === 'event' ? 'live' : 'inactive', isRecapBody: false }),
    hostAllowsCamera: true,
    anyChapterPublic: true,
    hasStory: true,
    hasDetails: true,
    liveBroadcast: false,
    destinations: { camera: '/papic/guest?from=ana', watch: '/ana/hub', join: '/ana/invite' },
    stageSlots: STAGE_BAR[stage].slots,
    tabbed: true,
    ...over,
  });

/* ══ 1 · THE MENUS ═══════════════════════════════════════════════════════════ */

test('1 · the Invitation: Welcome · Details · Our Love Story · Me — keys home/details/story/me', () => {
  const bar = guestAt('rsvp');
  assert.deepEqual(bar.map((s) => s.label), ['Welcome', 'Details', 'Our Love Story', 'Me']);
  assert.deepEqual(bar.map((s) => s.key), ['home', 'details', 'story', 'me'], 'the keys stay (links keep working)');
});

test('1 · The Day: Live · Welcome · Camera · Gallery · Me — broadcast or not', () => {
  for (const liveBroadcast of [false, true]) {
    const bar = guestAt('event', { liveBroadcast });
    assert.deepEqual(bar.map((s) => s.label), ['Live', 'Welcome', 'Camera', 'Gallery', 'Me']);
    assert.deepEqual(bar.map((s) => s.key), ['live', 'home', 'camera', 'gallery', 'me'], 'the day’s Welcome is `home`, the guest’s own page');
  }
  // A reader with no Welcome on the day → no dead tab.
  assert.deepEqual(guestAt('event', { hasWelcome: false }).map((s) => s.label), ['Live', 'Camera', 'Gallery', 'Me']);
});

test('1 · NO RSVP SLOT — for anyone, in any phase, tabbed or not', () => {
  for (const viewer of [{ kind: 'public' }, { kind: 'guest' }, { kind: 'couple' }, { kind: 'vendor', kits: [] }] as const)
    for (const phase of ['before', 'day', 'after'] as const)
      for (const tabbed of [false, true]) {
        const bar = resolveSiteNav({
          viewer, phase, tabbed, hostAllowsCamera: true, anyChapterPublic: true, hasStory: true, liveBroadcast: true,
          destinations: { camera: '/c', watch: '/w', join: '/j' },
        });
        assert.ok(!bar.some((s) => /rsvp|reply/i.test(`${s.key} ${s.label}`)), `${viewer.kind}/${phase}: an RSVP tab is back`);
      }
});

test('1 · the Maker’s Page ▾ offers the same pages, in the same words', () => {
  assert.deepEqual(makerGuestPages('rsvp', []).map((p) => p.label), ['Welcome', 'Details', 'Our Love Story', 'Me']);
  assert.deepEqual(makerGuestPages('event', []).map((p) => p.label), ['Live', 'Welcome', 'Camera', 'Gallery', 'Me']);
});

/* ══ 2 · EACH TAB HAS ITS OWN ADDRESS ════════════════════════════════════════ */

test('2 · a tabbed bar sends each in-page tab to its own address; a page of its own still leaves', () => {
  const day = guestAt('event');
  assert.deepEqual(
    Object.fromEntries(day.map((s) => [s.key, s.href])),
    { live: '?tab=live', home: '?tab=home', camera: '/papic/guest?from=ana', gallery: '?tab=gallery', me: '?tab=me' },
  );
  assert.deepEqual(inPageTabs(day), ['live', 'home', 'gallery', 'me']);
  // Untabbed (the Maker's canvas, a page that is one scroll) keeps the marks.
  const scroll = guestAt('rsvp', { tabbed: false });
  assert.ok(scroll.every((s) => s.href.startsWith('#')), 'a one-scroll page lost its marks');
  assert.deepEqual(inPageTabs(scroll), [], 'a one-scroll page has no tab pages');
});

test('2 · the address decides the tab; a bad or absent one is the first tab — never a blank page', () => {
  const tabs = ['home', 'details', 'story', 'me'];
  assert.equal(activeHubTab('story', tabs), 'story');
  assert.equal(activeHubTab(' me ', tabs), 'me');
  assert.equal(activeHubTab(['details', 'me'], tabs), 'details');
  for (const bad of [undefined, null, '', 'rsvp', 'gallery', 42]) assert.equal(activeHubTab(bad, tabs), 'home', String(bad));
  assert.equal(activeHubTab('home', ['live', 'home']), 'home');
  assert.equal(activeHubTab(null, ['live', 'home']), 'live', 'the day opens on Live');
  assert.equal(hubTabHref('story'), '?tab=story');
  assert.equal(hubTabOfHref('?tab=story'), 'story');
  assert.equal(isHubTabHref('#site-story'), false);
  assert.equal(hubTabOfHref('/papic/guest'), null);
});

/* ══ 3 · NOTHING IS STRANDED ═════════════════════════════════════════════════ */

test('3 · content asking for a tab the reader has not got lands on the nearest tab above it', () => {
  // A stranger has no Me: their Me marker goes to the last tab above it.
  assert.equal(hubTabFor('me', ['home', 'details', 'story']), 'story');
  // A guest on the day has no Details: the love story (below Details) goes to Welcome.
  assert.equal(hubTabFor('story', ['live', 'home', 'gallery', 'me']), 'home');
  // No Gallery on the day (nothing public): their own photos stay on their Welcome.
  assert.equal(hubTabFor('gallery', ['live', 'home', 'me']), 'home');
  // Before the day there is no Live: what Live would hold opens the page.
  assert.equal(hubTabFor('live', ['home', 'details', 'story', 'me']), 'home');
  // A tab they do have is theirs.
  assert.equal(hubTabFor('details', ['home', 'details', 'story', 'me']), 'details');
  // Every answer is a tab the bar HAS.
  for (const want of HUB_TAB_ORDER)
    for (const inPage of [['home', 'details', 'story', 'me'], ['live', 'home', 'gallery', 'me'], ['home', 'details', 'story'], ['live']])
      assert.ok(inPage.includes(hubTabFor(want, inPage)), `${want} → stranded off ${inPage.join('·')}`);
});

test('3 · the whole order a part falls through: the prototype’s page · the tab it asked for · the nearest above · the first', () => {
  const pages = (stage: 'rsvp' | 'event') => makerStagesPages(stage).map((p) => p.key);
  assert.deepEqual([...HUB_TAB_ORDER], ['live', 'home', 'details', 'story', 'gallery', 'me']);
  // The prototype's page, when this reader's bar has it — the Countdown is Welcome's, their table is Me's.
  assert.equal(readerPageOf('rsvp', 'w:countdown', 'details', ['home', 'details', 'story', 'me'], pages('rsvp')), 'home');
  assert.equal(readerPageOf('event', 'f:find_your_seat', 'home', ['live', 'home', 'gallery', 'me'], pages('event')), 'me');
  // No such tab on this bar: the tab the part asked for before the ruling (a reader without a key has no Me).
  assert.equal(readerPageOf('event', 'f:find_your_seat', 'home', ['live', 'home'], pages('event')), 'home');
  // That one missing too: the nearest tab above it…
  assert.equal(readerPageOf('event', 'f:find_your_seat', 'home', ['live'], pages('event')), 'live');
  assert.equal(readerPageOf('rsvp', 'w:our_love_story', 'story', ['home', 'details', 'me'], pages('rsvp')), 'details');
  // …and with nothing above it, the first tab.
  assert.equal(readerPageOf('event', 'w:schedule', 'live', ['home', 'me'], pages('event')), 'home');
  // Every answer is a tab the bar HAS — for every part the prototype names, every ask, every bar.
  for (const stage of ['rsvp', 'event'] as const)
    for (const key of ['f:hero', 'w:countdown', 'w:special_message', 'f:look', 'f:gifts', 'f:find_your_seat', 'w:venue_map', 'w:dress_code', 'f:entourage', 'w:what_to_bring', 'w:schedule', 'w:our_love_story', 'f:photos_of_you', 'f:pass', 'w:faq'])
      for (const want of HUB_TAB_ORDER)
        for (const inPage of [['home', 'details', 'story', 'me'], ['live', 'home', 'gallery', 'me'], ['home', 'details', 'story'], ['home'], ['live'], ['live', 'me']])
          assert.ok(inPage.includes(readerPageOf(stage, key, want, inPage, pages(stage))), `${stage}: ${key} (asked ${want}) → stranded off ${inPage.join('·')}`);
});

/* ══ 4 · THE DAY'S WELCOME AND LIVE ══════════════════════════════════════════ */

const DAY = {
  bodyNormal: true,
  identified: true,
  dressCodeOn: true,
  remindersOn: true,
  reminders: 'Arrive by 2:30.',
  giftHref: '/ana/pabuya',
  maker: false,
};

test('4 · the day’s Welcome: their look, the reminders, E-Gifts — nothing empty, never the canvas', () => {
  assert.deepEqual(welcomePartsOnTheDay(DAY), ['look', 'reminders', 'gifts']);
  assert.deepEqual(welcomePartsOnTheDay({ ...DAY, identified: false }), ['reminders', 'gifts'], 'a stranger has no role to dress for');
  assert.deepEqual(welcomePartsOnTheDay({ ...DAY, reminders: '  ', giftHref: null }), ['look']);
  assert.deepEqual(welcomePartsOnTheDay({ ...DAY, dressCodeOn: false, remindersOn: false }), ['gifts'], 'what the couple switched off stays off');
  assert.deepEqual(welcomePartsOnTheDay({ ...DAY, maker: true }), []);
  assert.deepEqual(welcomePartsOnTheDay({ ...DAY, bodyNormal: false }), []);
  // One gift door per page: the foot strip stands down on the day too.
  assert.equal(welcomeCarriesGifts({ stage: 'event', bodyNormal: true, giftHref: '/ana/pabuya', maker: false }), true);
  /* 🪑 The table is the page's own seat block. It was filed on Welcome until 2026-10-08, when the owner ruled the
     guest's pages follow the Maker's filing (DECISION_LOG "EIGHT OWNER ANSWERS" answer 5: *"yes"*; prototype: The
     Day › Me · seats). It is Me's now — drawn INSIDE Me, before the ticket — and on Welcome only for a reader whose
     bar has no Me. One block, two slots, never both. */
  const BODY = stripComments(read('_components', 'site-body.tsx'));
  const guest = BODY.slice(BODY.indexOf('const guestTree'));
  assert.equal(guest.split('<YourSeatBlock').length - 1, 1, 'the seat block is written once');
  assert.match(guest, /const seatTab = readerAt\('f:find_your_seat', 'home'\);\s*const seatOnMe = tabs\.on && seatTab === 'me';/);
  assert.match(guest, /\{seatOnMe \? null : group\(seatTab, seatBlock, \{ chapters: true, className: 'space-y-12' \}\)\}/, 'off Me, the seat block stands where it asked — Welcome');
  const me = guest.slice(guest.indexOf("group('me', ("));
  assert.match(me, /const tableOnMe = seatOnMe && seatBlock !== null;/);
  assert.match(me, /\{tableOnMe \? seatBlock : null\}\s*\{mine\}/, 'on Me the table stands before the ticket');
  const day = makerStagesPages('event').map((p) => p.key);
  assert.equal(readerPageOf('event', 'f:find_your_seat', 'home', ['live', 'home', 'gallery', 'me'], day), 'me', 'the day’s seat is Me’s');
  assert.equal(readerPageOf('event', 'f:find_your_seat', 'home', ['live', 'home'], day), 'home', 'a reader with no Me keeps it on Welcome');
});

test('4 · the day’s Live leads with Directions until the programme begins — on the venue’s clock', () => {
  const start = '2026-12-12T14:00:00+00:00'; // the couple's 2 PM, parked in UTC (lib/schedule.ts)
  assert.equal(directionsLead({ firstStartAt: start, venueNowMs: Date.parse('2026-12-12T13:59:00Z') }), true);
  assert.equal(directionsLead({ firstStartAt: start, venueNowMs: Date.parse('2026-12-12T14:00:00Z') }), false);
  assert.equal(directionsLead({ firstStartAt: null, venueNowMs: 0 }), true, 'no programme → nothing to wait for');
  const BODY = stripComments(read('_components', 'site-body.tsx'));
  assert.match(BODY, /directionsLead\(\{ firstStartAt: scheduleBlocks\[0\]\?\.start_at \?\? null, venueNowMs: venueNowMs\(eventTzForDay\) \}\)/, 'Directions compare against the venue clock');
  // 🗺 …to ONE place — where things are happening now (owner 2026-10-01, `lib/day-venue-now.ts`).
  assert.match(BODY, /directionsOnTop \? group\('live', <DayDirections venues=\{dayVenues\} \/>/);
});

/* ══ 5 · ONE SHELL · ONE BAR · ONE STATE ═════════════════════════════════════ */

test('5 · tabs are the Invitation’s and The Day’s, only where a bar is drawn, never the Maker’s canvas', () => {
  assert.deepEqual([...TABBED_STAGES].sort(), ['event', 'rsvp']);
  const on = { bodyNormal: true, barDrawn: true, makerCanvas: false };
  assert.equal(hubTabsOn({ ...on, stage: 'rsvp' }), true);
  assert.equal(hubTabsOn({ ...on, stage: 'event' }), true);
  assert.equal(hubTabsOn({ ...on, stage: 'save_the_date' }), false);
  assert.equal(hubTabsOn({ ...on, stage: 'editorial' }), false);
  assert.equal(hubTabsOn({ ...on, stage: 'rsvp', makerCanvas: true }), false, 'the canvas lists every scene it draws');
  /* 🧭 The one canvas exception (owner 2026-10-07 "yes pages"): the Stages canvas is tabbed like the guest's page. */
  assert.equal(hubTabsOn({ ...on, stage: 'rsvp', makerCanvas: true, stagesCanvas: true }), true, 'the Stages canvas is the guest’s tabbed page');
  assert.equal(hubTabsOn({ ...on, stage: 'save_the_date', makerCanvas: true, stagesCanvas: true }), false, 'Save the Date stays one page');
  assert.equal(hubTabsOn({ ...on, stage: 'rsvp', barDrawn: false }), false, 'no bar, no way to another tab');
});

test('5 · a tabbed stage always has the ordinary body (page.tsx relies on it for the Me tab)', () => {
  for (const stage of TABBED_STAGES)
    for (const identity of ['guest', 'anonymous'] as const)
      for (const stdFilm of [true, false]) {
        const plan = resolveSiteBodyPlan({
          identity, phasesEnabled: true, lifecyclePhase: stage, stdFilm, isSample: false,
          hasHeroMedia: false, hasBgMusic: false, liveMediaPublic: false, widgets: [],
        });
        assert.equal(plan.body, 'normal', `${stage}/${identity}: a tabbed stage drew another body`);
      }
});

test('5 · ONE shell: hub-shell.tsx carries both frames over one address; nothing else pushes a tab', () => {
  const SHELL = stripComments(read('_components', 'hub', 'hub-shell.tsx'));
  assert.equal(SHELL.match(/export function HubShell\(/g)?.length, 1);
  assert.match(SHELL, /props\.frame === 'page' \? <HubPageFrame \{\.\.\.props\} \/> : <HubStageFrame \{\.\.\.props\} \/>/);
  assert.equal(SHELL.match(/useTabAddress\(/g)?.length, 3, 'the one mechanism, used by both frames');
  assert.match(SHELL, /activeHubTab\(params\?\.get\(HUB_TAB_PARAM\) \?\? null, keys\)/, 'the tab IS the address');
  // No second shell: nobody else in the guest tree writes a tab into the
  // address (a sheet or an overlay that only moves the #hash is not a tab).
  const writers: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name) && !name.endsWith('.test.ts')) {
        const src = readFileSync(p, 'utf8');
        if (/searchParams\.set\((?:HUB_TAB_PARAM|'tab')/.test(src)) writers.push(p.slice(SLUG.length + 1));
      }
    }
  };
  walk(SLUG);
  assert.deepEqual(writers, ['_components/hub/hub-shell.tsx'], `a second tab mechanism: ${writers.join(', ')}`);
});

test('5 · ONE bar: the page’s own SiteMenuBar, marking the tab from the same address', () => {
  const BAR = stripComments(read('_components', 'site-menu-bar.tsx'));
  assert.match(BAR, /activeHubTab\(params\?\.get\(HUB_TAB_PARAM\) \?\? null, tabKeys\)/);
  assert.match(BAR, /aria-current=\{slot\.key === activeKey \? 'page' : undefined\}/);
  const BODY = stripComments(read('_components', 'site-body.tsx'));
  // Both trees: the bar and the shell read ONE value, and the shell rides with the bar.
  for (const v of ['anonBar', 'guestBar']) {
    assert.match(BODY, new RegExp(`<SiteMenuBar\\s+slots=\\{${v}\\}`));
    assert.match(BODY, new RegExp(`\\{menuOn && showGuestBars && tabs\\.on \\? <HubShell frame="page" slots=\\{${v}\\} /> : null\\}`));
  }
  assert.equal(BODY.match(/tabbed: tabsOn,/g)?.length, 2, 'both bars are told the page is tabs');
  assert.equal(BODY.match(/pageTabs = tabs;/g)?.length, 2, 'both trees hand their tabs to the blocks outside them');
});

test('5 · every tab group is marked, hidden off its tab, and names a tab from the order', () => {
  const BODY = stripComments(read('_components', 'site-body.tsx'));
  assert.match(BODY, /hidden=\{tab !== active \? true : undefined\}/);
  const wants = [...BODY.matchAll(/\bgroup\(\s*('([a-z]+)'|leadTab|scenesTab|pageStage === 'event' \? 'live' : 'details')/g)].map((m) => m[2] ?? m[1] ?? '');
  assert.ok(wants.length >= 20, `precondition: the groups were found (${wants.length})`);
  for (const w of wants) if (/^[a-z]+$/.test(w)) assert.ok((HUB_TAB_ORDER as readonly string[]).includes(w), `a group asks for "${w}", which is no tab`);
  // The Me tab: on a tabbed page the page body draws the guest's Me, and the
  // corner bar draws none — one `#site-me`, decided by one predicate.
  const PAGE = stripComments(read('page.tsx'));
  assert.match(PAGE, /meSection=\{\s*guestPageTabbed \?/);
  assert.match(PAGE, /meInPage=\{guestPageTabbed\}/);
  assert.match(PAGE, /meSlot=\{guestPageTabbed \? null : meSlot\}/);
  assert.match(PAGE, /hubTabsOn\(\{\s*stage: pageStageFor\(\{ phasesEnabled, lifecyclePhase, dayOfPhase \}\),/);
});

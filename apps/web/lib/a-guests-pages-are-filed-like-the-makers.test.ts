/**
 * 📱 A GUEST'S PAGES ARE FILED LIKE THE MAKER'S — ONE FILING FOR BOTH.
 *
 * Owner, 2026-10-08 (DECISION_LOG "EIGHT OWNER ANSWERS", answer 5). Asked: *"the Maker now files parts by the
 * prototype (for example Countdown on Welcome), while guests' phones still use the old filing (Countdown on
 * Details). Should the guest page change to match?"* — *"yes"*. Still holding: 2026-09-30 *"each menu gets their own
 * full page scroll"* and 2026-10-07 *"yes pages"*.
 *
 * This changes LIVE guest pages, so every rule is executed on the REAL functions — the bar resolver
 * (`resolveSiteNav`), the filing (`readerPageOf` · `ownPageOf` · `fileScenes` · `makerStagesPageOf`), the Welcome's
 * own rules (`welcomeParts` · `welcomePartsOnTheDay`) — over a roster of readers and events, with the page's own
 * filing calls read off `site-body.tsx` so the roster cannot drift from the page:
 *
 *   1 · ONE FILING — a part the prototype names is on the prototype's page for a guest whenever their bar has
 *       that tab, which is exactly the page the Maker's canvas files it on.
 *   2 · THE FALLBACK, STATED — prototype's page · the tab the part asked for before · the nearest tab above that in
 *       `HUB_TAB_ORDER` (live · home · details · story · gallery · me) · the bar's first tab. Never stranded.
 *   3 · THE ROSTER — signed out · a guest who has not replied · said yes · declined · a supplier · the couple, on
 *       the Invitation and on The Day, over a full event and a lean one: every section drawn before is drawn
 *       after, on one tab that reader's bar HAS; a section moves ONLY to its prototype page or because a tab of
 *       the bar came or went; nobody gains a section.
 *   4 · THE BAR STAYS HONEST — a tab is drawn only when something asks for it.
 *   5 · THE PAGE IS THE ROSTER — every `group(…)` in both trees is one of the roster's filings.
 *   6 · THE MAKER'S CANVAS IS UNTOUCHED — the Stages arms read what they read before.
 *
 * `FILING_TABLE=1 tsx --test lib/a-guests-pages-are-filed-like-the-makers.test.ts` prints the before → after table.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { HUB_TAB_ORDER, hubTabFor, inPageTabs } from '../app/[slug]/_lib/hub-tabs';
import { navPhaseFor, resolveSiteNav, type NavViewer } from '../app/[slug]/_lib/site-nav';
import { STAGE_BAR } from '../app/[slug]/_lib/stage-bar';
import { welcomeParts, welcomePartsOnTheDay, type WelcomePart } from './invitation-welcome';
import { MAKER_STAGE_PAGES } from './maker-parts';
import { makerPartCanvasOn } from './maker-part-groups';
import {
  WELCOME_PART_CANVAS,
  fileScenes,
  makerStagesPageOf,
  makerStagesPages,
  ownPageOf,
  prototypePageOf,
  readerPageOf,
} from './maker-stage-filing';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const BODY = stripComments(readFileSync(join(WEB, 'app/[slug]/_components/site-body.tsx'), 'utf8'));
const ANON = BODY.slice(BODY.indexOf('const anonymousTree'), BODY.indexOf('const guestTree'));
const GUEST = BODY.slice(BODY.indexOf('const guestTree'), BODY.indexOf("identity.kind === 'anonymous' ? anonymousTree(identity)"));

type Stage = 'rsvp' | 'event';
const STAGES: readonly Stage[] = ['rsvp', 'event'];
const makerPagesOf = (stage: Stage, hasStory = true) => makerStagesPages(stage, hasStory).map((p) => p.key);

/**
 * THE PROTOTYPE'S PAGE FOR EACH CANVAS KEY — copied by hand from the approved prototype's `TABS`
 * (`maker_two_dropdowns_owner_wireframe_2026-10-06_fable.html`, line ~1226) and the named additions
 * (`the-stage-pages-are-the-prototypes.test.ts`), NOT read through the functions under test.
 */
const PROTOTYPE: Readonly<Record<Stage, Readonly<Record<string, string>>>> = {
  rsvp: {
    'f:hero': 'home',
    'w:countdown': 'home',
    'f:greeting': 'home',
    'w:special_message': 'home',
    'f:gifts': 'home',
    'f:details': 'details',
    'w:schedule': 'details',
    'w:venue_map': 'details',
    'w:dress_code': 'details',
    'f:entourage': 'details',
    'w:what_to_bring': 'details',
    'w:our_love_story': 'story',
    'f:look': 'me',
    'f:find_your_seat': 'me',
    'f:pass': 'me',
  },
  event: {
    'f:spotlight': 'live',
    'f:announcements': 'live',
    'f:live_hub': 'live',
    'f:hero': 'live',
    'w:schedule': 'live',
    'w:venue_map': 'home',
    'w:dress_code': 'home',
    'f:entourage': 'home',
    'w:what_to_bring': 'home',
    'w:our_photos': 'gallery',
    'f:photos_of_you': 'gallery',
    'f:find_your_seat': 'me',
    'f:pass': 'me',
  },
};

/* ══ 1 · ONE FILING ══════════════════════════════════════════════════════════ */

test('1 · the hand-copied prototype map IS what the one filing reads — every named key, both stages', () => {
  for (const stage of STAGES) {
    const pages = makerPagesOf(stage);
    const named = new Set<string>();
    for (const page of pages)
      for (const part of MAKER_STAGE_PAGES[stage][page] ?? []) {
        const canvas = makerPartCanvasOn(stage, part);
        if (canvas) named.add(canvas);
      }
    named.add('f:pass');
    assert.deepEqual([...named].sort(), Object.keys(PROTOTYPE[stage]).sort(), `${stage}: the test's copy of the prototype names other keys than the parts map`);
    for (const [key, page] of Object.entries(PROTOTYPE[stage])) {
      assert.equal(prototypePageOf(stage, key, pages), page, `${stage}: ${key}`);
      assert.equal(makerStagesPageOf(stage, key, pages), page, `${stage}: the Maker's canvas files ${key} elsewhere`);
    }
  }
});

test('1 · a guest whose bar has the tab meets every named part on the page the Maker files it on', () => {
  for (const stage of STAGES) {
    const pages = makerPagesOf(stage);
    /* The fullest bar a guest can hold on this stage — the tabs that are pages of this one (the Camera leaves). */
    const full = pages.filter((p) => p !== 'camera');
    for (const key of Object.keys(PROTOTYPE[stage])) {
      const maker = makerStagesPageOf(stage, key, pages);
      for (const want of HUB_TAB_ORDER) {
        assert.equal(readerPageOf(stage, key, want, full, pages), maker, `${stage}: ${key} is on ${maker} for the couple and elsewhere for a guest (asked ${want})`);
      }
    }
  }
  // The owner's own example, and the measured table, by name.
  const inv = ['home', 'details', 'story', 'me'];
  const day = ['live', 'home', 'gallery', 'me'];
  assert.equal(readerPageOf('rsvp', 'w:countdown', 'details', inv, makerPagesOf('rsvp')), 'home', 'Countdown is on Welcome');
  assert.equal(readerPageOf('rsvp', 'w:special_message', 'details', inv, makerPagesOf('rsvp')), 'home', 'the Message is on Welcome');
  assert.equal(readerPageOf('rsvp', 'f:look', 'home', inv, makerPagesOf('rsvp')), 'me', 'the guest’s look is on Me');
  assert.equal(readerPageOf('event', 'f:find_your_seat', 'home', day, makerPagesOf('event')), 'me', 'the day’s seat is on Me');
  for (const k of ['w:venue_map', 'w:dress_code', 'f:entourage']) {
    assert.equal(readerPageOf('event', k, 'live', day, makerPagesOf('event')), 'home', `the day’s ${k} is on Welcome`);
  }
});

/* ══ 2 · THE FALLBACK, STATED ════════════════════════════════════════════════ */

test('2 · the order a part falls through: prototype’s page · the tab it asked for · the nearest tab above · the first', () => {
  assert.deepEqual([...HUB_TAB_ORDER], ['live', 'home', 'details', 'story', 'gallery', 'me'], 'the order the fallback walks');
  const inv = makerPagesOf('rsvp');
  const day = makerPagesOf('event');
  // 1 — the prototype's page, when this reader's bar has it (whatever the page asked for).
  assert.equal(readerPageOf('rsvp', 'f:look', 'home', ['home', 'details', 'story', 'me'], inv), 'me');
  // 2 — no such tab on this bar (a reader without a key has no Me): the tab it asked for before the ruling.
  assert.equal(readerPageOf('rsvp', 'f:look', 'home', ['home', 'details', 'story'], inv), 'home', 'the look stays on Welcome — never the nearest tab to Me');
  assert.equal(readerPageOf('event', 'f:find_your_seat', 'home', ['live', 'home'], day), 'home', 'a supplier’s seat finder stays on Welcome');
  // 3 — that tab is not on the bar either: the nearest tab ABOVE it in the order.
  assert.equal(readerPageOf('rsvp', 'w:our_love_story', 'story', ['home', 'details', 'me'], inv), 'details', 'no Our Love Story tab: Details');
  assert.equal(readerPageOf('rsvp', 'w:schedule', 'details', ['home', 'me'], inv), 'home', 'no Details tab: Welcome');
  assert.equal(readerPageOf('event', 'f:find_your_seat', 'home', ['live'], day), 'live', 'no Welcome and no Me: Live');
  assert.equal(readerPageOf('event', 'f:photos_of_you', 'gallery', ['live', 'home', 'me'], day), 'home', 'no Gallery: Welcome');
  // 4 — nothing above it: the bar's first tab.
  assert.equal(readerPageOf('event', 'w:schedule', 'live', ['home', 'details', 'me'], day), 'home', 'the day’s programme on a bar with no Live');
  // A key no part names has no step 1: it is not moved at all.
  for (const key of ['f:rsvp', 'x:checklist', 'w:faq', 'w:custom_section', 'f:live_hub']) {
    for (const want of HUB_TAB_ORDER) {
      const tabs = ['home', 'details', 'story', 'me'];
      assert.equal(readerPageOf('rsvp', key, want, tabs, inv), hubTabFor(want, tabs), `rsvp: ${key} (unnamed) was moved off ${want}`);
    }
  }
  // NEVER STRANDED: every answer is a tab the bar has — every key, every ask, every bar.
  const bars = [['home'], ['home', 'me'], ['home', 'details', 'story'], ['home', 'details', 'story', 'me'], ['live'], ['live', 'home'], ['live', 'me'], ['live', 'home', 'gallery', 'me'], ['me']];
  for (const stage of STAGES)
    for (const tabs of bars)
      for (const key of [...Object.keys(PROTOTYPE.rsvp), ...Object.keys(PROTOTYPE.event), 'f:rsvp', 'w:faq'])
        for (const want of HUB_TAB_ORDER) {
          const got = readerPageOf(stage, key, want, tabs, makerPagesOf(stage));
          assert.ok(tabs.includes(got), `${stage}: ${key} (asked ${want}) → "${got}", no tab of ${tabs.join('·')}`);
        }
  // A type with no two people: no Our Love Story page in the Maker either — the scene is Details', for both.
  assert.equal(readerPageOf('rsvp', 'w:our_love_story', 'story', ['home', 'details', 'me'], makerPagesOf('rsvp', false)), 'details');
  assert.equal(makerStagesPageOf('rsvp', 'w:our_love_story', makerPagesOf('rsvp', false)), 'details');
});

/* ══ 3 · THE ROSTER ══════════════════════════════════════════════════════════ */

type Reply = 'pending' | 'attending' | 'declined';
type Reader = {
  id: string;
  label: string;
  tree: 'guest' | 'anon';
  viewer: NavViewer;
  /** Their reply, when they are a guest. */
  reply: Reply | null;
  /** The couple, or a booked supplier — the inside of the event is theirs to see (`insideAllowed`). */
  inside: boolean;
  supplier: boolean;
};

const READERS: readonly Reader[] = [
  { id: 'signed-out', label: 'signed out', tree: 'anon', viewer: { kind: 'public' }, reply: null, inside: false, supplier: false },
  { id: 'guest-pending', label: 'a guest who has not replied', tree: 'guest', viewer: { kind: 'guest' }, reply: 'pending', inside: true, supplier: false },
  { id: 'guest-yes', label: 'a guest who said yes', tree: 'guest', viewer: { kind: 'guest' }, reply: 'attending', inside: true, supplier: false },
  { id: 'guest-no', label: 'a declined guest', tree: 'guest', viewer: { kind: 'guest' }, reply: 'declined', inside: true, supplier: false },
  /* A booked supplier reads the stranger's tree on the public bar (`site-body.tsx`: the vendor arm of the bar is not reached). */
  { id: 'supplier', label: 'a supplier', tree: 'anon', viewer: { kind: 'public' }, reply: null, inside: true, supplier: true },
  { id: 'couple', label: 'the couple', tree: 'anon', viewer: { kind: 'couple' }, reply: null, inside: true, supplier: false },
];

type EventFacts = {
  id: string;
  /** The couple's visible scenes on each stage, in their order (the love story is its own tab's). */
  scenes: Record<Stage, readonly string[]>;
  /** A love story with a chapter to land on. */
  story: boolean;
  entourage: boolean;
  /** A gift method is on (`doorways.pabuya`). */
  gifts: boolean;
  /** Reminders written, and the dress code switched on (the day's Welcome reads both). */
  reminders: boolean;
  dressCode: boolean;
  /** Seats are published (the day), and this guest has a table drawn on the plan. */
  seats: boolean;
  /** A venue to point at, a stream, a wall, and somebody's photos shared. */
  venue: boolean;
  broadcast: boolean;
  wall: boolean;
  /** Event Hub open browse — draws "THE DETAILS" and the spotlight card. */
  openBrowse: boolean;
  /** The new Maker's guest side is on (Me's four for-each-guest parts stand in for the Welcome's look). */
  guestStages: boolean;
};

const FULL: EventFacts = {
  id: 'full',
  scenes: {
    rsvp: ['countdown', 'special_message', 'schedule', 'venue_map', 'dress_code', 'faq', 'what_to_bring'],
    event: ['schedule', 'venue_map', 'dress_code', 'photo_moments', 'your_photos', 'our_photos'],
  },
  story: true,
  entourage: true,
  gifts: true,
  reminders: true,
  dressCode: true,
  seats: true,
  venue: true,
  broadcast: true,
  wall: true,
  openBrowse: true,
  guestStages: false,
};
/** A couple who has only begun: a countdown and a message, nothing else — the event that loses its Details tab. */
const LEAN: EventFacts = {
  id: 'lean',
  scenes: { rsvp: ['countdown', 'special_message'], event: ['schedule'] },
  story: false,
  entourage: false,
  gifts: false,
  reminders: false,
  dressCode: false,
  seats: true,
  venue: false,
  broadcast: false,
  wall: false,
  openBrowse: false,
  guestStages: false,
};
/** The full event with the new Maker's guest side on: Me's own parts say the look, so the Welcome's stands down. */
const STAGED: EventFacts = { ...FULL, id: 'staged', guestStages: true };
const EVENTS: readonly EventFacts[] = [FULL, LEAN, STAGED];

/** The scene types a reader without a key may be shown (`PUBLIC_WIDGET_ALLOWLIST` — the personal ones are a guest's). */
const NOT_PUBLIC = new Set(['your_photos']);

type Section = {
  id: string;
  /** The canvas key the page files it by — null: a section no part names (never moved). */
  key: string | null;
  /** The tab it asked for before the ruling. */
  want: string;
};

/** What a reader on a stage of an event is drawn — the page's own conditions, as facts. */
function sectionsFor(reader: Reader, stage: Stage, ev: EventFacts): Section[] {
  const day = stage === 'event';
  const lead = day ? 'live' : 'home';
  const guest = reader.tree === 'guest';
  const scenesTab = guest ? (day ? 'live' : 'details') : day && !reader.supplier ? 'live' : 'details';
  const scenes = ev.scenes[stage].filter((t) => guest || !NOT_PUBLIC.has(t));
  const out: Section[] = [];
  const add = (id: string, key: string | null, want: string) => out.push({ id, key, want });

  add('cover', 'f:hero', lead);
  if (guest) {
    if (!day) add('checklist', null, 'home');
    if (ev.openBrowse) add('spotlight', 'f:spotlight', 'home');
    if (day && ev.seats) add('seat-block', 'f:find_your_seat', 'home');
    if (day && ev.venue) add('directions-lead', null, 'live');
    if (!day) add('greeting', 'f:greeting', lead);
    if (ev.broadcast) add('watch-live', null, 'live');
    if (day) add('day-programme', null, 'live');
    if (day && ev.wall) add('live-wall', null, 'live');
    if (day) add('camera-card', null, 'live');
    if (day) add('photos-of-you', 'f:photos_of_you', 'gallery');
    if (!day) add('reply-lines', null, 'home');
    const welcome = welcomeParts({
      stage,
      bodyNormal: true,
      scenes: ev.scenes[stage],
      identified: true,
      reminders: ev.reminders ? 'Arrive by 2:30.' : null,
      giftHref: ev.gifts ? '/ana/pabuya' : null,
      maker: false,
    });
    /* Me's four parts say the look where the new Maker's guest side is on (`meParts`): the Welcome's stands down. */
    if (welcome.includes('look') && !ev.guestStages) add('look', WELCOME_PART_CANVAS.look, 'home');
    if (welcome.includes('gifts')) add('e-gifts', WELCOME_PART_CANVAS.gifts, 'home');
    const dayWelcome = dayWelcomeOf(reader, stage, ev);
    if (dayWelcome.length > 0) add('day-welcome', null, 'home');
    if (day) add('scan-trail', null, 'home');
    if (!day && ev.seats && reader.reply === 'attending') add('seat-line', 'f:find_your_seat', 'home');
    for (const t of scenes) add(`scene:${t}`, `w:${t}`, scenesTab);
    if (!day && ev.entourage) add('walking-order', 'f:entourage', scenesTab);
    if (ev.story && !day) add('love-story', 'w:our_love_story', 'story');
    add('me', null, 'me');
  } else {
    if (reader.inside && day && ev.seats) add('seat-finder', 'f:find_your_seat', 'home');
    if (ev.broadcast) add('watch-live', null, 'live');
    if (reader.inside && day && ev.wall) add('live-wall', null, 'gallery');
    if (!day && ev.gifts) add('e-gifts', WELCOME_PART_CANVAS.gifts, 'home');
    if (dayWelcomeOf(reader, stage, ev).length > 0) add('day-welcome', null, 'home');
    if (ev.openBrowse) add('the-details', 'f:details', scenesTab);
    for (const t of scenes) add(`scene:${t}`, `w:${t}`, scenesTab);
    if (ev.entourage) add('walking-order', 'f:entourage', scenesTab);
    if (ev.story && !day) add('love-story', 'w:our_love_story', 'story');
    add('me', null, 'me');
  }
  /* Outside both trees: the doorway strip and the stories of this day are the Welcome's (`pageTabs.attrs('home')`). */
  if (ev.gifts || ev.seats) add('doorway-strip', null, 'home');
  return out;
}

/** The day's Welcome parts for this reader (`welcomePartsOnTheDay`, as each tree calls it). */
function dayWelcomeOf(reader: Reader, stage: Stage, ev: EventFacts): WelcomePart[] {
  const guest = reader.tree === 'guest';
  return welcomePartsOnTheDay({
    bodyNormal: stage === 'event',
    identified: guest,
    dressCodeOn: ev.dressCode,
    remindersOn: ev.reminders,
    reminders: ev.reminders ? 'Arrive by 2:30.' : null,
    giftHref: ev.gifts ? '/ana/pabuya' : null,
    maker: false,
    ...(guest ? { march: stage === 'event' && ev.entourage, venue: stage === 'event' && ev.venue } : {}),
  });
}

type Rule = 'before' | 'after';

/** The reader's bar — the REAL resolver, fed what the page feeds it, by the rule before the ruling or after it. */
function barOf(reader: Reader, stage: Stage, ev: EventFacts, rule: Rule): string[] {
  const day = stage === 'event';
  const guest = reader.tree === 'guest';
  const pages = makerPagesOf(stage, true);
  const scenesTab = guest ? (day ? 'live' : 'details') : day && !reader.supplier ? 'live' : 'details';
  const scenes = ev.scenes[stage].filter((t) => guest || !NOT_PUBLIC.has(t));
  const own = (key: string, want: string) => ownPageOf(stage, key, want, pages);
  const sceneOwn = (t: string) => own(`w:${t}`, scenesTab);
  const dayWelcome = dayWelcomeOf(reader, stage, ev);
  const seat = day && ev.seats && (guest || reader.inside);
  const hasDetails =
    rule === 'before'
      ? (!guest && ev.openBrowse) || scenes.length > 0
      : (!guest && ev.openBrowse) || scenes.some((t) => sceneOwn(t) === 'details');
  const hasWelcome =
    rule === 'before'
      ? dayWelcome.length > 0 || seat
      : guest
        ? dayWelcome.length > 0 || (seat && own('f:find_your_seat', 'home') === 'home') || scenes.some((t) => sceneOwn(t) === 'home')
        : dayWelcome.length > 0 ||
          scenes.some((t) => sceneOwn(t) === 'home') ||
          (ev.entourage && own('f:entourage', scenesTab) === 'home') ||
          (seat && (own('f:find_your_seat', 'home') === 'home' || reader.viewer.kind === 'public'));
  const bar = resolveSiteNav({
    viewer: reader.viewer,
    phase: navPhaseFor({ dayOfPhase: day ? 'live' : 'inactive', isRecapBody: false }),
    hostAllowsCamera: true,
    anyChapterPublic: day && ev.wall,
    hasStory: ev.story,
    hasDetails,
    hasSchedule: scenes.includes('schedule'),
    hasWelcome,
    liveBroadcast: ev.broadcast,
    destinations: { camera: '/papic/guest?from=ana', watch: '/ana/hub', join: '/ana/invite' },
    stageSlots: STAGE_BAR[stage].slots,
    tabbed: true,
  });
  return inPageTabs(bar);
}

type Row = { id: string; key: string | null; before: string; after: string };

/** Every section of one reader's page, with its tab before the ruling and after it. */
function pageOf(reader: Reader, stage: Stage, ev: EventFacts): { tabsBefore: string[]; tabsAfter: string[]; rows: Row[] } {
  const pages = makerPagesOf(stage, true);
  const tabsBefore = barOf(reader, stage, ev, 'before');
  const tabsAfter = barOf(reader, stage, ev, 'after');
  const sections = sectionsFor(reader, stage, ev);
  const rows = sections.map((s) => ({
    id: s.id,
    key: s.key,
    before: hubTabFor(s.want, tabsBefore),
    after: s.key ? readerPageOf(stage, s.key, s.want, tabsAfter, pages) : hubTabFor(s.want, tabsAfter),
  }));
  return { tabsBefore, tabsAfter, rows };
}

const everyPage = () =>
  EVENTS.flatMap((ev) => STAGES.flatMap((stage) => READERS.map((reader) => ({ ev, stage, reader, ...pageOf(reader, stage, ev) }))));

test('3 · every section drawn before is drawn after, on ONE tab the reader’s bar has — nobody gains or loses one', () => {
  let seen = 0;
  for (const { ev, stage, reader, tabsAfter, tabsBefore, rows } of everyPage()) {
    const who = `${ev.id} · ${stage} · ${reader.label}`;
    assert.ok(tabsAfter.length > 0 && tabsBefore.length > 0, `${who}: a page with no tab`);
    /* What a reader is drawn does not ask the filing anything: the same list, before and after. */
    const ids = rows.map((r) => r.id);
    assert.equal(new Set(ids).size, ids.length, `${who}: a section is listed twice`);
    for (const r of rows) {
      assert.ok(tabsBefore.includes(r.before), `${who}: ${r.id} was on "${r.before}" — the model of BEFORE is wrong`);
      assert.ok(tabsAfter.includes(r.after), `${who}: ${r.id} is stranded on "${r.after}" (bar: ${tabsAfter.join('·')})`);
      seen += 1;
    }
  }
  assert.ok(seen > 300, `precondition: the roster walked the pages (${seen} sections)`);
  /* The before → after table, on request (the report's own table is this one). */
  if (process.env.FILING_TABLE === '1') {
    const lines: string[] = ['event | stage | reader | bar before | bar after | part | tab before | tab after'];
    for (const { ev, stage, reader, tabsBefore, tabsAfter, rows } of everyPage()) {
      for (const r of rows) {
        lines.push([ev.id, stage, reader.label, tabsBefore.join('·'), tabsAfter.join('·'), r.id, r.before, r.after + (r.before === r.after ? '' : '  ◀ moved')].join(' | '));
      }
    }
    console.log(lines.join('\n'));
  }
});

test('3 · the tab is the prototype’s page when the reader’s bar has it — else the stated fallback', () => {
  for (const { ev, stage, reader, tabsAfter, rows } of everyPage()) {
    const who = `${ev.id} · ${stage} · ${reader.label}`;
    const sections = sectionsFor(reader, stage, ev);
    for (const r of rows) {
      const want = sections.find((s) => s.id === r.id)!.want;
      const proto = r.key ? PROTOTYPE[stage][r.key] : undefined;
      const expected = proto && tabsAfter.includes(proto) ? proto : hubTabFor(want, tabsAfter);
      assert.equal(r.after, expected, `${who}: ${r.id}`);
    }
  }
});

test('3 · a section moves ONLY to its prototype page, or because a tab of the bar came or went', () => {
  const moved = new Set<string>();
  for (const { ev, stage, reader, tabsBefore, tabsAfter, rows } of everyPage()) {
    const who = `${ev.id} · ${stage} · ${reader.label}`;
    const sections = sectionsFor(reader, stage, ev);
    for (const r of rows) {
      if (r.before === r.after) continue;
      const want = sections.find((s) => s.id === r.id)!.want;
      const proto = r.key ? PROTOTYPE[stage][r.key] : undefined;
      const toPrototype = proto === r.after;
      /* The bar: the tab it stood on is gone (nothing asks for it now), or the tab it always asked for now exists. */
      const barChanged = !tabsAfter.includes(r.before) || (r.after === want && !tabsBefore.includes(want));
      assert.ok(toPrototype || barChanged, `${who}: ${r.id} moved ${r.before} → ${r.after} for no stated reason`);
      if (toPrototype) moved.add(`${stage}/${r.id} → ${r.after}`);
    }
  }
  /* The whole list of prototype moves the roster meets — the owner's table, and nothing else. */
  assert.deepEqual([...moved].sort(), [
    'event/scene:dress_code → home',
    'event/scene:our_photos → gallery',
    'event/scene:schedule → live',
    'event/scene:venue_map → home',
    'event/seat-block → me',
    'event/seat-finder → me',
    'event/spotlight → live',
    'event/walking-order → home',
    'rsvp/look → me',
    'rsvp/scene:countdown → home',
    'rsvp/scene:special_message → home',
    'rsvp/seat-line → me',
  ]);
});

test('3 · the measured table, by reader', () => {
  const tab = (readerId: string, stage: Stage, ev: EventFacts, id: string) => {
    const reader = READERS.find((r) => r.id === readerId)!;
    const row = pageOf(reader, stage, ev).rows.find((r) => r.id === id);
    return row ? `${row.before} → ${row.after}` : null;
  };
  // Countdown and Message: Details → Welcome, for every reader of the Invitation.
  for (const r of READERS) {
    assert.equal(tab(r.id, 'rsvp', FULL, 'scene:countdown'), 'details → home', r.label);
    assert.equal(tab(r.id, 'rsvp', FULL, 'scene:special_message'), 'details → home', r.label);
    // …and what Details keeps, it keeps.
    for (const t of ['schedule', 'venue_map', 'dress_code', 'faq', 'what_to_bring']) assert.equal(tab(r.id, 'rsvp', FULL, `scene:${t}`), 'details → details', `${r.label}: ${t}`);
  }
  // The guest's look: Welcome → Me — for each guest, whatever they replied; a reader without a key has no look.
  for (const id of ['guest-pending', 'guest-yes', 'guest-no']) assert.equal(tab(id, 'rsvp', FULL, 'look'), 'home → me');
  for (const id of ['signed-out', 'supplier', 'couple']) assert.equal(tab(id, 'rsvp', FULL, 'look'), null, 'a reader without a key gained a look');
  // …and where Me's own four parts already say it, the Welcome's look is not drawn on either page.
  assert.equal(tab('guest-yes', 'rsvp', STAGED, 'look'), null);
  // The day's seat: the day's Welcome → Me. The couple's finder follows; a supplier has no Me, so theirs stays.
  for (const id of ['guest-pending', 'guest-yes', 'guest-no']) assert.equal(tab(id, 'event', FULL, 'seat-block'), 'home → me');
  assert.equal(tab('couple', 'event', FULL, 'seat-finder'), 'home → me');
  assert.equal(tab('supplier', 'event', FULL, 'seat-finder'), 'home → home');
  assert.equal(tab('signed-out', 'event', FULL, 'seat-finder'), null, 'a reader without a key gained the seat finder');
  // The day's venue, dress code, march: Live → Welcome.
  for (const id of ['guest-pending', 'guest-yes', 'guest-no', 'signed-out', 'couple']) {
    assert.equal(tab(id, 'event', FULL, 'scene:venue_map'), 'live → home', id);
    assert.equal(tab(id, 'event', FULL, 'scene:dress_code'), 'live → home', id);
    assert.equal(tab(id, 'event', FULL, 'scene:schedule'), 'live → live', id);
  }
  for (const id of ['signed-out', 'couple']) assert.equal(tab(id, 'event', FULL, 'walking-order'), 'live → home', id);
  // The reply lines, the checklist, the scan-trail switch, Me: nobody named them, nothing moved them.
  for (const id of ['guest-pending', 'guest-yes', 'guest-no']) {
    assert.equal(tab(id, 'rsvp', FULL, 'reply-lines'), 'home → home');
    assert.equal(tab(id, 'rsvp', FULL, 'checklist'), 'home → home');
    assert.equal(tab(id, 'event', FULL, 'scan-trail'), 'home → home');
    assert.equal(tab(id, 'event', FULL, 'me'), 'me → me');
  }
});

/* ══ 4 · THE BAR STAYS HONEST ════════════════════════════════════════════════ */

test('4 · a tab is drawn only when something asks for it — and every tab drawn has something on it', () => {
  // The lean couple: a countdown and a message, both Welcome's now — no empty Details tab is left behind.
  for (const reader of READERS) {
    const { tabsBefore, tabsAfter, rows } = pageOf(reader, 'rsvp', LEAN);
    assert.ok(tabsBefore.includes('details'), `${reader.label}: precondition — the lean Invitation had a Details tab`);
    assert.ok(!tabsAfter.includes('details'), `${reader.label}: a Details tab with nothing behind it`);
    assert.ok(rows.every((r) => r.after !== 'details'));
  }
  // The full couple keeps Details: the programme, the venue and the dress code are its own.
  for (const reader of READERS) assert.ok(pageOf(reader, 'rsvp', FULL).tabsAfter.includes('details'), reader.label);
  // The day: a reader without a key now HAS a Welcome when the couple's venue or march is there to read.
  const stranger = READERS.find((r) => r.id === 'signed-out')!;
  assert.ok(pageOf(stranger, 'event', FULL).tabsAfter.includes('home'));
  // …a guest whose only Welcome content was their table (the lean day) has none now: the table is Me's.
  const yes = READERS.find((r) => r.id === 'guest-yes')!;
  assert.ok(pageOf(yes, 'event', LEAN).tabsBefore.includes('home'), 'precondition: the lean day’s Welcome held the table');
  assert.ok(!pageOf(yes, 'event', LEAN).tabsAfter.includes('home'), 'a Welcome tab with nothing behind it');
  // The two tabs this ruling resolves anew — the Invitation's Details, the day's Welcome — are never drawn empty,
  // for any reader of any event. (Gallery and Our Love Story keep the bar's own rules, untouched here.)
  for (const { ev, stage, reader, tabsAfter, rows } of everyPage()) {
    for (const t of tabsAfter) {
      if (!(stage === 'rsvp' && t === 'details') && !(stage === 'event' && t === 'home')) continue;
      assert.ok(rows.some((r) => r.after === t), `${ev.id} · ${stage} · ${reader.label}: the "${t}" tab has nothing behind it`);
    }
  }
  // WIRING: the page resolves both bars from what each part ASKS for (`ownPage`), never from the bar itself.
  assert.match(ANON, /\(readerFiled \? detailsSceneList\.some\(\(w\) => sceneOwnPage\(w\) === 'details'\) : detailsSceneList\.length > 0\)/);
  assert.match(GUEST, /\(makerPages \? detailsSceneList\.some\(\(w\) => sceneOwnPage\(w\) === 'details'\) : detailsSceneList\.length > 0\)/);
  assert.match(GUEST, /hasWelcome:\s*dayWelcome\.length > 0 \|\|\s*\(\(Boolean\(seatMap\) \|\| seatPassActive\) && ownPage\('f:find_your_seat', 'home'\) === 'home'\) \|\|\s*\(makerPages !== null && detailsSceneList\.some\(\(w\) => sceneOwnPage\(w\) === 'home'\)\),/);
  assert.match(ANON, /\(findSeatShown && \(ownPage\('f:find_your_seat', 'home'\) === 'home' \|\| !\(ownerCapability \|\| isEditorCanvas\)\)\)\s*: findSeatShown\),/);
  assert.match(BODY, /const ownPage = \(key: string, want: string\): string => \(makerPages \? ownPageOf\(pageStage, key, want, makerPages\) : want\);/);
});

test('4 · the couple’s scenes are filed in three runs — every scene in exactly one, in the couple’s order', () => {
  type W = { widget_type: string };
  for (const stage of STAGES)
    for (const tabs of [['home', 'details', 'story', 'me'], ['home', 'me'], ['live', 'home', 'gallery', 'me'], ['live', 'me'], ['live']]) {
      const pages = makerPagesOf(stage);
      const scenesTab = stage === 'event' ? 'live' : 'details';
      const scenes: W[] = ['countdown', 'schedule', 'special_message', 'venue_map', 'faq', 'dress_code', 'what_to_bring', 'our_photos'].map((widget_type) => ({ widget_type }));
      const tabOf = (w: W) => readerPageOf(stage, `w:${w.widget_type}`, scenesTab, tabs, pages);
      const runs = fileScenes({
        scenes,
        on: true,
        leadTab: stage === 'rsvp' ? 'home' : null,
        hereTab: hubTabFor(scenesTab, tabs),
        tabOf,
        ownOf: (w) => ownPageOf(stage, `w:${w.widget_type}`, scenesTab, pages),
      });
      const all = [...runs.lead, ...runs.here, ...runs.away];
      assert.equal(all.length, scenes.length, `${stage} ${tabs.join('·')}: a scene was dropped or drawn twice`);
      assert.deepEqual(new Set(all), new Set(scenes));
      for (const run of [runs.lead, runs.here, runs.away]) {
        assert.deepEqual(run, scenes.filter((w) => run.includes(w)), 'the couple’s order is kept inside a run');
      }
      for (const w of runs.here) assert.equal(tabOf(w), hubTabFor(scenesTab, tabs));
      for (const w of runs.lead) assert.equal(tabOf(w), 'home');
      for (const w of runs.away) assert.notEqual(tabOf(w), hubTabFor(scenesTab, tabs));
      // A page that is one scroll, and the Maker's Stages canvas: every scene stays with the page's sections.
      const off = fileScenes({ scenes, on: false, leadTab: 'home', hereTab: scenesTab, tabOf, ownOf: () => 'home' });
      assert.deepEqual(off, { lead: [], here: scenes, away: [] });
    }
  // The Invitation's Welcome leads with the Countdown and the Message, as the prototype draws it.
  const inv = fileScenes({
    scenes: FULL.scenes.rsvp.map((widget_type) => ({ widget_type })),
    on: true,
    leadTab: 'home',
    hereTab: 'details',
    tabOf: (w) => readerPageOf('rsvp', `w:${w.widget_type}`, 'details', ['home', 'details', 'story', 'me'], makerPagesOf('rsvp')),
    ownOf: (w) => ownPageOf('rsvp', `w:${w.widget_type}`, 'details', makerPagesOf('rsvp')),
  });
  assert.deepEqual(inv.lead.map((w) => w.widget_type), ['countdown', 'special_message']);
  assert.deepEqual(inv.here.map((w) => w.widget_type), ['schedule', 'venue_map', 'dress_code', 'faq', 'what_to_bring']);
  assert.deepEqual(inv.away, []);
});

/* ══ 5 · THE PAGE IS THE ROSTER ══════════════════════════════════════════════ */

/** The first argument of every `group(…)` call in a slice of the page — the tab each group is filed on. */
function groupFilings(src: string): string[] {
  const out: string[] = [];
  const re = /(^|[^A-Za-z0-9_$.])group\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length;
    const start = i;
    let depth = 0;
    let quote: string | null = null;
    for (; i < src.length; i += 1) {
      const c = src[i]!;
      if (quote) {
        if (c === '\\') i += 1;
        else if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') quote = c;
      else if ('([{'.includes(c)) depth += 1;
      else if (')]}'.includes(c)) {
        if (depth === 0) break;
        depth -= 1;
      } else if (c === ',' && depth === 0) break;
    }
    out.push(src.slice(start, i).trim().replace(/\s+/g, ' '));
  }
  return out;
}

test('5 · every group in both trees is filed by one of these — a new group cannot escape the filing', () => {
  /* Each filing the page calls, with why it is that one. A literal tab is allowed only where the one filing gives
     the same answer for every reader (asserted below) or the section is one no part names. */
  const GUEST_FILINGS: ReadonlyArray<[src: string, count: number, why: string]> = [
    ['p', 1, 'a run of the couple’s scenes on its own tab (`scenesOnTabs`, `sceneTab` = readerAt)'],
    ['leadTab', 1, 'the cover (f:hero — the stage’s first page by the prototype) and the reply card'],
    ["readerAt('f:spotlight', 'home')", 1, 'the "Happening now" card'],
    ['seatTab', 2, 'their table and the seat line (`readerAt(f:find_your_seat)`), for a reader whose bar has no Me'],
    ["readerAt('f:greeting', leadTab)", 2, 'the salutation’s two slots'],
    ["'live'", 6, 'directions · the stream · the day’s programme · the wall · the song request · the camera card'],
    ["pageStage === 'event' ? 'live' : 'details'", 1, 'the tea ceremony card (no part names it)'],
    ["'gallery'", 1, 'Photos of you · your shots (f:photos_of_you — the prototype’s Gallery)'],
    ["'home'", 8, 'the checklist · the supplier pitch · the reply lines · the Welcome (its own parts) · the day’s Welcome · the face-data notice (a page that is one scroll) · the scan-trail switch · the +1 note — none a part names, but the two Welcomes, asserted below'],
    ['scenesTab', 1, 'the scenes that stay with the page’s sections (`hereScenes`), the walking order with them'],
    ['marchTab', 1, 'the walking order when its tab is another (`readerAt(f:entourage)`)'],
    ["'story'", 1, 'Our Love Story (w:our_love_story — the prototype’s own page)'],
    ["'me'", 1, 'Me — with the guest’s look and their table inside it'],
  ];
  const ANON_FILINGS: ReadonlyArray<[src: string, count: number, why: string]> = [
    ['p', 2, 'a run of scenes on its own page — the canvas’s (`scenesByPage`) and a reader’s (`scenesByTab`)'],
    ['at(`f:${part}`, scenesTab)', 1, 'the Maker’s day-part stand-ins'],
    ['leadTab', 2, 'the cover’s two groups'],
    ["'home'", 2, 'the day’s Welcome landing mark · the day’s Welcome'],
    ["stagesPages ? 'home' : readerAt('f:find_your_seat', 'home')", 1, 'the seat finder'],
    ["'live'", 2, 'the stream, arranged or alone'],
    ["'gallery'", 1, 'the wall on its own'],
    ["at('f:rsvp', 'home')", 1, 'the canvas’s reply stand-in'],
    ["at('f:greeting', leadTab)", 1, 'the canvas’s greeting stand-in'],
    ["at('f:pass', 'me')", 1, 'the canvas’s pass stand-in'],
    ["stagesPages ? at(WELCOME_PART_CANVAS[parts[0]!], 'home') : 'home'", 1, 'the Invitation’s Welcome (a reader’s holds E-Gifts alone)'],
    ["at('f:details', scenesTab)", 1, 'the canvas’s "THE DETAILS"'],
    ['scenesTab', 2, 'the page’s sections (`hereScenes`) · its after-the-entourage scenes'],
    ["at('f:entourage', scenesTab)", 1, 'the walking order'],
    ["at('w:our_love_story', 'story')", 1, 'Our Love Story'],
    ["'me'", 1, 'the Me landing'],
  ];
  const tally = (list: string[]) => {
    const t = new Map<string, number>();
    for (const x of list) t.set(x, (t.get(x) ?? 0) + 1);
    return [...t.entries()].sort(([a], [b]) => a.localeCompare(b));
  };
  const want = (list: ReadonlyArray<[string, number, string]>) => list.map(([s, n]) => [s, n] as [string, number]).sort(([a], [b]) => a.localeCompare(b));
  assert.deepEqual(tally(groupFilings(GUEST)), want(GUEST_FILINGS), 'the guest tree files a group some other way — say what it is, and whether a part names it');
  assert.deepEqual(tally(groupFilings(ANON)), want(ANON_FILINGS), 'the stranger’s tree files a group some other way');

  // The literals are TRUE: for a reader whose bar has the tab, the one filing answers the same.
  const day = ['live', 'home', 'gallery', 'me'];
  const dayPages = makerPagesOf('event');
  assert.equal(readerPageOf('event', 'f:photos_of_you', 'gallery', day, dayPages), 'gallery');
  assert.equal(readerPageOf('event', 'f:live_hub', 'live', day, dayPages), 'live');
  assert.equal(readerPageOf('rsvp', 'w:our_love_story', 'story', ['home', 'details', 'story', 'me'], makerPagesOf('rsvp')), 'story');
  assert.equal(readerPageOf('rsvp', 'f:gifts', 'home', ['home', 'details', 'story', 'me'], makerPagesOf('rsvp')), 'home', 'the Welcome keeps E-Gifts');
  /* The day's Welcome is one section of five parts — each one's key is Welcome's on the day. */
  for (const part of ['look', 'reminders', 'march', 'venue', 'gifts'] as const) {
    assert.equal(readerPageOf('event', WELCOME_PART_CANVAS[part], 'home', day, dayPages), 'home', `the day’s Welcome part "${part}"`);
  }
  /* The Invitation's Welcome parts are Welcome's or Me's — the page splits them exactly so. */
  for (const part of ['look', 'gifts'] as const) {
    assert.ok(['home', 'me'].includes(readerPageOf('rsvp', WELCOME_PART_CANVAS[part], 'home', ['home', 'details', 'story', 'me'], makerPagesOf('rsvp'))));
  }
});

test('5 · WIRING: the guest’s look and their table are drawn INSIDE Me, once — and the seat line is Me’s own', () => {
  // The scenes ask the one filing, in both trees.
  assert.match(GUEST, /const sceneTab = \(w: \{ widget_type: string \}\) => readerAt\(`w:\$\{w\.widget_type\}`, scenesTab\);/);
  assert.match(ANON, /const sceneTab = \(w: \{ widget_type: string \}\) => at\(`w:\$\{w\.widget_type\}`, scenesTab\);/);
  assert.equal(BODY.match(/= fileScenes\(\{\s*scenes: detailsSceneList,/g)?.length, 2, 'both trees file their scenes through the one function');
  assert.match(BODY, /const readerAt = \(key: string, want: string\): string =>\s*makerPages && pageTabs\.on \? readerPageOf\(pageStage, key, want, pageTabs\.inPage, makerPages\) : want;/);
  // The Welcome's scenes stand around the greeting, in the prototype's order: countdown · greeting · message.
  assert.match(
    GUEST,
    /\{scenesOnTabs\(leadBefore, [^\n]*\)\}\s*\{group\(readerAt\('f:greeting', leadTab\), <>\{dayOfLead\.greetingStepsBack \? null : greetingBlock\}<\/>,[^\n]*\n\s*\{scenesOnTabs\(leadAfter, [^\n]*\)\}/,
  );
  assert.match(GUEST, /const leadCut = leadScenes\.findIndex\(\(w\) => w\.widget_type === 'special_message'\);/);
  assert.match(GUEST, /const leadBefore = leadCut < 0 \? leadScenes : leadScenes\.slice\(0, leadCut\);\s*const leadAfter = leadCut < 0 \? \[\] : leadScenes\.slice\(leadCut\);/);
  // Me: the look, then the table, then the ticket — inside the Me group, in one column.
  const me = GUEST.slice(GUEST.indexOf('data-me-stage=""'));
  assert.ok(me.length > 500, 'precondition: Me was found');
  const filed = me.indexOf('data-me-filed=""');
  assert.ok(filed > 0 && filed < me.indexOf('{signOut}'), 'the look and the table left Me');
  assert.match(me, /\{lookOnMe \? \(\s*<GuestWelcome partLooks=\{welcomeLooks\} parts=\{welcomeOnMe\}[^>]*\/>\s*\) : null\}\s*\{tableOnMe \? seatBlock : null\}\s*\{mine\}/);
  assert.match(me, /const lookOnMe = welcomeOnMe\.length > 0 && meParts\.length === 0;/, 'Me’s own four parts already say the look: never both');
  assert.match(me, /const tableOnMe = seatOnMe && seatBlock !== null;/);
  assert.match(me, /if \(!lookOnMe && !tableOnMe\) return mine;/, 'a guest with neither meets the Me they met before');
  // One block, two slots — never both.
  assert.match(GUEST, /\{seatOnMe \? null : group\(seatTab, seatBlock, \{ chapters: true, className: 'space-y-12' \}\)\}/);
  assert.match(GUEST, /const seatTab = readerAt\('f:find_your_seat', 'home'\);\s*const seatOnMe = tabs\.on && seatTab === 'me';/);
  assert.equal(GUEST.split('<YourSeatBlock').length - 1, 1);
  // The Welcome keeps the parts that are its own; Me's are filtered by the one filing.
  assert.match(GUEST, /const welcomeOnMe = tabs\.on \? welcome\.filter\(\(part\) => readerAt\(WELCOME_PART_CANVAS\[part\], 'home'\) === 'me'\) : \[\];/);
  assert.match(GUEST, /\{tabs\.on && welcomeHere\.length === 0 \? null : group\('home', \(\s*<GuestWelcome\s+partLooks=\{welcomeLooks\}\s+parts=\{welcomeHere\}/);
  // The seat line: Me already draws this very line (page.tsx), so it is never drawn a second time on Me.
  assert.match(GUEST, /\{seatOnMe && typeof meSection === 'function' \? null : group\(seatTab, <>\{seatPassActive && !isMakerCanvas && !seatMap \? \(\s*<SeatDoorLine/);
  const PAGE = stripComments(readFileSync(join(WEB, 'app/[slug]/page.tsx'), 'utf8'));
  assert.match(PAGE, /\{seatPassActive \? \(\s*<SeatDoorLine slug=\{event\.slug \?\? slug\} tableLabel=\{guestHubData\.tableLabel\}/, 'Me’s own seat line');
  assert.match(PAGE, /guestPageTabbed \? \(\s*\(\{ replyHref \}: \{ replyHref: string \| null \}\) => \(\s*<GuestMeSection meSlot=\{meSlotFor\(replyHref\)\}/, 'on a tabbed page Me is drawn by the page, with that line in it');
});

test('5 · 🔗 `#site-details` keeps landing — on the Welcome’s scenes when Details has nothing of its own', () => {
  /* The cover's "the day, the place, the story ↓" (`invitation-card.ts` `hubHref`) names this mark. A couple with only
     a countdown and a message had a Details tab holding both; both are Welcome's now, so the mark goes with them. */
  assert.match(readFileSync(join(WEB, 'app/[slug]/_lib/invitation-card.ts'), 'utf8'), /hubHref: `#\$\{SITE_MENU_ANCHORS\.details\}`,/);
  // The guest: the page's sections carry it, unless they are empty and the Welcome's scenes are not.
  assert.match(GUEST, /const detailsMarkOnLead =\s*leadScenes\.length > 0 &&\s*hereScenes\.length === 0 &&\s*!\(stageShowsEntourage\(pageStage\) && entourage\.length > 0 && !marchOnWelcome && marchTab === hereTab\);/);
  assert.match(GUEST, /\{scenesOnTabs\(leadBefore, detailsMarkOnLead \? SITE_MENU_ANCHORS\.details : undefined\)\}/);
  assert.match(GUEST, /\{scenesOnTabs\(leadAfter, detailsMarkOnLead && leadBefore\.length === 0 \? SITE_MENU_ANCHORS\.details : undefined\)\}/);
  assert.match(GUEST, /id: pageStage === 'event' \|\| detailsMarkOnLead \? undefined : SITE_MENU_ANCHORS\.details \}\)\}/, 'one mark on the page — never two elements with one id');
  assert.match(GUEST, /id: p === first \? mark : undefined \}\)\}/, 'the mark is on the run’s first group only');
  // The reader without a key: the Details section draws only with open browse or a scene of its own.
  assert.match(ANON, /const detailsMarkOnLead = !plan\.openBrowse && hereScenes\.length === 0 \? SITE_MENU_ANCHORS\.details : undefined;/);
  assert.match(ANON, /\{readerFiled \? scenesByTab\(readerLead, 'mt-12', detailsMarkOnLead\) : null\}/);
  assert.match(ANON, /<div id=\{p === first \? mark : undefined\} className=\{`sn-hub-cards \$\{gap\} space-y-4 scroll-mt-6`\}>\{sceneNodes\(mine\)\}<\/div>/);
  assert.match(ANON, /\) : hereScenes\.length > 0 \? \(\s*<section id=\{SITE_MENU_ANCHORS\.details\}/);
});

/* ══ 6 · THE MAKER'S CANVAS IS UNTOUCHED ═════════════════════════════════════ */

test('6 · the Stages canvas files by the Maker’s own function and list — no reader arm reaches it', () => {
  // The canvas's filing is the Maker's, with the Maker's list; only a READER takes the other arm.
  assert.match(BODY, /const at = \(key: string, want: string\): string => \(stagesPages \? makerStagesPageOf\(pageStage, key, stagesPages\) : readerAt\(key, want\)\);/);
  assert.match(BODY, /const makerPages = tabsOn \? \(stagesPages \?\? makerStagesPages\(pageStage, weddingOnly\.love_story\)\.map\(\(p\) => p\.key\)\) : null;/);
  // Every reader-only arm of the stranger's tree (the canvas's tree) is behind `readerFiled`, false in Stages.
  assert.match(ANON, /const readerFiled = makerPages !== null && stagesPages === null;/);
  assert.match(ANON, /on: readerFiled,/, 'in Stages every scene stays `hereScenes` — the canvas’s own runs draw them');
  assert.match(ANON, /\{readerFiled \? scenesByTab\(readerLead, 'mt-12', detailsMarkOnLead\) : null\}/);
  assert.match(ANON, /const hereTab = readerFiled \? hubTabFor\(scenesTab, tabs\.inPage\) : scenesTab;/);
  assert.match(ANON, /group\(stagesPages \? 'home' : readerAt\('f:find_your_seat', 'home'\),/, 'the canvas keeps the seat finder where it drew it');
  // The reader's away-scenes are drawn only in the arm the canvas never takes.
  const armAt = ANON.search(/\{stagesPages \? \(\s*<>\s*\{plan\.openBrowse \? group\(at\('f:details', scenesTab\), \(/);
  assert.ok(armAt > 0, 'precondition: the canvas’s Details arm was found');
  const arm = ANON.slice(armAt);
  const split = arm.indexOf(') : (');
  assert.ok(split > 0 && !arm.slice(0, split).includes('scenesByTab'), 'a reader’s run is drawn inside the canvas’s own arm');
  assert.ok(arm.slice(split).includes("{scenesByTab(awayScenes, 'mt-12')}"));
  // The canvas's own lines, as the round before left them.
  for (const line of [
    "const stagesLead = stagesPages && pageStage === 'rsvp' ? detailsSceneList.filter((w) => at(`w:${w.widget_type}`, 'details') === leadTab) : [];",
    'const stagesAround = splitAroundEntourage(pageStage, detailsSceneList.filter((w) => !stagesLead.includes(w)));',
    'const mine = list.filter((w) => at(`w:${w.widget_type}`, p) === p);',
    "{scenesByPage(stagesAround.before, 'mt-12')}",
    "{stagesPages ? scenesByPage(stagesAround.after, 'mt-8') : detailsAround.after.length > 0 ? group(scenesTab, <div className=\"sn-hub-cards mt-8 space-y-4\">{sceneNodes(detailsAround.after)}</div>) : null}",
  ]) {
    assert.ok(ANON.includes(line), `the canvas’s line changed: ${line}`);
  }
  // …and with the filing off (`on: false`) the page's own scenes are every scene: what the canvas read before.
  const scenes = [{ widget_type: 'countdown' }, { widget_type: 'schedule' }];
  assert.deepEqual(fileScenes({ scenes, on: false, leadTab: 'home', hereTab: 'details', tabOf: () => 'home', ownOf: () => 'home' }).here, scenes);
  // The Maker's answers themselves did not move (the round before pinned them; the same function still gives them).
  const inv = makerPagesOf('rsvp');
  const day = makerPagesOf('event');
  assert.equal(makerStagesPageOf('rsvp', 'f:rsvp', inv), 'home');
  assert.equal(makerStagesPageOf('event', 'f:rsvp', day), 'live');
  assert.equal(makerStagesPageOf('event', 'f:greeting', day), 'live');
  assert.equal(makerStagesPageOf('event', 'w:photo_moments', day), 'live');
  assert.equal(makerStagesPageOf('rsvp', 'w:faq', inv), 'details');
});

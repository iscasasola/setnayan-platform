/**
 * the-look-moves-into-details.test.ts — Details part 3 (owner 2026-09-28/29).
 *
 *   · DECISION_LOG "OPTION B — EVERYTHING MADE ONCE LIVES IN DETAILS; THE TOP
 *     MENU IS THE FOUR STAGES + DETAILS" — owner, verbatim: *"B. maximize this
 *     concept so it is easier to find everything to populate the event hub"*.
 *   · DECISION_LOG "SCHEDULE, MOOD BOARD AND SEAT PLAN MOVE INSIDE THE EVENT
 *     HUB (DETAILS)" — owner, verbatim: *"schedule, mood board and seat plan
 *     will be inside."* (Mood Board under Look; old routes land on its item.)
 *   · DECISION_LOG "THE PLAN ADAPTS TO EVERY EVENT TYPE — BUILT IN, NOT BOLTED
 *     ON" — a birthday and a wake get the same Look, in words that fit them.
 *
 * What is held, each by EXECUTING the code where it can be and by source where
 * no DOM runs:
 *   (1) the Look is Theme · Mood Board · Logo · Hero · Reveal, each in the split
 *       it shipped with;
 *   (2) every old address and every old door lands on its Details item;
 *   (3) the shipped pages MOVED — the work area builds them once and hands the
 *       same nodes to Details; it no longer draws them itself;
 *   (4) Details draws them, and a page that has not arrived SAYS so;
 *   (5) the Mood Board is one component: Details draws it for the couple, its
 *       old page redirects the couple there, and the supplier side is intact;
 *   (6) a birthday and a wake get all of it, with no wedding word.
 *
 * Lives in `lib/` because node's test glob does not descend into `[eventId]`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import {
  DETAILS_ITEM_GROUPS,
  DETAILS_ITEM_KEYS,
  LOOK_ITEM_KEYS,
  detailsItemFor,
  detailsItemHref,
  detailsItemLayout,
  detailsNavigatorKeys,
  isDetailsItemKey,
  makerHasWork,
  makerToolFor,
  movedPageItem,
  type DetailsItemContext,
  type DetailsItemKey,
} from './maker-details-items';
import { GENERIC_PROFILE, WAKE_PROFILE, WEDDING_PROFILE, type EventTypeProfile } from './event-type-profile';
import { eventWordsFromProfile } from '../app/[slug]/_lib/event-words';

/* tsx compiles the components to the CLASSIC runtime, so React must be global
   before they are imported (the set-up `hub-stage-renders.test.ts` documents). */
(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const L = 'app/dashboard/[eventId]/launch/_components';
const MB = 'app/dashboard/[eventId]/studio/mood-board';

/* ── (1) the Look ─────────────────────────────────────────────────────── */

test('(1) the Look is Theme · Mood Board · Logo · Hero · Reveal, in the owner’s order', () => {
  const look = DETAILS_ITEM_GROUPS.find((g) => g.group === 'look')!;
  assert.deepEqual([...look.keys], ['theme', 'mood-board', 'logo', 'hero', 'reveal']);
  assert.deepEqual([...LOOK_ITEM_KEYS], ['mood-board', 'logo', 'hero', 'reveal']);
  assert.equal(DETAILS_ITEM_KEYS[0], 'theme', 'Theme is still the first item and the cold open');
  assert.equal(new Set(DETAILS_ITEM_KEYS).size, DETAILS_ITEM_KEYS.length, 'one key names two items');
});

test('(1) each page keeps the split it shipped with', () => {
  // The Hero and the Reveal: a live page fills the body, their controls on the right.
  assert.equal(detailsItemLayout('hero'), 'fill');
  assert.equal(detailsItemLayout('reveal'), 'fill');
  // The Logo studio lays its own panel beside its canvas; the Mood Board is one board.
  assert.equal(detailsItemLayout('logo'), 'whole');
  assert.equal(detailsItemLayout('mood-board'), 'whole');
  // Everything else is the picture-and-editor it was.
  for (const k of ['theme', 'address', 'qr', 'invitation', 'download'] as const) assert.equal(detailsItemLayout(k), 'flow', k);
  // …and the workspace hides the editor column for a page that carries its own tools.
  const ws = read(`${L}/details-workspace.tsx`);
  assert.match(ws, /hidden=\{layout === 'whole'\}/);
  assert.match(ws, /\$\{layout === 'whole' \? 'hidden' : 'flex'\}/, 'the `hidden` attribute alone loses to a `flex` class');
});

/* ── (2) old addresses and old doors ──────────────────────────────────── */

test('(2) an old Logo, Hero or Reveal address opens Details on that item', () => {
  for (const tool of ['logo', 'hero', 'reveal'] as const) {
    assert.equal(makerToolFor(tool), 'details', `?tool=${tool} still opens a page of its own`);
    assert.equal(detailsItemFor({ tool }), tool, `?tool=${tool} opens Details on the wrong item`);
    assert.equal(movedPageItem(tool), tool);
  }
  // A named item still wins over the old tool.
  assert.equal(detailsItemFor({ tool: 'hero', item: 'qr' }), 'qr');
  // Nothing else moved: Post Event is a stage tool, Details is Details.
  assert.equal(makerToolFor('post-event'), 'post-event');
  assert.equal(movedPageItem('details'), null);
  assert.equal(movedPageItem(null), null);
  assert.equal(detailsItemHref('e-1', 'mood-board'), '/dashboard/e-1/launch?tool=details&item=mood-board');
});

test('(2) Love Story and RSVP move exactly when their Details item exists — never to nowhere', () => {
  // Part 2 adds `love-story` and `rsvp`; until then their old address keeps
  // opening their own page. The rule is one line either way: moved ⇔ the item exists.
  for (const [tool, item] of [
    ['love-story', 'love-story'],
    ['rsvp-page', 'rsvp'],
  ] as const) {
    const exists = isDetailsItemKey(item);
    assert.equal(makerToolFor(tool) === 'details', exists, `${tool}: moved ${!exists ? 'to an item that does not exist' : 'nowhere'}`);
    assert.equal(movedPageItem(tool), exists ? item : null);
  }
});

async function paintShell(initialSelection: unknown) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerShell } = await import(`../${L}/maker-shell`);
  return renderToStaticMarkup(
    React.createElement(
      MakerShell,
      {
        eventId: 'ev-1',
        slug: 'ana-ben',
        liveStage: 'rsvp',
        initialStage: 'rsvp',
        initialSelection,
        storeShell: false,
        priceLabel: null,
        firstVisit: false,
        completeTourAction: async () => {},
        renderStamp: '1',
        more: null,
        hasWork: true,
        details: { page: React.createElement('div', { 'data-stub': 'details-page' }), controls: null },
      },
      React.createElement('div', { 'data-stub': 'work' }),
    ),
  );
}

test('(2) a door that still says "open the Hero" opens Details — the shell turns it', async () => {
  for (const key of ['logo', 'hero', 'reveal'] as const) {
    const html = await paintShell({ kind: 'tool', key });
    assert.match(html, /data-maker-page="details"/, `${key}: Details did not open`);
    assert.match(html, /data-stub="details-page"/, `${key}: Details' page is not drawn`);
    assert.doesNotMatch(html, new RegExp(`data-maker-page="${key}"`), `${key}: still opened as a page of its own`);
    // One highlight, on Details.
    assert.match(html, /data-maker-bar-item="details"[^>]*aria-pressed="true"/, `${key}: Details is not the highlighted place`);
  }
  // Every door goes through that one turn: the context's `select`, the address and the tab's memory.
  const shell = read(`${L}/maker-shell.tsx`);
  assert.match(shell, /const select = useCallback\(\(next: MakerSelection\) => \{\s*const moved = movedSelection\(next\);/);
  assert.match(shell, /useState<MakerSelection>\(\(\) => movedSelection\(initialSelection\)\.selection\)/);
  assert.match(shell, /const moved = movedSelection\(saved\.selection\);/);
});

/* ── (3) moved, not rebuilt ───────────────────────────────────────────── */

test('(3) the work area builds Logo, Hero and Reveal once and hands the SAME nodes to Details', () => {
  const work = read('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');
  const reg = work.slice(work.indexOf('setLookPages({'), work.indexOf('setLookPages({') + 700);
  assert.ok(reg.length > 100, 'anti-vacuity: the registration was not found');
  assert.match(reg, /logo: madeOnce\?\.logo \?\? null/);
  assert.match(reg, /\{madeOnce\.hero\}/);
  assert.match(reg, /<RowBlock row=\{mainBackgroundRow\} \/>/, 'the Main background left the hero with the move');
  assert.match(reg, /reveal: madeOnce\?\.reveal \?\? null/);
  // …and draws none of them as a page of its own.
  const pick = work.slice(work.indexOf('function madeOncePageKey('), work.indexOf('function madeOncePageKey(') + 400);
  assert.match(pick, /return selection\.key === 'love-story' \? 'love-story' : null;/);
  assert.doesNotMatch(work, /pageKey === 'logo'|pageKey === 'reveal'|pageKey === 'hero'/, 'a Look page is still drawn by the work area');
  // The panels are still built where they always were — one build, not two.
  const editor = read('app/dashboard/[eventId]/website/editor/page.tsx');
  for (const panel of ['<MakerHeroPanel', '<MakerRevealPanel', '<MakerLogoPanel']) {
    assert.equal(editor.split(panel).length - 1, 1, `${panel} is built ${editor.split(panel).length - 1} times`);
  }
  const launch = read('app/dashboard/[eventId]/launch/page.tsx');
  assert.doesNotMatch(launch, /<Maker(Hero|Reveal|Logo)Panel\b/, 'Details built a second copy of a Look page');
});

/* ── (4) Details draws them ───────────────────────────────────────────── */

async function paintLook(part: 'body' | 'editor', item: 'logo' | 'hero' | 'reveal', lookPages: unknown) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerContext } = await import(`../${L}/maker-context`);
  const { DetailsLookBody, DetailsLookEditor } = await import(`../${L}/details-look-pages`);
  const noop = () => {};
  const value = {
    eventId: 'ev-1',
    stage: 'rsvp',
    setStage: noop,
    device: 'phone',
    navOpen: true,
    selection: { kind: 'tool', key: 'details' },
    select: noop,
    moreOpen: false,
    renderStamp: '1',
    storeShell: false,
    viewAsHref: null,
    addScene: null,
    setAddScene: noop,
    detailsItem: item,
    setDetailsItem: noop,
    lookPages,
    setLookPages: noop,
  };
  return renderToStaticMarkup(
    React.createElement(
      MakerContext.Provider,
      { value },
      React.createElement(part === 'body' ? DetailsLookBody : DetailsLookEditor, { item }),
    ),
  );
}

const LOOK = {
  logo: React.createElement('div', { 'data-stub': 'logo-studio' }),
  hero: React.createElement('div', { 'data-stub': 'hero-controls' }),
  reveal: React.createElement('div', { 'data-stub': 'reveal-controls' }),
  revealStages: ['rsvp', 'event'],
  publicLandingUrl: '/ana-ben',
};

test('(4) Details draws the Logo studio as the body, the Hero and Reveal pages with their controls on the right', async () => {
  assert.match(await paintLook('body', 'logo', LOOK), /data-details-look="logo"[\s\S]*data-stub="logo-studio"/);
  const hero = await paintLook('body', 'hero', LOOK);
  assert.match(hero, /src="\/ana-ben\?phase=rsvp&amp;editor=1&amp;only=hero"/, 'the Hero page is the hero alone, on the host canvas');
  assert.match(await paintLook('editor', 'hero', LOOK), /data-stub="hero-controls"/);
  const reveal = await paintLook('body', 'reveal', LOOK);
  assert.match(reveal, /src="\/ana-ben\?phase=rsvp&amp;preview=draft"/, 'the Reveal plays on its first chosen stage');
  assert.match(reveal, /data-maker-page-switch=""/, 'with two chosen stages the page offers both');
  assert.match(await paintLook('editor', 'reveal', LOOK), /data-stub="reveal-controls"/);
});

test('(4) a page that has not arrived SAYS so — never an empty column', async () => {
  for (const item of ['logo', 'hero', 'reveal'] as const) {
    const waiting = await paintLook('body', item, null);
    assert.match(waiting, /role="status"[^>]*data-details-look-waiting=/, `${item}: nothing says it is opening`);
  }
  // A registered page with no node (its read failed) is an alert, not a blank.
  const failed = await paintLook('body', 'logo', { ...LOOK, logo: null });
  assert.match(failed, /role="alert"[^>]*data-details-look-failed="logo"/);
  // No address yet: it says so and offers the Address item in place (no link out).
  const noAddress = await paintLook('body', 'hero', { ...LOOK, publicLandingUrl: null });
  assert.match(noAddress, /data-maker-page-no-address=""/);
  assert.doesNotMatch(noAddress, /<a\b/, 'a link out of the Maker');
});

test('(4) Details wires each Look item: its body, its editor, and the Mood Board note opens the item in place', () => {
  const details = read(`${L}/maker-details.tsx`);
  assert.match(details, /bodies\.logo = <DetailsLookBody item="logo" \/>/);
  assert.match(details, /bodies\.hero = <DetailsLookBody item="hero" \/>/);
  assert.match(details, /bodies\.reveal = <DetailsLookBody item="reveal" \/>/);
  assert.match(details, /hero: <DetailsLookEditor item="hero" \/>/);
  assert.match(details, /reveal: <DetailsLookEditor item="reveal" \/>/);
  assert.match(details, /bodies\['mood-board'\] = \(/);
  // "Build your Mood Board first" opens the item — it no longer links out of the Maker.
  assert.match(details, /<DetailsGoTo item="mood-board">Build your Mood Board first<\/DetailsGoTo>/);
  assert.doesNotMatch(details, /studio\/mood-board/, 'a link out to the old Mood Board page is back');
  // The Play menu knows the Hero and the Reveal play inside Details.
  assert.match(read(`${L}/maker-shell.tsx`), /selection\.key === 'details' && \(detailsItem === 'hero' \|\| detailsItem === 'reveal'\)/);
});

/* ── (5) the Mood Board ───────────────────────────────────────────────── */

test('(5) the Mood Board is ONE component — Details draws it, and its old page lands the couple there', () => {
  const launch = read('app/dashboard/[eventId]/launch/page.tsx');
  assert.match(launch, /<Suspense fallback=\{[^}]*Opening your Mood Board…[\s\S]{0,80}<MoodBoardEditor eventId=\{eventId\} inMaker \/>/, 'Details does not stream the board');
  const page = read(`${MB}/page.tsx`);
  assert.match(page, /if \(makerHasWork\(memberType, websiteOn\)\) redirect\(detailsItemHref\(eventId, 'mood-board'\)\);/);
  assert.match(page, /return <MoodBoardEditor eventId=\{eventId\} \/>;/, 'everyone else keeps the page');
  // The one rule, shared with the launch page's `hasWork`.
  assert.match(launch, /const hasWork = makerHasWork\(memberType, websiteOn\);/);
  assert.equal(makerHasWork('couple', true), true);
  assert.equal(makerHasWork('coordinator', true), false, 'a coordinator was sent into a Maker that has nothing for them');
  assert.equal(makerHasWork('couple', false), false, 'an event with no Event Hub was sent into the Maker');
  assert.equal(makerHasWork(null, true), false, 'an unread membership was sent into the Maker');
});

test('(5) inside the Maker the board keeps the Maker’s rules — and its supplier side is untouched', () => {
  const ed = read(`${MB}/_components/mood-board-editor.tsx`);
  assert.match(ed, /\{inMaker \? null : <PageMasthead title="Mood Board" \/>\}/, 'a second masthead inside Details');
  assert.match(ed, /\{storeShell \|\| inMaker \? null : \(\s*<Link\s*\n\s*href=\{`\/dashboard\/\$\{eventId\}\/studio`\}/, '"Back to add-ons" inside the Maker');
  assert.match(ed, /\{inMaker \? \(\s*<p[^>]*>You design the room in your Seat plan\.<\/p>\s*\) : \(\s*<Link/, 'a link out of the Maker to the seat plan');
  assert.match(ed, /\$\{inMaker \? 'sticky[^']*' : 'fixed inset-x-0'\}/, 'the save bar sits over the Maker’s own chrome');
  // A refused read inside the Maker is said — a 404 would take the whole Maker down.
  assert.match(ed, /if \(inMaker\) \{\s*return \(\s*<p role="alert"/);
  // The supplier side: both sign-off panels and Share with vendors, as before.
  assert.equal((ed.match(/<PartFinalizationPanel\b/g) ?? []).length, 2);
  assert.equal((ed.match(/<ShareWithVendorsButton\b/g) ?? []).length, 1);
  assert.match(ed, /requestAction=\{requestPartFinalization\.bind\(null, eventId\)\}/);
});

/* ── (6) every event type ─────────────────────────────────────────────── */

const BIRTHDAY: EventTypeProfile = { ...GENERIC_PROFILE, eventType: 'birthday' };
const ctx = (profile: EventTypeProfile): DetailsItemContext => ({ profile, solemn: eventWordsFromProfile(profile).solemn });
const ALL = new Set<DetailsItemKey>(DETAILS_ITEM_KEYS);

test('(6) a birthday and a wake get the whole Look — and the place menu is the same five', async () => {
  const { makerPlacePick } = await import(`../${L}/maker-bar`);
  for (const p of [BIRTHDAY, WAKE_PROFILE, WEDDING_PROFILE]) {
    const look = detailsNavigatorKeys(ctx(p), ALL).find((g) => g.group === 'look');
    assert.deepEqual(look?.keys, ['theme', ...LOOK_ITEM_KEYS], `${p.eventType}: the Look lost an item`);
  }
  assert.equal(ctx(WAKE_PROFILE).solemn, true, 'the wake fixture is not the solemn register');
  // The place menu names the stages in their ONE vocabulary (`PUBLIC_STAGE_LABELS`
  // — no per-type stage names ship) and Details; nothing about it is a wedding's.
  const m = makerPlacePick({ stage: 'rsvp', liveStage: null, openTool: null, hasWork: true }) as { options: Array<{ label: string }> };
  assert.deepEqual(m.options.map((o) => o.label), ['Save the Date', 'Invitation', 'On the Day', 'Post Event', 'Details']);
  // A viewer Details is not for is told who it IS for — in the type's own word.
  for (const p of [BIRTHDAY, WAKE_PROFILE, WEDDING_PROFILE]) {
    const theHost = eventWordsFromProfile(p).theHost;
    const shut = makerPlacePick({ stage: 'rsvp', liveStage: null, openTool: null, hasWork: false, theHost }) as {
      options: Array<{ key: string; disabledNote?: string }>;
    };
    assert.equal(shut.options.find((o) => o.key === 'details')?.disabledNote, `only ${theHost} can open this`, p.eventType);
  }
  assert.match(read('app/dashboard/[eventId]/launch/page.tsx'), /theHost=\{eventWordsFromProfile\(await resolveProfileByEvent\(eventId\)\)\.theHost\}/);
});

test('(6) no Look item, and no part-3 file, types a wedding word', () => {
  for (const f of [
    `${L}/details-look-pages.tsx`,
    `${L}/details-go.tsx`,
    `${L}/details-workspace.tsx`,
    `${L}/maker-bar.ts`,
    `${MB}/page.tsx`,
  ]) {
    assert.doesNotMatch(read(f), /\b(wedding|couple|bride|groom)\b/i, `${f} types a wedding word`);
  }
  // The Look's navigator words (maker-details `lookLabel`).
  const details = read(`${L}/maker-details.tsx`);
  const labels = details.slice(details.indexOf('function lookLabel('), details.indexOf('function lookLabel(') + 1400);
  assert.ok(labels.includes("label: 'Mood Board'"), 'anti-vacuity: lookLabel not found');
  assert.doesNotMatch(labels, /\b(wedding|couple|bride|groom)\b/i);
});

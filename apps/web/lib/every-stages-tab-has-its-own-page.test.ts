/**
 * 🧭 IN THE MAKER'S STAGES VIEW, EVERY TAB HAS ITS OWN PAGE — owner, 08 Oct, verbatim: *"i do not see the
 * individual pages. i still see invitation as a 1 long page that scrolls down"*; his ruling of 2026-10-07
 * (*"yes pages"*): *"each page is just a bookmark on a single page that just jumps. this was not the plan"*.
 *
 * Measured on the preview BEFORE the fix (375 px, signed in, maria-and-jose):
 *   · Invitation — groups `home` ×3, `details` ×4, `me` ×1 and NO `story`, though the Maker's bar showed Welcome ·
 *     Details · Our Love Story · Me. Our Love Story was filed at the foot of Details, so its tab only scrolled.
 *   · The Day — groups `live` ×6 and `me` ×1 only: Welcome, Camera and Gallery had no page.
 *   · greeting · pass · RSVP and the day's stand-ins (announcements, live hub, your seat, photos of you) sat outside
 *     every group, so they were drawn on EVERY tab; on Me the label read "Welcome".
 *   · the stage menu said "Save the Date · 3 pages" and "Post Event · 3 pages" over canvases with no pages at all.
 *
 * What holds now, each EXECUTED on the real functions (a source read only where the rule is a wiring):
 *   a · one page list — the Maker's bar, the stage menu's count and the canvas's groups ask `makerStagesPages`;
 *       every page of it gets a group, whether or not the READER's bar carries that tab.
 *   b · one filing — every part the canvas marks is on the page the prototype's `TABS` puts it on
 *       (`MAKER_STAGE_PAGES`, pinned by `the-stage-pages-are-the-prototypes.test.ts`).
 *   c · the Reveal's stub is on one page only: the first.
 *   d · a tab pick swaps the page, from its top, and the canvas says which tab is on screen.
 *   e · guests are untouched: with no Stages page list, the tabs are the reader's own bar's, as before.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { TABBED_STAGES, hubTabFor, hubTabsOn, inPageTabs } from '../app/[slug]/_lib/hub-tabs';
import { navPhaseFor, resolveSiteNav } from '../app/[slug]/_lib/site-nav';
import { STAGE_BAR } from '../app/[slug]/_lib/stage-bar';
import { HUB_TAB_FREES, HUB_TAB_HOLD_MS, createPageTop, openHubTab, showHubTab, shownHubTab } from '../app/[slug]/_components/hub-tab-dom';
import { createCanvasBringUp } from '../app/[slug]/_components/canvas-bring-up';
import type { LifecyclePhase } from './invitation-widgets';
import { WIDGET_TYPES } from './invitation-widgets';
import { makerGuestPages } from './maker-guest-pages';
import { makerPartCanvasOn, makerPartsWithAdded } from './maker-part-groups';
import { MAKER_STAGE_PAGES, makerPartsOnPage, type MakerPartKey } from './maker-parts';
import { MAKER_FIXED_LABEL } from './maker-scene-list';
import {
  filedOnCanvas,
  firstMarkerOnPage,
  makerStageIsPaged,
  makerStagesPageOf,
  makerStagesPages,
  pageTabKeys,
  stagesPagesLeft,
} from './maker-stage-filing';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const BODY = src('app/[slug]/_components/site-body.tsx');
const TOOLS = src('app/dashboard/[eventId]/launch/_components/stage-tools.tsx');
const MENU = src('app/dashboard/[eventId]/launch/_components/stage-item-menu.tsx');
const BRIDGE = src('app/[slug]/_components/editor-bridge.tsx');

const STAGES: readonly LifecyclePhase[] = ['save_the_date', 'rsvp', 'event', 'editorial'];
const keysOf = (stage: LifecyclePhase, hasStory = true) => makerStagesPages(stage, hasStory).map((p) => p.key);

/** The bar the HOST's canvas resolves when the couple has written no love story and nothing is public yet —
 *  the reader's bar that hid the pages (the canvas asks as a guest holding their key, `site-body.tsx`). */
const hostCanvasBar = (stage: 'rsvp' | 'event') =>
  resolveSiteNav({
    viewer: { kind: 'guest' },
    phase: navPhaseFor({ dayOfPhase: stage === 'event' ? 'live' : 'inactive', isRecapBody: false }),
    hostAllowsCamera: false,
    anyChapterPublic: false,
    hasStory: false,
    hasDetails: true,
    hasSchedule: true,
    hasWelcome: false,
    liveBroadcast: false,
    destinations: { camera: null, watch: '/ana/hub', join: '/ana/invite' },
    stageSlots: STAGE_BAR[stage].slots,
    tabbed: true,
  });

/* ══ a · ONE PAGE LIST ═══════════════════════════════════════════════════════ */

test('a · the Stages pages ARE the Maker’s bar: Invitation four, The Day five — and they are the parts map’s pages', () => {
  assert.deepEqual(makerStagesPages('rsvp').map((p) => p.label), ['Welcome', 'Details', 'Our Love Story', 'Me']);
  assert.deepEqual(makerStagesPages('event').map((p) => p.label), ['Live', 'Welcome', 'Camera', 'Gallery', 'Me']);
  for (const stage of TABBED_STAGES) {
    assert.deepEqual(keysOf(stage), makerGuestPages(stage, []).map((p) => p.key as string), `${stage}: a second page list`);
    assert.deepEqual(keysOf(stage), Object.keys(MAKER_STAGE_PAGES[stage]), `${stage}: the parts map names other pages than the bar`);
  }
  // A type with no two people has no Our Love Story page, as its guests have none.
  assert.deepEqual(keysOf('rsvp', false), ['home', 'details', 'me']);
});

test('a · the page count and the canvas agree for EVERY stage: tabs only where the canvas draws tabs', () => {
  for (const stage of STAGES) {
    const canvasTabs = hubTabsOn({ stage, bodyNormal: true, barDrawn: true, makerCanvas: true, stagesCanvas: true });
    assert.equal(makerStageIsPaged(stage), canvasTabs, `${stage}: the Maker's page count and the canvas disagree`);
    if (!canvasTabs) assert.equal(keysOf(stage).length, 1, `${stage}: one page on the canvas is one page in the Maker`);
  }
  // …and both of the Maker's readers ask the one list (the tab bar under the page, the stage menu's "n pages").
  assert.match(TOOLS, /const own = new Set\(makerStagesPages\(stage\)\.map\(\(p\) => p\.key\)\);/);
  assert.match(MENU, /const own = new Set\(makerStagesPages\(s\)\.map\(\(p\) => p\.key\)\);/);
  assert.doesNotMatch(TOOLS, /pk\.stage === stage && !o\.disabledNote/, 'a page with no scene of the couple’s yet is still a page');
});

test('a · the canvas groups by the Maker’s list — a tab the READER’s bar lacks still has a page', () => {
  // The measured fault: this reader's Invitation bar has no Our Love Story, and their day no Welcome · Gallery.
  const inv = hostCanvasBar('rsvp');
  const day = hostCanvasBar('event');
  assert.ok(!inPageTabs(inv).includes('story'), 'precondition: the reader’s bar has no Our Love Story');
  assert.ok(!inPageTabs(day).includes('home') && !inPageTabs(day).includes('gallery'), 'precondition: no Welcome · Gallery on the reader’s day');
  for (const [stage, bar] of [['rsvp', inv], ['event', day]] as const) {
    const tabs = pageTabKeys({ tabsOn: true, bar, stagesPages: keysOf(stage) });
    assert.deepEqual(tabs, keysOf(stage), `${stage}: the canvas does not group by the Maker's pages`);
  }
  // The owner's own example: Our Love Story is its own page, never the foot of Details.
  assert.equal(makerStagesPageOf('rsvp', 'w:our_love_story', pageTabKeys({ tabsOn: true, bar: inv, stagesPages: keysOf('rsvp') })), 'story');
  assert.match(BODY, /const inPage = pageTabKeys\(\{ tabsOn, bar, stagesPages \}\);/, 'the canvas asks the one function');
  assert.match(BODY, /tabsOn && stagesTabs && isMakerCanvas && canvasOnly === null \? makerStagesPages\(pageStage, weddingOnly\.love_story\) : null/);
});

test('a · EVERY page of the list gets a group — a page nothing was filed on draws its stand-in', async () => {
  assert.deepEqual(stagesPagesLeft(keysOf('event'), new Set(['live', 'home', 'me'])), ['camera', 'gallery']);
  assert.deepEqual(stagesPagesLeft(keysOf('rsvp'), new Set(keysOf('rsvp'))), []);
  // Both trees end with it, after every group() has run; it marks each page as a tab of its own.
  assert.equal(BODY.match(/\{tabs\.rest\(\)\}/g)?.length, 2, 'both trees draw the pages nothing was filed on');
  assert.match(BODY, /stagesPagesLeft\(inPage, filled\)\.map\(\(p\) => \(\s*<div key=\{p\} \{\.\.\.\{ \[HUB_TAB_ATTR\]: p \}\}/);
  assert.match(BODY, /if \(!opts\.quiet\) filled\.add\(tab\);/, 'a group records the page it filled');
  const React = await import('react');
  /* The canvas's stand-ins are compiled with the classic JSX runtime under `tsx` — they read the global. */
  (globalThis as unknown as { React: unknown }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerPageStandIn } = await import('../app/[slug]/_components/maker-fixed-parts');
  const cam = renderToStaticMarkup(React.createElement(MakerPageStandIn, { page: 'camera', label: 'Camera' }));
  assert.match(cam, /data-maker-page-stand-in="camera"/);
  assert.match(cam, /Only you see this/);
  assert.match(cam, /data-maker-sample=""/, 'editor-only: globals.css hides it on any page without a Maker marker');
});

/* ══ b · ONE FILING ══════════════════════════════════════════════════════════ */

test('b · every part the canvas marks is on the prototype’s page for it', () => {
  for (const stage of TABBED_STAGES) {
    const pages = keysOf(stage);
    const seen = new Set<string>();
    for (const page of pages) {
      for (const part of makerPartsOnPage(stage, page)) {
        const canvas = makerPartCanvasOn(stage, part);
        if (!canvas || seen.has(canvas)) continue; // not drawn by the canvas, or the page that names it first has it
        seen.add(canvas);
        assert.equal(makerStagesPageOf(stage, canvas, pages), page, `${stage}: ${part} (${canvas}) is not on ${page}`);
      }
    }
    assert.ok(seen.size >= 8, `precondition: ${stage} marks several parts (${seen.size})`);
  }
});

test('b · the measured faults, by name', () => {
  const inv = keysOf('rsvp');
  const day = keysOf('event');
  // Invitation: greeting · pass · RSVP were on every tab; the Love Story at the foot of Details.
  assert.equal(makerStagesPageOf('rsvp', 'f:greeting', inv), 'home');
  assert.equal(makerStagesPageOf('rsvp', 'f:rsvp', inv), 'home', 'the reply card sits under the names');
  assert.equal(makerStagesPageOf('rsvp', 'f:pass', inv), 'me', 'the pass is the Digital ticket — Me only');
  assert.equal(makerStagesPageOf('rsvp', 'w:our_love_story', inv), 'story');
  assert.equal(makerStagesPageOf('rsvp', 'w:countdown', inv), 'home', 'prototype: Welcome carries the countdown');
  assert.equal(makerStagesPageOf('rsvp', 'w:special_message', inv), 'home');
  assert.equal(makerStagesPageOf('rsvp', 'f:look', inv), 'me', 'prototype: What to wear is one of Me’s four');
  assert.equal(makerStagesPageOf('rsvp', 'f:gifts', inv), 'home');
  for (const k of ['f:details', 'w:schedule', 'w:venue_map', 'w:dress_code', 'f:entourage', 'w:what_to_bring']) {
    assert.equal(makerStagesPageOf('rsvp', k, inv), 'details', k);
  }
  // The Day: the stand-ins sat outside every group; Welcome · Camera · Gallery had no page.
  assert.equal(makerStagesPageOf('event', 'f:announcements', day), 'live');
  assert.equal(makerStagesPageOf('event', 'f:live_hub', day), 'live');
  assert.equal(makerStagesPageOf('event', 'f:spotlight', day), 'live');
  assert.equal(makerStagesPageOf('event', 'f:hero', day), 'live');
  assert.equal(makerStagesPageOf('event', 'w:schedule', day), 'live');
  for (const k of ['w:venue_map', 'w:dress_code', 'f:entourage', 'w:what_to_bring']) assert.equal(makerStagesPageOf('event', k, day), 'home', k);
  assert.equal(makerStagesPageOf('event', 'f:photos_of_you', day), 'gallery');
  assert.equal(makerStagesPageOf('event', 'w:our_photos', day), 'gallery');
  assert.equal(makerStagesPageOf('event', 'f:find_your_seat', day), 'me');
  assert.equal(makerStagesPageOf('event', 'f:pass', day), 'me');
});

test('b · a key no part names is never stranded — and never on a page that is not one of this stage’s', () => {
  const every = [...Object.keys(MAKER_FIXED_LABEL).map((k) => `f:${k}`), ...WIDGET_TYPES.map((t) => `w:${t}`), 'w:custom_section', 'p:numbers'];
  for (const stage of TABBED_STAGES)
    for (const pages of [keysOf(stage), keysOf(stage, false)])
      for (const key of every) {
        const page = makerStagesPageOf(stage, key, pages);
        assert.ok(pages.includes(page), `${stage}: ${key} → "${page}", which is no page of ${pages.join('·')}`);
      }
  // No Love Story page (a birthday): the scene stays where a guest would scroll past it — Details.
  assert.equal(makerStagesPageOf('rsvp', 'w:our_love_story', keysOf('rsvp', false)), 'details');
  // The Camera is a page only for the camera: nothing unnamed is ever filed on it.
  for (const key of every) if (makerStagesPageOf('event', key, keysOf('event')) === 'camera') assert.fail(`${key} was filed on the Camera page`);
  // The lead group carries the cover and the day's card — both ARE on the stage's first page.
  for (const stage of TABBED_STAGES) {
    assert.equal(makerStagesPageOf(stage, 'f:hero', keysOf(stage)), keysOf(stage)[0]);
    assert.equal(makerStagesPageOf(stage, 'f:spotlight', keysOf(stage)), keysOf(stage)[0]);
  }
});

test('b · WIRING: in the canvas every marker is inside a group filed by its own key', () => {
  const anon = BODY.slice(BODY.indexOf('const anonymousTree'), BODY.indexOf('const guestTree'));
  assert.ok(anon.length > 5000, 'precondition: the stranger’s tree (the canvas’s) was found');
  // Every key the tree marks by name is filed by that name — or rides the lead group (asserted above to BE its page).
  const LEAD = new Set(['f:spotlight', 'f:hero']);
  const marked = [...anon.matchAll(/makerMark\('([a-z]:[a-z_]+)'\)/g)].map((m) => m[1]!);
  assert.ok(marked.includes('f:details') && marked.includes('f:hero'), `precondition: the named markers were found (${marked.join(', ')})`);
  for (const key of marked) if (!LEAD.has(key)) assert.ok(anon.includes(`at('${key}',`), `${key} is marked but not filed by its own key`);
  // The cover's two markers sit inside the lead group.
  for (const key of LEAD) {
    const at = anon.indexOf(`makerMark('${key}')`);
    assert.ok(at > 0 && anon.lastIndexOf('{group(leadTab, ', at) > anon.lastIndexOf('{ chapters: true })}', at), `${key} left the lead group`);
  }
  // The three guest-link scenes, each in its own group, filed by its own key (they were drawn on every tab).
  for (const k of ['rsvp', 'greeting', 'pass']) {
    assert.match(anon, new RegExp(`group\\(at\\('f:${k}', [^)]*\\), <MakerGuestScenes show=\\{\\{[^}]*${k}: true[^}]*\\}\\}`), `f:${k} is not on its own page`);
  }
  assert.match(anon, /stagesPages\s*\? \{ greeting: false, pass: false, rsvp: false \}/, 'the ungrouped mount draws none of them in Stages');
  // The day's stand-ins, each filed by its own key.
  assert.match(anon, /\{group\(at\(`f:\$\{part\}`, scenesTab\), <>\s*\{makerMark\(`f:\$\{part\}`\)\}/);
  // The Welcome's places (the guest's look, E-Gifts), one group per part.
  assert.match(anon, /group\(stagesPages \? at\(WELCOME_PART_CANVAS\[parts\[0\]!\], 'home'\) : 'home', \(/);
  // The scenes: one group per page, each scene asked for its own page; the Love Story and the entourage by key.
  assert.match(anon, /const mine = list\.filter\(\(w\) => at\(`w:\$\{w\.widget_type\}`, p\) === p\);/);
  assert.match(anon, /\{stagesPages \? \(\s*<>\s*\{plan\.openBrowse \? group\(at\('f:details', scenesTab\), \(/);
  assert.match(anon, /\{scenesByPage\(stagesAround\.before, 'mt-12'\)\}/);
  assert.match(anon, /\{stagesPages \? scenesByPage\(stagesAround\.after, 'mt-8'\) : /);
  // …and `at` IS the filing function (a guest's page keeps the tab it asked for).
  assert.match(BODY, /const at = \(key: string, want: string\): string => \(stagesPages \? makerStagesPageOf\(pageStage, key, stagesPages\) : want\);/);
});

test('b · the Stages tools read the page of a part off the canvas — never a second rule', () => {
  const group = (tab: string) => ({ getAttribute: (n: string) => (n === 'data-hub-tab' ? tab : null) });
  const marker = (key: string, tab: string | null) => ({
    getAttribute: (n: string) => (n === 'data-maker-section' ? key : null),
    closest: () => (tab ? group(tab) : null),
  });
  const doc = { querySelectorAll: () => [marker('f:hero', 'home'), marker('w:photo_moments', 'live'), marker('f:pass', 'me'), marker('f:film', null)] };
  assert.deepEqual(filedOnCanvas(doc), { 'f:hero': 'home', 'w:photo_moments': 'live', 'f:pass': 'me' });
  // A part the page's list does not name (the Invitation's pass) is a tile of the page the canvas filed it on.
  const pages = keysOf('rsvp');
  const drawn = ['f:hero', 'f:pass', 'f:details'];
  const on = (page: string, filed?: Record<string, string>) => makerPartsWithAdded({ stage: 'rsvp', page, pages, drawn, filed });
  assert.ok(on('me', { 'f:pass': 'me' }).includes('pass'), 'the pass is a tile of Me, where the canvas drew it');
  assert.ok(!on('home', { 'f:pass': 'me' }).includes('pass'), '…and of no other page');
  assert.ok(on('home').includes('pass'), 'precondition: without the canvas’s word the neighbour rule put it on Welcome');
  assert.match(TOOLS, /makerPartsWithAdded\(\{ stage, page, pages: pages\.map\(\(p\) => p\.key\), drawn: \[\.\.\.present\], filed \}\)/);
});

/* ══ c · THE REVEAL'S STUB IS ON ONE PAGE ════════════════════════════════════ */

test('c · the Reveal leads exactly one page of each stage it opens — the first', () => {
  for (const stage of ['save_the_date', 'rsvp', 'event'] as const) {
    const pages = keysOf(stage);
    const leads = pages.filter((p) => makerPartsOnPage(stage, p)[0] === ('reveal' satisfies MakerPartKey));
    assert.deepEqual(leads, [pages[0]], `${stage}: the Reveal leads ${leads.join(', ') || 'no page'}`);
  }
});

test('c · the stub stands before the first part of ITS page’s own group — never outside every tab', () => {
  type M = { key: string; tab: string | null; getAttribute(n: string): string | null; closest(sel: string): { getAttribute(n: string): string | null } | null };
  const m = (key: string, tab: string | null): M => ({
    key,
    tab,
    getAttribute: (n) => (n === 'data-maker-section' ? key : null),
    closest: () => (tab ? { getAttribute: (n: string) => (n === 'data-hub-tab' ? tab : null) } : null),
  });
  const tabbed = { querySelectorAll: () => [m('f:pass', 'me'), m('f:hero', 'home'), m('f:details', 'details')] };
  assert.equal(firstMarkerOnPage(tabbed, 'home')?.key, 'f:hero', 'on Welcome: before the cover, inside Welcome’s group');
  assert.equal(firstMarkerOnPage(tabbed, 'details')?.key, 'f:details');
  assert.equal(firstMarkerOnPage(tabbed, 'story'), null, 'a page with no marked part gets no stub — never another page’s');
  // A canvas that is one page (Save the Date): the first marker, as before.
  assert.equal(firstMarkerOnPage({ querySelectorAll: () => [m('f:film', null), m('f:hero', null)] }, 'home')?.key, 'f:film');
  // SOURCE: the panel asks it for the page on screen, and takes the stub away on a page the Reveal does not lead.
  assert.match(TOOLS, /const first = firstMarkerOnPage\(doc, shownPage\);/);
  assert.match(TOOLS, /if \(!revealLeadsHere\) \{\s*part\?\.remove\(\);\s*return;\s*\}/);
  assert.match(TOOLS, /makerPartsOnPage\(stage, shownPage\)\[0\] === 'reveal'/);
});

/* ══ d · A TAB PICK SWAPS THE PAGE, AND THE CANVAS SAYS WHICH ════════════════ */

test('d · the canvas shows one tab’s groups, refuses a tab it has no page for, and says the tab on screen', () => {
  const g = (tab: string, hidden: boolean) => ({ hidden, getAttribute: (n: string) => (n === 'data-hub-tab' ? tab : null) });
  const groups = [g('home', false), g('home', false), g('details', true), g('story', true), g('me', true)];
  const doc = { querySelectorAll: () => groups };
  assert.equal(shownHubTab(doc), 'home');
  assert.equal(showHubTab(doc, 'story'), true);
  assert.deepEqual(groups.map((x) => x.hidden), [true, true, true, false, true], 'exactly that tab’s groups are shown');
  assert.equal(shownHubTab(doc), 'story');
  // A tab with no page: nothing changes (a pick the page cannot honour never blanks it).
  assert.equal(showHubTab(doc, 'gallery'), false);
  assert.equal(shownHubTab(doc), 'story');
  assert.equal(shownHubTab({ querySelectorAll: () => [] }), null, 'a page that is one scroll has no tab');
});

test('d · WIRING: the swap starts at the top and stays there; the label follows the canvas, not a guess', () => {
  const tab = BRIDGE.slice(BRIDGE.indexOf("data.t === 'hubTab'"));
  const handler = tab.slice(0, tab.indexOf('return;\n      }') + 20);
  assert.match(handler, /if \(!openHubTab\(document, window, lift, tab\)\) return;\s*pageTop\.hold\(\);/, 'a pick starts at the top');
  // After a RELOAD the page that was on screen is put back on the fresh page's own document, at once — before the
  // buffered swap carries the scroll — and never through a message that would send it to the top.
  assert.match(TOOLS, /if \(was\?\.stage === stage && was\.tab !== d\.tab && putTabBack\(from, was\.tab\)\) return;/);
  assert.match(TOOLS, /function putTabBack\(canvas: Window, tab: string\): boolean \{\s*try \{\s*return showHubTab\(canvas\.document, tab\);/);
  // The shell no longer re-sends ITS page on `ready` (it follows the scroll, so it named the wrong tab).
  assert.doesNotMatch(src('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx'), /tabNowRef/);
  assert.match(handler, /postMessage\(\{ source: 'setnayan-site', t: 'hubTab', tab \}, origin\)/, 'the canvas says the tab on screen');
  // The page pick's own "scroll to its first scene" no longer drags the fresh page down.
  assert.match(BRIDGE, /if \(data\.t === 'scrollTo'\) \{\s*if \(pageTop\.held\(\)\) return;/);
  assert.match(BRIDGE, /t: 'ready', order: drawnMakerOrder\(document\), bar: readMakerBar\(document\), tab: shownHubTab\(document\)/);
  assert.ok(HUB_TAB_HOLD_MS >= 800 && HUB_TAB_HOLD_MS <= 3000, 'long enough for what a tab tap sets off, short enough that the page is theirs again at once');
  // A stage warmed behind the canvas is not on screen: the front page's tab pick is not for it.
  assert.match(handler, /window\.frameElement\?\.getAttribute\('data-maker-canvas-frame'\) === 'warm'\) return;/);
  // The panel reads the tab off the page when it mounts late or a warm stage is shown (no `ready` is said again).
  assert.match(TOOLS, /const tab = readCanvasTab\(stage\);/);
  // …and when the canvas reloaded while the panel was away (Studio), the page the couple left is put back.
  assert.match(TOOLS, /const putBack = Boolean\(tab && was\?\.stage === stage && was\.tab !== tab && frame && putTabBack\(frame, was\.tab\)\);\s*if \(tab && !putBack\) setCanvasTab\(/);
  assert.match(TOOLS, /useState<\{ stage: LifecyclePhase; tab: string \} \| null>\(lastTab\?\.of === suppliersHref \? lastTab : null\);/, 'this event’s last page only');
  // 📦 The Maker's panel reads the small DOM file, never the bridge (nothing of the bridge rides the Maker).
  assert.doesNotMatch(TOOLS, /_components\/editor-bridge'/);
  // The label and the underline name the tab the CANVAS has on screen (on Me they read "Welcome").
  assert.match(TOOLS, /if \(canvasTab\?\.stage === stage && has\(canvasTab\.tab\)\) return canvasTab\.tab;/);
  assert.match(TOOLS, /if \(d\.t === 'hubTab'\) setCanvasTab\(\{ stage, tab: d\.tab \}\);/);
  // A tap on a tab tells the canvas itself, then the shell's Page ▾.
  assert.match(TOOLS, /postToCanvas\(\{ source: 'setnayan-editor', t: 'hubTab', key: '', tab: key \}\);\s*onPickPage\(option\);/);
  assert.match(TOOLS, /setPicked\(null\);\s*goToPage\(p\.key, p\.option\);/);
});

test('d · 🔝 a tab tap ENDS at the top: the part edited before cannot pull the page back down', () => {
  /* The measured fault (preview a76d76a, 375 px): Details → scrollY 959, Me → 77, Welcome → 156 about 1.8 s after
     the tap. Replayed here on the REAL bring-up (`canvas-bring-up.ts`) and the REAL page-open rule. */
  let y = 0;
  const scrolls: number[] = [];
  const win = {
    innerWidth: 375,
    get scrollY() { return y; },
    scrollTo(to: { top: number }) { y = to.top; scrolls.push(to.top); },
    addEventListener() {},
    removeEventListener() {},
  };
  const lift = createCanvasBringUp(win as never);
  const g = (tab: string, hidden: boolean) => ({ hidden, getAttribute: (n: string) => (n === 'data-hub-tab' ? tab : null) });
  const doc = { querySelectorAll: () => [g('home', false), g('details', true), g('me', true)] };
  // 1 · The couple is 959 px down Welcome and taps a part: it is brought up for its sheet; the page's place is kept.
  y = 959;
  lift.up({ getBoundingClientRect: () => ({ top: 300 }) } as never);
  assert.notEqual(y, 959, 'precondition: the part was brought up');
  // 2 · They tap the Details tab. The page opens from its top…
  assert.equal(openHubTab(doc, win, lift, 'details'), true);
  assert.equal(y, 0, 'the page opens at its top');
  // 3 · …and the tap closed the part's sheet, so the Maker says `settle` (`lift.down()`): the page STAYS at the top.
  lift.down();
  assert.equal(y, 0, 'the old page’s resting place pulled the new page down');
  assert.equal(scrolls.at(-1), 0, 'the last scroll after a tab tap is the one to the top');
  // A tab with no page: nothing is scrolled and nothing is forgotten (the edit in hand keeps its way back).
  y = 400;
  lift.up({ getBoundingClientRect: () => ({ top: 200 }) } as never);
  const before = scrolls.length;
  assert.equal(openHubTab(doc, win, lift, 'gallery'), false);
  assert.equal(scrolls.length, before, 'a refused pick scrolled the page');
  lift.down();
  assert.equal(y, 400, 'a refused pick forgot where the page rested');
});

test('d · 🔝 for a moment after a page opens only the COUPLE moves it — any other scroll is put back to the top', () => {
  let t = 1_000;
  let y = 0;
  const win = { get scrollY() { return y; }, scrollTo(to: { top: number }) { y = to.top; } };
  const top = createPageTop(win, () => t);
  // Not held: a scroll is nobody's business.
  y = 300;
  assert.equal(top.onScroll(), false);
  assert.equal(y, 300);
  // A page opens (the bridge: `openHubTab`, then `hold`)…
  y = 0;
  top.hold();
  assert.equal(top.held(), true, 'a scroll the Maker asks for by message is not run');
  // …and 300 ms later something that is not the couple scrolls it 959 px down (the measured fault): put back.
  t += 300;
  y = 959;
  assert.equal(top.onScroll(), true);
  assert.equal(y, 0, 'a scroll that was not theirs moved the fresh page off its top');
  // Their own touch ends the hold at once: the page scrolls as they move it.
  top.release();
  y = 420;
  assert.equal(top.onScroll(), false);
  assert.equal(y, 420, 'the couple could not scroll their own page');
  assert.equal(top.held(), false);
  // Untouched, the hold ends by itself.
  top.hold();
  t += HUB_TAB_HOLD_MS;
  y = 700;
  assert.equal(top.onScroll(), false, 'the hold never ended');
  assert.equal(y, 700);
  // WIRING: their touch is a pointer, a finger, a wheel or a key ON THE PAGE; a part picked or played frees it too.
  assert.match(BRIDGE, /for \(const t of \['pointerdown', 'touchstart', 'wheel', 'keydown'\] as const\) window\.addEventListener\(t, theirTouch, \{ passive: true, capture: true \}\);/);
  assert.match(BRIDGE, /window\.addEventListener\('scroll', onPageScroll, \{ passive: true \}\);/);
  assert.match(BRIDGE, /if \(HUB_TAB_FREES\.includes\(data\.t \?\? ''\)\) pageTop\.release\(\);/);
  assert.deepEqual([...HUB_TAB_FREES].sort(), ['markEl', 'play', 'playEl', 'playSeq', 'playStage']);
  assert.ok(!HUB_TAB_FREES.includes('scrollTo') && !HUB_TAB_FREES.includes('settle'), 'the two that pulled the page down must never free it');
});

test('d · 🔝 nothing in the Maker scrolls the canvas after a tab tap — no scroll to the page’s first tile', () => {
  const SHELL = src('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');
  // The page pick: its one message to the canvas is the tab — never a `scrollTo` for the page's first scene.
  const jump = SHELL.slice(SHELL.indexOf('const jumpToPage = (page: MakerGuestPage) => {'));
  const body = jump.slice(0, jump.indexOf('\n  };') + 1);
  assert.ok(body.length > 200 && body.length < 2500, `precondition: jumpToPage was found (${body.length})`);
  assert.doesNotMatch(body, /t: 'scrollTo'/, 'jumpToPage posts a scroll itself');
  // Its only scrolls go through `scrollPreviewTo`, which under Stages on a phone sends nothing at all…
  assert.match(SHELL, /if \(!anchor \|\| \(stagesStudioRef\.current && window\.innerWidth < 1024\)\) return;\s*postToShownCanvases\(\{ source: 'setnayan-editor', t: 'scrollTo', key: anchor \}\);/);
  assert.doesNotMatch(SHELL, /pageAskRef|takePageAsk/, 'the page pick is exempt from the skip again — it scrolls to its first tile');
  // …and should one arrive anyway, the canvas holds the fresh page's top against it.
  assert.match(BRIDGE, /if \(data\.t === 'scrollTo'\) \{\s*if \(pageTop\.held\(\)\) return;/);
  // The tab bar's own tap sends the tab and nothing else to the canvas.
  const go = TOOLS.slice(TOOLS.indexOf('const goToPage = useCallback('));
  assert.doesNotMatch(go.slice(0, go.indexOf('[onPickPage]')), /scrollTo|centrePart/, 'a tab tap scrolls the canvas');
});

/* ══ ⚡ THE MAKER'S FIRST LOAD (budget 507 KB — #6413 measured 507.4 KB in CI) ═══════ */

test('⚡ what only a tap asks for stays out of the Maker’s first load', () => {
  const LAUNCH_DIR = 'app/dashboard/[eventId]/launch/_components';
  const SHELL_SRC = src(`${LAUNCH_DIR}/maker-shell.tsx`);
  /* Raw, not stripped: the chunk's name is a comment (`webpackChunkName`). */
  const LAZY = readFileSync(join(WEB, `${LAUNCH_DIR}/details-lazy.tsx`), 'utf8');
  // The pages list and the filing are read by the lazy Stages tools and the canvas — never by a first-load file.
  for (const f of [`${LAUNCH_DIR}/maker-shell.tsx`, 'app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx', `${LAUNCH_DIR}/maker-bar.ts`, 'lib/maker-guest-pages.ts', 'lib/maker-navigator-tabs.ts']) {
    assert.doesNotMatch(src(f), /maker-stage-filing|hub-tab-dom|from '@\/lib\/maker-parts'/, `${f} pulls the Stages filing into the first load`);
  }
  // The Stages tools themselves arrive lazily.
  assert.match(LAZY, /export const StageTools = dynamic\(\(\) => import\(\/\* webpackChunkName: "maker-details" \*\/ '\.\/stage-tools'\)/);
  // "✓ Done · back to <part>" and its focusing exist only after a Style-bar jump; "About the Maker" only when asked.
  for (const [name, file] of [['StudioBackToPart', 'stages-studio-parts'], ['MakerTour', 'maker-tour']] as const) {
    assert.match(LAZY, new RegExp(`export const ${name} = dynamic\\(\\(\\) => import\\(\\/\\* webpackChunkName: "maker-details" \\*\\/ '\\.\\/${file}'\\)`), `${name} is not lazy`);
    assert.doesNotMatch(SHELL_SRC, new RegExp(`from '\\./${file}'`), `the shell imports ${file} statically again`);
  }
  assert.match(SHELL_SRC, /import \{[^}]*\bMakerTour\b[^}]*\bStudioBackToPart\b[^}]*\} from '\.\/details-lazy';/);
  assert.doesNotMatch(SHELL_SRC, /data-focus-pending|data-maker-studio-back/, 'the jump’s focusing or its button is back in the shell');
  // The hub draft (first load) reads the camera look's KEYS only — never the file with its words, tint and ink maths.
  assert.match(src('lib/hub-draft.ts'), /from '@\/lib\/camera-look-key';/);
  assert.doesNotMatch(src('lib/hub-draft.ts'), /from '@\/lib\/camera-look';/, 'the whole camera look rides the Maker’s first load again');
  assert.doesNotMatch(src('lib/camera-look-key.ts'), /^import /m, 'the key file grew a dependency');
  assert.match(src('lib/camera-look.ts'), /export \{ CAMERA_LOOKS, CAMERA_LOOK_PREF_KEY, isCameraLook, type CameraLook \};/, 'one spelling: the look re-exports its keys');
});

/* ══ e · GUESTS ARE UNTOUCHED ════════════════════════════════════════════════ */

test('e · with no Stages page list the tabs are the reader’s own bar’s — exactly `inPageTabs`', () => {
  for (const stage of ['rsvp', 'event'] as const) {
    const bar = hostCanvasBar(stage);
    assert.deepEqual(pageTabKeys({ tabsOn: true, bar, stagesPages: null }), inPageTabs(bar), `${stage}: a guest's tabs changed`);
    assert.deepEqual(pageTabKeys({ tabsOn: false, bar, stagesPages: keysOf(stage) }), [], 'a page that is one scroll has no tabs');
  }
  // `at` hands a guest back the tab the page asked for; the filing still runs through `hubTabFor` for them.
  assert.match(BODY, /const tab = hubTabFor\(want, inPage\);/);
  assert.equal(hubTabFor('story', ['home', 'details', 'me']), 'details', 'a guest with no Our Love Story still reads it on Details');
  // The Stages list exists only on the host's Stages canvas: `?tabs=1` is honoured on the editor canvas alone.
  assert.match(src('app/[slug]/page.tsx'), /stagesTabs: isEditorCanvas && search\.tabs === '1',/);
});

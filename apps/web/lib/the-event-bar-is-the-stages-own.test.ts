/**
 * the-event-bar-is-the-stages-own.test.ts — owner 2026-09-26, verbatim:
 * *"you showed invitation guest bar? for an on the day guest bar"* · *"show
 * the actual guest bar for that stage"* · on the navigator's "Main" tile:
 * *"this depends on what menu they are looking at."* · *"rename it to Event Bar"*.
 *
 * One per-stage config (`STAGE_BAR`, `app/[slug]/_lib/stage-bar.ts`) feeds
 * three things that must never disagree:
 *   1. the guest header's stage label — each stage shows ITS OWN name, where it
 *      used to read "Invitation" on every stage;
 *   2. the guest tab bar — each stage's allow-list, Post Event set in one place;
 *   3. the Maker navigator's tabs — the canvas hands over the bar it drew
 *      (`data-maker-bar`, the SAME value the tab bar is drawn from), and the
 *      navigator's tabs are exactly those items, each listing its scenes in
 *      page order. No generic "Main".
 * Plus the switch's own name: "Event Bar".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from './strip-comments';
import { STAGE_BAR, pageStageFor, makerBarItems } from '../app/[slug]/_lib/stage-bar';
import { resolveSiteNav, navPhaseFor, type NavSlotKey } from '../app/[slug]/_lib/site-nav';
import { PUBLIC_STAGE_LABELS, PUBLIC_STAGE_ORDER } from './public-site-stage-labels';
import { navigatorTabs, parseNavigatorBar, anchorOfTile } from './maker-navigator-tabs';
import { makerStageList, type MakerStageInput } from './maker-scene-list';
import type { InvitationWidgetRow, LifecyclePhase, WidgetType } from './invitation-widgets';

(globalThis as unknown as { React: unknown }).React = React;

const read = (rel: string) => stripComments(readFileSync(join(import.meta.dirname, rel), 'utf8'));

/** The nav moment each stage is previewed at — how `?phase=` forces `dayOfPhase` (page.tsx). */
const NAV_PHASE: Record<LifecyclePhase, ReturnType<typeof navPhaseFor>> = {
  save_the_date: navPhaseFor({ dayOfPhase: 'inactive', isRecapBody: false }),
  rsvp: navPhaseFor({ dayOfPhase: 'inactive', isRecapBody: false }),
  event: navPhaseFor({ dayOfPhase: 'live', isRecapBody: false }),
  editorial: navPhaseFor({ dayOfPhase: 'post', isRecapBody: true }),
};

/** The canvas's own bar for a stage: the public viewer, the stage's allow-list. */
function canvasBar(stage: LifecyclePhase, facts: { hasDetails: boolean; hasStory: boolean }) {
  return makerBarItems(
    resolveSiteNav({
      viewer: { kind: 'public' },
      phase: NAV_PHASE[stage],
      hostAllowsCamera: true,
      anyChapterPublic: false,
      hasStory: facts.hasStory,
      hasDetails: facts.hasDetails,
      liveBroadcast: false,
      destinations: { camera: '/papic/guest?from=cale-ice', watch: '/cale-ice/hub', join: '/cale-ice/invite' },
      stageSlots: STAGE_BAR[stage].slots,
    }),
  );
}

const ALWAYS = new Set<WidgetType>(['hero', 'greeting', 'qr_card', 'rsvp']);
const ORDER: WidgetType[] = [
  'hero', 'greeting', 'qr_card', 'event_details', 'countdown', 'schedule', 'rsvp', 'venue_map',
  'dress_code', 'photo_moments', 'your_photos', 'tier_comparison', 'special_message',
  'what_to_bring', 'our_photos', 'our_love_story',
];
const widgets: InvitationWidgetRow[] = ORDER.map((t, i) => ({
  widget_id: `id-${t}`, event_id: 'e1', widget_type: t, display_order: i + 1, is_visible: true,
  is_always_on: ALWAYS.has(t), tier: 'basic', config_json: {}, created_at: '', updated_at: '', mode: 'auto', audience: 'public',
}));
const PAGE: Omit<MakerStageInput, 'stage'> = {
  widgets,
  openBrowse: false,
  content: { schedule: true, venue_map: true, our_love_story: false, our_photos: false, special_message: false, what_to_bring: false, countdown: true },
  solemn: false,
  hasHeroMedia: false,
  hasEntourage: true,
  storyRenders: false,
};

test('1 · the header names the stage it shows — each stage its own label, never "Invitation" everywhere', async () => {
  for (const stage of PUBLIC_STAGE_ORDER) assert.equal(STAGE_BAR[stage].label, PUBLIC_STAGE_LABELS[stage]);
  const { renderToStaticMarkup } = await import('react-dom/server');
  const mod = await import('../app/[slug]/_components/invitation-shell');
  const InvitationShell = (mod as { InvitationShell?: typeof mod.InvitationShell }).InvitationShell
    ?? (mod as unknown as { default: typeof mod }).default.InvitationShell;
  type ShellProps = React.ComponentProps<typeof InvitationShell>;
  for (const stage of PUBLIC_STAGE_ORDER) {
    const html = renderToStaticMarkup(
      React.createElement(InvitationShell, { stageLabel: STAGE_BAR[stage].label } as ShellProps, React.createElement('p', null, 'x')),
    );
    const label = /data-stage-label=""[^>]*>([^<]*)</.exec(html)?.[1];
    console.log(`  ${stage}: header says "${label}"`);
    assert.equal(label, PUBLIC_STAGE_LABELS[stage], `the ${stage} header must say its own stage`);
  }
  const BODY = read('../app/[slug]/_components/site-body.tsx');
  assert.match(BODY, /stageLabel=\{STAGE_BAR\[pageStage\]\.label\}/, 'the page hands the shell the stage it is showing');
  assert.match(BODY, /const pageStage = pageStageFor\(\{ phasesEnabled, lifecyclePhase, dayOfPhase \}\);/);
  // a host's ?phase= preview IS the lifecycle phase; with phases off the day and the recap still name themselves
  assert.equal(pageStageFor({ phasesEnabled: true, lifecyclePhase: 'event', dayOfPhase: 'inactive' }), 'event');
  assert.equal(pageStageFor({ phasesEnabled: false, lifecyclePhase: 'rsvp', dayOfPhase: 'live' }), 'event');
  assert.equal(pageStageFor({ phasesEnabled: false, lifecyclePhase: 'rsvp', dayOfPhase: 'post' }), 'editorial');
  assert.equal(pageStageFor({ phasesEnabled: false, lifecyclePhase: 'rsvp', dayOfPhase: 'pre' }), 'rsvp');
});

test('2 · the tab bar follows the stage’s one config — On the Day is Now · Camera · Join, Post Event is set in one place', () => {
  const day = canvasBar('event', { hasDetails: true, hasStory: false }).map((b) => b.label);
  assert.deepEqual(day, ['Now', 'Camera', 'Join']);
  const invite = canvasBar('rsvp', { hasDetails: true, hasStory: true }).map((b) => b.label);
  assert.deepEqual(invite, ['Home', 'Details', 'Story', 'Camera', 'Join']);
  // the allow-list removes: a stage that does not list a slot never draws it
  const narrowed = resolveSiteNav({
    viewer: { kind: 'public' }, phase: 'after', hostAllowsCamera: true, anyChapterPublic: true, liveBroadcast: false,
    destinations: { camera: '/c', join: '/j' }, stageSlots: ['home', 'gallery'] as NavSlotKey[],
  }).map((s) => s.key);
  assert.deepEqual(narrowed, ['home', 'gallery']);
  // both trees read the config
  const BODY = read('../app/[slug]/_components/site-body.tsx');
  assert.equal(BODY.match(/stageSlots: STAGE_BAR\[pageStage\]\.slots,/g)?.length, 2, 'the anonymous AND the guest bar follow the stage config');
});

test('3 · for EVERY stage the navigator’s tabs are exactly that stage’s Event Bar, each listing its scenes in page order', () => {
  for (const stage of PUBLIC_STAGE_ORDER) {
    const tiles = makerStageList({ ...PAGE, stage }).shown.map((t) => t.key);
    const bar = canvasBar(stage, { hasDetails: tiles.some((k) => k.startsWith('w:')), hasStory: false });
    // what the canvas stamps is what the navigator reads, through the same parser
    const posted = parseNavigatorBar(JSON.parse(JSON.stringify(bar)));
    assert.ok(posted);
    const tabs = navigatorTabs(posted!, tiles);
    console.log(`  ${stage}: ${tabs.map((t) => `${t.label}[${t.tiles.join(' ') || (t.leaves ? 'opens its own page' : '—')}]`).join(' · ')}`);
    assert.deepEqual(tabs.map((t) => t.label), bar.map((b) => b.label), `${stage}: the navigator's tabs must equal the Event Bar`);
    assert.ok(!tabs.some((t) => /^main$/i.test(t.label)), 'never a generic "Main"');
    // every scene is under exactly one tab, and the tabs read top-down in page order
    const flat = tabs.flatMap((t) => t.tiles);
    assert.deepEqual([...flat].sort(), [...tiles].sort(), `${stage}: a scene was lost or doubled`);
    for (const t of tabs) {
      const idx = t.tiles.map((k) => (tiles as readonly string[]).indexOf(k));
      assert.deepEqual(idx, [...idx].sort((a, b) => a - b), `${stage}/${t.label}: scenes out of page order`);
      if (t.leaves) assert.equal(t.tiles.length, 0, `${stage}/${t.label} opens its own page — it lists no scenes`);
    }
  }
  // On the Day has no Details tab, so the page's sections sit under Now, the tab above them
  assert.equal(anchorOfTile('w:venue_map'), 'details');
  const dayTiles = makerStageList({ ...PAGE, stage: 'event' }).shown.map((t) => t.key);
  const dayTabs = navigatorTabs(canvasBar('event', { hasDetails: true, hasStory: false }), dayTiles);
  assert.deepEqual(dayTabs.find((t) => t.label === 'Now')?.tiles, dayTiles);
});

test('4 · SOURCE: one value draws the bar and feeds the navigator; the navigator builds no menu of its own', () => {
  const BODY = read('../app/[slug]/_components/site-body.tsx');
  assert.match(BODY, /const anonBar = resolveSiteNav\(\{/);
  assert.match(BODY, /<span hidden data-maker-bar=\{JSON\.stringify\(makerBarItems\(anonBar\)\)\} \/>/);
  assert.match(BODY, /\{menuOn && showGuestBars \? \(\s*<SiteMenuBar\s+slots=\{anonBar\}/, 'the guest bar in the canvas is drawn from the same value');
  const BRIDGE = read('../app/[slug]/_components/editor-bridge.tsx');
  assert.match(BRIDGE, /bar: readMakerBar\(document\)/);
  const SHELL = read('../app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');
  assert.match(SHELL, /setCanvasBar\(parseNavigatorBar\(data\.bar\)\)/);
  assert.match(SHELL, /const tabs = canvasBar \? navigatorTabs\(canvasBar, list\.shown\.map\(\(t\) => t\.key\)\) : null;/);
  assert.match(SHELL, /if \(activeTab && !activeTab\.tiles\.includes\(tile\.key\)\) return null;/, 'a tab lists only its own scenes');
  const nav = SHELL.slice(SHELL.indexOf('aria-label="Scenes"'), SHELL.indexOf('{list.shown.map((tile, i) =>'));
  assert.doesNotMatch(nav, />\s*Main\s*</, 'the navigator must not draw a generic "Main" tile');
});

test('5 · the canvas switch is called "Event Bar"', () => {
  const SHELL = read('../app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');
  assert.match(SHELL, /aria-label="Event Bar"/);
  assert.match(SHELL, /<InfoTip label="Event Bar"/);
  assert.doesNotMatch(SHELL, /aria-label="Guest bars"|label="Guest bars"/);
});

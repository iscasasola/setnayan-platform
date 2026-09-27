/**
 * each-stage-does-one-job.test.ts — DECISION_LOG 2026-09-27, "EACH STAGE DOES
 * ONE JOB". The controller measured the live Maker: Save the Date, Invitation
 * and On the Day drew the SAME scenes in the SAME order, the stage-specific
 * ones sat in "Not shown", On the Day had a countdown and no schedule, and Post
 * Event had a dress code. Held here, each assertion seen to fail once:
 *
 *   1. each stage's scene list matches the table — open browsing ON and OFF;
 *   2. "Two ways to celebrate" is on no stage;
 *   3. the Invitation bar reads RSVP before a reply and Me after it;
 *   4. the On the Day bar reads Now · Schedule · Camera · Gallery · Me;
 *   5. the Save the Date has no Camera tab;
 *   6. an empty scene is on the Maker canvas and absent for a guest;
 *   +  one source: WIDGET_PHASES is derived from the table, never listed twice.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { STAGE_SCENES, stageShowsEntourage } from './stage-scenes';
import { WIDGET_PHASES, type InvitationWidgetRow, type LifecyclePhase, type WidgetType } from './invitation-widgets';
import { makerStageList, type MakerStageInput } from './maker-scene-list';
import { resolveSiteBodyPlan } from './site-body-plan';
import { resolveSiteNav, navPhaseFor } from '../app/[slug]/_lib/site-nav';
import { STAGE_BAR } from '../app/[slug]/_lib/stage-bar';
import { stripComments } from './strip-comments';

const ALWAYS = new Set<WidgetType>(['hero', 'greeting', 'qr_card', 'rsvp']);
const ALL: WidgetType[] = [
  'hero', 'greeting', 'qr_card', 'event_details', 'countdown', 'schedule', 'rsvp', 'venue_map',
  'dress_code', 'photo_moments', 'your_photos', 'tier_comparison', 'special_message',
  'what_to_bring', 'our_photos', 'our_love_story',
];
/* Every row visible, in the catalog's seed order — which is NOT any stage's order. */
const widgets: InvitationWidgetRow[] = ALL.map((t, i) => ({
  widget_id: `id-${t}`, event_id: 'e1', widget_type: t, display_order: i + 1, is_visible: true,
  is_always_on: ALWAYS.has(t), tier: 'basic', config_json: {}, created_at: '', updated_at: '', mode: 'auto', audience: 'public',
}));
const FULL: Omit<MakerStageInput, 'stage'> = {
  widgets,
  openBrowse: false,
  content: {}, // every scene has content
  solemn: false,
  hasHeroMedia: false,
  hasEntourage: true,
  storyRenders: false,
};

/** What the Maker lists — the canvas's own scenes — for one stage. */
const scenes = (stage: LifecyclePhase, over: Partial<MakerStageInput> = {}) =>
  makerStageList({ ...FULL, ...over, stage }).shown.flatMap((t) => (t.kind === 'scene' ? [t.type] : []));
const keys = (stage: LifecyclePhase, over: Partial<MakerStageInput> = {}) =>
  makerStageList({ ...FULL, ...over, stage }).shown.map((t) => t.key);

/* The anonymous canvas draws the public-safe scenes only (event_details and
   your_photos are each guest's own), so the table read by the canvas is: */
const CANVAS_TABLE: Record<LifecyclePhase, WidgetType[]> = {
  save_the_date: ['countdown', 'our_love_story'], // the gallery is the film's while a film plays (see below)
  rsvp: ['countdown', 'special_message', 'our_love_story', 'schedule', 'venue_map', 'dress_code', 'what_to_bring'],
  event: ['schedule', 'venue_map', 'photo_moments'],
  editorial: ['our_love_story', 'our_photos', 'special_message'],
};

test('1 · each stage draws exactly the table’s scenes, in the table’s order — open browsing OFF and ON', () => {
  for (const openBrowse of [false, true]) {
    for (const stage of Object.keys(CANVAS_TABLE) as LifecyclePhase[]) {
      const got = scenes(stage, { openBrowse });
      // The Save the Date's canvas is the film's stage — its gallery is in the film.
      const want = CANVAS_TABLE[stage];
      console.log(`  ${openBrowse ? 'open' : 'fenced'} ${stage}: ${got.join(' → ')}`);
      assert.deepEqual(got, want, `${stage} (openBrowse ${openBrowse}) draws the wrong scenes or order`);
    }
  }
  // The table is the source of the order, not the couple's seed display_order.
  assert.deepEqual(STAGE_SCENES.rsvp.slice(0, 3), ['countdown', 'special_message', 'our_love_story']);
});

test('1 · the Save the Date: the film shows the gallery when it plays; otherwise the gallery scene does', () => {
  const withFilm = resolveSiteBodyPlan({
    identity: 'anonymous', phasesEnabled: true, lifecyclePhase: 'save_the_date', stdFilm: true, isSample: false,
    hasHeroMedia: false, hasBgMusic: false, liveMediaPublic: false, widgets, openBrowse: false, content: {},
  });
  assert.equal(withFilm.body, 'save_the_date');
  assert.deepEqual(withFilm.publicSafeWidgets.map((w) => w.widget_type), CANVAS_TABLE.save_the_date);
  // No film on this event type (the film is wedding-signature) → the gallery scene leads.
  const noFilm = resolveSiteBodyPlan({
    identity: 'anonymous', phasesEnabled: true, lifecyclePhase: 'save_the_date', stdFilm: false, isSample: false,
    hasHeroMedia: false, hasBgMusic: false, liveMediaPublic: false, widgets, openBrowse: false, content: {},
    weddingOnlyParts: { save_the_date_film: false },
  });
  assert.equal(noFilm.body, 'normal');
  assert.deepEqual(noFilm.publicSafeWidgets.map((w) => w.widget_type), ['our_photos', ...CANVAS_TABLE.save_the_date]);
});

test('1 · the entourage is on the Invitation, the Day and Post Event — never the Save the Date', () => {
  assert.ok(!keys('save_the_date').includes('f:entourage'));
  for (const s of ['rsvp', 'event', 'editorial'] as LifecyclePhase[]) assert.ok(keys(s).includes('f:entourage'), s);
  assert.equal(stageShowsEntourage('save_the_date'), false);
  const BODY = stripComments(readFileSync(join(__dirname, '..', 'app/[slug]/_components/site-body.tsx'), 'utf8'));
  const mounts = BODY.match(/<EntourageSection[\s/>]/g) ?? [];
  const gated = BODY.match(/stageShowsEntourage\(pageStage\) \? <EntourageSection/g) ?? [];
  assert.equal(gated.length, mounts.length, 'every entourage mount asks the stage');
});

test('2 · "Two ways to celebrate" is on NO stage — Post Event included, open browsing too', () => {
  assert.deepEqual(WIDGET_PHASES.tier_comparison, []);
  for (const openBrowse of [false, true]) {
    for (const stage of ['save_the_date', 'rsvp', 'event', 'editorial'] as LifecyclePhase[]) {
      assert.ok(!scenes(stage, { openBrowse }).includes('tier_comparison'), `${stage}: the pitch is back`);
    }
  }
});

test('+ one source: every hideable scene’s stages are DERIVED from STAGE_SCENES', () => {
  for (const t of ALL.filter((x) => !ALWAYS.has(x))) {
    const fromTable = (Object.keys(STAGE_SCENES) as LifecyclePhase[]).filter((s) => STAGE_SCENES[s].includes(t));
    assert.deepEqual(WIDGET_PHASES[t], fromTable, `${t}: WIDGET_PHASES disagrees with the table`);
  }
});

/* ── The Event Bars ────────────────────────────────────────────────────── */

const bar = (stage: LifecyclePhase, over: Partial<Parameters<typeof resolveSiteNav>[0]> = {}) =>
  resolveSiteNav({
    viewer: { kind: 'guest' },
    phase: stage === 'event' ? navPhaseFor({ dayOfPhase: 'live', isRecapBody: false }) : stage === 'editorial' ? navPhaseFor({ dayOfPhase: 'post', isRecapBody: true }) : navPhaseFor({ dayOfPhase: 'inactive', isRecapBody: false }),
    hostAllowsCamera: true,
    anyChapterPublic: true,
    hasStory: true,
    hasDetails: true,
    hasSchedule: true,
    liveBroadcast: false,
    destinations: { camera: '/papic/guest?from=x', watch: '/x/hub', join: '/x/invite', rsvp: '/x/invite/reply' },
    stageSlots: STAGE_BAR[stage].slots,
    ...over,
  }).map((s) => s.label);

test('3 · the Invitation bar: Home · Details · Story · RSVP — and RSVP becomes Me once they answer', () => {
  assert.deepEqual(bar('rsvp', { replied: false }), ['Home', 'Details', 'Story', 'RSVP']);
  assert.deepEqual(bar('rsvp', { replied: true }), ['Home', 'Details', 'Story', 'Me']);
  // A stranger: Home · Details · Story, no RSVP and no Me.
  assert.deepEqual(bar('rsvp', { viewer: { kind: 'public' } }), ['Home', 'Details', 'Story']);
  const BODY = stripComments(readFileSync(join(__dirname, '..', 'app/[slug]/_components/site-body.tsx'), 'utf8'));
  assert.match(BODY, /replied: Boolean\(guest\.rsvp_status\) && guest\.rsvp_status !== 'pending',/, 'the guest bar is told whether they answered');
});

test('4 · the On the Day bar: Now · Schedule · Camera · Gallery · Me', () => {
  assert.deepEqual(bar('event'), ['Now', 'Schedule', 'Camera', 'Gallery', 'Me']);
  // While a broadcast runs, Watch takes the Schedule's place (the bar holds five).
  assert.deepEqual(bar('event', { liveBroadcast: true }), ['Now', 'Watch', 'Camera', 'Gallery', 'Me']);
  // No schedule → no dead tab.
  assert.deepEqual(bar('event', { hasSchedule: false }), ['Now', 'Camera', 'Gallery', 'Me']);
});

test('5 · the Save the Date: no Camera tab — Home · Story, and Me for a key-holder', () => {
  const std = bar('save_the_date');
  assert.ok(!std.includes('Camera'), `the Save the Date offers a camera: ${std.join(' · ')}`);
  assert.deepEqual(std, ['Home', 'Story', 'Me']);
});

/* ── 6 · empty scenes ──────────────────────────────────────────────────── */

test('6 · an empty scene is on the Maker canvas (with its prompt) and absent for a guest', () => {
  const EMPTY = { ...FULL, content: { our_love_story: false, special_message: false } };
  for (const openBrowse of [false, true]) {
    const list = makerStageList({ ...EMPTY, openBrowse, stage: 'rsvp' });
    const story = list.shown.find((t) => t.kind === 'scene' && t.type === 'our_love_story');
    assert.ok(story && story.kind === 'scene' && story.empty, `the empty Love Story is not on the Maker canvas (openBrowse ${openBrowse})`);
  }
  // A guest's own page, open browsing: the plan drops the empty scene.
  const guest = resolveSiteBodyPlan({
    identity: 'guest', phasesEnabled: true, lifecyclePhase: 'rsvp', stdFilm: false, isSample: false,
    hasHeroMedia: false, hasBgMusic: false, liveMediaPublic: false, widgets, openBrowse: true, content: EMPTY.content,
  });
  assert.ok(!guest.hideableInOrder.some((w) => w.widget_type === 'our_love_story'), 'a guest was shown an empty Love Story');
});

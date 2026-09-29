/**
 * every-scene-drags-within-its-stage.test.ts — DECISION_LOG 2026-09-27,
 * "EVERY SCENE DRAGS WITHIN ITS STAGE (ORDER SAVED PER STAGE) · SAVE THE DATE:
 * THE COUPLE PICKS FILM OR PHOTOS". Owner, choosing between the two #6034
 * deviations: *"Drag any scene"* and *"Couple picks Film or Photos"*.
 *
 * Held here, each assertion seen to fail once:
 *   1. a BUILT-IN scene reorders, and guests see the order — live and through
 *      the draft (Save → Apply);
 *   2. each stage keeps its own order — a drag on one never moves another;
 *   3. Film · Photos switches what guests see on the Save the Date;
 *   4. the Maker lets every scene drag, sends the stage with every move, and
 *      the "order is fixed" note is gone; +0 server-action exports.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  STAGE_ORDER_KEY,
  STAGE_SCENES,
  configWithStageOrder,
  stagePlacesAfterMove,
  stageRowOrder,
  stdShows,
} from './stage-scenes';
import { widgetInPhase, isWidgetType, type InvitationWidgetRow, type LifecyclePhase, type WidgetType } from './invitation-widgets';
import { resolveSiteBodyPlan } from './site-body-plan';
import { makerStageList } from './maker-scene-list';
import { emptyHubDraft, mergeHubDraft, overlayHubDraftWidgets, planHubDraftApply, sanitizeHubDraft } from './hub-draft';
import { stripComments } from './strip-comments';

const ALWAYS = new Set<WidgetType>(['hero', 'greeting', 'qr_card', 'rsvp']);
const ALL: WidgetType[] = [
  'hero', 'greeting', 'qr_card', 'event_details', 'countdown', 'schedule', 'rsvp', 'venue_map',
  'dress_code', 'photo_moments', 'your_photos', 'tier_comparison', 'special_message',
  'what_to_bring', 'our_photos', 'our_love_story',
];
const base: InvitationWidgetRow[] = ALL.map((t, i) => ({
  widget_id: `id-${t}`, event_id: 'e1', widget_type: t, display_order: i + 1, is_visible: true,
  is_always_on: ALWAYS.has(t), tier: 'basic', config_json: {}, created_at: '', updated_at: '', mode: 'auto', audience: 'public',
}));
const inStage = (t: string, s: LifecyclePhase) => isWidgetType(t) && widgetInPhase(t, s);

/** What a guest (holding their key) is shown on `stage`, in order. */
const guestSees = (widgets: readonly InvitationWidgetRow[], stage: LifecyclePhase) =>
  resolveSiteBodyPlan({
    identity: 'guest', phasesEnabled: true, lifecyclePhase: stage, stdFilm: true, isSample: false,
    hasHeroMedia: false, hasBgMusic: false, liveMediaPublic: false, widgets, openBrowse: false, content: {},
  }).hideableInOrder.map((w) => w.widget_type);

/** One step of `moveWithinStage`, live: the places written onto each row's config_json. */
function moveLive(rows: InvitationWidgetRow[], stage: LifecyclePhase, type: WidgetType, dir: 'up' | 'down') {
  const ordered = stageRowOrder(rows, stage, inStage);
  const places = stagePlacesAfterMove(ordered, `id-${type}`, dir);
  assert.ok(places, `${type} could not move ${dir} on ${stage}`);
  const byId = new Map(places.map(({ row, place }) => [row.widget_id, place]));
  return rows.map((r) =>
    byId.has(r.widget_id) ? { ...r, config_json: configWithStageOrder(r.config_json, { [stage]: byId.get(r.widget_id)! }) } : r,
  );
}

test('1 · a BUILT-IN scene reorders on its stage, and guests see the order', () => {
  const before = guestSees(base, 'rsvp');
  assert.deepEqual(before.slice(0, 3), ['countdown', 'special_message', 'our_love_story'], 'the default is the table');
  // Drag the schedule up three: above details, Love Story and the message.
  let rows = base;
  for (let i = 0; i < 3; i += 1) rows = moveLive(rows, 'rsvp', 'schedule', 'up');
  const after = guestSees(rows, 'rsvp');
  console.log(`  Invitation after the drag: ${after.join(' → ')}`);
  assert.deepEqual(after.slice(0, 3), ['countdown', 'schedule', 'special_message']);
  // The anonymous page follows the same order (the Maker canvas is anonymous).
  const anon = resolveSiteBodyPlan({
    identity: 'anonymous', phasesEnabled: true, lifecyclePhase: 'rsvp', stdFilm: true, isSample: false,
    hasHeroMedia: false, hasBgMusic: false, liveMediaPublic: false, widgets: rows, openBrowse: true, content: {},
  }).publicSafeWidgets.map((w) => w.widget_type);
  assert.deepEqual(anon.slice(0, 2), ['countdown', 'schedule'], 'open browsing follows the couple too');
  // And the Maker's navigator lists it where the page draws it.
  const nav = makerStageList({
    stage: 'rsvp', widgets: rows, openBrowse: false, content: {}, solemn: false, hasHeroMedia: false,
    hasEntourage: false, storyRenders: false,
  }).shown.flatMap((t) => (t.kind === 'scene' ? [t.type] : []));
  assert.deepEqual(nav.slice(0, 2), ['countdown', 'schedule']);
});

test('1 · …through the DRAFT: the preview shows it, Apply writes it (never Pro), guests see it after', () => {
  const ordered = stageRowOrder(base, 'rsvp', inStage);
  const places = stagePlacesAfterMove(ordered, 'id-venue_map', 'up')!;
  const patch = { widgets: Object.fromEntries(places.map(({ row, place }) => [row.widget_type, { stage_order: { rsvp: place } }])) };
  const draft = mergeHubDraft(emptyHubDraft(), JSON.parse(JSON.stringify(patch)));
  // The couple's preview shows the venue above the schedule…
  const preview = guestSees(overlayHubDraftWidgets(base, draft), 'rsvp');
  assert.ok(preview.indexOf('venue_map') < preview.indexOf('schedule'), `the preview: ${preview.join(' → ')}`);
  // …while the live rows (what guests get) still read the default.
  const live = guestSees(base, 'rsvp');
  assert.ok(live.indexOf('schedule') < live.indexOf('venue_map'));
  // Apply: every stage place is a free item, written as the WHOLE merged key.
  const plan = planHubDraftApply(draft, { events: {}, widgets: base }, false);
  assert.equal(plan.refused.length, 0, 'arranging is never Pro');
  const items = plan.apply.filter((i): i is Extract<typeof i, { kind: 'widget' }> => i.kind === 'widget' && i.field === 'stage_order');
  assert.ok(items.length > 0, 'Apply writes the stage places');
  const applied = base.map((r) => {
    const it = items.find((i) => i.kind === 'widget' && i.widgetId === r.widget_id);
    return it ? { ...r, config_json: { ...(r.config_json as object), [STAGE_ORDER_KEY]: it.value } } : r;
  });
  const seen = guestSees(applied, 'rsvp');
  assert.ok(seen.indexOf('venue_map') < seen.indexOf('schedule'), `after Apply guests see the venue first: ${seen.join(' → ')}`);
  // The live Apply writes that key into config_json (hub-draft-actions.ts).
  const ACTIONS = stripComments(readFileSync(join(__dirname, '..', 'app/dashboard/[eventId]/website/hub-draft-actions.ts'), 'utf8'));
  assert.match(ACTIONS, /item\.field === 'stage_order'\s*\?\s*STAGE_ORDER_KEY/);
  assert.match(ACTIONS, /item\.field === 'std_lead'\s*\?\s*STD_LEAD_KEY/);
});

test('2 · each stage keeps its OWN order — a drag on one never moves another', () => {
  // The schedule and the venue are on BOTH the Invitation and the Day, so a drag
  // on either stage rewrites their rows — the other stage's place must survive.
  const dayBefore = guestSees(base, 'event');
  let rows = moveLive(base, 'rsvp', 'venue_map', 'up');
  let invite = guestSees(rows, 'rsvp');
  assert.ok(invite.indexOf('venue_map') < invite.indexOf('schedule'), 'the Invitation drag did not land');
  assert.deepEqual(guestSees(rows, 'event'), dayBefore, 'the Invitation drag moved On the Day');
  // Now the day: the camera cues above the venue — every Day row is re-placed.
  rows = moveLive(rows, 'event', 'photo_moments', 'up');
  assert.deepEqual(guestSees(rows, 'event').slice(0, 3), ['schedule', 'photo_moments', 'venue_map']);
  // …and the Invitation still has its own.
  invite = guestSees(rows, 'rsvp');
  assert.ok(invite.indexOf('venue_map') < invite.indexOf('schedule'), `the day's drag moved the Invitation: ${invite.join(' → ')}`);
  // In the DRAFT, places merge stage by stage: a second stage's drag keeps the first.
  const d1 = mergeHubDraft(emptyHubDraft(), { widgets: { venue_map: { stage_order: { rsvp: 4 } } } });
  const d2 = mergeHubDraft(d1, { widgets: { venue_map: { stage_order: { event: 0 } } } });
  assert.deepEqual(d2.widgets.venue_map?.stage_order, { rsvp: 4, event: 0 });
  // A stage nobody dragged reads the table.
  assert.deepEqual(guestSees(base, 'event'), [...STAGE_SCENES.event]);
  // A scene with no saved place (added after the couple arranged) goes AFTER
  // the placed ones — the placed order is never interleaved with the default.
  const partly = base.map((r) =>
    r.widget_type === 'what_to_bring' ? { ...r, config_json: { stage_order: { rsvp: 0 } } }
    : r.widget_type === 'dress_code' ? { ...r, config_json: { stage_order: { rsvp: 1 } } }
    : r,
  );
  assert.deepEqual(guestSees(partly, 'rsvp').slice(0, 3), ['what_to_bring', 'dress_code', 'countdown']);
});

test('3 · Film · Photos switches what guests see on the Save the Date', () => {
  const withLead = (lead: 'film' | 'photos' | null) =>
    base.map((r) => (r.widget_type === 'our_photos' && lead ? { ...r, config_json: { std_lead: lead } } : r));
  const std = (rows: InvitationWidgetRow[], parts?: { save_the_date_film: boolean }) =>
    resolveSiteBodyPlan({
      identity: 'guest', phasesEnabled: true, lifecyclePhase: 'save_the_date', stdFilm: true, isSample: false,
      hasHeroMedia: false, hasBgMusic: true, liveMediaPublic: false, widgets: rows, openBrowse: false, content: {},
      ...(parts ? { weddingOnlyParts: parts } : {}),
    });
  // Default: the film where this kind of event has one.
  const film = std(withLead(null));
  assert.equal(film.body, 'save_the_date');
  assert.ok(!film.hideableInOrder.some((w) => w.widget_type === 'our_photos'), 'the film carries the gallery');
  assert.equal(std(withLead('film')).body, 'save_the_date');
  // Photos: no film — the gallery leads the Save the Date.
  const photos = std(withLead('photos'));
  assert.equal(photos.body, 'normal');
  assert.equal(photos.fullBleed, false);
  assert.equal(photos.hideableInOrder[0]?.widget_type, 'our_photos');
  assert.equal(photos.stdViewBeacon, true, 'still a Save the Date view');
  assert.equal(photos.backgroundMusic, true, 'no film owns the audio');
  // A type with no film shows the photos whatever is stored.
  assert.equal(std(withLead('film'), { save_the_date_film: false }).body, 'normal');
  assert.equal(stdShows(null, false), 'photos');
  assert.equal(stdShows(null, true), 'film');
  // The Maker draws what guests see: the film tile, or the gallery first.
  const tiles = (rows: InvitationWidgetRow[]) =>
    makerStageList({ stage: 'save_the_date', widgets: rows, openBrowse: false, content: {}, solemn: false, hasHeroMedia: false, hasEntourage: true, storyRenders: false }).shown.map((t) => t.key);
  assert.equal(tiles(withLead('film'))[0], 'f:film');
  assert.deepEqual(tiles(withLead('photos')).slice(0, 2), ['f:hero', 'w:our_photos']);
  // Through the draft: the pick is kept on the gallery's row only, and is free.
  const draft = sanitizeHubDraft({ v: 1, events: {}, widgets: { our_photos: { std_lead: 'photos' }, countdown: { std_lead: 'photos' } }, history: [] });
  assert.equal(draft.widgets.our_photos?.std_lead, 'photos');
  assert.equal(draft.widgets.countdown, undefined, 'the pick has one home');
  assert.equal(std(overlayHubDraftWidgets(base, draft)).body, 'normal', 'the preview shows the pick');
  const plan = planHubDraftApply(draft, { events: {}, widgets: base }, false);
  assert.deepEqual(plan.apply.map((i) => (i.kind === 'widget' ? `${i.widgetType}.${i.field}=${String(i.value)}` : '')), ['our_photos.std_lead=photos']);
});

test('4 · SOURCE: every scene drags, each move names its stage, no "order is fixed" note, +0 exports', () => {
  const SHELL = stripComments(
    readFileSync(join(__dirname, '..', 'app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx'), 'utf8'),
  );
  assert.match(SHELL, /const canDrag = tile\.kind === 'scene' && !pending;/, 'a built-in scene must drag');
  assert.doesNotMatch(SHELL, /orderIsAutomatic|isCustomSectionType/);
  assert.doesNotMatch(SHELL, /Order set for you|order its job needs/);
  assert.match(SHELL, /<input type="hidden" name="stage" value=\{stage\} readOnly \/>/, 'the move form names the stage');
  /* An optimistic drop (`lib/maker-reorder.ts`) counts in the order it just showed — still THIS stage's. */
  assert.match(SHELL, /const fullOrder = (?:override \?\? )?fullOrders\[stage\];/, 'a drop is counted in the STAGE’s list');
  assert.match(SHELL, /aria-label="What opens your Save the Date"/);
  assert.match(SHELL, /\{ widgets: \{ our_photos: \{ std_lead: next \} \} \}/, 'the switch saves through the draft');
  const ACTIONS = stripComments(readFileSync(join(__dirname, '..', 'app/dashboard/[eventId]/website/widgets/actions.ts'), 'utf8'));
  assert.match(ACTIONS, /return moveWithinStage\(formData, supabase, eventId, widgetId, stageRaw as LifecyclePhase, direction\);/);
  const exportsIn = (src: string) => (src.match(/^export async function /gm) ?? []).length;
  assert.equal(exportsIn(ACTIONS), 9, 'no new server action');
});

/**
 * the-navigator-follows-the-page.test.ts — owner 2026-09-25, verbatim:
 * *"why does the slides not follow the sequence alotted"*.
 *
 * The Maker's navigator listed every hideable row in raw `display_order`, the
 * same twelve on every stage, while the canvas drew the page's own plan. This
 * holds the navigator to the plan:
 *   1. For each of the four stages, the navigator's scene tiles are EXACTLY
 *      `resolveSiteBodyPlan(...)`'s `publicSafeWidgets` (the canvas's list), in
 *      that order, minus only the sections the dispatcher draws as nothing.
 *   2. The whole list, fixed sections included, for a fixture shaped like the
 *      owner's own page on each stage.
 *   3. Nothing is lost: every hideable section is either shown or folded, with
 *      a reason, never both.
 *   4. A reorder moves the navigator exactly as it moves the plan, and a drop
 *      is counted in the FULL order the move actions swap in.
 *   5. Guest-facing words only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from './strip-comments';
import { resolveSiteBodyPlan } from './site-body-plan';
import { WELCOME_PART_SCENE, scenesLeftForDetails, welcomeParts } from './invitation-welcome';

/**
 * 🏠 THE PAGE'S OWN ORDER (owner 2026-09-30, `lib/invitation-welcome.ts`): the
 * Invitation's Welcome page draws its scene (Reminders) after the reply and
 * BEFORE Details, so the page is the Welcome scenes first, then the plan's list
 * without them — asked through the same helpers the page and the navigator use.
 */
function pageSceneOrder<T extends { widget_type: string }>(stage: LifecyclePhase, body: string, planned: readonly T[]): T[] {
  const welcome = welcomeParts({
    stage, bodyNormal: body === 'normal', scenes: planned.map((w) => w.widget_type),
    identified: false, reminders: null, giftHref: null, maker: true,
  });
  const first = welcome.flatMap((p) => {
    const t = WELCOME_PART_SCENE[p];
    const w = p === 'reminders' && t ? planned.find((x) => x.widget_type === t) : undefined;
    return w ? [w] : [];
  });
  return [...first, ...scenesLeftForDetails(planned, welcome)];
}
import {
  WIDGET_TYPES,
  type InvitationWidgetRow,
  type LifecyclePhase,
  type WidgetType,
} from './invitation-widgets';
import {
  makerStageList,
  makerStageLists,
  makerSceneLabel,
  swapsForDrop,
  widgetsGuestsMeet,
  MAKER_SCENE_LABEL,
  type MakerStageInput,
} from './maker-scene-list';

(globalThis as unknown as { React: unknown }).React = React;

const ALWAYS = new Set<WidgetType>(['hero', 'greeting', 'qr_card', 'rsvp']);
const OWNER_ORDER: WidgetType[] = [
  'hero', 'greeting', 'qr_card', 'event_details', 'countdown', 'schedule', 'rsvp', 'venue_map',
  'dress_code', 'photo_moments', 'your_photos', 'tier_comparison', 'special_message',
  'what_to_bring', 'our_photos', 'our_love_story',
];

function rows(order: WidgetType[], hidden: WidgetType[] = []): InvitationWidgetRow[] {
  return order.map((t, i) => ({
    widget_id: `id-${t}`,
    event_id: 'e1',
    widget_type: t,
    display_order: i + 1,
    is_visible: !hidden.includes(t),
    is_always_on: ALWAYS.has(t),
    tier: 'basic',
    config_json: {},
    created_at: '',
    updated_at: '',
    mode: 'auto',
    audience: 'public',
  }));
}

/** Shaped like the owner's own page (measured 2026-09-25): a date, a run of show,
 *  a venue pin, a dress code; no message, no gift note, no gallery, an empty love
 *  story; an entourage; open browsing OFF. */
const OWNER: Omit<MakerStageInput, 'stage'> = {
  widgets: rows(OWNER_ORDER),
  openBrowse: false,
  content: {
    schedule: true,
    venue_map: true,
    our_love_story: false,
    our_photos: false,
    special_message: false,
    what_to_bring: false,
    countdown: true,
  },
  solemn: false,
  hasHeroMedia: false,
  hasEntourage: true,
  storyRenders: false,
};

const STAGES: LifecyclePhase[] = ['save_the_date', 'rsvp', 'event', 'editorial'];

test('1 · for EVERY stage, the scene tiles are the plan’s own list, in the plan’s order', () => {
  for (const stage of STAGES) {
    const list = makerStageList({ ...OWNER, stage });
    const plan = resolveSiteBodyPlan({
      identity: 'anonymous',
      phasesEnabled: true,
      lifecyclePhase: stage,
      stdFilm: false,
      isSample: false,
      hasHeroMedia: false,
      hasBgMusic: false,
      liveMediaPublic: false,
      // The Maker's canvas: the scenes guests meet on this stage (no "Two ways
      // to celebrate" on the Invitation or the Day), content failing OPEN so
      // an empty scene keeps its place as a placeholder (owner 2026-09-27).
      widgets: widgetsGuestsMeet(OWNER.widgets, stage),
      openBrowse: false,
      content: {},
    });
    const tiles = list.shown.flatMap((t) => (t.kind === 'scene' ? [t.widgetId] : []));
    const planIds = pageSceneOrder(stage, plan.body, plan.publicSafeWidgets).map((w) => w.widget_id);
    // Same order: the tiles are a subsequence of the plan, never a reshuffle.
    let at = -1;
    for (const id of tiles) {
      const k = planIds.indexOf(id);
      assert.ok(k > at, `${stage}: ${id} is out of the plan's order (plan: ${planIds.join(' ')})`);
      at = k;
    }
    // And only the empty-drawn ones are dropped — each with a folded reason.
    const dropped = planIds.filter((id) => !tiles.includes(id));
    for (const id of dropped) {
      const f = list.folded.find((x) => x.widgetId === id);
      assert.ok(f && f.reason.length > 0, `${stage}: ${id} left the list without a reason`);
    }
    console.log(`  ${stage}: ${list.shown.map((t) => t.key).join(' → ')}`);
  }
});

test('2 · the owner’s page, stage by stage — fixed sections included, in the canvas’s order', () => {
  const keys = (stage: LifecyclePhase) => makerStageList({ ...OWNER, stage }).shown.map((t) => t.key);
  // Owner 2026-09-27: an EMPTY scene keeps its place in the Maker (drawn as a
  // placeholder — the message, gift note and love story below). And "EACH
  // STAGE DOES ONE JOB" (`lib/stage-scenes.ts`): each stage draws its own
  // scenes in its own order — the Save the Date holds the date, the
  // Invitation gets the reply, the Day is here-and-now, and "Two ways to
  // celebrate" is on no stage.
  assert.deepEqual(keys('save_the_date'), ['f:film', 'f:hero', 'w:countdown', 'w:our_love_story']);
  // …and each guest's own parts are drawn in place after the names, as "Your
  // guest" (owner 2026-09-27): the greeting, the pass, the RSVP — whichever the
  // page gives a guest on that stage.
  // 🏠 …then the Invitation's Welcome page (owner 2026-09-30): the guest's
  // look and E-Gifts. 🎒 What to bring is Details' since 2026-10-06 — after the
  // dress code, before the entourage.
  assert.deepEqual(keys('rsvp'), [
    'f:hero', 'f:greeting', 'f:pass', 'f:rsvp', 'f:look', 'f:gifts',
    'w:countdown', 'w:special_message', 'w:our_love_story', 'w:schedule', 'w:venue_map', 'w:dress_code', 'w:what_to_bring', 'f:entourage',
  ]);
  assert.deepEqual(keys('event'), ['f:hero', 'f:pass', 'w:schedule', 'w:venue_map', 'w:photo_moments', 'f:entourage']);
  assert.deepEqual(keys('editorial'), [
    'f:editorial', 'f:hero', 'w:our_love_story', 'w:our_photos', 'w:special_message', 'f:entourage',
  ]);
  const empties = (stage: LifecyclePhase) =>
    makerStageList({ ...OWNER, stage }).shown.flatMap((t) => (t.kind === 'scene' && t.empty ? [t.type] : []));
  assert.deepEqual(empties('rsvp'), ['special_message', 'our_love_story', 'what_to_bring']);
});

test('2b · the navigator is NOT the same twelve on every stage', () => {
  const all = makerStageLists(OWNER);
  const sigs = new Set(STAGES.map((s) => all[s].shown.map((t) => t.key).join(',')));
  assert.equal(sigs.size, 4, 'each stage draws a different page, so each list differs');
});

test('3 · nothing is lost — every hideable section is shown XOR folded, and a fold says why', () => {
  for (const stage of STAGES) {
    const list = makerStageList({ ...OWNER, stage });
    const shown = new Set(list.shown.flatMap((t) => (t.kind === 'scene' ? [t.widgetId] : [])));
    for (const w of OWNER.widgets.filter((x) => !x.is_always_on)) {
      // "Two ways to celebrate" is on no stage at all — guests never meet it,
      // so the Maker omits it (owner 2026-09-27, "EACH STAGE DOES ONE JOB").
      if (w.widget_type === 'tier_comparison') {
        assert.ok(!shown.has(w.widget_id) && !list.folded.some((f) => f.widgetId === w.widget_id), `${stage}: tier_comparison must be omitted`);
        continue;
      }
      const folded = list.folded.filter((f) => f.widgetId === w.widget_id);
      assert.equal(shown.has(w.widget_id) ? 0 : 1, folded.length, `${stage}: ${w.widget_type} must be shown or folded, once`);
      if (folded[0]) assert.ok(folded[0].reason.length > 8, `${stage}: ${w.widget_type} folded with no reason`);
    }
  }
  const rsvp = makerStageList({ ...OWNER, stage: 'rsvp' });
  const why = (t: WidgetType) => rsvp.folded.find((f) => f.type === t)?.reason ?? '';
  // An empty scene is no longer folded — it is SHOWN, with its prompt (owner 2026-09-27).
  assert.equal(why('special_message'), '');
  const message = rsvp.shown.find((t) => t.kind === 'scene' && t.type === 'special_message');
  assert.match(message && message.kind === 'scene' ? (message.empty ?? '') : '', /write your message/i);
  assert.match(why('event_details'), /own link/);
  assert.match(why('your_photos'), /own link|Not part of this stage/);
  // The RSVP is drawn in place in the Maker now, with "Open RSVP editor" (owner 2026-09-27).
  assert.equal(why('rsvp'), '');
  assert.ok(rsvp.shown.some((t) => t.key === 'f:rsvp'));
});

test('3b · a section the couple hid is folded with the eye, not lost', () => {
  const list = makerStageList({ ...OWNER, widgets: rows(OWNER_ORDER, ['dress_code']), stage: 'rsvp' });
  assert.ok(!list.shown.some((t) => t.key === 'w:dress_code'));
  const f = list.folded.find((x) => x.type === 'dress_code');
  assert.ok(f?.hiddenByCouple, 'the fold must offer the eye back');
});

test('4 · a reorder moves the navigator exactly as it moves the page', () => {
  // Owner 2026-09-27, "EACH STAGE DOES ONE JOB": a stage keeps ITS scenes in
  // the order its job needs — the couple's display_order no longer moves them.
  // Only the couple's OWN scenes follow the couple's order, after the stage's.
  const moved: WidgetType[] = [...OWNER_ORDER, 'custom_2', 'custom_1'];
  // Venue before the run of show — the stage's order wins.
  moved.splice(moved.indexOf('venue_map'), 1);
  moved.splice(moved.indexOf('schedule'), 0, 'venue_map');
  const list = makerStageList({ ...OWNER, widgets: rows(moved), stage: 'rsvp' });
  const scenes = list.shown.flatMap((t) => (t.kind === 'scene' ? [t.type] : []));
  // (What to bring no longer leads — it is a Details scene since 2026-10-06, after the dress code.)
  assert.deepEqual(scenes.slice(3, 5), ['schedule', 'venue_map'], 'the stage keeps its own order');
  assert.deepEqual(scenes.filter((t) => t.startsWith('custom_')), ['custom_2', 'custom_1'], 'the couple’s own scenes keep theirs');
  // …and the page draws the same order (the navigator IS the plan).
  const plan = resolveSiteBodyPlan({
    identity: 'anonymous', phasesEnabled: true, lifecyclePhase: 'rsvp', stdFilm: false, isSample: false,
    hasHeroMedia: false, hasBgMusic: false, liveMediaPublic: false,
    widgets: widgetsGuestsMeet(rows(moved), 'rsvp'), openBrowse: false, content: {},
  });
  const drawn = pageSceneOrder('rsvp', plan.body, plan.publicSafeWidgets).map((w) => w.widget_type);
  assert.deepEqual(scenes, drawn.filter((t) => scenes.includes(t)));
});

test('4b · a drop is counted in the FULL order the move actions swap in', () => {
  const full = ['a', 'hidden1', 'b', 'hidden2', 'c'];
  assert.equal(swapsForDrop(full, 'c', 'b'), -2, 'c before b crosses hidden2 AND b');
  assert.equal(swapsForDrop(full, 'a', 'c'), 3, 'a before c crosses hidden1, b, hidden2');
  assert.equal(swapsForDrop(full, 'a', null), 4, 'to the very end');
  assert.equal(swapsForDrop(full, 'b', 'b'), 0);
  assert.equal(swapsForDrop(full, 'zzz', 'a'), 0, 'an unknown row moves nothing');
});

test('4c · open browsing no longer orders by kind — every scene drags, and the navigator says nothing is fixed', () => {
  // Owner 2026-09-27, "EVERY SCENE DRAGS WITHIN ITS STAGE": the stage's order
  // (the couple's, else `STAGE_SCENES`) holds on both paths, so there is no
  // "order set for you" state left to announce.
  const list = makerStageList({ ...OWNER, openBrowse: true, stage: 'rsvp' });
  assert.ok(!('orderIsAutomatic' in list));
  const SHELL = stripComments(
    readFileSync(join(import.meta.dirname, '../app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx'), 'utf8'),
  );
  assert.doesNotMatch(SHELL, /Order set for you/);
});

test('5 · guest-facing words — no internal names in the navigator', () => {
  for (const t of WIDGET_TYPES) {
    const label = makerSceneLabel(t);
    assert.ok(label && label !== t, `${t} has no friendly label`);
    assert.doesNotMatch(label, /Setnayan account|explainer|_/i, `${t} reads like an internal name: ${label}`);
  }
  assert.equal(MAKER_SCENE_LABEL.tier_comparison, 'Two ways to celebrate');
  // The earlier owner rename stands (the-four-photo-names.test.ts): not undone here.
  assert.equal(makerSceneLabel('photo_moments'), 'Camera cues');
  assert.equal(makerSceneLabel('our_photos'), 'Photos you add');
  // "Spec…" was a one-line tile cutting "Special message" — the label wraps now.
  const SHELL = stripComments(
    readFileSync(join(import.meta.dirname, '../app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx'), 'utf8'),
  );
  assert.match(SHELL, /line-clamp-2 break-words pt-1 text-\[11px\]/, 'the tile label must wrap, not truncate');
});

test('6 · "Our story" is listed exactly when <OurStory> draws something', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const mod = await import('../app/[slug]/_components/our-story');
  const m = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const blobs: unknown[] = [
    {},
    null,
    { how_we_met: 'at a friend’s wedding' },
    { milestones: [{ year: '2019', title: 'First date' }] },
    { milestones: [{ year: '', title: '', note: '' }] },
  ];
  for (const b of blobs) {
    const drew = renderToStaticMarkup(React.createElement(m.OurStory, { loveStory: b, variant: 'full' })).length > 0;
    assert.equal(m.ourStoryRenders(b), drew, `ourStoryRenders disagrees with the render for ${JSON.stringify(b)}`);
  }
});

test('7 · SOURCE: the navigator draws the stage list, and the canvas carries the handles', () => {
  const SHELL = stripComments(
    readFileSync(join(import.meta.dirname, '../app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx'), 'utf8'),
  );
  /* The stage's own list, with a drop the server has not drawn yet laid over it (`optimisticStageList`). */
  assert.match(SHELL, /const list = (?:optimisticStageList\()?stageLists\[stage\](?:, override\))?;/, 'the navigator must read the stage’s own list');
  assert.match(SHELL, /\{list\.shown\.map\(\(tile, i\) =>/, 'tiles come from the stage list');
  assert.doesNotMatch(SHELL, /\{scenes\.map\(\(scene, i\) =>/, 'raw display_order tiles are gone');
  assert.match(SHELL, /move\(from, swapsForDrop\(fullOrder, from, tile\.widgetId\)\)/, 'a drop is counted in the full order');
  const BODY = stripComments(readFileSync(join(import.meta.dirname, '../app/[slug]/_components/site-body.tsx'), 'utf8'));
  assert.match(BODY, /isEditorCanvas && editorBridge \? <span hidden data-maker-section=\{key\} \/> : null/);
  assert.match(BODY, /\{makerMark\(`w:\$\{widget\.widget_type\}`\)\}/, 'every public section carries its handle');
  assert.equal(BODY.match(/makerMark\('f:hero'\)/g)?.length, 2, 'both mastheads carry the hero handle');
});

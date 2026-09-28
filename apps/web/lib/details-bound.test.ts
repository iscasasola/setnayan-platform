/**
 * details-bound.test.ts — DETAILS IS THE SOURCE; A SCENE EDIT ASKS
 * "EVERYWHERE OR JUST HERE" (owner 2026-09-25, DECISION_LOG).
 *
 * What this file proves, through the draft's own merge / overlay / Apply
 * functions and a real render of the Letter scene — not by restating them:
 *
 *   1. "Change it everywhere" writes Details (the draft's `special_message`)
 *      and EVERY bound scene shows it;
 *   2. "Just this scene" changes ONE scene; the other bound scene, and Details,
 *      do not move;
 *   3. "↺ Use Details" takes the scene's own version off and it shows Details;
 *   4. an override does not follow a later Details edit;
 *   5. the guest render honours both — the Letter scene rendered, and both
 *      guest dispatchers of the Special message scene read the one rule;
 *   6. nothing is live before Apply — the live rows never change, the guest
 *      (un-overlaid) render still shows the old words, and at Apply the words
 *      are written for a FREE couple (words are never a Pro look key);
 *   7. the Maker wiring: the Content tab mounts the field, and every answer is
 *      one draft save.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  DETAILS_FACT,
  DETAILS_OVERRIDE_MAX,
  detailsEditPatch,
  detailsFactOfScene,
  sanitizeDetailsOverrides,
  sceneBoundText,
  sceneBoundTextOf,
} from './details-bound';
import { hasHubCanvas, sanitizeHubCanvas, type HubSectionCanvas } from './hub-canvas';
import {
  HUB_DRAFT_EVENT_COLUMNS,
  HUB_DRAFT_TEXT_MAX,
  emptyHubDraft,
  mergeHubDraft,
  overlayHubDraftEvent,
  overlayHubDraftWidgets,
  planHubDraftApply,
  type HubDraft,
  type HubLiveState,
} from './hub-draft';
import { HUB_CANVAS_LOOK_KEYS } from './hub-look-pro';
import type { InvitationWidgetRow, WidgetType } from './invitation-widgets';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

function widget(type: string, config: unknown): InvitationWidgetRow {
  return {
    widget_id: `w-${type}`,
    event_id: 'e1',
    widget_type: type as WidgetType,
    display_order: 5,
    is_visible: true,
    is_always_on: false,
    tier: 'basic',
    config_json: config,
    created_at: '',
    updated_at: '',
    mode: 'auto',
  };
}

const DETAILS_OLD = 'Thank you for being part of our story.';
const LETTER = { canvas: { template: 11 } };
const LIVE_EVENT = { event_id: 'e1', special_message: DETAILS_OLD } as Record<string, unknown>;
const LIVE_WIDGETS = [widget('special_message', {}), widget('custom_1', LETTER)];
const LIVE: HubLiveState = {
  events: { special_message: DETAILS_OLD },
  widgets: LIVE_WIDGETS,
};

/** What each bound scene shows the host (the draft laid over live). */
function shown(draft: HubDraft | null) {
  const ev = overlayHubDraftEvent(LIVE_EVENT, draft);
  const rows = overlayHubDraftWidgets(LIVE_WIDGETS, draft);
  const of = (t: string) => sanitizeHubCanvas(rows.find((r) => r.widget_type === t)!.config_json);
  return {
    details: ev.special_message as string | null,
    specialScene: sceneBoundText('message', of('special_message'), ev.special_message as string | null).text,
    letter: sceneBoundText('message', of('custom_1'), ev.special_message as string | null).text,
    canvasOf: of,
  };
}

/** The Maker's view of a scene's canvas — what the field builds its patch on. */
const canvasNow = (draft: HubDraft, type: string): HubSectionCanvas => shown(draft).canvasOf(type);

/* ── 0 · the contract ──────────────────────────────────────────────────── */

test('the override is words: stored in the canvas, sanitized, never a Pro look key, never a frame', () => {
  assert.deepEqual(sanitizeDetailsOverrides({ message: '  Hi all \r\n ', names: 'x', evil: 'y' }), { message: 'Hi all' });
  assert.equal(sanitizeDetailsOverrides({ message: '   ' }), null, 'a blank is not an override');
  assert.equal(sanitizeDetailsOverrides({ message: 'x'.repeat(DETAILS_OVERRIDE_MAX + 1) }), null, 'over the cap is dropped');
  assert.equal(sanitizeDetailsOverrides({ message: 42 }), null);
  assert.deepEqual(sanitizeHubCanvas({ canvas: { details: { message: 'Ours' } } }).details, { message: 'Ours' });
  assert.equal(hasHubCanvas({ details: { message: 'Ours' } }), false, 'an override alone brings no frame and no motion');
  assert.ok(!(HUB_CANVAS_LOOK_KEYS as readonly string[]).includes('details'), 'words are never a Pro look key');
  assert.equal(DETAILS_OVERRIDE_MAX, HUB_DRAFT_TEXT_MAX, 'the override holds to the Details writer’s own cap');
  assert.ok((HUB_DRAFT_EVENT_COLUMNS as readonly string[]).includes(DETAILS_FACT.message.column), 'Details’ value is drafted');
});

test('which scenes are bound: the Special message scene and a Letter — nothing else', () => {
  assert.equal(detailsFactOfScene('special_message', {}), 'message');
  assert.equal(detailsFactOfScene('custom_1', { template: 11 }), 'message');
  assert.equal(detailsFactOfScene('custom_1', { template: 10 }), null, 'a Title card shows names, which Details does not own');
  assert.equal(detailsFactOfScene('custom_2', {}), null);
  assert.equal(detailsFactOfScene('what_to_bring', {}), null);
});

/* ── 1 · everywhere ────────────────────────────────────────────────────── */

test('"Change it everywhere" writes Details and EVERY bound scene follows', () => {
  const before = shown(null);
  assert.equal(before.specialScene, DETAILS_OLD);
  assert.equal(before.letter, DETAILS_OLD);

  const draft = mergeHubDraft(
    emptyHubDraft(),
    detailsEditPatch({ choice: 'everywhere', fact: 'message', text: 'See you at the altar!', widgetType: 'custom_1', canvas: canvasNow(emptyHubDraft(), 'custom_1') }),
  );
  const after = shown(draft);
  assert.equal(after.details, 'See you at the altar!', 'Details itself changed');
  assert.equal(after.specialScene, 'See you at the altar!');
  assert.equal(after.letter, 'See you at the altar!');
  assert.deepEqual(Object.keys(draft.widgets), [], 'a scene with no own version sends no canvas — no phantom scene change');
});

test('"Change it everywhere" from a scene that had its own version puts that scene back on Details', () => {
  let draft = mergeHubDraft(
    emptyHubDraft(),
    detailsEditPatch({ choice: 'here', fact: 'message', text: 'Only the letter', widgetType: 'custom_1', canvas: canvasNow(emptyHubDraft(), 'custom_1') }),
  );
  draft = mergeHubDraft(
    draft,
    detailsEditPatch({ choice: 'everywhere', fact: 'message', text: 'For everyone', widgetType: 'custom_1', canvas: canvasNow(draft, 'custom_1') }),
  );
  const s = shown(draft);
  assert.equal(s.letter, 'For everyone');
  assert.equal(s.specialScene, 'For everyone');
  assert.equal(s.canvasOf('custom_1').details, undefined);
  assert.equal(s.canvasOf('custom_1').template, 11, 'the scene’s own canvas rides along untouched');
});

/* ── 2 · just here ─────────────────────────────────────────────────────── */

test('"Just this scene" changes ONE scene — Details and the other scene do not move', () => {
  const draft = mergeHubDraft(
    emptyHubDraft(),
    detailsEditPatch({ choice: 'here', fact: 'message', text: 'Only in the letter', widgetType: 'custom_1', canvas: canvasNow(emptyHubDraft(), 'custom_1') }),
  );
  const s = shown(draft);
  assert.equal(s.letter, 'Only in the letter');
  assert.equal(s.specialScene, DETAILS_OLD, 'the other bound scene still shows Details');
  assert.equal(s.details, DETAILS_OLD, 'Details is untouched');
  assert.deepEqual(draft.events, {}, 'no Details write at all');
  assert.equal(sceneBoundText('message', s.canvasOf('custom_1'), s.details).overridden, true, 'the chip shows "Edited here"');
  assert.equal(sceneBoundText('message', s.canvasOf('special_message'), s.details).overridden, false);
});

test('an override does NOT follow a later Details edit', () => {
  let draft = mergeHubDraft(
    emptyHubDraft(),
    detailsEditPatch({ choice: 'here', fact: 'message', text: 'Letter words', widgetType: 'custom_1', canvas: canvasNow(emptyHubDraft(), 'custom_1') }),
  );
  // The Details page's own save (`updateSpecialMessage` through the draft door).
  draft = mergeHubDraft(draft, { events: { special_message: 'A new Details message' } });
  const s = shown(draft);
  assert.equal(s.specialScene, 'A new Details message');
  assert.equal(s.letter, 'Letter words');
});

/* ── 3 · ↺ Use Details ─────────────────────────────────────────────────── */

test('"↺ Use Details" takes the scene’s own version off and it shows Details again', () => {
  let draft = mergeHubDraft(
    emptyHubDraft(),
    detailsEditPatch({ choice: 'here', fact: 'message', text: 'Mine', widgetType: 'special_message', canvas: canvasNow(emptyHubDraft(), 'special_message') }),
  );
  assert.equal(shown(draft).specialScene, 'Mine');
  draft = mergeHubDraft(
    draft,
    detailsEditPatch({ choice: 'use-details', fact: 'message', text: '', widgetType: 'special_message', canvas: canvasNow(draft, 'special_message') }),
  );
  const s = shown(draft);
  assert.equal(s.specialScene, DETAILS_OLD);
  assert.equal(sceneBoundText('message', s.canvasOf('special_message'), s.details).overridden, false);
});

/* ── 4 · the guest render ──────────────────────────────────────────────── */

async function renderLetter(canvas: HubSectionCanvas, specialMessage: string | null, body = '') {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { renderScene, NO_SCENE_FACTS } = await import('../app/[slug]/_components/scene-template');
  const el = renderScene({ canvas, words: { title: '', body }, facts: { ...NO_SCENE_FACTS, specialMessage } });
  return el ? renderToStaticMarkup(el) : '';
}

test('the guest render honours both: a Letter shows its own version, else Details', async () => {
  assert.match(await renderLetter({ template: 11 }, DETAILS_OLD), /Thank you for being part of our story\./);
  const own = await renderLetter({ template: 11, details: { message: 'Only in the letter' } }, DETAILS_OLD);
  assert.match(own, /Only in the letter/);
  assert.doesNotMatch(own, /Thank you for being part/);
  // Words typed into the scene before binding existed still win — nothing a
  // couple wrote is silently replaced.
  assert.match(await renderLetter({ template: 11, details: { message: 'x' } }, DETAILS_OLD, 'Our own words'), /Our own words/);
});

test('both guest dispatchers draw the Special message scene through the ONE rule', () => {
  for (const f of ['app/[slug]/_components/hideable-widget-render.tsx', 'app/[slug]/_components/public-hideable-widget.tsx']) {
    const src = read(f);
    const arm = src.slice(src.indexOf("case 'special_message':"), src.indexOf("case 'what_to_bring':"));
    assert.match(
      arm,
      // The property is the TEXT's source; the scene's style (2026-09-29) rides
      // beside it as other props and changes nothing about which words are read.
      /<SpecialMessageWidget text=\{sceneBoundTextOf\('message', widget\.config_json, event\.special_message\)\.text\}[^>]*\/>/,
      `${f} reads the scene's own version before Details`,
    );
  }
  const body = read('app/[slug]/_components/site-body.tsx');
  assert.match(body, /special_message: Boolean\(\s*sceneBoundTextOf\(\s*'message',/, 'open browsing counts a scene’s own version as content');
  // The dispatchers' reader (straight from config_json — the frame owns the
  // canvas contract) agrees with the canvas rule on every shape.
  for (const config of [
    {},
    null,
    { canvas: { details: { message: 'Ours' } } },
    { details: { message: 'Flat' } },
    { canvas: { details: { message: '   ' } } },
    { canvas: { template: 11, details: { message: 'Letter own' } } },
  ]) {
    for (const d of ['Details words', null]) {
      assert.deepEqual(
        sceneBoundTextOf('message', config, d),
        sceneBoundText('message', sanitizeHubCanvas(config), d),
        `${JSON.stringify(config)} / ${d}`,
      );
    }
  }
});

/* ── 5 · nothing is live before Apply ──────────────────────────────────── */

test('nothing is live before Apply — and at Apply a FREE couple’s words are written', () => {
  const liveBefore = JSON.stringify({ LIVE_EVENT, LIVE_WIDGETS });
  let draft = mergeHubDraft(
    emptyHubDraft(),
    detailsEditPatch({ choice: 'everywhere', fact: 'message', text: 'Everywhere now', widgetType: 'special_message', canvas: canvasNow(emptyHubDraft(), 'special_message') }),
  );
  draft = mergeHubDraft(
    draft,
    detailsEditPatch({ choice: 'here', fact: 'message', text: 'Letter only', widgetType: 'custom_1', canvas: canvasNow(draft, 'custom_1') }),
  );
  assert.equal(JSON.stringify({ LIVE_EVENT, LIVE_WIDGETS }), liveBefore, 'the live rows are never touched by a draft save');
  // A guest's page is the live rows with NO draft laid over them.
  const guest = shown(null);
  assert.equal(guest.specialScene, DETAILS_OLD);
  assert.equal(guest.letter, DETAILS_OLD);

  const plan = planHubDraftApply(draft, LIVE, false);
  assert.equal(plan.refused.length, 0, 'words are never held for Pro');
  const cols = plan.apply.filter((i) => i.kind === 'event').map((i) => i.kind === 'event' && i.column);
  assert.deepEqual(cols, ['special_message']);
  const canv = plan.apply.find((i) => i.kind === 'widget' && i.field === 'canvas');
  assert.ok(canv && canv.kind === 'widget' && canv.widgetType === 'custom_1');
  assert.deepEqual((canv.value as HubSectionCanvas).details, { message: 'Letter only' });
});

/* ── 6 · the Maker wiring ──────────────────────────────────────────────── */

test('the scene’s Content tab is the field, and every answer is ONE draft save', () => {
  const shell = read('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');
  assert.match(shell, /tab === 'content' \? \(\s*contentBound \? \(\s*contentBound/, 'a bound scene’s Content is the field, first');
  assert.match(shell, /detailsFactOfScene\(selectedScene\.type, sceneCanvas\)/);
  assert.match(shell, /<DetailsBoundField[\s\S]{0,400}detailsValue=\{detailsBound\.values\[fact\]\}/);

  const field = read('app/dashboard/[eventId]/website/editor/_components/details-bound-field.tsx');
  assert.match(field, /Change it everywhere \(updates Details\)/);
  assert.match(field, /Just this scene/);
  assert.match(field, /Use Details/);
  assert.match(field, /fd\.set\('intent', 'save'\)/, 'a draft save, never a live write');
  assert.match(field, /detailsEditPatch\(\{ choice, fact, text, widgetType, canvas: latest\.current \}\)/);
  assert.doesNotMatch(field, /intent', 'apply'/);

  const page = read('app/dashboard/[eventId]/website/editor/page.tsx');
  assert.match(page, /detailsBound=\{\{\s*values: \{ message: \(drafted\.special_message/, 'Details’ value is read drafted over live');
  assert.match(page, /<MiniTour tourKey="customer_details_bound_v1"/, 'the first-visit tour is mounted');
});

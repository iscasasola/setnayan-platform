/**
 * no-background-drops-the-card.test.ts — 🖼 "NO BACKGROUND" TAKES THE WIDGET'S
 * OWN CARD OFF THE MAKER CANVAS, AND A BACKGROUND TAKEN OFF PUTS IT BACK.
 *
 * Owner, 2026-09-28, with a screenshot: Format → Background → "No background"
 * on the Countdown, and the canvas still showed the Countdown's semi-transparent
 * pink card (`<section data-scene-card="own" …>`). Measured: the draft was
 * right (`kind: 'none'`), the server render was right, and reloading the canvas
 * frame flipped that section to `data-scene-card="bare"`. The canvas HOLD
 * (`element-preview.ts`) had kept the page: the bridge lays the scene's FRAME
 * (`sceneBg`), but whether a widget draws its OWN card is decided server-side
 * (`lib/scene-ground.ts` `sceneWidgetIsBare`, read by both dispatchers), so no
 * bridge preview can remove the card — or bring it back.
 *
 * What this proves, through the server's own pipeline (the draft merged,
 * sanitized and laid over the live rows — what the Maker page hands the shell):
 *
 *   1. a pick that flips the widget's bare-ness (`backgroundPickRedrawsBox`,
 *      asked of the SAME `sceneWidgetIsBare` the dispatchers ask) makes the
 *      shell release the hold, so the save's render reloads the canvas — and
 *      the server's HTML for that render really does drop the card — and the
 *      countdown's four per-number tiles with it;
 *   2. a pick that does not flip it is held as before (the instant paint);
 *   3. the reverse: a background taken off entirely flips it back, and that
 *      pick reloads too, so the card comes back;
 *   4. a photo or snippet the Maker has no URL for is never guessed — reload;
 *   5. the wiring: the row decides with `backgroundPickRedrawsBox` and tells
 *      the shell on both the forward and the refused path; the shell releases
 *      on it and holds otherwise.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sanitizeHubCanvas, type HubSectionCanvas } from './hub-canvas';
import { emptyHubDraft, mergeHubDraft, overlayHubDraftWidgets, sanitizeHubDraft, type HubDraftPatch } from './hub-draft';
import { makerStageLists, type MakerStageInput } from './maker-scene-list';
import { withBackground } from './scene-background-scope';
import { sceneWidgetIsBare } from './scene-ground';
import type { InvitationWidgetRow, WidgetType } from './invitation-widgets';
import { stripComments } from './strip-comments';
import { HubCanvasFrame } from '../app/[slug]/_components/hub-canvas-frame';
import { CountdownWidget } from '../app/[slug]/_components/countdown';
import {
  NO_CANVAS_HOLD,
  backgroundPickRedrawsBox,
  canvasKeepsItsPage,
  canvasOrderOf,
  holdChange,
  type CanvasHold,
} from '../app/dashboard/[eventId]/website/editor/_components/element-preview';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/* ── THE SERVER'S OWN PIPELINE (as `a-maker-pick-never-reloads-what-it-drew.test.ts`) ── */

const ALWAYS = new Set<WidgetType>(['hero', 'greeting', 'qr_card', 'rsvp']);
const ORDER: WidgetType[] = ['hero', 'greeting', 'qr_card', 'event_details', 'countdown', 'schedule', 'rsvp', 'venue_map', 'dress_code'];
function liveRows(): InvitationWidgetRow[] {
  return ORDER.map((t, i) => ({
    widget_id: `id-${t}`,
    event_id: 'e1',
    widget_type: t,
    display_order: i + 1,
    is_visible: true,
    is_always_on: ALWAYS.has(t),
    tier: 'basic',
    config_json: {},
    created_at: '',
    updated_at: '',
    mode: 'auto',
    audience: 'public',
  })) as InvitationWidgetRow[];
}
const FACTS: Omit<MakerStageInput, 'stage' | 'widgets'> = {
  openBrowse: false,
  content: { schedule: true, venue_map: true, countdown: true, dress_code: true },
  solemn: false,
  hasHeroMedia: false,
  hasEntourage: true,
  storyRenders: false,
};
function render(patches: HubDraftPatch[]) {
  let draft = emptyHubDraft();
  for (const p of patches) draft = mergeHubDraft(draft, JSON.parse(JSON.stringify(p)) as HubDraftPatch);
  draft = sanitizeHubDraft(JSON.parse(JSON.stringify(draft)));
  const widgets = overlayHubDraftWidgets(liveRows(), draft);
  const canvases = Object.fromEntries(widgets.map((w) => [w.widget_type, sanitizeHubCanvas(w.config_json)])) as Record<string, HubSectionCanvas>;
  const order = canvasOrderOf(makerStageLists({ ...FACTS, widgets }));
  const countdown = widgets.find((w) => w.widget_type === 'countdown')!;
  return { canvases, order, countdown };
}

/** The Countdown exactly as a dispatcher mounts it — its `data-scene-card` is the pixel the owner saw. */
function cardOf(widget: InvitationWidgetRow, mediaUrls: Record<string, string> = {}): string {
  const bare = sceneWidgetIsBare(widget, mediaUrls);
  const props = { widget, mediaUrls } as React.ComponentProps<typeof HubCanvasFrame>;
  const html = renderToStaticMarkup(
    React.createElement(HubCanvasFrame, props, React.createElement(CountdownWidget, { targetIso: '2099-12-12', bare })),
  );
  const m = /data-scene-card="([a-z]+)"/.exec(html);
  assert.ok(m, 'anti-vacuity: the countdown did not render its section');
  return m[1] as string;
}

/**
 * Exactly the shell's decision (`<SceneBackgroundRow onSaving>`): a pick that
 * redraws the box releases; anything else is held.
 */
function shellHold(basis: ReturnType<typeof render>, before: Record<string, HubSectionCanvas>, touched: Record<string, HubSectionCanvas>, mediaUrls: Record<string, string>, now: number): CanvasHold {
  if (backgroundPickRedrawsBox(before, touched, mediaUrls)) return NO_CANVAS_HOLD;
  return holdChange(NO_CANVAS_HOLD, basis, { canvases: touched }, now);
}

const NOW = 1_000_000;
const NONE: Partial<HubSectionCanvas> = { kind: 'none' };
const PLAIN: Partial<HubSectionCanvas> = { kind: 'color', color: '#8a1c2b' };

/* ═══ 1 · "NO BACKGROUND" ON A SCENE WITH NO BACKGROUND AT ALL RELOADS — the card must go ═══ */

test('the owner’s pick: "No background" on the Countdown releases the hold, and the render it brings has no card', () => {
  const before = render([]);
  assert.equal(cardOf(before.countdown), 'own', 'anti-vacuity: the page as it always looked draws the Countdown’s own card');
  const next = withBackground(before.canvases.countdown ?? {}, NONE, false);
  const hold = shellHold(before, { countdown: before.canvases.countdown ?? {} }, { countdown: next }, {}, NOW);
  const after = render([{ widgets: { countdown: { canvas: next } } }]);
  assert.equal(cardOf(after.countdown), 'bare', 'the server drops the card — the canvas must show THAT');
  assert.equal(hold, NO_CANVAS_HOLD, 'the pick flips bare-ness: the shell must not hold');
  assert.equal(canvasKeepsItsPage(hold, after.canvases, NOW + 3_000, after.order), false, 'a kept page would still show the pink card');
});

/* ═══ 1b · THE PER-NUMBER TILES GO WITH THE CARD (DECISION_LOG 2026-09-27, "NO BACKGROUND" MEANS NO BOX) ═══ */

test('with "No background" the countdown’s per-number tiles go too — the numbers stand on their own', () => {
  /** Every element carrying a border in the Countdown's HTML — the card and each tile. */
  const bordered = (bare: boolean) =>
    (renderToStaticMarkup(React.createElement(CountdownWidget, { targetIso: '2099-12-12', bare })).match(/class="[^"]*\bborder\b[^"]*"/g) ?? []).length;
  assert.equal(bordered(false), 5, 'anti-vacuity: the card as it always looked — one card, four tiles');
  assert.equal(bordered(true), 0, 'No background: no card and no tile — no border anywhere');
});

/* ═══ 2 · A PICK THAT LEAVES THE BOX WITH THE SAME OWNER IS STILL INSTANT ═══ */

test('a pick that does not change who draws the box keeps the page — the instant paint stays', () => {
  const base = withBackground({}, PLAIN, false);
  const before = render([{ widgets: { countdown: { canvas: base } } }]);
  assert.equal(cardOf(before.countdown), 'bare');
  const kept: Array<[string, HubSectionCanvas]> = [
    ['Plain → Glow', withBackground(base, { kind: 'glow', color: '#8a1c2b' }, false)],
    ['Plain → another colour', withBackground(base, { kind: 'color', color: '#224466' }, false)],
    ['Plain → Frosted', withBackground(base, { kind: 'frost', color: '#f4ecdd', opacity: 40 }, false)],
    ['Plain → No background', withBackground(base, NONE, false)],
    ['Full width', sanitizeHubCanvas({ canvas: { ...base, shape: 'full' } })],
  ];
  for (const [name, next] of kept) {
    const hold = shellHold(before, { countdown: base }, { countdown: next }, {}, NOW);
    const after = render([{ widgets: { countdown: { canvas: next } } }]);
    assert.equal(cardOf(after.countdown), 'bare', `${name}: anti-vacuity — the server still draws no card`);
    assert.notEqual(hold, NO_CANVAS_HOLD, `${name}: the hold was released for a pick the bridge already drew`);
    assert.equal(canvasKeepsItsPage(hold, after.canvases, NOW + 3_000, after.order), true, `${name}: the canvas reloaded a page it already shows`);
  }
  // …and from "No background" to a colour: both are bare, so that too is held.
  const none = withBackground({}, NONE, false);
  const fromNone = render([{ widgets: { countdown: { canvas: none } } }]);
  const plain = withBackground(none, PLAIN, false);
  const hold = shellHold(fromNone, { countdown: none }, { countdown: plain }, {}, NOW);
  const after = render([{ widgets: { countdown: { canvas: plain } } }]);
  assert.equal(cardOf(after.countdown), 'bare');
  assert.equal(canvasKeepsItsPage(hold, after.canvases, NOW + 3_000, after.order), true, 'No background → Plain: nothing about the card changes');
});

/* ═══ 3 · THE REVERSE: A BACKGROUND TAKEN OFF ENTIRELY BRINGS THE CARD BACK ═══ */

test('the reverse: taking the background off entirely flips the card back on, so that pick reloads too', () => {
  const photo = { ref: 'r2://setnayan-media/one.jpg', url: 'https://media.example/one.jpg' };
  const urls = { [photo.ref]: photo.url };
  const starts: Array<[string, HubSectionCanvas]> = [
    ['Plain', withBackground({}, PLAIN, false)],
    ['No background', withBackground({}, NONE, false)],
    ['a photo', withBackground({}, { media: photo.ref }, false)],
  ];
  for (const [name, base] of starts) {
    const before = render([{ widgets: { countdown: { canvas: base } } }]);
    assert.equal(cardOf(before.countdown, urls), 'bare', `${name}: anti-vacuity — a painted or absent ground owns the box`);
    // `put({}, false)` — "Remove this scene’s photo" — and "Use the Event Hub’s" when the Hub has none.
    const off = withBackground(base, {}, false);
    const hold = shellHold(before, { countdown: base }, { countdown: off }, urls, NOW);
    const after = render([{ widgets: { countdown: { canvas: off } } }]);
    assert.equal(cardOf(after.countdown, urls), 'own', `${name}: the server draws the card again`);
    assert.equal(hold, NO_CANVAS_HOLD, `${name} → nothing: the card comes back, so the shell must not hold`);
    assert.equal(canvasKeepsItsPage(hold, after.canvases, NOW + 3_000, after.order), false, `${name}: a kept page would still show no card`);
  }
});

/* ═══ 4 · NEVER GUESS A PHOTO THE MAKER CANNOT RESOLVE ═══ */

test('a photo or snippet the Maker has no URL for is never guessed — that pick reloads', () => {
  const photo = withBackground({}, { media: 'r2://setnayan-media/unknown.jpg' }, false);
  assert.equal(backgroundPickRedrawsBox({ countdown: {} }, { countdown: photo }, {}), true, 'unknown after');
  assert.equal(backgroundPickRedrawsBox({ countdown: photo }, { countdown: withBackground(photo, PLAIN, false) }, {}), true, 'unknown before');
  // With the URL in hand the same pick is answered, not guessed: a photo behind is bare, like a colour.
  const urls = { 'r2://setnayan-media/unknown.jpg': 'https://media.example/x.jpg' };
  assert.equal(backgroundPickRedrawsBox({ countdown: photo }, { countdown: withBackground(photo, PLAIN, false) }, urls), false);
  // "Every scene" — one save of the stage — is decided over every scene it touches.
  const plain = withBackground({}, PLAIN, false);
  assert.equal(backgroundPickRedrawsBox({ schedule: plain, countdown: plain }, { schedule: plain, countdown: {} }, {}), true, 'one scene of the stage flips');
  assert.equal(backgroundPickRedrawsBox({ schedule: plain, countdown: plain }, { schedule: withBackground({}, NONE, false), countdown: plain }, {}), false);
});

/* ═══ 5 · THE WIRING ═══ */

test('the row decides with backgroundPickRedrawsBox and tells the shell both ways; the shell releases on it', () => {
  const row = read('app/dashboard/[eventId]/website/editor/_components/scene-background-row.tsx');
  const save = row.slice(row.indexOf('const save = ('), row.indexOf('const put = '));
  assert.match(save, /const redrawsBox = backgroundPickRedrawsBox\(before, touched, mediaUrls\);/, 'the row must ask the one function');
  assert.ok(save.indexOf('const redrawsBox') < save.indexOf('onSaving?.(touched, redrawsBox)'), 'decided before the shell is told');
  assert.match(save, /if \(!res\.ok\) \{[\s\S]*onSaving\?\.\(before, redrawsBox\);/, 'a refused save tells the shell the same answer');
  // The URLs the row hands it are the couple's own uploads — the same map the server reads.
  assert.match(row, /const mediaUrls: Record<string, string> = Object\.fromEntries\(\[\s*\.\.\.photoChoices\.map/);
  const shell = read('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');
  const bg = shell.slice(shell.indexOf('<SceneBackgroundRow'), shell.indexOf('/>', shell.indexOf('<SceneBackgroundRow')));
  assert.match(bg, /onSaving=\{\(canvases, redrawsBox\) => \{\s*if \(redrawsBox\) \{\s*releaseCanvas\(\);\s*return;\s*\}\s*canvasHold\.current = holdChange\(/);
  // The function asks the server's own answer, never a second rule.
  const preview = read('app/dashboard/[eventId]/website/editor/_components/element-preview.ts');
  const fn = preview.slice(preview.indexOf('export function backgroundPickRedrawsBox'), preview.indexOf('export function canvasesFingerprint'));
  assert.match(fn, /sceneWidgetIsBare\(\{ config_json: \{ canvas \} \}, mediaUrls\)/);
  assert.doesNotMatch(fn, /kind === 'none'/, 'no second rule about "none" — the server’s function decides');
});

/**
 * a-maker-pick-never-reloads-what-it-drew.test.ts — ⚡ A PICK THE BRIDGE HAS
 * ALREADY DRAWN NEVER RELOADS THE CANVAS.
 *
 * Owner, 2026-09-28, on the Event Hub Maker: *"picking something takes a lot
 * of time before the website reacts"*. Measured on production: every pick
 * except an element choice paid the save, a whole-Maker server render, and a
 * ~2 s reload of the canvas iframe (a full guest-page render), because the
 * canvas is keyed on `canvasStamp` and only an element choice held it.
 *
 * The canvas hold (`element-preview.ts`) now holds ANY change the bridge has
 * drawn — a part (`elStyle`), words (`words`), a scene's background (`sceneBg`)
 * and a scene taken off the page (`sceneShow`) — and compares BOTH halves of
 * what the canvas shows: every scene's canvas AND which scenes each stage
 * draws (`canvasOrderOf`). What this proves, through the server's own
 * pipeline (the draft merged, sanitized, laid over the live rows, and the
 * navigator's own stage lists — exactly what the Maker page hands the shell):
 *
 *   1. each kind of pick, held, keeps its page for the render its save brings
 *      — `canvasStamp` does not move (`canvasKeepsItsPage` → true);
 *   2. a render the canvas could NOT have shown still reloads it (another
 *      change, an Undo, a scene shown again, a lapsed hold);
 *   3. the wiring: each kind is held in the shell, every other write releases
 *      the hold, and the bridge lays `sceneShow`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sanitizeHubCanvas, type HubSectionCanvas } from './hub-canvas';
import { emptyHubDraft, mergeHubDraft, overlayHubDraftWidgets, sanitizeHubDraft, type HubDraftPatch } from './hub-draft';
import { makerStageLists, type MakerStageInput } from './maker-scene-list';
import { everySceneBackgroundPatch, withBackground } from './scene-background-scope';
import type { InvitationWidgetRow, WidgetType } from './invitation-widgets';
import { stripComments } from './strip-comments';
import {
  CANVAS_HOLD_MS,
  NO_CANVAS_HOLD,
  canvasKeepsItsPage,
  canvasOrderOf,
  holdCanvas,
  holdChange,
  orderWithout,
  sceneDrawEffect,
  type CanvasHold,
} from '../app/dashboard/[eventId]/website/editor/_components/element-preview';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/* ── THE SERVER'S OWN PIPELINE — what the Maker page hands the shell ── */

const ALWAYS = new Set<WidgetType>(['hero', 'greeting', 'qr_card', 'rsvp']);
const ORDER: WidgetType[] = [
  'hero', 'greeting', 'qr_card', 'event_details', 'countdown', 'schedule', 'rsvp', 'venue_map',
  'dress_code', 'photo_moments', 'special_message', 'what_to_bring', 'our_photos', 'our_love_story',
];
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
const FACTS = (openBrowse: boolean): Omit<MakerStageInput, 'stage' | 'widgets'> => ({
  openBrowse,
  content: { schedule: true, venue_map: true, special_message: true, what_to_bring: true, our_photos: true, countdown: true, dress_code: true, photo_moments: true },
  solemn: false,
  hasHeroMedia: false,
  hasEntourage: true,
  storyRenders: false,
});

/** A draft built from these saves, read back and laid over live — the page's `canvases` and stage lists. */
function render(patches: HubDraftPatch[], openBrowse = false) {
  let draft = emptyHubDraft();
  for (const p of patches) draft = mergeHubDraft(draft, JSON.parse(JSON.stringify(p)) as HubDraftPatch);
  draft = sanitizeHubDraft(JSON.parse(JSON.stringify(draft))); // the row as `readHubDraft` reads it
  const widgets = overlayHubDraftWidgets(liveRows(), draft);
  const canvases = Object.fromEntries(widgets.map((w) => [w.widget_type, sanitizeHubCanvas(w.config_json)]));
  const order = canvasOrderOf(makerStageLists({ ...FACTS(openBrowse), widgets }));
  return { canvases: canvases as Record<string, HubSectionCanvas>, order };
}

const NOW = 1_000_000;

/* ═══ 1 · EACH KIND OF PICK KEEPS ITS PAGE ═══════════════════════════════ */

test('a scene background — every choice — keeps the page for the render its save brings', () => {
  const before = render([]);
  const choices: Array<[string, Partial<HubSectionCanvas>]> = [
    ['Plain', { kind: 'color', color: '#8a1c2b' }],
    ['Diagonal', { kind: 'diagonal', color: '#a9834b' }],
    ['Glow', { kind: 'glow', color: '#a9834b' }],
    ['Opaque', { kind: 'glass', color: '#ffffff' }],
    ['Frosted', { kind: 'frost', color: '#f4ecdd', opacity: 40 }],
    ['No background', { kind: 'none' }],
  ];
  for (const [name, bg] of choices) {
    // What `SceneBackgroundRow.put` builds, and what it tells the shell (`onSaving`).
    const next = withBackground(before.canvases.schedule ?? {}, bg, false);
    const hold = holdChange(NO_CANVAS_HOLD, before, { canvases: { schedule: next } }, NOW);
    const after = render([{ widgets: { schedule: { canvas: next } } }]);
    assert.equal(canvasKeepsItsPage(hold, after.canvases, NOW + 3_000, after.order), true, `${name}: the canvas reloaded a page it already shows`);
  }
});

test('"Every scene" — one save of the whole stage — keeps the page too', () => {
  const before = render([]);
  const stage = (['schedule', 'venue_map', 'dress_code'] as const).map((type) => ({ type, canvas: before.canvases[type] ?? {} }));
  const patch = everySceneBackgroundPatch(stage, withBackground({}, { kind: 'glow', color: '#224466' }, false));
  const touched = Object.fromEntries(Object.entries(patch.widgets).map(([t, w]) => [t, w.canvas]));
  const hold = holdChange(NO_CANVAS_HOLD, before, { canvases: touched }, NOW);
  const after = render([patch as HubDraftPatch]);
  assert.equal(canvasKeepsItsPage(hold, after.canvases, NOW + 2_000, after.order), true);
});

test('a part (font · colour · size) keeps the page — the element hold, now carrying the scene order', () => {
  const before = render([]);
  const next: HubSectionCanvas = sanitizeHubCanvas({ canvas: { elements: { heading: { size: 130, color: '#112233' } } } });
  const hold = holdCanvas(NO_CANVAS_HOLD, before.canvases, 'special_message', next, NOW, before.order);
  const after = render([{ widgets: { special_message: { canvas: next } } }]);
  assert.equal(canvasKeepsItsPage(hold, after.canvases, NOW + 2_000, after.order), true);
});

test('a scene taken off the page — the eye, and Hidden — keeps the page, on EVERY stage it was drawn', () => {
  /* Exactly the shell's decision (`drawHow` → `sceneDrawEffect`), step by step,
     against the render each step brings: 'hide' → hidden by the bridge and held
     without it; 'none' → held as it is; anything else would reload. */
  type Gate = { mode: 'auto' | 'shown' | 'hidden'; isVisible: boolean };
  const step = (hold: CanvasHold, basis: ReturnType<typeof render>, key: string, before: Gate, after: Gate, openBrowse: boolean): CanvasHold | null => {
    const effect = sceneDrawEffect(before, after, openBrowse);
    if (effect === 'hide') return holdChange(hold, basis, { order: (o) => orderWithout(o, key) }, NOW);
    if (effect === 'none') return holdChange(hold, basis, {}, NOW);
    return null; // the shell releases: a reload
  };
  for (const openBrowse of [false, true]) {
    for (const type of ['schedule', 'venue_map', 'dress_code', 'special_message', 'what_to_bring'] as const) {
      const key = `w:${type}`;
      const before = render([], openBrowse);
      if (!before.order.includes(key)) continue;
      const auto: Gate = { mode: 'auto', isVisible: true };
      // The eye on an Auto scene: one write.
      const eyeHold = step(NO_CANVAS_HOLD, before, key, auto, { mode: 'auto', isVisible: false }, openBrowse);
      assert.ok(eyeHold, `${type}: taking a drawn scene off must be held, not reloaded`);
      const eyeAfter = render([{ widgets: { [type]: { is_visible: false } } } as HubDraftPatch], openBrowse);
      assert.ok(!eyeAfter.order.includes(key), `${type}: the server still draws it`);
      assert.equal(canvasKeepsItsPage(eyeHold, eyeAfter.canvases, NOW + 2_000, eyeAfter.order), true, `${type} eye (openBrowse ${openBrowse})`);
      // Hidden from Auto (the Arrange tab): with open browsing off the page ignores `mode`.
      const modeHold = step(NO_CANVAS_HOLD, before, key, auto, { mode: 'hidden', isVisible: true }, openBrowse);
      assert.ok(modeHold, `${type}: Hidden must be held either way`);
      const modeAfter = render([{ widgets: { [type]: { mode: 'hidden' } } } as HubDraftPatch], openBrowse);
      assert.equal(canvasKeepsItsPage(modeHold, modeAfter.canvases, NOW + 2_000, modeAfter.order), true, `${type} Hidden (openBrowse ${openBrowse})`);
      // The eye on a SHOWN scene is a two-step chain (Hidden, then the eye) — held through both renders.
      const shown = render([{ widgets: { [type]: { mode: 'shown' } } } as HubDraftPatch], openBrowse);
      const s1 = step(NO_CANVAS_HOLD, shown, key, { mode: 'shown', isVisible: true }, { mode: 'hidden', isVisible: true }, openBrowse)!;
      const r1 = render([{ widgets: { [type]: { mode: 'hidden' } } } as HubDraftPatch], openBrowse);
      assert.equal(canvasKeepsItsPage(s1, r1.canvases, NOW + 1_000, r1.order), true, `${type} chain step 1 (openBrowse ${openBrowse})`);
      const s2 = step(s1, r1, key, { mode: 'hidden', isVisible: true }, { mode: 'hidden', isVisible: false }, openBrowse)!;
      const r2 = render([{ widgets: { [type]: { mode: 'hidden', is_visible: false } } } as HubDraftPatch], openBrowse);
      assert.ok(!r2.order.includes(key));
      assert.equal(canvasKeepsItsPage(s2, r2.canvases, NOW + 2_000, r2.order), true, `${type} chain step 2 (openBrowse ${openBrowse})`);
    }
  }
  // Putting a scene BACK is never held — the page must draw what it never drew.
  assert.equal(sceneDrawEffect({ mode: 'auto', isVisible: false }, { mode: 'auto', isVisible: true }, false), 'show');
  assert.equal(sceneDrawEffect({ mode: 'hidden', isVisible: true }, { mode: 'auto', isVisible: true }, true), 'show');
  // Open browsing unread: never guessed — reload.
  assert.equal(sceneDrawEffect({ mode: 'auto', isVisible: true }, { mode: 'auto', isVisible: false }, undefined), 'unknown');
});

test('two quick picks of different kinds both count toward what the canvas shows', () => {
  const before = render([]);
  const bg = withBackground({}, { kind: 'color', color: '#335577' }, false);
  let hold = holdChange(NO_CANVAS_HOLD, before, { canvases: { venue_map: bg } }, NOW);
  hold = holdChange(hold, before, { order: (o) => orderWithout(o, 'w:dress_code') }, NOW + 200);
  const after = render([{ widgets: { venue_map: { canvas: bg } } }, { widgets: { dress_code: { is_visible: false } } } as HubDraftPatch]);
  assert.equal(canvasKeepsItsPage(hold, after.canvases, NOW + 2_000, after.order), true);
});

/* ═══ 2 · A RENDER THE CANVAS COULD NOT HAVE SHOWN STILL RELOADS IT ══════ */

test('the safety net: anything the bridge did not draw reloads the canvas', () => {
  const before = render([]);
  const bg = withBackground({}, { kind: 'color', color: '#8a1c2b' }, false);
  const held = holdChange(NO_CANVAS_HOLD, before, { canvases: { schedule: bg } }, NOW);
  // Undo took it back.
  assert.equal(canvasKeepsItsPage(held, before.canvases, NOW + 1_000, before.order), false);
  // Another scene changed too (another tab, a panel's form).
  const more = render([{ widgets: { schedule: { canvas: bg }, venue_map: { canvas: { zoom: 120 } } } }]);
  assert.equal(canvasKeepsItsPage(held, more.canvases, NOW + 1_000, more.order), false);
  // A scene was put BACK on the page, or moved — the order differs.
  const hidden = render([{ widgets: { dress_code: { is_visible: false } } } as HubDraftPatch]);
  const hideHold = holdChange(NO_CANVAS_HOLD, before, { order: (o) => orderWithout(o, 'w:dress_code') }, NOW);
  assert.equal(canvasKeepsItsPage(hideHold, before.canvases, NOW + 1_000, before.order), false, 'the hide was refused');
  const more2 = render([{ widgets: { dress_code: { is_visible: false }, what_to_bring: { is_visible: false } } } as HubDraftPatch]);
  assert.equal(canvasKeepsItsPage(hideHold, more2.canvases, NOW + 1_000, more2.order), false, 'another scene left the page too');
  assert.equal(canvasKeepsItsPage(hideHold, hidden.canvases, NOW + 1_000, hidden.order), true);
  // A render with no order at all cannot be matched against a hold that carries one.
  assert.equal(canvasKeepsItsPage(hideHold, hidden.canvases, NOW + 1_000), false);
  // The hold lapsed.
  assert.equal(canvasKeepsItsPage(hideHold, hidden.canvases, NOW + CANVAS_HOLD_MS, hidden.order), false);
  // No hold at all — every write the shell released.
  assert.equal(canvasKeepsItsPage(NO_CANVAS_HOLD, hidden.canvases, NOW, hidden.order), false);
});

/* ═══ 3 · THE WIRING ═════════════════════════════════════════════════════ */

const SHELL = read('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');

test('the shell holds every kind the bridge draws, and compares the scene order on every render', () => {
  assert.match(
    SHELL,
    /canvasKeepsItsPage\(canvasHold\.current, serverCanvasesRef\.current \?\? \{\}, Date\.now\(\), canvasOrderRef\.current\)/,
    'the render check must compare which scenes are drawn, not only their canvases',
  );
  // A scene background: laid, then HELD — released ONLY when the pick changes who
  // draws the box, which the bridge cannot paint (`no-background-drops-the-card.test.ts`).
  const bg = SHELL.slice(SHELL.indexOf('<SceneBackgroundRow'), SHELL.indexOf('/>', SHELL.indexOf('<SceneBackgroundRow')));
  assert.match(bg, /onSaving=\{\(canvases, redrawsBox\) => \{\s*if \(redrawsBox\) \{\s*releaseCanvas\(\);\s*return;\s*\}\s*canvasHold\.current = holdChange\(/);
  assert.equal((bg.match(/releaseCanvas\(\)/g) ?? []).length, 1, 'a background the bridge laid must not reload the canvas — only a box change may');
  // A scene taken off the page: hidden by the bridge, held without it.
  const hide = SHELL.slice(SHELL.indexOf('const hideOnCanvas = '), SHELL.indexOf('const post = ('));
  assert.match(hide, /t: 'sceneShow', key, shown: false/);
  assert.match(hide, /orderWithout\(o, key\)/);
  // Every eye / Hidden write is decided as the page reads it; everything else releases.
  const post = SHELL.slice(SHELL.indexOf('const drawHow = '), SHELL.indexOf('const eyeWrite = '));
  assert.match(post, /sceneDrawEffect\([\s\S]*sceneFormat\?\.openBrowse/, 'the decision reads open browsing, as the page does');
  assert.match(post, /if \(how\.hide\) hideOnCanvas\(how\.hide\);\s*else if \(how\.still\) \{[\s\S]*?\} else releaseCanvas\(\);/);
  const eye = SHELL.slice(SHELL.indexOf('const eyeWrite = '), SHELL.indexOf('const move = '));
  assert.equal((eye.match(/drawHow\(scene, /g) ?? []).length, 4, 'the eye (three branches) and Hidden all ask drawHow');
  const chainStep = SHELL.slice(SHELL.indexOf('const runChain = '), SHELL.indexOf("} else if (op === 'up' || op === 'down')"));
  assert.match(chainStep, /drawHow\(scene, \{ isVisible: want \}\)/);
  // A write the bridge did not draw releases the hold — forms and unheld saves alike.
  assert.match(SHELL, /window\.addEventListener\(MAKER_UNHELD_WRITE_EVENT, release\)/);
});

test('only saves the bridge drew are marked held; the shell announces every form', () => {
  const held = [
    'app/dashboard/[eventId]/website/editor/_components/element-sheet.tsx',
    'app/dashboard/[eventId]/website/editor/_components/scene-background-row.tsx',
    'app/dashboard/[eventId]/website/editor/_components/details-bound-field.tsx',
  ];
  // `{ held: true }`, or with more options beside it (the part sheet's `ok`, 2026-09-30).
  for (const f of held) assert.match(read(f), /makerSave\([\s\S]*?\{ held: true\b[^}]*\},?\s*\)/, `${f}: a drawn pick must be held`);
  for (const f of [
    'app/dashboard/[eventId]/website/editor/_components/scene-inspector.tsx',
    'app/dashboard/[eventId]/website/editor/_components/main-background-panel.tsx',
    'app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx',
    'app/dashboard/[eventId]/launch/_components/maker-reveal.tsx',
    'app/dashboard/[eventId]/launch/_components/maker-rsvp-ask.tsx',
  ]) {
    const src = read(f);
    assert.match(src, /makerSave\(/, `${f}: every Maker draft save goes through makerSave`);
    assert.doesNotMatch(src, /held: true/, `${f}: nothing here is drawn by the bridge — it must release the hold`);
  }
  const shell = read('app/dashboard/[eventId]/launch/_components/maker-shell.tsx');
  assert.match(shell, /form\.dataset\.makerHeld !== '1'\) \{\s*announceUnheldWrite\(\);/);
});

test('the bridge lays sceneShow on the section, and the background preview no longer asks for a reload', () => {
  const bridge = read('app/[slug]/_components/editor-bridge.tsx');
  const h = bridge.slice(bridge.indexOf("data.t === 'sceneShow'"), bridge.indexOf("data.t === 'playEl'"));
  assert.ok(h.length > 0, 'no sceneShow handler');
  assert.match(h, /el\.style\.display = \(data as \{ shown\?: unknown \}\)\.shown === false \? 'none' : ''/);
  const row = read('app/dashboard/[eventId]/website/editor/_components/scene-background-row.tsx');
  const save = row.slice(row.indexOf('const save = ('), row.indexOf('const put = '));
  assert.ok(save.indexOf('lay(touched)') < save.indexOf('onSaving?.(touched, redrawsBox)'), 'preview first, then hold');
  assert.ok(save.indexOf('onSaving?.(touched, redrawsBox)') < save.indexOf('makerSave('), 'the hold is set BEFORE the save is sent');
  assert.match(save, /if \(!res\.ok\) \{[\s\S]*lay\(before\);\s*onSaving\?\.\(before, redrawsBox\);/, 'a refused save puts the canvas and the hold back');
});

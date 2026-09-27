/**
 * 🖼 A SCENE'S BACKGROUND IS THE BOX (owner 2026-09-27 — DECISION_LOG "A SCENE'S
 * BACKGROUND EXISTS TO SEPARATE IT FROM THE NEXT" · "NO BACKGROUND MEANS NO
 * BOX…FRAMED OR FULL WIDTH" · "A SCENE IS AS TALL AS ITS CONTENT" · 2026-09-24
 * "BACKGROUND COLOUR IS FREE; A MEDIA BACKGROUND IS PRO").
 *
 * Rendered, not grepped where it can be: the real `HubCanvasFrame` around the
 * real `CountdownWidget`, through `sceneWidgetIsBare` exactly as both
 * dispatchers ask it.
 *
 *   1. "No background" → the Countdown has no border, no fill, no radius — its
 *      numbers stand on their own; the frame paints nothing.
 *   2. Frosted glass → backdrop blur, tinted with the scene's own colour (and
 *      opaque glass keeps that same colour).
 *   3. Full width → no radius and no inset margin — edge to edge.
 *   4. A legacy row with `media` and no `kind` is still a PHOTO.
 *   5. A hostile value is dropped, never stored or rendered.
 *   6. Free vs Pro: colour, both glasses, none and the shape are free; photo /
 *      snippet are Pro.
 *   7. A photo covers the scene in proportion and never sets its height.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from './strip-comments';
import {
  HUB_BACKGROUND_KINDS,
  hubBackgroundOwnsBox,
  hubCanvasClass,
  hubCanvasVars,
  resolveHubBackground,
  sanitizeHubCanvas,
} from './hub-canvas';
import { sectionBackgroundChange, HUB_CANVAS_LOOK_KEYS } from './hub-look-pro';
import { canvasLookChange } from './hub-draft';
import { HubCanvasFrame } from '../app/[slug]/_components/hub-canvas-frame';
import { sceneWidgetIsBare } from './scene-ground';
import { CountdownWidget } from '../app/[slug]/_components/countdown';
import type { InvitationWidgetRow } from './invitation-widgets';

// The components compile to classic JSX under the node runner (the repo's own pattern).
(globalThis as unknown as { React: unknown }).React = React;

const ROOT = join(__dirname, '..');
const CSS = readFileSync(join(ROOT, 'app/globals.css'), 'utf8');

function row(canvas: unknown): InvitationWidgetRow {
  return {
    widget_id: 'w1',
    widget_type: 'countdown',
    is_always_on: false,
    is_visible: true,
    display_order: 1,
    config_json: canvas === undefined ? {} : { canvas },
  } as unknown as InvitationWidgetRow;
}

/** The countdown exactly as a dispatcher mounts it, inside the frame. */
function paintCountdown(canvas: unknown, mediaUrls: Record<string, string> = {}): string {
  const w = row(canvas);
  const bare = sceneWidgetIsBare(w, mediaUrls);
  const props = { widget: w, mediaUrls } as React.ComponentProps<typeof HubCanvasFrame>;
  return renderToStaticMarkup(
    React.createElement(HubCanvasFrame, props, React.createElement(CountdownWidget, { targetIso: '2099-12-12', bare })),
  );
}

/** The class list of the element carrying `data-scene-card`. */
function cardClasses(html: string): string {
  const m = /<section data-scene-card="([a-z]+)" class="([^"]*)"/.exec(html);
  assert.ok(m, 'anti-vacuity: the countdown did not render its section');
  return m[2] as string;
}

/** A CSS rule's body, by exact selector. */
function rule(selector: string): string {
  const i = CSS.indexOf(`${selector} {`);
  assert.ok(i >= 0, `no CSS rule for ${selector}`);
  return CSS.slice(i, CSS.indexOf('}', i));
}

/* ── 1 · no background → no box ─────────────────────────────────────────── */

test('1 · "No background": the Countdown draws no border, no fill, no radius — numbers stand alone', () => {
  const html = paintCountdown({ kind: 'none' });
  const card = cardClasses(html);
  assert.doesNotMatch(card, /\bborder\b|\bbg-|\brounded/, `the countdown still draws its own box: "${card}"`);
  assert.match(html, /data-scene-card="bare"/);
  // …and its per-number tiles are gone too.
  assert.doesNotMatch(html, /rounded-lg border border-ink\/10 bg-paper/, 'the per-number tiles are still boxed');
  // The frame paints nothing: no ground class but "none", no colour, no shape.
  assert.match(html, /class="hub-canvas [^"]*hub-bg-none/);
  assert.doesNotMatch(html, /hub-shape-|--hub-bg-color|hub-canvas-media/);
  // The CSS for "none" removes any fill.
  assert.match(rule('.hub-bg-none'), /background:\s*none/);
});

test('1 · a scene that never chose a background keeps the widget’s own card (the page as it was)', () => {
  const html = paintCountdown(undefined);
  assert.match(cardClasses(html), /rounded-2xl border border-ink\/10 bg-veil\/40/);
  assert.doesNotMatch(html, /class="hub-canvas/, 'an untouched scene grew a frame');
});

test('1 · a painted background owns the box too — no card inside the frame', () => {
  const html = paintCountdown({ kind: 'color', color: '#f4e9dc' });
  assert.doesNotMatch(cardClasses(html), /\bborder\b|\bbg-|\brounded/, 'a box inside the painted box');
  assert.match(html, /hub-bg-color/);
});

/* ── 2 · frosted glass, tinted from the scene colour ─────────────────────── */

test('2 · Frosted glass renders a backdrop blur, tinted with the scene’s own colour', () => {
  const html = paintCountdown({ kind: 'frost', color: '#5c2542' });
  assert.match(html, /class="hub-canvas [^"]*hub-bg-frost/);
  assert.match(html, /--hub-bg-color:#5c2542/, 'the scene colour did not reach the glass');
  const frost = rule('.hub-bg-frost');
  assert.match(frost, /backdrop-filter:\s*blur\(/, 'frosted glass has no blur');
  /* The pane is painted from `--hub-glass-fill` — the scene colour at the
     opacity its words allow (`sceneTintGround`) — and falls back to the scene
     colour itself. Both must carry the colour. */
  assert.match(frost, /background-color:\s*var\(--hub-glass-fill,[^;]*var\(--hub-bg-color\)/, 'frosted glass is not tinted by the scene colour');
  assert.match(html, /--hub-glass-fill:rgb\(92 37 66 \/ 0\.\d\d\)/, 'the frosted pane did not receive its measured fill');
  // Opaque glass wears the SAME colour — "with or without effects".
  const glass = paintCountdown({ kind: 'glass', color: '#5c2542' });
  assert.match(glass, /hub-bg-glass/);
  assert.match(glass, /--hub-bg-color:#5c2542/);
  assert.match(glass, /--hub-glass-fill:rgb\(92 37 66 \/ (0\.\d\d|1\.00)\)/);
  assert.match(rule('.hub-bg-glass'), /background-color:\s*var\(--hub-glass-fill,\s*var\(--hub-bg-color\)\)/);
  // A glass chosen before any colour is a clear pane, never an empty value.
  assert.deepEqual(resolveHubBackground(sanitizeHubCanvas({ canvas: { kind: 'frost' } })), { kind: 'frost', color: '#ffffff' });
});

/* ── 3 · framed or full width ─────────────────────────────────────────────── */

test('3 · Full width has no radius and no inset margin; Framed is the default and is rounded', () => {
  const full = paintCountdown({ kind: 'color', color: '#f4e9dc', shape: 'full' });
  assert.match(full, /hub-shape-full/);
  assert.doesNotMatch(full, /hub-shape-framed/);
  const r = rule('.hub-shape-full');
  assert.match(r, /border-radius:\s*0/, 'full width is rounded');
  // Edge to edge: the margin only ever pulls OUT to the screen edge — never an inset.
  assert.match(r, /margin-inline:\s*calc\(50% - 50vw\)/, 'full width does not reach the screen edge');
  assert.doesNotMatch(r, /margin-inline:\s*(?!calc\(50% - 50vw\))[\d.]/, 'full width has an inset margin');
  // Framed — the default — is the one rounded surface, on the radius token.
  const framed = paintCountdown({ kind: 'color', color: '#f4e9dc' });
  assert.match(framed, /hub-shape-framed/);
  assert.match(rule('.hub-shape-framed'), /border-radius:\s*var\(--m-r-lg\)/);
  // "No background" has no box to shape — a stored shape is dropped with it.
  assert.equal(sanitizeHubCanvas({ canvas: { kind: 'none', shape: 'full' } }).shape, undefined);
});

/* ── 4 · legacy rows ─────────────────────────────────────────────────────── */

test('4 · a legacy row with media and no kind is still a PHOTO', () => {
  const ref = 'r2://setnayan-media/events/e1/gallery/photo.jpg';
  const canvas = sanitizeHubCanvas({ canvas: { media: ref } });
  assert.equal(canvas.kind, undefined, 'a kind was invented for a legacy row');
  assert.deepEqual(resolveHubBackground(canvas), { kind: 'photo', media: ref });
  const html = paintCountdown({ media: ref }, { [ref]: 'https://signed.example/photo.jpg' });
  assert.match(html, /hub-bg-photo/);
  assert.match(html, /--hub-media:url\(&quot;https:\/\/signed\.example\/photo\.jpg&quot;\)/);
});

/* ── 5 · hostile values ──────────────────────────────────────────────────── */

test('5 · a hostile value is dropped — never stored, never rendered', () => {
  const evil = sanitizeHubCanvas({
    canvas: {
      kind: 'frost',
      color: 'red;background:url(javascript:alert(1))',
      shape: 'full;position:fixed',
    },
  });
  assert.equal(evil.kind, 'frost');
  assert.equal(evil.color, undefined, 'a colour that is not six hex digits survived');
  assert.equal(evil.shape, undefined, 'a shape outside the closed set survived');
  assert.deepEqual(sanitizeHubCanvas({ canvas: { kind: 'lava', color: '#123456' } }), {}, 'a kind outside the set survived');
  assert.deepEqual(sanitizeHubCanvas({ canvas: { kind: 'none', media: 'r2://setnayan-thread-files/x' } }), { kind: 'none' }, 'a private-bucket ref rode in beside "none"');
  const html = paintCountdown({ kind: 'frost', color: 'red;background:url(javascript:alert(1))' });
  assert.doesNotMatch(html, /javascript|red;/, 'the hostile colour reached the page');
  assert.match(html, /--hub-bg-color:#ffffff/, 'a dropped colour must fall back to the clear pane');
  // Every class and property the frame emits comes from a closed set.
  for (const kind of HUB_BACKGROUND_KINDS) {
    const cls = hubCanvasClass(sanitizeHubCanvas({ canvas: { kind, color: '#abcdef', media: 'r2://setnayan-media/a.jpg', shape: 'full' } }), true);
    assert.doesNotMatch(cls, /[;:{}()]/, `${kind}: a class carries CSS text`);
  }
  const vars = hubCanvasVars(sanitizeHubCanvas({ canvas: { kind: 'glass', color: '#abcdef' } }));
  assert.equal(vars['--hub-bg-color'], '#abcdef');
});

/* ── 6 · free vs Pro ─────────────────────────────────────────────────────── */

test('6 · colour, both glasses, "none" and the shape are free; photo / snippet are Pro', () => {
  for (const kind of ['color', 'glass', 'frost', 'none'] as const) {
    assert.equal(sectionBackgroundChange({ currentMedia: null, kind, nextMedia: null }), 'none', `${kind} is gated`);
    assert.equal(sectionBackgroundChange({ currentMedia: 'r2://x', kind, nextMedia: null }), 'remove');
  }
  assert.equal(sectionBackgroundChange({ currentMedia: null, kind: 'photo', nextMedia: 'r2://p' }), 'add');
  assert.equal(sectionBackgroundChange({ currentMedia: null, kind: 'snippet', nextMedia: 'r2://v' }), 'add');
  for (const key of ['kind', 'color', 'shape']) {
    assert.ok(!(HUB_CANVAS_LOOK_KEYS as readonly string[]).includes(key), `${key} became a Pro look key`);
  }
  // APPLY — the gate a draft meets: swapping a photo for a glass takes media
  // down (free); colour ↔ glass ↔ frost ↔ none and the shape never gate.
  const photo = sanitizeHubCanvas({ canvas: { media: 'r2://setnayan-media/p.jpg' } });
  const glass = sanitizeHubCanvas({ canvas: { kind: 'glass', color: '#abcdef' } });
  const frostFull = sanitizeHubCanvas({ canvas: { kind: 'frost', color: '#abcdef', shape: 'full' } });
  const none = sanitizeHubCanvas({ canvas: { kind: 'none' } });
  assert.equal(canvasLookChange(photo, glass), 'remove');
  assert.equal(canvasLookChange(glass, frostFull), 'none', 'glass → frosted, full width was gated');
  assert.equal(canvasLookChange(frostFull, none), 'none');
  assert.equal(canvasLookChange(none, photo), 'add', 'putting a photo up must be Pro');
  // WRITE — the live action classifies every tinted kind (and none) as media-free.
  const writer = stripComments(readFileSync(join(ROOT, 'app/dashboard/[eventId]/website/widgets/actions.ts'), 'utf8'));
  assert.match(writer, /const tinted = kind === 'color' \|\| kind === 'glass' \|\| kind === 'frost' \|\| kind === 'none';/);
  assert.match(writer, /nextMedia: shapeOnly \|\| tinted \|\| wanted\.length === 0 \? null/);
});

/* ── 7 · the photo fills, the content sets the height ────────────────────── */

test('7 · a photo covers the scene in proportion and never sets its height', () => {
  const layer = rule('.hub-has-media > .hub-canvas-media');
  assert.match(layer, /position:\s*absolute/);
  assert.match(layer, /inset:\s*0/);
  assert.match(layer, /background-size:\s*cover/);
  for (const sel of ['.hub-canvas', '.hub-has-media', '.hub-shape-framed', '.hub-shape-full', '.hub-bg-frost', '.hub-bg-glass']) {
    const i = CSS.indexOf(`${sel} {`);
    if (i < 0) continue;
    assert.doesNotMatch(CSS.slice(i, CSS.indexOf('}', i)), /min-height|height:\s*100(vh|dvh|svh)/, `${sel} forces a height`);
  }
});

/* ── wiring: both dispatchers ask, the frame decides ─────────────────────── */

test('both dispatchers ask the frame whether the widget draws its own card', () => {
  for (const f of ['hideable-widget-render.tsx', 'public-hideable-widget.tsx']) {
    const src = stripComments(readFileSync(join(ROOT, 'app/[slug]/_components', f), 'utf8'));
    assert.match(src, /const bare = sceneWidgetIsBare\(widget, canvasMediaUrls\);/, `${f} does not ask`);
    assert.match(src, /<CountdownWidget[\s\S]*?bare=\{bare\}/, `${f}: the countdown is not told`);
  }
  assert.equal(hubBackgroundOwnsBox(sanitizeHubCanvas({ canvas: { kind: 'none' } }), false), true);
  assert.equal(hubBackgroundOwnsBox(sanitizeHubCanvas({}), false), false);
});

/**
 * a-scene-background-previews-instantly.test.ts — A BACKGROUND CHOICE IS ON THE
 * MAKER CANVAS BEFORE ITS SAVE, AND IT IS WHAT THE SERVER WILL DRAW.
 *
 * #6046 made element choices instant; background choices stayed save +
 * buffered reload (~3.5 s). The Keynote rebuild's Format → Background row now
 * posts a `sceneBg` message first (`scene-bg-preview-message.ts`, computed with
 * the server's own `hubCanvasClass` / `hubCanvasVars`) and the bridge lays it
 * (`app/[slug]/_components/scene-bg-preview.ts`). What this proves:
 *
 *   1. for every background choice — each colour kind, both ombrés, both
 *      glasses, a photo, No background, Framed / Full width — the frame the
 *      preview lays has EXACTLY the class list and `--hub-…` variables
 *      `HubCanvasFrame` renders for the same canvas;
 *   2. a scene with no frame yet is wrapped in one, as the server draws it;
 *   3. "Every scene" previews every scene the patch touches — this stage only;
 *   4. nothing in the message reaches CSS unchecked;
 *   5. the row posts the preview BEFORE it saves.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sanitizeHubCanvas, type HubSectionCanvas } from './hub-canvas';
import { everySceneBackgroundPatch } from './scene-background-scope';
import { HubCanvasFrame } from '../app/[slug]/_components/hub-canvas-frame';
import { applySceneBgPreview, sanitizeSceneBgPreview } from '../app/[slug]/_components/scene-bg-preview';
import { sceneBgPreview, sceneBgPreviewMessage } from '../app/dashboard/[eventId]/website/editor/_components/scene-bg-preview-message';
import { stripComments } from './strip-comments';
import { INVITE_THEMES } from './invite-themes';
import type { InvitationWidgetRow } from './invitation-widgets';

(globalThis as unknown as { React: unknown }).React = React;

const PHOTO = 'r2://setnayan-media/events/e/gallery/a.jpg';
const URL_OF: Record<string, string> = { [PHOTO]: 'https://example.test/a.jpg' };
const mediaUrl = (ref: string) => URL_OF[ref] ?? null;

/* ── a tiny DOM: exactly what `applySceneBgPreview` touches ── */
class El {
  className = '';
  children: El[] = [];
  parentNode: El | null = null;
  attrs: Record<string, string> = {};
  private props = new Map<string, string>();
  constructor(public tagName: string) {}
  classList = { contains: (c: string) => this.className.split(/\s+/).includes(c) };
  style = {
    get length() {
      return 0;
    },
    item: (i: number) => [...this.props.keys()][i]!,
    setProperty: (p: string, v: string) => void this.props.set(p, v),
    removeProperty: (p: string) => void this.props.delete(p),
  };
  get firstChild(): El | null {
    return this.children[0] ?? null;
  }
  vars() {
    return Object.fromEntries(this.props);
  }
  setAttribute(n: string, v: string) {
    this.attrs[n] = v;
  }
  removeAttribute(n: string) {
    delete this.attrs[n];
  }
  appendChild(c: El) {
    return this.insertBefore(c, null);
  }
  insertBefore(c: El, ref: El | null) {
    if (c.parentNode) c.parentNode.children.splice(c.parentNode.children.indexOf(c), 1);
    const i = ref ? this.children.indexOf(ref) : -1;
    if (i < 0) this.children.push(c);
    else this.children.splice(i, 0, c);
    c.parentNode = this;
    return c;
  }
  remove() {
    this.parentNode?.children.splice(this.parentNode.children.indexOf(this), 1);
    this.parentNode = null;
  }
}
// `style.length` must see the element's own map.
function el(tag: string): El {
  const e = new El(tag);
  Object.defineProperty(e.style, 'length', { get: () => (e as unknown as { props: Map<string, string> }).props.size });
  return e;
}
const doc = { createElement: (t: string) => el(t.toUpperCase()) } as unknown as Pick<Document, 'createElement'>;

/** The server's frame for a canvas: its class list and its WHOLE style (variables and ink). */
function server(canvas: Record<string, unknown>) {
  const widget = { widget_id: 'w', widget_type: 'message', is_visible: true, display_order: 1, config_json: { canvas } } as unknown as InvitationWidgetRow;
  const html = renderToStaticMarkup(
    React.createElement(HubCanvasFrame, { widget, mediaUrls: URL_OF } as never, React.createElement('section', null, 'Hi')),
  );
  const m = /^<div class="([^"]*)" style="([^"]*)"/.exec(html);
  assert.ok(m, `the server drew a frame: ${html.slice(0, 200)}`);
  const vars: Record<string, string> = {};
  for (const d of m[2]!.replace(/&quot;/g, '"').split(';')) {
    const i = d.indexOf(':');
    if (i > 0) vars[d.slice(0, i).trim()] = d.slice(i + 1).trim();
  }
  return { classes: m[1]!, vars, photoLayer: html.includes('class="hub-canvas-media"') };
}

/** Lay a preview on a bare scene (no frame yet) inside a parent. */
function lay(canvas: HubSectionCanvas) {
  const parent = el('MAIN');
  const scene = el('SECTION');
  parent.appendChild(scene);
  const msg = sanitizeSceneBgPreview([sceneBgPreview('message', canvas, mediaUrl, INVITE_THEMES.house)]);
  const frame = applySceneBgPreview(scene as unknown as HTMLElement, msg[0]!, doc) as unknown as El;
  return { parent, scene, frame };
}

const CHOICES: Array<[string, Record<string, unknown>]> = [
  ['Plain', { kind: 'color', color: '#8a1c2b' }],
  ['Diagonal', { kind: 'diagonal', color: '#a9834b' }],
  ['Glow', { kind: 'glow', color: '#a9834b' }],
  ['Opaque', { kind: 'glass', color: '#ffffff' }],
  ['Frosted', { kind: 'frost', color: '#f4ecdd', opacity: 40 }],
  ['A photo', { media: PHOTO, focal: 3, zoom: 120 }],
  ['No background', { kind: 'none' }],
  ['Full width', { kind: 'color', color: '#112233', shape: 'full' }],
];

test('every background choice previews as EXACTLY the frame the server draws', () => {
  for (const [name, raw] of CHOICES) {
    const want = server(raw);
    const { frame, scene } = lay(sanitizeHubCanvas({ canvas: raw }));
    assert.ok(frame, `${name}: a frame was laid`);
    assert.equal(frame.className, want.classes, `${name}: the classes differ from the server's`);
    assert.deepEqual(frame.vars(), want.vars, `${name}: the variables differ from the server's`);
    assert.equal(frame.children[frame.children.length - 1]!.className, 'hub-canvas-body', `${name}: the scene sits in the body`);
    assert.equal(scene.parentNode!.className, 'hub-canvas-body');
    const photo = frame.children.some((c) => c.className === 'hub-canvas-media');
    assert.equal(photo, want.photoLayer, `${name}: the photo layer`);
  }
});

test('re-laying a framed scene swaps its look and leaves nothing of the old one behind', () => {
  const { frame } = lay(sanitizeHubCanvas({ canvas: { media: PHOTO } }));
  const glow = sanitizeHubCanvas({ canvas: { kind: 'glow', color: '#a9834b' } });
  applySceneBgPreview(frame as unknown as HTMLElement, sanitizeSceneBgPreview([sceneBgPreview('message', glow, mediaUrl, INVITE_THEMES.house)])[0]!, doc);
  const want = server(glow as Record<string, unknown>);
  assert.equal(frame.className, want.classes);
  assert.deepEqual(frame.vars(), want.vars, 'the photo variable is gone');
  assert.ok(!frame.children.some((c) => c.className === 'hub-canvas-media'), 'the photo layer is gone');
});

test('"Every scene" previews every scene the patch touches — this stage only', () => {
  const stage = [
    { type: 'special_message', canvas: sanitizeHubCanvas({ canvas: { kind: 'frost', color: '#f4ecdd' } }) },
    { type: 'countdown', canvas: {} },
    { type: 'dress_code', canvas: sanitizeHubCanvas({ canvas: { kind: 'color', color: '#112233', own: true } }) },
  ];
  const patch = everySceneBackgroundPatch(stage, stage[0]!.canvas);
  const msg = sceneBgPreviewMessage(Object.entries(patch.widgets).map(([type, w]) => ({ type, canvas: w.canvas })), mediaUrl, INVITE_THEMES.house);
  assert.equal(msg.t, 'sceneBg');
  assert.deepEqual(msg.scenes.map((s) => s.key).sort(), ['w:countdown', 'w:dress_code', 'w:special_message']);
  for (const s of msg.scenes) assert.ok(s.classes.includes('hub-bg-frost'), `${s.key} previews the shared glass`);
});

test('nothing in the message reaches CSS unchecked', () => {
  const [s] = sanitizeSceneBgPreview([
    {
      key: 'w:message',
      classes: ['hub-bg-color', 'evil class', 'x', 'hub-ok'],
      vars: {
        '--hub-bg-color': '#123456',
        '--color-ink': '27 26 23',
        color: 'rgb(27 26 23)',
        '--hub-x': 'red; background:url(x)',
        background: 'url(x)',
        position: 'fixed',
        '--hub-y': '}',
      },
    },
  ]);
  assert.deepEqual(s!.classes, ['hub-bg-color', 'hub-ok']);
  assert.deepEqual(s!.vars, { '--hub-bg-color': '#123456', '--color-ink': '27 26 23', color: 'rgb(27 26 23)' }, 'only the frame’s variables and the ink');
  assert.deepEqual(sanitizeSceneBgPreview([{ key: 'f:hero', classes: [], vars: {} }]), [], 'only a scene key');
  assert.deepEqual(sanitizeSceneBgPreview('nope'), []);
});

test('the background row posts the preview BEFORE it saves, and the bridge lays it', () => {
  const row = stripComments(readFileSync(join(__dirname, '../app/dashboard/[eventId]/website/editor/_components/scene-background-row.tsx'), 'utf8'));
  const save = row.slice(row.indexOf('const save = '));
  // Laid through `lay(…)` (the same `onPreview` a refusal reverts with), the save inside `makerSave`.
  const preview = save.indexOf('lay(touched)');
  const draft = save.indexOf('draftAction(eventId, fd)');
  assert.ok(preview > 0 && draft > preview, 'the canvas is told before the save starts');
  const bridge = stripComments(readFileSync(join(__dirname, '../app/[slug]/_components/editor-bridge.tsx'), 'utf8'));
  assert.match(bridge, /data\.t === 'sceneBg'[\s\S]{0,600}sanitizeSceneBgPreview\([\s\S]{0,200}applySceneBgPreview\(/);
});

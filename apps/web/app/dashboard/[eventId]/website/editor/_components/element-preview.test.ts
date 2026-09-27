/**
 * element-preview.test.ts — ⚡ THE MAKER'S ELEMENT CHOICES SHOW INSTANTLY.
 *
 * Owner, 2026-09-27, editing his own Event Hub: *"changing size does nothing"*
 * · *"the toolbars are not working"*. The save worked; the canvas showed it
 * ~6 s later, after a full reload. This file holds the four promises the fix
 * makes, each proved on the real functions:
 *
 *   1 · THE CANVAS LAYS A CHOICE EXACTLY AS THE GUEST PAGE RENDERS IT — the
 *       server's HTML (`PahinaMasthead`, `HubCanvasFrame`) and the bridge's
 *       live write (`editor-bridge.tsx`) are compared on the SAME input: a hero
 *       part's inline style, its per-letter runs, a scene's scoped `<style>`.
 *   2 · AN ELEMENT SAVE DOES NOT RELOAD THE CANVAS — the canvas hold keeps the
 *       page for a render that shows what it already shows, and for nothing
 *       else; and the stage iframe is keyed on the held stamp.
 *   3 · A REFUSED SAVE PUTS THE LAST SAVED LOOK BACK on the canvas.
 *   4 · A MOTION CHANGE REPLAYS THE ARRIVAL; a font or colour change does not
 *       touch the animation (writing an animation again restarts it).
 *
 * 🪤 There is no DOM library in this repo's unit runner, so a small parser and
 * fake DOM below read React's server HTML into nodes the bridge's functions
 * can write to, and write them back out in one spelling for comparison.
 * `globalThis.React` is set before the dynamic imports for the reason
 * `byline-renders-as-a-door.test.ts` gives (tsconfig `jsx: preserve`).
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import * as es from '@/lib/element-style';
import * as ep from './element-preview';

(globalThis as unknown as { React: unknown }).React = React;

let renderToStaticMarkup: typeof import('react-dom/server').renderToStaticMarkup;
let PahinaMasthead: typeof import('@/app/[slug]/_components/pahina-masthead').PahinaMasthead;
let HubCanvasFrame: typeof import('@/app/[slug]/_components/hub-canvas-frame').HubCanvasFrame;
let bridge: typeof import('@/app/[slug]/_components/editor-bridge');
before(async () => {
  ({ renderToStaticMarkup } = await import('react-dom/server'));
  ({ PahinaMasthead } = await import('@/app/[slug]/_components/pahina-masthead'));
  ({ HubCanvasFrame } = await import('@/app/[slug]/_components/hub-canvas-frame'));
  bridge = await import('@/app/[slug]/_components/editor-bridge');
});

type Styles = import('@/lib/element-style').HubElementStyles;
type Canvas = import('@/lib/hub-canvas').HubSectionCanvas;

/* ── a small DOM, enough for the bridge ─────────────────────────────────── */

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const unesc = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

class FakeStyle {
  map = new Map<string, string>();
  setProperty(p: string, v: string) {
    this.map.set(p, v);
  }
  removeProperty(p: string) {
    this.map.delete(p);
    return '';
  }
  getPropertyValue(p: string) {
    return this.map.get(p) ?? '';
  }
}

abstract class FakeNode {
  parentNode: FakeEl | null = null;
  abstract nodeType: number;
  abstract get textContent(): string;
}

class FakeText extends FakeNode {
  nodeType = 3;
  constructor(public data: string) {
    super();
  }
  get textContent() {
    return this.data;
  }
}

class FakeEl extends FakeNode {
  nodeType = 1;
  attrs = new Map<string, string>();
  style = new FakeStyle();
  childNodes: FakeNode[] = [];
  hidden = false;
  constructor(public tagName: string) {
    super();
  }
  get textContent(): string {
    return this.childNodes.map((c) => c.textContent).join('');
  }
  set textContent(v: string) {
    for (const c of this.childNodes) c.parentNode = null;
    this.childNodes.length = 0;
    if (v) this.appendChild(new FakeText(v));
  }
  getAttribute(n: string) {
    return this.attrs.has(n) ? this.attrs.get(n)! : null;
  }
  setAttribute(n: string, v: string) {
    this.attrs.set(n, v);
  }
  hasAttribute(n: string) {
    return this.attrs.has(n);
  }
  removeAttribute(n: string) {
    this.attrs.delete(n);
  }
  appendChild(c: FakeNode) {
    return this.insertBefore(c, null);
  }
  insertBefore(c: FakeNode, ref: FakeNode | null) {
    if (c.parentNode) c.parentNode.removeChild(c);
    const i = ref ? this.childNodes.indexOf(ref) : -1;
    if (i < 0) this.childNodes.push(c);
    else this.childNodes.splice(i, 0, c);
    c.parentNode = this;
    return c;
  }
  removeChild(c: FakeNode) {
    const i = this.childNodes.indexOf(c);
    if (i >= 0) this.childNodes.splice(i, 1);
    c.parentNode = null;
    return c;
  }
  replaceChild(n: FakeNode, old: FakeNode) {
    this.insertBefore(n, old);
    return this.removeChild(old);
  }
  normalize() {
    const out: FakeNode[] = [];
    for (const c of this.childNodes) {
      const prev = out[out.length - 1];
      if (c instanceof FakeText && prev instanceof FakeText) prev.data += c.data;
      else if (!(c instanceof FakeText && c.data === '')) out.push(c);
      if (c instanceof FakeEl) c.normalize();
    }
    this.childNodes.length = 0;
    for (const c of out) {
      c.parentNode = this;
      this.childNodes.push(c);
    }
  }
  get nextSibling(): FakeNode | null {
    const sibs = this.parentNode?.childNodes ?? [];
    return sibs[sibs.indexOf(this) + 1] ?? null;
  }
  get nextElementSibling(): FakeEl | null {
    const sibs = this.parentNode?.childNodes ?? [];
    for (let i = sibs.indexOf(this) + 1; i < sibs.length; i += 1) if (sibs[i] instanceof FakeEl) return sibs[i] as FakeEl;
    return null;
  }
  /** `[attr]` and `[attr="value"]` — the only selectors the bridge's preview uses. */
  querySelectorAll(sel: string): FakeEl[] {
    const m = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(sel);
    if (!m) throw new Error(`fake DOM cannot match ${sel}`);
    const out: FakeEl[] = [];
    const walk = (n: FakeEl) => {
      for (const c of n.childNodes) {
        if (!(c instanceof FakeEl)) continue;
        if (c.hasAttribute(m[1]!) && (m[2] === undefined || c.getAttribute(m[1]!) === m[2])) out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }
  find(attr: string, value?: string): FakeEl {
    const hit = this.querySelectorAll(value === undefined ? `[${attr}]` : `[${attr}="${value}"]`)[0];
    assert.ok(hit, `no [${attr}${value === undefined ? '' : `="${value}"`}] in the rendered HTML`);
    return hit;
  }
}

const doc = {
  createElement: (t: string) => new FakeEl(t.toUpperCase()),
  createTextNode: (d: string) => new FakeText(d),
} as unknown as Pick<Document, 'createElement' | 'createTextNode'>;

/** React's server HTML → fake nodes. Comments (`<!-- -->`) are dropped. */
function parse(html: string): FakeEl {
  const root = new FakeEl('ROOT');
  let cur = root;
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z0-9]+)>|<([a-zA-Z0-9]+)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/g;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[0].startsWith('<!--')) continue;
    if (m[1]) {
      cur = cur.parentNode ?? root;
    } else if (m[2]) {
      const el = new FakeEl(m[2].toUpperCase());
      for (const a of (m[3] ?? '').matchAll(/([^\s=>/]+)(?:="([^"]*)")?/g)) {
        const name = a[1]!;
        const value = unesc(a[2] ?? '');
        if (name === 'style') {
          for (const decl of value.split(';')) {
            const i = decl.indexOf(':');
            if (i > 0) el.style.setProperty(decl.slice(0, i).trim(), decl.slice(i + 1).trim());
          }
        } else el.setAttribute(name, value);
      }
      cur.appendChild(el);
      if (!m[4] && !['BR', 'HR', 'IMG', 'INPUT', 'META', 'LINK'].includes(el.tagName)) cur = el;
    } else if (m[5]) {
      cur.appendChild(new FakeText(unesc(m[5])));
    }
  }
  return root;
}

/** Fake nodes → one spelling (style last, as `prop:value;…`). */
function serialize(n: FakeNode): string {
  if (n instanceof FakeText) return esc(n.data);
  const el = n as FakeEl;
  let attrs = '';
  for (const [k, v] of el.attrs) attrs += ` ${k}="${esc(v)}"`;
  if (el.style.map.size > 0) attrs += ` style="${esc([...el.style.map].map(([p, v]) => `${p}:${v}`).join(';'))}"`;
  return `<${el.tagName.toLowerCase()}${attrs}>${el.childNodes.map(serialize).join('')}</${el.tagName.toLowerCase()}>`;
}

const styleOf = (el: FakeEl) => Object.fromEntries(el.style.map);

/* ── fixtures ────────────────────────────────────────────────────────────── */

const FONT = es.HUB_ELEMENT_FONTS[0]!.key;
const FONT_2 = es.HUB_ELEMENT_FONTS[3]!.key;

function masthead(elements: Styles | null): FakeEl {
  const html = renderToStaticMarkup(
    React.createElement(PahinaMasthead, {
      displayName: 'Maria & Jose',
      eventDate: '2026-12-12',
      twoPeople: true,
      stampElements: true,
      elements,
      monogramSlot: React.createElement('span', null, 'MJ'),
      card: {
        eyebrow: 'You are invited',
        line: 'invite you to celebrate their wedding',
        timeLabel: '1:30 PM',
        hubHref: '#hub',
        hubLabel: 'Open the Event Hub',
      },
    }),
  );
  return parse(html);
}

/* ═══ 1 · THE CANVAS LAYS A CHOICE EXACTLY AS THE GUEST PAGE RENDERS IT ═══ */

test('a hero part: the bridge writes the SAME inline style the server renders, for every field', () => {
  const style = {
    font: FONT,
    color: '#123456',
    size: 145,
    motion: { in: 'rise', during: 'drift', duration: 'slow', delay: 'short' },
  } as const;
  for (const el of ['names', 'eyebrow', 'date', 'time', 'line'] as const) {
    const server = masthead({ [el]: style } as Styles).find('data-el', el);
    const live = masthead(null).find('data-el', el);
    assert.deepEqual(styleOf(live), {}, `${el}: the untouched part starts with no style of its own`);
    bridge.applyHeroPartStyle(live as unknown as HTMLElement, es.sanitizeHubElementStyle(style, el), true);
    assert.deepEqual(styleOf(live), styleOf(server), `${el}: bridge ≠ server`);
    assert.ok(Object.keys(styleOf(server)).length >= 4, `${el}: the server really rendered the choice`);
  }
});

test('THE MARK: every size step reaches the canvas as the zoom the server renders', () => {
  // ♻ The old S · L · XL (a draft saved before the stepper) still draw at their zoom.
  for (const size of ['s', 'l', 'xl'] as const) {
    const legacy = { size } as unknown as es.HubElementStyle;
    const server = masthead({ mark: legacy }).find('data-el', 'mark');
    const live = masthead(null).find('data-el', 'mark');
    bridge.applyHeroPartStyle(live as unknown as HTMLElement, legacy, false);
    assert.deepEqual(styleOf(live), styleOf(server));
    assert.equal(live.style.getPropertyValue('zoom'), String(es.HUB_ELEMENT_LEGACY_SIZE[size] / 100));
  }
  // Back to M is an ABSENCE: nothing of the old size is left behind.
  const live = masthead({ mark: { size: 145 } }).find('data-el', 'mark');
  bridge.applyHeroPartStyle(live as unknown as HTMLElement, null, true);
  assert.deepEqual(styleOf(live), {});
});

test('a font or colour change never touches the animation — only a motion change re-lays it', () => {
  const live = masthead({ names: { motion: { in: 'rise' } } }).find('data-el', 'names');
  // ▶ Play left its `-p` twin inline; a font change must leave the arrival alone.
  live.style.setProperty('animation-name', 'el-in-rise-p');
  const before = live.style.getPropertyValue('--el-anim');
  assert.match(before, /el-in-rise/, 'precondition: the server laid the motion');
  bridge.applyHeroPartStyle(live as unknown as HTMLElement, { font: FONT, motion: { in: 'rise' } }, false);
  assert.equal(live.style.getPropertyValue('--el-anim'), before);
  assert.equal(live.style.getPropertyValue('animation-name'), 'el-in-rise-p');
  assert.ok(live.style.getPropertyValue('font-family'));
  // A motion change clears the twin and lays the new motion.
  bridge.applyHeroPartStyle(live as unknown as HTMLElement, { font: FONT, motion: { in: 'fade' } }, true);
  assert.equal(live.style.getPropertyValue('animation-name'), '');
  assert.match(live.style.getPropertyValue('--el-anim'), /el-in-fade/);
  assert.equal(live.getAttribute('data-el-motion'), '', 'the gated rule\'s hook is laid with the motion');
  // Motion taken away (↺): the properties AND the hook go.
  bridge.applyHeroPartStyle(live as unknown as HTMLElement, { font: FONT }, true);
  assert.equal(live.style.getPropertyValue('--el-anim'), '');
  assert.equal(live.getAttribute('data-el-motion'), null);
});

test('the preview clears exactly the properties the declarations can write', () => {
  const emitted = new Set<string>();
  const motions = [
    { in: 'rise', during: 'drift', timeline: 'scroll', out: 'lift' },
    { in: 'fade', duration: 'quick', delay: 'long' },
    { during: 'drift' },
  ];
  for (const motion of motions) {
    const style = { font: FONT, color: '#000000', size: 120, weight: 600, italic: true, underline: true, align: 'left', leading: 1.2, tracking: 8, hidden: true, motion } as never;
    for (const [p] of es.hubElementDeclarations(style)) emitted.add(p);
    for (const [p] of es.hubElementHeroMotionVars(style)) emitted.add(p);
  }
  const listed = new Set<string>([...es.HUB_ELEMENT_LOOK_PROPS, ...es.HUB_ELEMENT_MOTION_PROPS]);
  for (const p of emitted) assert.ok(listed.has(p), `${p} is written by the declarations but never cleared by the preview`);
});

test('✍ per-letter runs: the bridge re-cuts the part into the SAME spans the server renders', () => {
  const whole = 'MariaandJose'; // the card's names as `textContent` reads them
  const of = es.hubTextHash(whole);
  const runsA = { runs: [{ start: 0, end: 1, color: '#aa0000' }, { start: 4, end: 6, font: FONT }, { start: 6, end: 9, size: 120 }], of };
  const runsB = { runs: [{ start: 2, end: 3, font: FONT_2, color: '#00aa00', size: 85 }], of };
  const cut = (style: unknown) => es.sanitizeHubElementStyle(style, 'names');

  const live = masthead(null).find('data-el', 'names');
  bridge.applyHeroPartRuns(live as unknown as HTMLElement, cut(runsA), doc);
  const serverA = masthead({ names: cut(runsA)! }).find('data-el', 'names');
  assert.ok(serverA.querySelectorAll('[data-el-run]').length >= 3, 'the server really drew the runs');
  assert.equal(serialize(live), serialize(serverA));

  // A second choice re-cuts from the first — nothing of the old runs is left.
  bridge.applyHeroPartRuns(live as unknown as HTMLElement, cut(runsB), doc);
  assert.equal(serialize(live), serialize(masthead({ names: cut(runsB)! }).find('data-el', 'names')));

  // "Clear this selection" — back to the plain text.
  bridge.applyHeroPartRuns(live as unknown as HTMLElement, null, doc);
  assert.equal(serialize(live), serialize(masthead(null).find('data-el', 'names')));
});

test('a date part keeps its gold rules while its runs are re-cut', () => {
  const server0 = masthead(null).find('data-el', 'date');
  const whole = server0.textContent;
  const style = es.sanitizeHubElementStyle({ runs: [{ start: 0, end: 3, color: '#abcdef' }], of: es.hubTextHash(whole) }, 'date');
  const live = masthead(null).find('data-el', 'date');
  bridge.applyHeroPartRuns(live as unknown as HTMLElement, style, doc);
  assert.equal(serialize(live), serialize(masthead({ date: style! }).find('data-el', 'date')));
});

test("a scene's parts: the bridge writes the SAME scoped <style> the frame renders", () => {
  const elements = es.sanitizeHubElements({
    heading: { color: '#112233', size: 120, font: FONT },
    body: { motion: { in: 'fade' } },
  })!;
  const widget = {
    widget_id: 'w1',
    event_id: 'e1',
    widget_type: 'details',
    display_order: 1,
    is_visible: true,
    is_always_on: false,
    tier: 'basic',
    config_json: { canvas: { elements } },
    created_at: '',
    updated_at: '',
  };
  const frameProps: Parameters<typeof HubCanvasFrame>[0] = {
    widget: widget as never,
    children: React.createElement('section', null, 'x'),
  };
  const html = renderToStaticMarkup(React.createElement(HubCanvasFrame, frameProps));
  const serverCss = unesc(/<style[^>]*data-hub-els="details"[^>]*>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? '');
  assert.ok(serverCss.includes('zoom:1.2'), 'the frame really rendered the choice');

  const page = parse('<div><span hidden="" data-maker-section="w:details"></span><section><h2>Hi</h2></section><span hidden="" data-maker-section="w:gallery"></span></div>');
  const section = page.find('data-maker-section', 'w:details').nextElementSibling!;
  const tag = bridge.applySceneElementStyles(section as unknown as HTMLElement, 'details', elements, doc) as unknown as FakeEl;
  assert.equal(tag.textContent, serverCss);
  assert.equal(section.nextElementSibling, tag, 'placed straight after the scene, where `:has(+ style)` looks');

  // A second choice rewrites the SAME tag; a reset empties it.
  const again = bridge.applySceneElementStyles(section as unknown as HTMLElement, 'details', { heading: { size: 85 } }, doc);
  assert.equal(again as unknown, tag);
  assert.equal(page.querySelectorAll('[data-hub-els]').length, 1);
  bridge.applySceneElementStyles(section as unknown as HTMLElement, 'details', null, doc);
  assert.equal(tag.textContent, '');
  // ⛔ The RSVP form is never restyled.
  assert.equal(bridge.applySceneElementStyles(section as unknown as HTMLElement, 'rsvp', elements, doc), null);
});

test('the elStyle message is wired: the canvas applies it, and replays on a motion change', () => {
  const src = readFileSync(join(process.cwd(), 'app/[slug]/_components/editor-bridge.tsx'), 'utf8');
  const handler = src.slice(src.indexOf("data.t === 'elStyle'"), src.indexOf("data.t === 'markEl'"));
  assert.ok(handler.length > 0, 'no elStyle handler in the bridge');
  assert.match(handler, /applyElementPreview\(/);
  assert.match(handler, /sanitizeHubElements\(/, 'the canvas must re-sanitize what reaches CSS');
  assert.match(handler, /replay === true[\s\S]*replayElementIn\(/, 'a motion change must replay the arrival');
});

/* ═══ 2 · AN ELEMENT SAVE DOES NOT RELOAD THE CANVAS ═════════════════════ */

const hero: Canvas = { elements: { names: { size: 120 } } };
const details: Canvas = { arrangement: 'left' };

test('the hold keeps the page for a render that shows what the canvas shows', () => {
  const server = { hero: {}, details };
  const hold = ep.holdCanvas(ep.NO_CANVAS_HOLD, server, 'hero', hero, 1000);
  // The save's refresh: the server now holds the same canvas (key order differs).
  const after = { details, hero: { elements: { names: { size: 120 } } } } as Record<string, Canvas>;
  assert.equal(ep.canvasKeepsItsPage(hold, after, 2000), true);
  // An empty canvas and an absent one are the same page.
  assert.equal(ep.canvasKeepsItsPage(ep.holdCanvas(ep.NO_CANVAS_HOLD, { details }, 'hero', {}, 0), { details }, 10), true);
});

test('the hold never swallows a render that changed something — or one after it lapsed', () => {
  const server = { hero: {}, details };
  const hold = ep.holdCanvas(ep.NO_CANVAS_HOLD, server, 'hero', hero, 1000);
  // Undo took the choice back: the canvas must reload.
  assert.equal(ep.canvasKeepsItsPage(hold, server, 2000), false);
  // A background changed on another scene: reload.
  assert.equal(ep.canvasKeepsItsPage(hold, { hero, details: { ...details, zoom: 120 } }, 2000), false);
  // No hold at all (every other Maker write): reload.
  assert.equal(ep.canvasKeepsItsPage(ep.NO_CANVAS_HOLD, { hero, details }, 2000), false);
  // The hold lapsed: reload.
  assert.equal(ep.canvasKeepsItsPage(hold, { hero, details }, 1000 + ep.CANVAS_HOLD_MS), false);
});

test('quick choices on two scenes both count toward what the canvas shows', () => {
  const server = { hero: {}, details: {} };
  let hold = ep.holdCanvas(ep.NO_CANVAS_HOLD, server, 'hero', hero, 0);
  hold = ep.holdCanvas(hold, server, 'details', details, 100);
  assert.equal(ep.canvasKeepsItsPage(hold, { hero, details }, 200), true);
  assert.deepEqual(ep.heldCanvasFor(hold, 'hero', 200), hero);
});

test('the stage canvas iframe is keyed on the held stamp, never on every render', () => {
  const src = readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx'), 'utf8');
  const frame = src.slice(src.indexOf('<BufferedCanvasFrame'), src.indexOf('/>', src.indexOf('<BufferedCanvasFrame')));
  assert.ok(frame.length > 0, 'the stage canvas is the buffered frame');
  assert.match(frame, /frameKey=\{`\$\{stage\}:\$\{canvasStamp\}/, 'the stage canvas must be keyed on canvasStamp');
  assert.doesNotMatch(frame, /renderStamp/, 'a key on renderStamp reloads the canvas on every element save');
  assert.match(src, /canvasKeepsItsPage\(canvasHold\.current/);
  assert.match(src, /onSaving=\{\(widgetType, canvas\) => \{\s*canvasHold\.current = holdCanvas\(/);
});

/* ═══ 3 · A REFUSED SAVE PUTS THE LAST SAVED LOOK BACK ═══════════════════ */

test('a refused save reverts to the last saved canvas — unless a later choice is on its way', () => {
  const saved: Canvas = { elements: { names: { size: 85 } } };
  const failed: Canvas = { elements: { names: { size: 145 } } };
  const later: Canvas = { elements: { names: { size: 145, color: '#000000' } } };
  assert.equal(ep.revertAfterFailedSave(failed, failed, saved), saved);
  assert.equal(ep.revertAfterFailedSave(failed, later, saved), null);
  // The revert is laid on the canvas quietly — no replay.
  const msg = ep.elementPreview('f:hero', 'names', { elements: { names: { motion: { in: 'rise' } } } }, saved, false);
  assert.equal(msg.replay, false);
  assert.equal(msg.motion, true);
});

test('the sheet previews BEFORE it saves, and a refusal previews the saved look', () => {
  const src = readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/website/editor/_components/element-sheet.tsx'), 'utf8');
  const commit = src.slice(src.indexOf('const commit = '), src.indexOf('/* ✍ A selection inside'));
  const preview = commit.indexOf('onPreview?.(elementPreview(target.key, target.el, before, next))');
  const save = commit.indexOf('await saveCanvas(');
  assert.ok(preview > 0 && save > preview, 'the canvas must be told before the save starts');
  const refused = commit.slice(commit.indexOf('if (!res.ok)'));
  assert.match(refused, /revertAfterFailedSave\(/);
  assert.match(refused, /onPreview\?\.\(elementPreview\(target\.key, target\.el, next, back, false\)\)/);
  assert.match(refused, /setError\(res\.error\)/);
});

/* ═══ 4 · A MOTION CHANGE REPLAYS THE ARRIVAL ════════════════════════════ */

test('a motion change replays the In; a size, font or colour change does not', () => {
  const base: Canvas = { elements: { names: { size: 120 } } };
  const withIn: Canvas = { elements: { names: { size: 120, motion: { in: 'rise' } } } };
  const slower: Canvas = { elements: { names: { size: 120, motion: { in: 'rise', duration: 'slow' } } } };
  const bigger: Canvas = { elements: { names: { size: 145, motion: { in: 'rise', duration: 'slow' } } } };
  const inOn = ep.elementPreview('f:hero', 'names', base, withIn);
  assert.deepEqual([inOn.motion, inOn.replay], [true, true]);
  const dur = ep.elementPreview('f:hero', 'names', withIn, slower);
  assert.deepEqual([dur.motion, dur.replay], [true, true]);
  const size = ep.elementPreview('f:hero', 'names', slower, bigger);
  assert.deepEqual([size.motion, size.replay], [false, false]);
  // Drift alone has no arrival to replay — it runs on its own.
  const drift = ep.elementPreview('f:hero', 'names', base, { elements: { names: { size: 120, motion: { during: 'drift' } } } });
  assert.deepEqual([drift.motion, drift.replay], [true, false]);
  assert.equal(inOn.t, 'elStyle');
  assert.deepEqual(inOn.elements, withIn.elements);
});

/* ═══ 5 · THE KEYNOTE REBUILD'S ROWS PREVIEW EXACTLY AS THEY RENDER (2026-09-27) ═══ */

test('the Text tab’s new rows and Hidden: the canvas lays exactly what the server draws (a hidden part ghosted)', () => {
  const style = { weight: 600, italic: true, underline: true, leading: 1.2, tracking: 8, hidden: true } as const;
  for (const el of ['names', 'eyebrow', 'date', 'time', 'line'] as const) {
    const server = masthead({ [el]: style } as Styles).find('data-el', el);
    const live = masthead(null).find('data-el', el);
    bridge.applyHeroPartStyle(live as unknown as HTMLElement, es.sanitizeHubElementStyle(style, el), false);
    assert.deepEqual(styleOf(live), styleOf(server), `${el}: bridge ≠ server`);
    assert.equal(live.style.getPropertyValue('opacity'), '0.3', `${el}: hidden is ghosted in the Maker, never gone`);
    assert.equal(live.style.getPropertyValue('display'), '');
  }
});

test('the hero’s one alignment reaches EVERY hero part on the canvas, as the server draws it', () => {
  const aligned = es.withElementAlign(null, 'date', 'left');
  const server = masthead(aligned);
  const live = masthead(null);
  bridge.applyElementPreview(live as unknown as HTMLElement, 'f:hero', 'date', aligned, false, doc);
  for (const el of ['eyebrow', 'names', 'line', 'date', 'time'] as const) {
    assert.deepEqual(styleOf(live.find('data-el', el)), styleOf(server.find('data-el', el)), `${el}: not re-laid`);
    assert.equal(live.find('data-el', el).style.getPropertyValue('text-align'), 'left');
  }
  // ↺ taken off again: nothing of the alignment is left on any part.
  bridge.applyElementPreview(live as unknown as HTMLElement, 'f:hero', 'names', null, false, doc);
  for (const el of ['eyebrow', 'names', 'line', 'date', 'time'] as const) assert.deepEqual(styleOf(live.find('data-el', el)), {});
});

test('the Joiner’s word is on the canvas at once, and taking it off puts the page’s own word back', () => {
  const live = masthead(null);
  const joiner = () => live.find('data-el', 'joiner');
  assert.equal(joiner().textContent, 'and');
  bridge.applyElementPreview(live as unknown as HTMLElement, 'f:hero', 'joiner', { joiner: { word: '+' } }, false, doc);
  assert.equal(joiner().textContent, '+');
  assert.equal(joiner().textContent, masthead({ joiner: { word: '+' } }).find('data-el', 'joiner').textContent, 'canvas = guest page');
  bridge.applyElementPreview(live as unknown as HTMLElement, 'f:hero', 'joiner', null, false, doc);
  assert.equal(joiner().textContent, 'and');
});

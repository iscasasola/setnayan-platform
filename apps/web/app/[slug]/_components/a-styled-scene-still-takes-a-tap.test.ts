/**
 * 👆 A SCENE JUST STYLED STILL TAKES A TAP (2026-10-16, live on the owner's event, production f687fde: *"cannot
 * select on maker preview screen anymore"*).
 *
 * The sequence: a Style card is tapped (Title › Style, a scene's Style card). Since #6568 the pick is laid on the canvas
 * AT THE TAP — a copy of the card's section, cut from the card's own frame (`lib/maker-scene-look.ts` `sectionPicture`
 * → the bridge's `layScenePicture`). The card's frame is a Maker page too, so its bridge had bound that section: the
 * copy arrived wearing `data-setnayan-editor-bound="1"` with no listener behind it. The canvas's bridge read the mark
 * as "already bound" and never listened, and its stray-tap check read the same mark as "a section has this tap" — so
 * every tap on the styled scene went nowhere. The copy is posted to every canvas frame, so a kept stage wore it too.
 *
 * This guard DRIVES the real code on a stand-in page — the card's own binder, the real `sectionPicture`, the real
 * `layScenePicture`, the canvas's real binder (`canvas-section-binder.ts`) — and taps:
 *   1. a part of the laid copy reaches the canvas's tap handler, as the section it stands for;
 *   2. the copy carries no mark it did not earn on this page, and the stray-tap check holds it;
 *   3. a section node a redraw brought in is bound by the next sweep, and the one it replaced is let go;
 *   4. the bridge sweeps when a picture is laid and when a redraw lands (the two moments a section can be new).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/* ── a stand-in DOM: only what these paths touch ─────────────────────────────────────────────────────────────────── */
const parsed = new Map<string, El>();
type Listener = (e: { target: El; stopped: boolean }) => void;
class El {
  tagName: string;
  attrs = new Map<string, string>();
  children: El[] = [];
  parent: El | null = null;
  textContent = '';
  style: Record<string, string> = {};
  listeners = new Map<string, Listener[]>();
  constructor(tag: string, attrs: Record<string, string> = {}) {
    this.tagName = tag.toUpperCase();
    for (const [k, v] of Object.entries(attrs)) this.attrs.set(k, v);
  }
  getAttribute(k: string) {
    return this.attrs.has(k) ? this.attrs.get(k)! : null;
  }
  setAttribute(k: string, v: string) {
    this.attrs.set(k, String(v));
  }
  hasAttribute(k: string) {
    return this.attrs.has(k);
  }
  removeAttribute(k: string) {
    this.attrs.delete(k);
  }
  append(...cs: El[]) {
    for (const c of cs) {
      c.parent = this;
      this.children.push(c);
    }
    return this;
  }
  appendChild(c: El) {
    this.append(c);
    return c;
  }
  get parentElement() {
    return this.parent;
  }
  get isConnected(): boolean {
    let n: El | null = this;
    while (n.parent) n = n.parent;
    return n instanceof Doc;
  }
  get nextElementSibling(): El | null {
    if (!this.parent) return null;
    return this.parent.children[this.parent.children.indexOf(this) + 1] ?? null;
  }
  get firstElementChild(): El | null {
    return this.children[0] ?? null;
  }
  remove() {
    if (!this.parent) return;
    this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = null;
  }
  replaceWith(el: El) {
    const p = this.parent!;
    el.parent = p;
    p.children.splice(p.children.indexOf(this), 1, el);
    this.parent = null;
  }
  insertAdjacentElement(where: 'afterend', el: El) {
    assert.equal(where, 'afterend');
    const p = this.parent!;
    el.parent = p;
    p.children.splice(p.children.indexOf(this) + 1, 0, el);
    return el;
  }
  cloneNode(): El {
    const c = new El(this.tagName, Object.fromEntries(this.attrs));
    c.textContent = this.textContent;
    c.append(...this.children.map((x) => x.cloneNode()));
    return c;
  }
  get outerHTML(): string {
    const a = [...this.attrs].map(([k, v]) => ` ${k}="${v}"`).join('');
    const html = `<${this.tagName.toLowerCase()}${a}>${this.textContent}${this.children.map((c) => c.outerHTML).join('')}</${this.tagName.toLowerCase()}>`;
    parsed.set(html, this.cloneNode());
    return html;
  }
  set innerHTML(html: string) {
    const el = parsed.get(html);
    assert.ok(el, 'the picture reaching the page is one this stand-in drew');
    this.children = [];
    this.append(el!.cloneNode());
  }
  get content() {
    return this;
  }
  addEventListener(type: string, fn: Listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  removeEventListener(type: string, fn: Listener) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((f) => f !== fn));
  }
  private all(): El[] {
    return this.children.flatMap((c) => [c, ...c.all()]);
  }
  querySelectorAll(sel: string): El[] {
    return this.all().filter((e) => sel.split(',').some((one) => matches(e, one.trim())));
  }
  querySelector(sel: string): El | null {
    return this.querySelectorAll(sel)[0] ?? null;
  }
  matches(sel: string) {
    return matches(this, sel);
  }
}
function matches(e: El, sel: string): boolean {
  const m = /^([a-z]*)((?:\[[^\]]+\])*)$/i.exec(sel);
  if (!m) throw new Error(`stand-in DOM cannot match ${sel}`);
  if (m[1] && e.tagName !== m[1].toUpperCase()) return false;
  for (const a of m[2]!.match(/\[[^\]]+\]/g) ?? []) {
    const [, k, v] = /^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(a)!;
    if (!e.hasAttribute(k!)) return false;
    if (v !== undefined && e.getAttribute(k!) !== v) return false;
  }
  return true;
}
class Doc extends El {
  head: El;
  body: El;
  constructor() {
    super('html');
    this.head = new El('head');
    this.body = new El('body');
    this.append(this.head, this.body);
  }
  createElement(tag: string) {
    return new El(tag);
  }
  getElementById() {
    return null;
  }
}
/** A click on `target`, bubbling to the document — a listener that stops it stops it. */
function tap(doc: Doc, target: El) {
  const e = { target, stopped: false };
  for (let n: El | null = target; n && n !== doc && !e.stopped; n = n.parent) for (const fn of n.listeners.get('click') ?? []) fn(e);
  if (!e.stopped) for (const fn of doc.listeners.get('click') ?? []) fn(e);
}
(globalThis as unknown as { CSS: unknown }).CSS = { escape: (s: string) => s };

const KEY = 'w:countdown';
function scene(look: string) {
  return new El('section', { 'data-look': look }).append(new El('div', { 'data-el': 'heading' }));
}

test('a part of a styled scene — the Style card\'s picture laid over it — is still a tap the Maker hears', async () => {
  const { createSectionBinder, EDITOR_BOUND_ATTR } = await import('./canvas-section-binder');
  const { layScenePicture } = await import('./scene-look-lay');
  const { sectionPicture } = await import('../../../lib/maker-scene-look');
  const { sectionAfter } = await import('./maker-section-find');

  /* The Style card: a Maker page of its own, whose bridge bound its section (as every editor=1 page does). */
  const card = new Doc();
  card.body.append(new El('span', { 'data-maker-section': KEY }), scene('big-number'));
  createSectionBinder(card as unknown as Document, () => () => {}).sweep();
  const cardSection = sectionAfter(card.querySelector(`[data-maker-section="${KEY}"]`) as unknown as Element)!;
  assert.equal(cardSection.getAttribute(EDITOR_BOUND_ATTR), '1', 'the card\'s own bridge marked its section');

  /* The canvas: the scene in Boxes, bound by the canvas's bridge, and a page ground outside every section. */
  const canvas = new Doc();
  const ground = new El('div', { 'data-ground': '' });
  canvas.body.append(new El('span', { 'data-maker-section': KEY }), scene('boxes'), ground);
  const heard: string[] = [];
  const binder = createSectionBinder(canvas as unknown as Document, (el, key) => {
    const send = (e: { stopped: boolean }) => {
      heard.push(`${key}:${(el as unknown as El).getAttribute('data-look')}`);
      e.stopped = true;
    };
    (el as unknown as El).addEventListener('click', send as never);
    return () => (el as unknown as El).removeEventListener('click', send as never);
  });
  binder.sweep();
  const strays: string[] = [];
  canvas.addEventListener('click', (e) => {
    if (!binder.holds(e.target as never)) strays.push('tapOutside');
  });

  /* Tapped before the pick: the scene selects. */
  tap(canvas, canvas.querySelector('[data-el="heading"]')!);
  assert.deepEqual(heard, [`${KEY}:boxes`]);

  /* The pick: the card's section, laid over the canvas's — then the sweep the bridge runs on `sceneLook`. */
  const html = sectionPicture(cardSection);
  assert.ok(html, 'the card gives a picture');
  assert.equal(layScenePicture(canvas as unknown as Document, KEY, html!), true, 'the picture is on the page');
  binder.sweep();
  const laid = canvas.querySelector('[data-maker-look-copy]')!;
  assert.equal(laid.getAttribute('data-look'), 'big-number', 'what the couple sees now is the picked style');

  /* 1 — a tap on the picture's part reaches the Maker, as the section it stands for */
  heard.length = 0;
  tap(canvas, laid.querySelector('[data-el="heading"]')!);
  assert.deepEqual(heard, [`${KEY}:big-number`], 'a tap on the styled scene selects it — it was swallowed by a copied mark (2026-10-16)');
  assert.deepEqual(strays, [], 'and it is not a tap on the ground');

  /* 2 — no mark it did not earn here; the stray check holds it, and the ground is still the ground */
  assert.equal(binder.isBound(laid as never), true, 'the canvas listens to the picture itself');
  for (const inner of laid.querySelectorAll(`[${EDITOR_BOUND_ATTR}]`)) assert.fail(`a copied mark survived inside the picture: ${inner.tagName}`);
  tap(canvas, ground);
  assert.deepEqual(strays, ['tapOutside'], 'a tap between scenes still says so');

  /* 3 — the server's render: the picture taken off, and a NEW node where the section stood (a different component) */
  const { takeScenePicturesOff } = await import('./scene-look-lay');
  takeScenePicturesOff(canvas as unknown as Document);
  const own = canvas.querySelector('[data-look="boxes"]')!;
  const redrawn = scene('big-number');
  own.replaceWith(redrawn);
  binder.sweep();
  assert.equal(binder.isBound(own as never), false, 'the node the redraw replaced is let go');
  assert.equal(binder.isBound(laid as never), false, 'the picture taken off is let go');
  heard.length = 0;
  tap(canvas, redrawn.querySelector('[data-el="heading"]')!);
  assert.deepEqual(heard, [`${KEY}:big-number`], 'the redrawn scene takes a tap');
});

test('the bridge sweeps at the two moments a section can be new: a picture laid, a redraw landed', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'editor-bridge.tsx'), 'utf8');
  /* The sceneLook branch: its lay is followed by a sweep (the condition is the lay's own answer). */
  const look = src.slice(src.indexOf("data.t === 'sceneLook'"), src.indexOf("data.t === 'sceneLook'") + 900);
  assert.match(look, /layScenePicture\(document, data\.key, html\)\)\s*bindAll\(\)/, 'a laid picture is bound at once');
  /* The redraw-done effect runs the sweep the bridge's effect registered. */
  const done = src.slice(src.indexOf('if (wasRedrawing.current && !redrawing)'), src.indexOf('wasRedrawing.current = redrawing;'));
  assert.match(done, /rebindRef\.current\?\.\(\)/, 'a landed redraw is swept');
  assert.match(src, /rebindRef\.current = bindAll;/, 'the sweep the redraw runs is the bridge\'s own');
  /* Never back to deciding by the node's own mark. */
  assert.doesNotMatch(src, /dataset\.setnayanEditorBound === '1'\) return/, 'bound-ness is the binder\'s, not a copied attribute');
  assert.doesNotMatch(src, /closest\?\.\('\[data-setnayan-editor-bound="1"\]'\)\) return;/, 'the stray check asks the binder');
});

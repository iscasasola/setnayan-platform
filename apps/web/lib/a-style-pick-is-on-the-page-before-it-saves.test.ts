/**
 * 🎨 A STYLE PICK IS ON THE PAGE BEFORE ITS SAVE IS ANSWERED — AND ITS ↺ IS TOO (2026-10-15, owner: *"i still feel
 * doing/editing using maker still takes so long before i see changes"*).
 *
 * MEASURED on the production build (`controller-2026-10-12/maker-speed/MEASURE.md`): a Style card changed nothing on
 * the page for 4.1–4.3 s (the save, then the guest page's render), and its ↺ took 8.7 s (a whole-Maker render and a
 * new canvas page) because a redraw save left an undo BARRIER. `every-maker-edit-shows-before-it-saves` passed all the
 * while: the "drawn" it saw was the card's own ring, not the page.
 *
 * So this guard does not read source. It DRIVES the real code — `styleTap` (the one door both style rows use), the real
 * `makerRedrawSave` and ↺ journal, the real ↺ runner, and the bridge's real `layScenePicture` — on a stand-in page with
 * a save that has NOT answered, and asks what the canvas was told and what its page shows meanwhile:
 *   1. the tapped card's section reaches the canvas while the save is still on its way;
 *   2. the bridge lays it over the page's own section (which stays, hidden), and every Maker lookup then finds it;
 *   3. the ↺ of that pick is in the journal (never a barrier) and lays the BEFORE section back while its own save is
 *      still on its way; its answer redraws the page in place;
 *   4. the server's render takes every picture off again.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

/* ── a stand-in DOM: only what these paths touch ─────────────────────────────────────────────────────────────────── */
type Msg = { t?: string; key?: string; html?: string };
const parsed = new Map<string, El>();
class El {
  tagName: string;
  attrs = new Map<string, string>();
  children: El[] = [];
  parent: El | null = null;
  textContent = '';
  contentDocument: Doc | null = null;
  contentWindow: { postMessage: (m: Msg) => void } | null = null;
  ownerDoc: Doc;
  constructor(doc: Doc, tag: string, attrs: Record<string, string> = {}) {
    this.ownerDoc = doc;
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
  get nextElementSibling(): El | null {
    if (!this.parent) return null;
    const i = this.parent.children.indexOf(this);
    return this.parent.children[i + 1] ?? null;
  }
  get firstElementChild(): El | null {
    return this.children[0] ?? null;
  }
  remove() {
    if (!this.parent) return;
    this.parent.children.splice(this.parent.children.indexOf(this), 1);
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
    const c = new El(this.ownerDoc, this.tagName, Object.fromEntries(this.attrs));
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
  readyState = 'complete';
  constructor() {
    super(null as unknown as Doc, 'html');
    this.ownerDoc = this;
    this.head = new El(this, 'head');
    this.body = new El(this, 'body');
    this.append(this.head, this.body);
  }
  createElement(tag: string) {
    return new El(this, tag);
  }
  getElementById() {
    return null;
  }
}

/* ── the stage: a canvas showing the Countdown in Boxes, and the Big number card drawn ─────────────────────────────── */
function stage() {
  const maker = new Doc();
  const canvas = new Doc();
  const told: Array<Msg & { at: string }> = [];
  let phase = 'before the save';
  const sectionOf = (doc: Doc, look: string) => {
    const s = new El(doc, 'section', { 'data-look': look });
    s.append(new El(doc, 'div', { 'data-el': 'heading' }));
    return s;
  };
  canvas.body.append(new El(canvas, 'div', { 'data-maker-section': 'w:countdown' }), sectionOf(canvas, 'boxes'), new El(canvas, 'style', { 'data-hub-els': 'countdown' }));
  const shown = new El(maker, 'iframe', { 'data-maker-canvas-frame': 'shown' });
  shown.contentDocument = canvas;
  shown.contentWindow = { postMessage: (m) => told.push({ ...m, at: phase }) };
  const cardDoc = new Doc();
  cardDoc.body.append(new El(cardDoc, 'div', { 'data-maker-section': 'w:countdown' }), sectionOf(cardDoc, 'big-number'));
  const card = new El(maker, 'iframe', { 'data-style-preview-frame': 'big-number', src: '/maria-and-jose?editor=1&only=w%3Acountdown&style=countdown%3Abig-number' });
  card.contentDocument = cardDoc;
  maker.body.append(shown, card);
  return { maker, canvas, told, setPhase: (p: string) => (phase = p) };
}

const events: string[] = [];
(globalThis as unknown as { CSS: unknown }).CSS = { escape: (s: string) => s };
(globalThis as unknown as { window: unknown }).window = {
  location: { origin: 'http://x' },
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: (e: { type: string }) => {
    events.push(e.type);
    return true;
  },
  setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
  clearTimeout: (t: ReturnType<typeof setTimeout>) => clearTimeout(t),
};
if (typeof (globalThis as { Event?: unknown }).Event === 'undefined') (globalThis as unknown as { Event: unknown }).Event = class { constructor(public type: string) {} };

test('a Style card tap: the page shows the picked style while the save is still on its way — and its ↺ does too', async () => {
  const s = stage();
  (globalThis as unknown as { document: unknown }).document = s.maker;
  const { styleTap } = await import('./maker-scene-look');
  const { makerRedrawSave, MAKER_CANVAS_REDRAW_EVENT } = await import('./maker-refresh');
  const { undoJournal } = await import('./maker-drawn-undo');
  const { runDrawnUndo } = await import('./maker-undo-run');
  const { layScenePicture, takeScenePicturesOff } = await import('../app/[slug]/_components/scene-look-lay');
  const { findMakerSection } = await import('../app/[slug]/_components/maker-section-find');
  undoJournal.clear();

  let answer!: (r: { ok: true; stamp: string }) => void;
  const send = () => new Promise<{ ok: true; stamp: string }>((r) => (answer = r));
  const tap = styleTap({ canvasKey: 'w:countdown', sceneType: null, styleId: 'big-number', send, refresh: () => {}, save: makerRedrawSave });

  /* 1 — told while the save has not answered */
  const look = s.told.find((m) => m.t === 'sceneLook');
  assert.ok(look, 'the canvas was told to lay the picked style');
  assert.equal(look!.at, 'before the save', 'the picture went to the page BEFORE the save was answered');
  assert.match(look!.html ?? '', /data-look="big-number"/, 'the picture is the tapped card’s own section');
  assert.ok(tap.drawn);

  /* 2 — the bridge lays it over the page's own section; the page's own node stays, hidden */
  assert.ok(layScenePicture(s.canvas as unknown as Document, look!.key!, look!.html!));
  const own = s.canvas.querySelector('[data-look="boxes"]')!;
  assert.ok(own.hasAttribute('data-maker-look-hidden'), 'the page’s own section is hidden, never removed');
  assert.equal(findMakerSection(s.canvas as unknown as Document, 'w:countdown')?.getAttribute('data-look'), 'big-number', 'the page SHOWS the picked style now');
  assert.equal(own.nextElementSibling?.getAttribute('data-look'), 'big-number');
  assert.equal(own.nextElementSibling?.nextElementSibling?.tagName, 'STYLE', 'the scene’s own style still follows a section');

  /* the save answers: the page redraws in place behind the picture */
  s.setPhase('after the save');
  answer({ ok: true, stamp: 's1' });
  await tap.saved;
  assert.ok(events.includes(MAKER_CANVAS_REDRAW_EVENT), 'the answered pick asks for the in-place redraw');

  /* 3 — its ↺ is in the journal, and lays the BEFORE back while ITS save is still on its way */
  const top = undoJournal.top();
  assert.notEqual(top, 'barrier', 'a redraw-saved pick hands its inverse — never a barrier (the slow ↺)');
  assert.ok(top);
  s.setPhase('before the undo is answered');
  let undoAnswered = false;
  const drawn = runDrawnUndo({
    send: async () => {
      await new Promise((r) => setTimeout(r, 20));
      undoAnswered = true;
      return { ok: true, intent: 'undo', matched: true } as never;
    },
    truth: () => {},
    answered: () => {},
  });
  assert.ok(drawn, 'the ↺ is drawn by the Maker itself (the fast path)');
  const back = s.told.filter((m) => m.t === 'sceneLook').at(-1)!;
  assert.equal(back.at, 'before the undo is answered');
  assert.match(back.html ?? '', /data-look="boxes"/, 'the ↺ lays the BEFORE section back at once');
  assert.equal(undoAnswered, false);

  /* 4 — the server's render takes the picture off: the page's own section is back */
  takeScenePicturesOff(s.canvas as unknown as Document);
  assert.equal(s.canvas.querySelectorAll('[data-maker-look-copy]').length, 0);
  assert.equal(own.hasAttribute('data-maker-look-hidden'), false);
});

test('a card not drawn yet lays nothing — the pick still saves, held, with its ↺ in the journal', async () => {
  const s = stage();
  s.maker.querySelector('[data-style-preview-frame]')!.remove();
  (globalThis as unknown as { document: unknown }).document = s.maker;
  const { styleTap } = await import('./maker-scene-look');
  const { makerRedrawSave } = await import('./maker-refresh');
  const { undoJournal } = await import('./maker-drawn-undo');
  undoJournal.clear();
  const tap = styleTap({ canvasKey: 'w:countdown', sceneType: null, styleId: 'big-number', send: async () => ({ ok: true, stamp: 's2' }), refresh: () => {}, save: makerRedrawSave });
  assert.equal(tap.drawn, false);
  assert.equal(s.told.filter((m) => m.t === 'sceneLook').length, 0);
  await tap.saved;
  assert.notEqual(undoJournal.top(), 'barrier');
});

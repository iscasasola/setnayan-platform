/**
 * tap-to-type-every-scene.test.ts — ✍ TAP ANY TEXT, TYPE RIGHT THERE, ON EVERY
 * SCENE (not only the hero).
 *
 * DECISION_LOG "✂ THE MAKER RE-PLAN IS CUT TO ITS CORE" keeps *"tap any text to
 * type"*; the two-week audit (Area B) found it on the HERO only — every other
 * scene's words were typed in an inspector box. This proves, at the RENDER, on
 * the real widgets a guest's page draws:
 *
 *   R1 every scene field the Maker offers (`sceneTypeWords`) is FOUND on the
 *      drawn scene — the Special message (note · letter), the Reminders (note),
 *      a scene of their own's heading and words (plain, and the template
 *      layouts that draw them) — marked on exactly the part whose words they
 *      are; words a style splits (the quote, the list) are not marked, so that
 *      scene keeps its box;
 *   R2 a tap on a marked part puts the caret IN it, in the tap, and tells the
 *      Maker which field it is; several lines take Enter as a new line, a
 *      heading's Enter is Done;
 *   R3 what is typed is ONE draft write to the field's own home, and a guest's
 *      page draws exactly that after Apply; empty / too long / control
 *      characters are refused, not stored;
 *   R4 the wiring: the Maker tells every loading canvas, the box steps aside
 *      only where the canvas found the words, the own-scene form keeps only what
 *      the page does not draw yet and always drafts in the Maker, and nothing in
 *      the canvas half saves.
 *
 * 🪤 No DOM library in the unit runner: a small parser and fake DOM read React's
 * server HTML (the same approach as `part-runs.test.ts`).
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from '@/lib/strip-comments';
import { HUB_DRAFT_TEXT_MAX, emptyHubDraft, mergeHubDraft } from '@/lib/hub-draft';
import { CUSTOM_SECTION_TYPES, CUSTOM_COLUMN_BODY_MAX, CUSTOM_COLUMN_TITLE_MAX } from '@/lib/custom-sections';
import { readSceneTypeWords, readTypeStart, type SceneTypeWords } from '@/lib/hub-part-words';
import { SCENE_WORDS_TEXT_MAX, sceneFieldMax, sceneTypeWords, sceneTypeWrite } from '@/lib/scene-type-words';
import type { InvitationWidgetRow } from '@/lib/invitation-widgets';
import { NO_SCENE_FACTS } from './scene-template';

(globalThis as unknown as { React: unknown }).React = React;
(globalThis as unknown as { CSS: unknown }).CSS ??= { escape: (s: string) => s.replace(/["\\]/g, '\\$&') };

let renderToStaticMarkup: typeof import('react-dom/server').renderToStaticMarkup;
let HubCanvasFrame: typeof import('./hub-canvas-frame').HubCanvasFrame;
let stampSceneElements: typeof import('./editor-bridge').stampSceneElements;
let canvasHalf: typeof import('./type-in-place-canvas');
let SpecialMessageWidget: typeof import('./special-message-widget').SpecialMessageWidget;
let WhatToBringWidget: typeof import('./what-to-bring-widget').WhatToBringWidget;
let renderCustomSection: typeof import('./custom-section-widget').renderCustomSection;
before(async () => {
  ({ renderToStaticMarkup } = await import('react-dom/server'));
  ({ HubCanvasFrame } = await import('./hub-canvas-frame'));
  ({ stampSceneElements } = await import('./editor-bridge'));
  canvasHalf = await import('./type-in-place-canvas');
  ({ SpecialMessageWidget } = await import('./special-message-widget'));
  ({ WhatToBringWidget } = await import('./what-to-bring-widget'));
  ({ renderCustomSection } = await import('./custom-section-widget'));
});

const WEB = join(__dirname, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/* ── a small DOM ────────────────────────────────────────────────────────── */

const unesc = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

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
type Pred = (el: FakeEl) => boolean;
function compound(src: string): Pred {
  const preds: Pred[] = [];
  let rest = src.trim();
  while (rest.length > 0) {
    let m: RegExpExecArray | null;
    if ((m = /^:not\(([^)]*)\)/.exec(rest))) {
      const inner = compound(m[1]!);
      preds.push((el) => !inner(el));
    } else if ((m = /^\.([\w-]+)/.exec(rest))) {
      const c = m[1]!;
      preds.push((el) => (el.getAttribute('class') ?? '').split(/\s+/).includes(c));
    } else if ((m = /^\[([\w-]+)(?:="([^"]*)")?\]/.exec(rest))) {
      const [, a, v] = m;
      preds.push((el) => el.hasAttribute(a!) && (v === undefined || el.getAttribute(a!) === v));
    } else if ((m = /^([a-z][a-z0-9]*)/.exec(rest))) {
      const t = m[1]!.toUpperCase();
      preds.push((el) => el.tagName === t);
    } else throw new Error(`fake DOM cannot parse selector "${src}"`);
    rest = rest.slice(m[0].length);
  }
  return (el) => preds.every((p) => p(el));
}
const selector = (sel: string): Pred => {
  const alts = sel.split(',').map(compound);
  return (el) => alts.some((p) => p(el));
};
type Listener = (e: Record<string, unknown>) => void;
class FakeEl extends FakeNode {
  nodeType = 1;
  attrs = new Map<string, string>();
  childNodes: FakeNode[] = [];
  listeners = new Map<string, Listener[]>();
  focused = 0;
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
  get children(): FakeEl[] {
    return this.childNodes.filter((c): c is FakeEl => c instanceof FakeEl);
  }
  get contentEditable(): string {
    return this.getAttribute('contenteditable') ?? 'inherit';
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
  matches(sel: string) {
    return selector(sel)(this);
  }
  closest(sel: string): FakeEl | null {
    for (let n: FakeEl | null = this; n; n = n.parentNode) if (n.tagName !== 'ROOT' && n.matches(sel)) return n;
    return null;
  }
  contains(n: unknown): boolean {
    for (let c = n as FakeNode | null; c; c = c.parentNode) if (c === this) return true;
    return false;
  }
  appendChild(c: FakeNode) {
    if (c.parentNode) c.parentNode.childNodes.splice(c.parentNode.childNodes.indexOf(c), 1);
    this.childNodes.push(c);
    c.parentNode = this;
    return c;
  }
  get nextElementSibling(): FakeEl | null {
    const s = this.parentNode?.children ?? [];
    return s[s.indexOf(this) + 1] ?? null;
  }
  querySelectorAll(sel: string): FakeEl[] {
    const p = selector(sel);
    const out: FakeEl[] = [];
    const walk = (n: FakeEl) => {
      for (const c of n.children) {
        if (p(c)) out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }
  querySelector(sel: string): FakeEl | null {
    return this.querySelectorAll(sel)[0] ?? null;
  }
  addEventListener(t: string, f: Listener) {
    this.listeners.set(t, [...(this.listeners.get(t) ?? []), f]);
  }
  removeEventListener(t: string, f: Listener) {
    this.listeners.set(t, (this.listeners.get(t) ?? []).filter((x) => x !== f));
  }
  fire(t: string, e: Record<string, unknown> = {}) {
    for (const f of this.listeners.get(t) ?? []) f(e);
  }
  focus() {
    this.focused += 1;
  }
  blur() {
    this.fire('blur');
  }
  getBoundingClientRect() {
    return { top: 10, left: 10, width: 100, height: 20 };
  }
  scrollIntoView() {}
}

function parse(html: string): FakeEl {
  const root = new FakeEl('ROOT');
  let cur = root;
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z0-9]+)>|<([a-zA-Z0-9]+)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/g;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[0].startsWith('<!--')) continue;
    if (m[1]) cur = cur.parentNode ?? root;
    else if (m[2]) {
      const el = new FakeEl(m[2].toUpperCase());
      for (const a of (m[3] ?? '').matchAll(/([^\s=>/]+)(?:="([^"]*)")?/g)) el.setAttribute(a[1]!, unesc(a[2] ?? ''));
      cur.appendChild(el);
      if (!m[4] && !['BR', 'HR', 'IMG', 'INPUT', 'META', 'LINK'].includes(el.tagName)) cur = el;
    } else if (m[5]) cur.appendChild(new FakeText(unesc(m[5])));
  }
  return root;
}

/* ── the page, as the Maker's canvas draws it ───────────────────────────── */

function row(type: string, config: unknown): InvitationWidgetRow {
  return {
    widget_id: `w-${type}`,
    event_id: 'e1',
    widget_type: type,
    display_order: 1,
    is_visible: true,
    is_always_on: false,
    tier: 'basic',
    config_json: config,
    created_at: '',
    updated_at: '',
    mode: 'auto',
  } as unknown as InvitationWidgetRow;
}

type Scene = { type: string; config?: unknown; draw: React.ReactElement | null };

/**
 * The canvas: each scene behind its `data-maker-section` marker, in its frame
 * (`site-body.tsx`), then the bridge's own mount — the parts stamped by the one
 * selector list (`stampSceneElements`) and each section bound.
 */
function canvas(scenes: readonly Scene[]): FakeEl {
  const html = renderToStaticMarkup(
    React.createElement(
      'main',
      null,
      ...scenes.flatMap((sc, i) => [
        React.createElement('span', { key: `m${i}`, hidden: true, 'data-maker-section': `w:${sc.type}` }),
        React.createElement(HubCanvasFrame, { key: `s${i}`, widget: row(sc.type, sc.config ?? {}) } as never, sc.draw),
      ]),
    ),
  );
  const page = parse(html);
  for (const m of page.querySelectorAll('[data-maker-section]')) {
    const section = m.nextElementSibling;
    if (!section) continue;
    stampSceneElements(section as unknown as HTMLElement, m.getAttribute('data-maker-section')!);
    section.setAttribute('data-setnayan-editor-bound', '1');
  }
  return page;
}

const MESSAGE = 'Thank you for being part of our story.\nSee you on the day!';
const REMINDERS = 'Arrive by 2:30\nBring your ticket';
const own = (title: string, body: string, template?: number) => ({
  custom: { title, body },
  ...(template ? { canvas: { template } } : {}),
});

/** Every scene a couple's page can carry words in, drawn the way a guest gets them. */
function everyScene(): Scene[] {
  const custom = (type: string, config: ReturnType<typeof own>): Scene => ({
    type,
    config,
    draw: renderCustomSection({ config, facts: { ...NO_SCENE_FACTS, names: 'Ana & Miguel' } }),
  });
  return [
    { type: 'special_message', draw: React.createElement(SpecialMessageWidget, { text: MESSAGE }) },
    { type: 'what_to_bring', draw: React.createElement(WhatToBringWidget, { text: REMINDERS }) },
    custom('custom_1', own('A word from us', 'We could not wait to share this.\nWith love.')),
    custom('custom_2', own('Our promise', 'Always you.', 8)), // Words only
    custom('custom_3', own('Our day', 'In the garden at four.', 1)), // Photo left, words right (no photo yet)
    custom('custom_4', own('— Ana & Miguel', 'Love is patient.', 9)), // Big quote: the heading is its signature
    custom('custom_5', own('Dear friends', '', 11)), // Letter, bound to the message: its heading only
  ];
}

function offered(scenes: readonly Scene[]): SceneTypeWords[] {
  return sceneTypeWords({
    types: scenes.map((s) => s.type),
    canvases: Object.fromEntries(scenes.map((s) => [s.type, ((s.config as { canvas?: object } | undefined)?.canvas ?? {}) as never])),
    message: MESSAGE,
    reminders: REMINDERS,
    own: Object.fromEntries(
      scenes.filter((s) => s.type.startsWith('custom_')).map((s) => [s.type, (s.config as ReturnType<typeof own>).custom]),
    ),
  });
}

/* ═══ R1 · EVERY OFFERED FIELD IS FOUND ON THE DRAWN SCENE ═══ */

test('R1 · every scene’s words the Maker offers are found on the page a guest gets — on exactly their own part', () => {
  const scenes = everyScene();
  const parts = offered(scenes);
  assert.deepEqual(
    parts.map((p) => `${p.key}|${p.field}`),
    [
      'w:special_message|message',
      'w:what_to_bring|reminders',
      'w:custom_1|title',
      'w:custom_1|body',
      'w:custom_2|title',
      'w:custom_2|body',
      'w:custom_3|title',
      'w:custom_3|body',
      'w:custom_4|title',
      'w:custom_4|body',
      'w:custom_5|title',
    ],
    'every scene that draws words of its own is offered — the Letter’s shared message is not',
  );
  const page = canvas(scenes);
  const found = canvasHalf.markSceneWords(page as unknown as Document, parts);
  assert.deepEqual(found, parts.map((p) => `${p.key}|${p.field}`), 'every offered field is tappable on the page');
  for (const p of parts) {
    const marked = page.querySelectorAll(`[data-el-field="${p.field}"]`).filter((n) => {
      const section = n.closest('[data-setnayan-editor-bound="1"]');
      const marker = page.querySelectorAll('[data-maker-section]').find((m) => m.nextElementSibling === section);
      return marker?.getAttribute('data-maker-section') === p.key;
    });
    assert.equal(marked.length, 1, `${p.key} ${p.field}: one part, and only one`);
    assert.equal(marked[0]!.textContent.replace(/\s+/g, ' ').trim(), p.text.replace(/\s+/g, ' ').trim(), `${p.key} ${p.field}: its own words`);
    assert.ok(['label', 'heading', 'body'].includes(marked[0]!.getAttribute('data-el')!), `${p.key} ${p.field}: a stamped scene part (Style ▾ and Hide work on it)`);
  }
});

test('R1b · words a style splits are not typed into half-way — that scene keeps its box', () => {
  const scenes: Scene[] = [
    { type: 'special_message', draw: React.createElement(SpecialMessageWidget, { text: MESSAGE, sceneStyle: 'quote' }) },
    { type: 'what_to_bring', draw: React.createElement(WhatToBringWidget, { text: REMINDERS, sceneStyle: 'list' }) },
  ];
  const page = canvas(scenes);
  assert.deepEqual(canvasHalf.markSceneWords(page as unknown as Document, offered(scenes)), [], 'nothing marked');
  assert.equal(page.querySelectorAll('[data-el-field]').length, 0);
  // …and the letter style draws the message whole: typed in place.
  const letter = canvas([{ type: 'special_message', draw: React.createElement(SpecialMessageWidget, { text: MESSAGE, sceneStyle: 'letter', signedBy: 'Ana & Miguel' }) }]);
  assert.deepEqual(canvasHalf.markSceneWords(letter as unknown as Document, offered([{ type: 'special_message', draw: null }])), ['w:special_message|message']);
});

test('R1c · a message changed “just here”, an empty scene, and a stale word list are never marked', () => {
  const sm = { type: 'special_message', config: { canvas: { details: { message: 'Only on this scene.' } } }, draw: null };
  assert.deepEqual(
    sceneTypeWords({ types: ['special_message'], canvases: { special_message: sm.config.canvas }, message: MESSAGE, reminders: null, own: {} }),
    [],
    '“Just this scene” keeps its box — its ↺ is the box’s',
  );
  assert.deepEqual(sceneTypeWords({ types: ['special_message', 'what_to_bring', 'custom_1'], canvases: {}, message: '  ', reminders: null, own: { custom_1: { title: '', body: '' } } }), [], 'nothing drawn, nothing offered');
  const page = canvas(everyScene());
  const stale = offered(everyScene()).map((p) => ({ ...p, text: `${p.text} (older words)` }));
  assert.deepEqual(canvasHalf.markSceneWords(page as unknown as Document, stale), [], 'words the page does not show are never typed into');
  assert.deepEqual(readSceneTypeWords([{ key: 'f:hero', field: 'message', text: 'x' }, { key: 'w:x', field: 'nope', text: 'x' }, 'junk']), [], 'the canvas reads only scene keys and known fields');
});

/* ═══ R2 · A TAP PUTS THE CARET IN, IN THE TAP ═══ */

function tapOn(page: FakeEl, field: string) {
  const posted: Record<string, unknown>[] = [];
  const win = {
    document: Object.assign(page, { elementFromPoint: () => null, getSelection: () => null, activeElement: null }),
    innerWidth: 1280,
    addEventListener() {},
    removeEventListener() {},
    requestAnimationFrame: () => 0,
    cancelAnimationFrame() {},
  };
  const typing = canvasHalf.createCanvasTyping(win as unknown as Window, (m) => posted.push(m));
  const part = page.querySelector(`[data-el-field="${field}"]`)!;
  const section = part.closest('[data-setnayan-editor-bound="1"]')!;
  const key = page.querySelectorAll('[data-maker-section]').find((m) => m.nextElementSibling === section)!.getAttribute('data-maker-section')!;
  // The bridge's own rule (`editor-bridge.tsx` send): the hero by name, a scene by its mark.
  const el = canvasHalf.typeablePart(part as unknown as HTMLElement, key) ?? (canvasHalf.sceneTypeField(part as unknown as HTMLElement) ? part.getAttribute('data-el') : null);
  assert.ok(el, `${field}: the tap types`);
  typing.begin(part as unknown as HTMLElement, key, el as never, { x: 1, y: 1 });
  return { posted, part, typing, key };
}

test('R2 · a tap on a scene’s words puts the caret IN them, in the tap, and names the field', () => {
  const page = canvas(everyScene());
  canvasHalf.markSceneWords(page as unknown as Document, offered(everyScene()));
  for (const field of ['message', 'reminders', 'title', 'body']) {
    const { posted, part } = tapOn(page, field);
    const target = canvasHalf.typeTargetOf(part as unknown as HTMLElement) as unknown as FakeEl;
    assert.ok(target.hasAttribute('contenteditable'), `${field}: the words take a caret`);
    assert.ok(target.focused > 0, `${field}: focused in the tap (a phone raises its keyboard only then)`);
    const start = readTypeStart(posted[0], null, 1);
    assert.ok(start, `${field}: the Maker reads the tap as a type start`);
    assert.equal(start!.field, field);
    assert.equal(start!.caret, true);
    assert.ok(start!.text.length > 0);
    target.blur();
  }
});

test('R2b · several lines keep their lines — Enter is a new line; a heading’s Enter is Done', () => {
  const page = canvas(everyScene());
  canvasHalf.markSceneWords(page as unknown as Document, offered(everyScene()));
  const body = tapOn(page, 'message');
  assert.equal(readTypeStart(body.posted[0], null, 1)!.text, MESSAGE, 'the message’s two lines, as typed');
  const target = canvasHalf.typeTargetOf(body.part as unknown as HTMLElement) as unknown as FakeEl;
  let prevented = false;
  target.fire('keydown', { key: 'Enter', preventDefault: () => (prevented = true) });
  assert.equal(prevented, false, 'Enter in the message is a new line');
  target.blur();
  const head = tapOn(page, 'title');
  const h = canvasHalf.typeTargetOf(head.part as unknown as HTMLElement) as unknown as FakeEl;
  prevented = false;
  h.fire('keydown', { key: 'Enter', preventDefault: () => (prevented = true) });
  assert.equal(prevented, true, 'Enter in a heading is Done');
  assert.ok(!h.hasAttribute('contenteditable'), '…and the caret is gone');
  assert.equal(head.posted.at(-1)?.phase, 'end');
});

/* ═══ R3 · ONE DRAFT WRITE, WHAT A GUEST GETS AT APPLY ═══ */

test('R3 · typed words are ONE draft write to their own home — and a guest’s page draws exactly them', () => {
  const m = sceneTypeWrite('message', 'special_message', '  New words.\nSecond line  ', null);
  assert.ok(m.ok);
  assert.equal(m.ok && m.writeKey, 'events:special_message', 'the Special message’s own queue (`special-message-field.tsx` shares it)');
  const d1 = mergeHubDraft(emptyHubDraft(), m.ok ? m.patch : {});
  assert.equal(d1.events.special_message, 'New words.\nSecond line', 'into the draft — not the live row');

  const r = sceneTypeWrite('reminders', 'what_to_bring', 'Arrive by 3', null);
  assert.equal(mergeHubDraft(emptyHubDraft(), r.ok ? r.patch : {}).events.what_to_bring, 'Arrive by 3');

  const t = sceneTypeWrite('title', 'custom_2', 'Our vow', { title: 'Our promise', body: 'Always you.' });
  assert.ok(t.ok);
  const d2 = mergeHubDraft(emptyHubDraft(), t.ok ? t.patch : {});
  assert.deepEqual(d2.widgets.custom_2?.custom, { title: 'Our vow', body: 'Always you.' }, 'the heading, with the words carried along');
  const b = sceneTypeWrite('body', 'custom_2', 'Always, you.', { title: 'Our vow', body: 'Always you.' });
  assert.deepEqual(mergeHubDraft(d2, b.ok ? b.patch : {}).widgets.custom_2?.custom, { title: 'Our vow', body: 'Always, you.' });
  // What a guest's page draws from that draft, after Apply.
  const html = renderToStaticMarkup(renderCustomSection({ config: { custom: d2.widgets.custom_2!.custom, canvas: { template: 8 } }, facts: NO_SCENE_FACTS })!);
  assert.match(html, />Our vow</);
  assert.match(html, />Always you\.</);
  assert.equal(sceneTypeWrite('title', 'custom_1', '   ', { title: 'Old', body: 'Words' }).ok, true, 'a heading may be cleared (it is optional)');
});

test('R3b · refused, never stored: empty words, over the cap, control characters, a scene that is not theirs', () => {
  for (const f of ['message', 'reminders', 'body'] as const) {
    const w = sceneTypeWrite(f, f === 'body' ? 'custom_1' : f === 'message' ? 'special_message' : 'what_to_bring', '  \n ', { title: 'x', body: 'y' });
    assert.equal(w.ok, false, `${f}: emptied is refused`);
    assert.match(w.ok ? '' : w.reason, /Hide/, `${f}: …and says how to take it off the page`);
  }
  assert.equal(sceneTypeWrite('message', 'special_message', 'x'.repeat(601), null).ok, false);
  assert.equal(sceneTypeWrite('title', 'custom_1', 'x'.repeat(81), { title: '', body: 'b' }).ok, false);
  assert.equal(sceneTypeWrite('body', 'custom_1', 'a\u0000b', { title: '', body: 'b' }).ok, false);
  assert.equal(sceneTypeWrite('body', 'dress_code', 'words', null).ok, false, 'only a scene of their own has `custom`');
  // The caps ARE the writers' caps (restated so the bar's chunk carries no draft module).
  assert.equal(SCENE_WORDS_TEXT_MAX, HUB_DRAFT_TEXT_MAX);
  assert.equal(sceneFieldMax('title'), CUSTOM_COLUMN_TITLE_MAX);
  assert.equal(sceneFieldMax('body'), CUSTOM_COLUMN_BODY_MAX);
  for (const t of CUSTOM_SECTION_TYPES) assert.equal(sceneTypeWrite('body', t, 'w', null).ok, true, `${t} is a scene of their own`);
  assert.equal(sceneTypeWrite('body', 'custom_7', 'w', null).ok, false);
});

/* ═══ R4 · THE WIRING ═══ */

test('R4 · the Maker tells every canvas; the box steps aside only where the canvas found the words; the canvas never saves', () => {
  const shell = read('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');
  assert.match(shell, /d\.t === 'ready'\) \{\s*\(event\.source as Window \| null\)\?\.postMessage\(\s*\{ source: 'setnayan-editor', t: 'typeHere', parts: typeHereRef\.current \}/, 'every canvas that loads hears which words a tap types in');
  assert.match(shell, /typedField && typedHereOn\(sceneKey, typedField\)/, 'the box steps aside only for words the canvas found');
  assert.doesNotMatch(shell, /from '\.\/type-in-place'|scene-type-words'/, 'the Maker’s first load carries neither the bar nor the write rules');
  const page = read('app/dashboard/[eventId]/website/editor/page.tsx');
  assert.match(page, /typeHere: sceneTypeWords\(\{/, 'the words told to the canvas are the draft over live the canvas draws');

  const bridge = read('app/[slug]/_components/editor-bridge.tsx');
  assert.match(bridge, /typeablePart\(part, key\) \?\? \(sceneTypeField\(part\)/, 'a tap on a marked scene part begins typing, in the click');
  assert.match(bridge, /markSceneWords\(document, readSceneTypeWords\(/);
  const canvasSrc = read('app/[slug]/_components/type-in-place-canvas.ts');
  assert.doesNotMatch(canvasSrc, /fetch\(|actions'|FormData|makerSave|hub-draft/, 'the canvas only types and tells');

  const bar = read('app/dashboard/[eventId]/website/editor/_components/type-in-place.tsx');
  assert.equal((bar.match(/makerSave\(/g) ?? []).length, 1, 'still ONE write path for everything the bar writes');
  assert.match(bar, /if \(field\) \{\s*typeScene\(session\.text\);\s*return;\s*\}/, 'a scene keystroke is a scene write');
  assert.match(bar, /write\(\s*w\.writeKey,\s*w\.patch,/, 'the scene’s one draft write, through the one path');
  assert.match(bar, /const lines = field \? \[\] :/, 'no Wording ▾ invented for a couple’s own words');
});

test('R4b · the own-scene form keeps only what the page does not draw yet — and in the Maker it always drafts', () => {
  const panel = read('app/dashboard/[eventId]/website/editor/_components/sections-panel.tsx');
  assert.match(panel, /const askTitle = !makerPart \|\| !title \|\|/);
  assert.match(panel, /const askBody = !makerPart \|\| \(!body && !letterBound\)/);
  assert.match(panel, /\{askTitle \? \(/, 'the heading box only when the page has no heading to tap');
  assert.match(panel, /!askBody \? null :/, 'the words box only when the page has no words to tap');
  assert.match(panel, /const draftWords = wordsDrafted \|\| Boolean\(makerPart\);/, 'never a live write from inside the Maker');
  assert.match(panel, /\{draftWords \? <HubDraftField \/> : <HubSavesImmediately \/>\}/);
  const action = read('app/dashboard/[eventId]/website/widgets/actions.ts');
  assert.match(action, /kept && !formData\.has\('title'\) \? kept\.title : formData\.get\('title'\)/, 'a heading posted alone keeps the words');
  assert.match(action, /kept && !formData\.has\('body'\) \? kept\.body : formData\.get\('body'\)/);
});

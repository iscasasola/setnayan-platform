/**
 * maker-scene-words.test.ts — ✍ THE MAKER IS THE EDITOR: WORDS ARE EDITED
 * WHERE THEY ARE SEEN (owner 2026-09-27, DECISION_LOG).
 *
 * Owner, writing his own invitation: *"i cannot write a message"* · *"this is
 * the editor, so we can edit here"* · *"needs to show on the scene editor"*.
 * What this file proves, on the real functions and the real markup:
 *
 *   1 · a tap on a words scene's words — or anywhere on it while it is empty —
 *       opens its words box; a tap on any other scene's part does not;
 *   2 · what is typed is ON THE CANVAS SCENE: the bridge writes it into the
 *       scene's real look (the widget guests get), the empty scene's prompt
 *       steps aside, and a blank box brings the prompt back — on the empty
 *       Special message, a written one, What to bring, and a Letter (where the
 *       signature is never overwritten);
 *   3 · the Maker wiring: the canvas tap and the navigator tile open Content
 *       focused, both words boxes preview, and the canvas gets the preview
 *       again when it reloads;
 *   4 · the navigator's tile shows a scene's OWN version of the message.
 *
 * 🪤 There is no DOM library in the unit runner, so a small parser below reads
 * React's server HTML into nodes the bridge's functions can query and write.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isWordsScene, tapOpensWords, MAKER_WORDS_SCENE_TYPES } from './maker-scene-words';
import { stripComments } from './strip-comments';
import { makerEmptyPrompt, makerSceneLabel } from './maker-scene-list';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

let renderToStaticMarkup: typeof import('react-dom/server').renderToStaticMarkup;
let bridge: typeof import('@/app/[slug]/_components/editor-bridge');
let empty: typeof import('@/app/[slug]/_components/maker-empty-scene');
let SpecialMessageWidget: typeof import('@/app/[slug]/_components/special-message-widget').SpecialMessageWidget;
let WhatToBringWidget: typeof import('@/app/[slug]/_components/what-to-bring-widget').WhatToBringWidget;
let scene: typeof import('@/app/[slug]/_components/scene-template');
before(async () => {
  ({ renderToStaticMarkup } = await import('react-dom/server'));
  bridge = await import('@/app/[slug]/_components/editor-bridge');
  empty = await import('@/app/[slug]/_components/maker-empty-scene');
  ({ SpecialMessageWidget } = await import('@/app/[slug]/_components/special-message-widget'));
  ({ WhatToBringWidget } = await import('@/app/[slug]/_components/what-to-bring-widget'));
  scene = await import('@/app/[slug]/_components/scene-template');
});

/* ── a small DOM, enough for the bridge ─────────────────────────────────── */

const unesc = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

type Simple = { tag?: string; classes: string[]; attrs: Array<[string, string | null]>; nots: Simple[] };

function parseSimple(sel: string): Simple {
  const out: Simple = { classes: [], attrs: [], nots: [] };
  let rest = sel.trim();
  const tag = /^[a-z][a-z0-9]*/i.exec(rest);
  if (tag) {
    out.tag = tag[0].toLowerCase();
    rest = rest.slice(tag[0].length);
  }
  while (rest.length > 0) {
    let m: RegExpExecArray | null;
    if ((m = /^\.([\w-]+)/.exec(rest))) out.classes.push(m[1]!);
    else if ((m = /^\[([\w-]+)(?:="([^"]*)")?\]/.exec(rest))) out.attrs.push([m[1]!, m[2] ?? null]);
    else if ((m = /^:not\(([^)]*)\)/.exec(rest))) out.nots.push(parseSimple(m[1]!));
    else throw new Error(`the fake DOM cannot read "${rest}" in "${sel}"`);
    rest = rest.slice(m[0].length);
  }
  return out;
}

class Node_ {
  parent: El | null = null;
}
class Txt extends Node_ {
  constructor(public data: string) {
    super();
  }
}
class El extends Node_ {
  attrs = new Map<string, string>();
  /** Only `display` matters here: a class's display outranks `hidden`, so the bridge sets both. */
  style: { display: string } = { display: '' };
  children: Array<El | Txt> = [];
  constructor(public tag: string) {
    super();
  }
  getAttribute(n: string) {
    return this.attrs.get(n) ?? null;
  }
  setAttribute(n: string, v: string) {
    this.attrs.set(n, v);
  }
  hasAttribute(n: string) {
    return this.attrs.has(n);
  }
  get hidden() {
    return this.attrs.has('hidden');
  }
  set hidden(v: boolean) {
    if (v) this.attrs.set('hidden', '');
    else this.attrs.delete('hidden');
  }
  get textContent(): string {
    return this.children.map((c) => (c instanceof Txt ? c.data : c.textContent)).join('');
  }
  set textContent(v: string) {
    const t = new Txt(v);
    t.parent = this;
    this.children = [t];
  }
  private hit(s: Simple): boolean {
    if (s.tag && s.tag !== this.tag) return false;
    const cls = (this.attrs.get('class') ?? '').split(/\s+/);
    if (!s.classes.every((c) => cls.includes(c))) return false;
    if (!s.attrs.every(([n, v]) => this.attrs.has(n) && (v === null || this.attrs.get(n) === v))) return false;
    return s.nots.every((n) => !this.hit(n));
  }
  matches(sel: string): boolean {
    return sel.split(',').some((g) => this.hit(parseSimple(g)));
  }
  querySelectorAll<T = El>(sel: string): T[] {
    const out: El[] = [];
    const walk = (e: El) => {
      for (const c of e.children) {
        if (c instanceof El) {
          if (c.matches(sel)) out.push(c);
          walk(c);
        }
      }
    };
    walk(this);
    return out as unknown as T[];
  }
  querySelector<T = El>(sel: string): T | null {
    return (this.querySelectorAll<T>(sel)[0] ?? null) as T | null;
  }
  /** Visible text: what a hidden ancestor keeps off the screen is left out. */
  shownText(): string {
    // A flex class outranks `hidden` in a real browser, so ONLY an inline `display: none` counts
    // for an element whose class sets a display (the eyebrow); `hidden` counts for the rest.
    const cls = this.attrs.get('class') ?? '';
    const classDisplays = /\b(flex|grid|block|inline-flex|pahina-eyebrow)\b/.test(cls);
    if (this.style.display === 'none' || (this.hidden && !classDisplays)) return '';
    return this.children.map((c) => (c instanceof Txt ? c.data : c.shownText())).join('');
  }
}

const VOID = new Set(['br', 'img', 'hr', 'input', 'meta', 'link', 'source']);
function parse(html: string): El {
  const root = new El('#root');
  let cur = root;
  const re = /<(\/?)([a-z][a-z0-9]*)\b([^>]*?)(\/?)>|([^<]+)/gi;
  for (const m of html.matchAll(re)) {
    if (m[5] !== undefined) {
      const t = new Txt(unesc(m[5]));
      t.parent = cur;
      cur.children.push(t);
      continue;
    }
    const tag = m[2]!.toLowerCase();
    if (m[1] === '/') {
      cur = cur.parent ?? root;
      continue;
    }
    const el = new El(tag);
    for (const a of m[3]!.matchAll(/([\w-:]+)(?:="([^"]*)")?/g)) el.attrs.set(a[1]!, unesc(a[2] ?? ''));
    el.parent = cur;
    cur.children.push(el);
    if (m[4] !== '/' && !VOID.has(tag)) cur = el;
  }
  return root;
}

/** Render, parse, and hand back the scene's root as the bridge would see it (stamped at mount). */
function mount(node: React.ReactElement, key: string): El {
  const root = parse(renderToStaticMarkup(node));
  const section = root.children.find((c): c is El => c instanceof El)!;
  // The bridge binds the element AFTER the marker; the frame wraps the scene in it.
  const wrap = new El('div');
  wrap.children = [section];
  section.parent = wrap;
  bridge.stampSceneElements(wrap as unknown as HTMLElement, key);
  return wrap;
}
const preview = (section: El, text: string) => bridge.previewSceneWords(section as unknown as Element, text);

/* ── 1 · which tap opens the words ─────────────────────────────────────── */

test('✍ a tap on a words scene’s words — or on the empty scene — opens its words; nothing else does', () => {
  assert.deepEqual([...MAKER_WORDS_SCENE_TYPES], ['special_message', 'what_to_bring']);
  assert.equal(isWordsScene('special_message', {}), true);
  assert.equal(isWordsScene('what_to_bring', null), true);
  assert.equal(isWordsScene('custom_1', { template: 11 }), true, 'a Letter shows the message — its words open too');
  assert.equal(isWordsScene('custom_1', { template: 11 }, ['custom_1']), false, 'a Letter with words of its own keeps them in Format');
  assert.equal(isWordsScene('custom_1', { template: 2 }), false);
  assert.equal(isWordsScene('countdown', {}), false);
  assert.equal(isWordsScene('our_love_story', {}), false, 'Love Story is a scrapbook, not one box');

  assert.equal(tapOpensWords({ wordsScene: true, el: 'body', empty: undefined }), true, 'the words themselves');
  assert.equal(tapOpensWords({ wordsScene: true, el: 'label', empty: true }), true, 'anywhere on the empty placeholder');
  assert.equal(tapOpensWords({ wordsScene: true, el: undefined, empty: true }), true);
  assert.equal(tapOpensWords({ wordsScene: true, el: 'label', empty: undefined }), false, 'a written scene’s label still styles');
  assert.equal(tapOpensWords({ wordsScene: true, el: undefined, empty: undefined }), false, 'its space still opens the scene');
  assert.equal(tapOpensWords({ wordsScene: false, el: 'body', empty: true }), false, 'any other scene: unchanged');
});

/* ── 2 · what is typed is on the canvas scene ──────────────────────────── */

test('✍ the EMPTY Special message shows what is typed in the real look, and the prompt steps aside', () => {
  const s = mount(
    React.createElement(empty.MakerEmptyScene, { type: 'special_message', look: empty.makerWordsLook('special_message') }),
    'w:special_message',
  );
  const before = s.shownText();
  const prompt = makerEmptyPrompt('special_message');
  assert.ok(before.includes(prompt), 'the placeholder asks for the message');
  assert.match(before, /Only you see this/);
  assert.ok(!before.includes('Dear family'), 'nothing typed yet');
  const look = s.querySelector('[data-maker-look]')!;
  assert.equal(look.hidden, true, 'the look waits hidden');
  assert.ok(look.querySelector('.pahina-plate'), 'the look is the widget guests get — its plate');

  assert.equal(preview(s, 'Dear family,\nsee you there.'), true);
  const after = s.shownText();
  assert.ok(after.includes('Dear family,\nsee you there.'), 'the typed words are on the scene, line breaks kept');
  assert.ok(!after.includes(prompt), 'the prompt stepped aside');
  assert.ok(
    !after.includes(makerSceneLabel('special_message')),
    'its label stepped aside too — a flex eyebrow ignores `hidden`, so the bridge must set display',
  );
  assert.ok(after.includes('A note from us'), 'the look’s own label is what guests will read');
  assert.match(after, /Only you see this/, 'the "only you see this" line stays until it is saved');
  // In the real look's text part — the same element guests' words are drawn in.
  assert.equal(look.querySelector('[data-el="body"]')!.textContent, 'Dear family,\nsee you there.');

  preview(s, '   ');
  assert.equal(look.hidden, true, 'a blank box brings the placeholder back');
  assert.ok(s.shownText().includes(prompt), 'the prompt is back');
  for (const p of s.querySelectorAll('[data-maker-empty-prompt]')) assert.equal(p.hidden, false);
});

test('✍ a WRITTEN Special message has its words replaced, and nothing else', () => {
  const s = mount(React.createElement(SpecialMessageWidget, { text: 'Old words' }), 'w:special_message');
  assert.equal(preview(s, 'New words'), true);
  assert.ok(s.shownText().includes('New words'));
  assert.ok(!s.shownText().includes('Old words'));
  assert.ok(s.shownText().includes('A note from us'), 'the label is not the words');
});

test('✍ What to bring previews the same way — empty and written', () => {
  const e = mount(
    React.createElement(empty.MakerEmptyScene, { type: 'what_to_bring', look: empty.makerWordsLook('what_to_bring') }),
    'w:what_to_bring',
  );
  preview(e, 'Your presence is our gift.');
  assert.ok(e.shownText().includes('Your presence is our gift.'));
  const w = mount(React.createElement(WhatToBringWidget, { text: 'Registry at X' }), 'w:what_to_bring');
  preview(w, 'No gifts, please');
  assert.ok(w.shownText().includes('No gifts, please'));
  assert.ok(!w.shownText().includes('Registry at X'));
});

test('✍ a Letter previews in its text, never over its signature', () => {
  const el = scene.renderScene({
    canvas: { template: 11 },
    words: { title: '', body: '' },
    facts: { ...scene.NO_SCENE_FACTS, specialMessage: 'Old letter', names: 'Ana & Ben' },
  });
  assert.ok(el, 'the Letter renders');
  const s = mount(el!, 'w:custom_1');
  preview(s, 'A new letter');
  assert.ok(s.shownText().includes('A new letter'));
  assert.ok(s.shownText().includes('Ana & Ben'), 'the signature is untouched');
});

test('an empty scene with no one-text content carries no look (nothing to preview into)', () => {
  assert.equal(empty.makerWordsLook('our_love_story'), null);
  assert.equal(empty.makerWordsLook('venue_map'), null);
});

/* ── 3 · the Maker wiring ──────────────────────────────────────────────── */

test('the canvas tap and the navigator tile open Content with the box focused', () => {
  const shell = read('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');
  const onEdit = shell.slice(shell.indexOf("data.t !== 'edit'"), shell.indexOf("window.addEventListener('message', onMessage)"));
  const words = onEdit.indexOf('openWordsOnTap(');
  assert.ok(words > 0, 'the canvas tap asks whether it opens the words');
  assert.ok(words < onEdit.indexOf('setElementTarget((prev)'), 'before the style sheet can take the tap');
  assert.match(onEdit.slice(words), /select\?\.\(\{ \.\.\.picked, tab: 'content' \}\)[\s\S]*?setWordsFocus\(/);
  const tile = shell.slice(shell.indexOf('select?.(selectionForTile(tile));'), shell.indexOf('select?.(selectionForTile(tile));') + 700);
  assert.match(tile, /isWordsScene\(tile\.type/, 'the tile asks too');
  assert.match(tile, /select\?\.\(\{ kind: 'scene', id: tile\.widgetId, tab: 'content' \}\)/);
  assert.match(tile, /setWordsFocus\(/);
  assert.match(shell, /<CanvasWordsContext\.Provider value=\{canvasWords\}>\s*<Inspector/, 'the boxes can reach the canvas');
  // A canvas that reloads while a box is open gets the words again.
  assert.match(shell, /d\.t !== 'ready'\) return;\s*for \(const \[key, text\] of Object\.entries\(wordsPending\.current\)\) postWords\(key, text\)/);
});

test('both words boxes preview as they are typed and take the focus', () => {
  const field = read('app/dashboard/[eventId]/website/editor/_components/details-bound-field.tsx');
  assert.match(field, /useSceneWordsBox\(`w:\$\{widgetType\}`, box,/);
  assert.match(field, /onChange=\{\(e\) => \{[^}]*preview\(e\.target\.value\)/);
  assert.match(field, /ref=\{box\}/);
  const panel = read('app/dashboard/[eventId]/website/editor/_components/text-panel.tsx');
  assert.match(panel, /useSceneWordsBox\(previewKey, box,/);
  assert.match(panel, /onInput=\{\(e\) => preview\(e\.currentTarget\.value\)\}/);
  const page = read('app/dashboard/[eventId]/website/editor/page.tsx');
  assert.match(page, /previewKey="w:what_to_bring"/, 'What to bring’s box previews on its scene');
  assert.match(page, /startingPoint: drafted\.special_message \? null : messageBoxOpens/, 'the scene’s box keeps AP-11’s starting point');
});

/* ── 4 · the navigator tile ────────────────────────────────────────────── */

test('the navigator tile shows a scene’s OWN version of the message', async () => {
  const { buildMakerNavigatorData } = await import('@/app/dashboard/[eventId]/website/editor/_components/maker-navigator-data');
  const row = (type: string, config: unknown) => ({
    widget_id: `w-${type}`,
    event_id: 'e1',
    widget_type: type,
    display_order: 5,
    is_visible: true,
    is_always_on: false,
    tier: 'basic',
    config_json: config,
    created_at: '',
    updated_at: '',
    mode: 'auto',
  });
  const facts = {
    names: null, dateLabel: null, daysToGo: null, venueName: null, venueAddress: null, firstBlock: null,
    dressTitle: null, dressLine: null, photoMomentsLine: null, specialMessage: 'Details words', whatToBring: null,
    loveStory: null, entourageCount: null, heroPhotoUrl: null, firstGalleryUrl: null,
  };
  const build = (rows: unknown[]) =>
    buildMakerNavigatorData({
      plan: { widgets: rows, content: {}, solemn: false } as never,
      sectionRows: rows as never,
      tint: { canvas: '#ffffff', ink: '#000000', accent: '#888888' },
      facts,
      photoUrls: {},
    }).minis;
  const bound = build([row('special_message', {}), row('custom_1', { canvas: { template: 11 } })]);
  assert.equal(bound['w:special_message']!.title, 'Details words', 'bound: Details’ words');
  assert.equal(bound['w:custom_1']!.line, 'Details words', 'a Letter shows the message too');
  const own = build([
    row('special_message', { canvas: { details: { message: 'Only on this scene' } } }),
    row('custom_1', { canvas: { template: 11, details: { message: 'The letter’s own' } } }),
  ]);
  assert.equal(own['w:special_message']!.title, 'Only on this scene', '"Just this scene" shows on its tile');
  assert.equal(own['w:custom_1']!.line, 'The letter’s own');
});

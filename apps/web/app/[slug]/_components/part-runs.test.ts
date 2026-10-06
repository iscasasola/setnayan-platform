/**
 * part-runs.test.ts — ✍ ONE LETTER, ONE WORD IN ITS OWN LOOK, IN EVERY SCENE.
 *
 * Until 2026-09-29 a run (a letter or a word in its own font · colour · size,
 * owner 2026-09-27: *"they can take 1 letter and change the font"*) reached
 * the hero only. This file holds what extending it to every scene's label,
 * heading and words promises — through the SAME mechanism, not a second one:
 *
 *   S1 the scene's runs reach the guest page (`HubCanvasFrame` →
 *      `<style data-hub-runs>`), and only when a part has one — an untouched
 *      scene's markup is unchanged;
 *   S2 the page cuts them into the SAME `<span data-el-run>` the hero draws,
 *      with the SAME declarations (`hubRunDeclarations`), in a REAL widget;
 *   S3 a scene key addresses every heading, but the runs land on the ONE whose
 *      words they were made on;
 *   S4 words changed in Details / in place: the runs ADAPT (kept letters keep
 *      their style); gone letters take theirs with them;
 *   S5 cutting is idempotent — a new choice or new words re-cut, never nest;
 *   S6 the Maker canvas lays the same cut on every choice and every keystroke;
 *   S7 the wiring: mounted by the page, the selection carries its words, the
 *      sheet re-anchors; ⛔ never the RSVP form;
 *   P  a scene run's FONT is Event Hub Pro at Apply, its colour and size are free.
 *
 * 🪤 No DOM library in the unit runner: a small parser and fake DOM (with the
 * handful of selectors the scene list uses) read React's server HTML.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import * as es from '@/lib/element-style';
import { HUB_FONTS_MOST_USED } from '@/lib/hub-fonts';
import { stripComments } from '@/lib/strip-comments';
import { emptyHubDraft, mergeHubDraft, planHubDraftApply, type HubLiveState } from '@/lib/hub-draft';
import type { InvitationWidgetRow } from '@/lib/invitation-widgets';
import { applyAllSceneRuns, applySceneRuns } from './part-runs';

(globalThis as unknown as { React: unknown }).React = React;

let renderToStaticMarkup: typeof import('react-dom/server').renderToStaticMarkup;
let HubCanvasFrame: typeof import('./hub-canvas-frame').HubCanvasFrame;
let CustomSectionWidget: typeof import('./custom-section-widget').CustomSectionWidget;
let bridge: typeof import('./editor-bridge');
before(async () => {
  ({ renderToStaticMarkup } = await import('react-dom/server'));
  ({ HubCanvasFrame } = await import('./hub-canvas-frame'));
  ({ CustomSectionWidget } = await import('./custom-section-widget'));
  bridge = await import('./editor-bridge');
});

const WEB = join(__dirname, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/* ── a small DOM ────────────────────────────────────────────────────────── */

const unesc = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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

type Pred = (el: FakeEl) => boolean;
/** A compound selector: tag · .class · [attr] · [attr="v"] · :not(compound). */
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
  matches(sel: string) {
    return selector(sel)(this);
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
  private siblings(): FakeEl[] {
    return (this.parentNode?.childNodes ?? []).filter((c): c is FakeEl => c instanceof FakeEl);
  }
  get nextSibling(): FakeNode | null {
    const sibs = this.parentNode?.childNodes ?? [];
    return sibs[sibs.indexOf(this) + 1] ?? null;
  }
  get nextElementSibling(): FakeEl | null {
    const s = this.siblings();
    return s[s.indexOf(this) + 1] ?? null;
  }
  get previousElementSibling(): FakeEl | null {
    const s = this.siblings();
    return s[s.indexOf(this) - 1] ?? null;
  }
  querySelectorAll(sel: string): FakeEl[] {
    const p = selector(sel);
    const out: FakeEl[] = [];
    const walk = (n: FakeEl) => {
      for (const c of n.childNodes) {
        if (!(c instanceof FakeEl)) continue;
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
}

const doc = {
  createElement: (t: string) => new FakeEl(t.toUpperCase()),
  createTextNode: (d: string) => new FakeText(d),
} as unknown as Pick<Document, 'createElement' | 'createTextNode'>;

function parse(html: string): FakeEl {
  const root = new FakeEl('ROOT');
  let cur = root;
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z0-9]+)>|<([a-zA-Z0-9]+)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/g;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[0].startsWith('<!--')) continue;
    if (m[1]) cur = cur.parentNode ?? root;
    else if (m[2]) {
      const el = new FakeEl(m[2].toUpperCase());
      for (const a of (m[3] ?? '').matchAll(/([^\s=>/]+)(?:="([^"]*)")?/g)) {
        const value = unesc(a[2] ?? '');
        if (a[1] === 'style') {
          for (const decl of value.split(';')) {
            const i = decl.indexOf(':');
            if (i > 0) el.style.setProperty(decl.slice(0, i).trim(), decl.slice(i + 1).trim());
          }
        } else el.setAttribute(a[1]!, value);
      }
      cur.appendChild(el);
      if (!m[4] && !['BR', 'HR', 'IMG', 'INPUT', 'META', 'LINK'].includes(el.tagName)) cur = el;
    } else if (m[5]) cur.appendChild(new FakeText(unesc(m[5])));
  }
  return root;
}

function serialize(n: FakeNode): string {
  if (n instanceof FakeText) return esc(n.data);
  const el = n as FakeEl;
  let attrs = '';
  for (const [k, v] of el.attrs) attrs += ` ${k}="${esc(v)}"`;
  if (el.style.map.size > 0) attrs += ` style="${esc([...el.style.map].map(([p, v]) => `${p}:${v}`).join(';'))}"`;
  return `<${el.tagName.toLowerCase()}${attrs}>${el.childNodes.map(serialize).join('')}</${el.tagName.toLowerCase()}>`;
}

/* ── fixtures ────────────────────────────────────────────────────────────── */

const FONT = HUB_FONTS_MOST_USED[0]!;

function widget(type: string, config: unknown): InvitationWidgetRow {
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

/** A scene as a guest's page draws it — the frame around a widget's markup. */
function scenePage(type: string, elements: unknown, children: React.ReactElement): FakeEl {
  const els = es.sanitizeHubElements(elements);
  const html = renderToStaticMarkup(
    React.createElement(
      'main',
      null,
      React.createElement(HubCanvasFrame, { widget: widget(type, els ? { canvas: { elements: els } } : {}) } as never, children),
    ),
  );
  return parse(html);
}

const STORY = React.createElement(
  'section',
  null,
  React.createElement('p', { className: 'pahina-eyebrow' }, 'Our day'),
  React.createElement('h2', null, 'Our story'),
  React.createElement('h3', null, 'How we met'),
  React.createElement('p', null, 'We met in Baguio.'),
);
const anchored = (runs: es.HubElementRun[], was: string) => ({ runs, of: es.hubTextHash(was), was });
const runSpans = (el: FakeEl) => el.querySelectorAll('[data-el-run]').map((s) => [s.textContent, Object.fromEntries(s.style.map)]);

/* ── S1 ─────────────────────────────────────────────────────────────────── */

test('S1 · a scene with a run carries it on its scoped <style>, even with no other choice; untouched scenes carry nothing', () => {
  const page = scenePage('details', { heading: anchored([{ start: 4, end: 9, color: '#8a1c2b' }], 'Our story') }, STORY);
  const tag = page.querySelector('style[data-hub-els="details"]');
  assert.ok(tag, 'the style tag is placed for a run alone');
  assert.equal(tag!.previousElementSibling?.tagName, 'SECTION', 'straight after the scene, where the page looks for it');
  const carried = es.readHubSceneRuns(tag!.getAttribute('data-hub-runs'));
  assert.deepEqual(carried?.heading?.runs, [{ start: 4, end: 9, color: '#8a1c2b' }]);
  assert.equal(carried?.heading?.was, 'Our story');

  const plain = renderToStaticMarkup(React.createElement(HubCanvasFrame, { widget: widget('details', {}) } as never, STORY));
  assert.equal(plain, renderToStaticMarkup(STORY), "an untouched scene's markup is byte-identical");
  const colourOnly = renderToStaticMarkup(
    React.createElement(HubCanvasFrame, { widget: widget('details', { canvas: { elements: { heading: { color: '#112233' } } } }) } as never, STORY),
  );
  assert.doesNotMatch(colourOnly, /data-hub-runs/, 'no runs, no attribute');
});

/* ── S2 ─────────────────────────────────────────────────────────────────── */

test('S2 · the page cuts a scene heading into the SAME span the hero draws — one letter, its own font', () => {
  const run = { start: 4, end: 5, font: FONT, size: 120 as const };
  const page = scenePage('details', { heading: anchored([run], 'Our story') }, STORY);
  assert.equal(applyAllSceneRuns(page as unknown as Document, doc), 1);
  const h2 = page.querySelector('h2')!;
  assert.equal(h2.textContent, 'Our story', 'not a letter added or lost');
  assert.deepEqual(runSpans(h2), [['s', Object.fromEntries(es.hubRunDeclarations(run))]]);
  // The hero's own span, from the same function the server renders it with.
  assert.match(serialize(h2), /^<h2>Our <span data-el-run="" style="[^"]+">s<\/span>tory<\/h2>$/);
  assert.equal(page.querySelector('h3')!.querySelectorAll('[data-el-run]').length, 0);
});

test('S2 · in a REAL widget: a couple\'s own section — its label (inside a span) and its words', () => {
  const custom = { custom: { title: 'Our vows', body: 'I promise to love you\nevery day' } };
  const body = 'I promise to love you\nevery day';
  const els = es.sanitizeHubElements({
    label: anchored([{ start: 4, end: 8, color: '#8a1c2b' }], 'Our vows'),
    body: anchored([{ start: 13, end: 17, font: FONT }], body),
  });
  const html = renderToStaticMarkup(
    React.createElement(
      HubCanvasFrame,
      { widget: widget('custom_1', { ...custom, canvas: { elements: els } }) } as never,
      React.createElement(CustomSectionWidget, { config: custom }),
    ),
  );
  const page = parse(`<main>${html}</main>`);
  assert.equal(applyAllSceneRuns(page as unknown as Document, doc), 2);
  assert.deepEqual(runSpans(page.querySelector('.pahina-eyebrow')!), [['vows', { color: '#8a1c2b' }]]);
  assert.deepEqual(runSpans(page.querySelector('p:not(.pahina-eyebrow)')!).map((r) => r[0]), ['love']);
});

/* ── S3 ─────────────────────────────────────────────────────────────────── */

test('S3 · a scene has two headings: the runs land on the one they were made on, never on both', () => {
  const page = scenePage('details', { heading: anchored([{ start: 0, end: 3, color: '#8a1c2b' }], 'How we met') }, STORY);
  applyAllSceneRuns(page as unknown as Document, doc);
  assert.equal(page.querySelector('h2')!.querySelectorAll('[data-el-run]').length, 0, 'Our story is untouched');
  assert.deepEqual(runSpans(page.querySelector('h3')!), [['How', { color: '#8a1c2b' }]]);
});

/* ── S4 ─────────────────────────────────────────────────────────────────── */

test('S4 · the heading was edited ("Our story" → "Our love story"): the styled word keeps its style', () => {
  const edited = React.createElement('section', null, React.createElement('h2', null, 'Our love story'), React.createElement('h3', null, 'How we met'));
  const page = scenePage('details', { heading: anchored([{ start: 4, end: 9, font: FONT }], 'Our story') }, edited);
  applyAllSceneRuns(page as unknown as Document, doc);
  assert.deepEqual(runSpans(page.querySelector('h2')!).map((r) => r[0]), ['story']);
  assert.equal(page.querySelector('h3')!.querySelectorAll('[data-el-run]').length, 0);
});

test('S4 · the styled word was deleted: its style goes with it — nothing lands on another word', () => {
  const edited = React.createElement('section', null, React.createElement('h2', null, 'Our journey'));
  const page = scenePage('details', { heading: anchored([{ start: 4, end: 9, font: FONT }], 'Our story') }, edited);
  applyAllSceneRuns(page as unknown as Document, doc);
  assert.equal(page.querySelectorAll('[data-el-run]').length, 0);
});

test('S4 · a run from before `was` existed, on changed words: dropped, as it always was', () => {
  const edited = React.createElement('section', null, React.createElement('h2', null, 'Our love story'));
  const page = scenePage('details', { heading: { runs: [{ start: 4, end: 9, font: FONT }], of: es.hubTextHash('Our story') } }, edited);
  applyAllSceneRuns(page as unknown as Document, doc);
  assert.equal(page.querySelectorAll('[data-el-run]').length, 0);
});

/* ── S5 ─────────────────────────────────────────────────────────────────── */

test('S5 · cutting twice is cutting once; a new choice re-cuts from plain text', () => {
  const page = scenePage('details', { heading: anchored([{ start: 0, end: 3, color: '#8a1c2b' }], 'Our story') }, STORY);
  applyAllSceneRuns(page as unknown as Document, doc);
  const once = serialize(page);
  applyAllSceneRuns(page as unknown as Document, doc);
  assert.equal(serialize(page), once);
  const scene = page.querySelector('section')!;
  applySceneRuns(scene as unknown as Element, es.sanitizeHubElements({ heading: anchored([{ start: 4, end: 9, size: 85 }], 'Our story') }), doc);
  assert.deepEqual(runSpans(page.querySelector('h2')!).map((r) => r[0]), ['story']);
  applySceneRuns(scene as unknown as Element, null, doc);
  assert.equal(serialize(page.querySelector('h2')!), '<h2>Our story</h2>', '"Clear this selection" puts the plain words back');
});

/* ── S6 ─────────────────────────────────────────────────────────────────── */

test('S6 · the Maker canvas: a choice lays the SAME cut the guest page makes, and updates the carried runs', () => {
  const elements = es.sanitizeHubElements({ heading: anchored([{ start: 4, end: 9, font: FONT }], 'Our story') });
  const guest = scenePage('details', elements, STORY);
  applyAllSceneRuns(guest as unknown as Document, doc);

  const canvas = parse(`<main><span hidden="" data-maker-section="w:details"></span>${renderToStaticMarkup(STORY)}</main>`);
  const section = canvas.querySelector('section')!;
  bridge.applyElementPreview(section as unknown as HTMLElement, 'w:details', 'heading', elements, false, doc);
  assert.equal(serialize(section), serialize(guest.querySelector('section')!));
  const tag = canvas.querySelector('style[data-hub-els="details"]');
  assert.ok(tag?.getAttribute('data-hub-runs'), 'the canvas carries the runs where the next keystroke reads them');

  // ✍ Typing in the Content box: the words change live, the styled word keeps its style.
  // (previewSceneWords writes the scene's words target; then the bridge re-lays the runs.)
  const h2 = section.querySelector('h2')!;
  h2.textContent = 'Our whole story';
  applySceneRuns(section as unknown as Element, es.readHubSceneRuns(tag!.getAttribute('data-hub-runs')), doc);
  assert.deepEqual(runSpans(h2).map((r) => r[0]), ['story']);

  // ↺ The choice taken off: the canvas's attribute goes, and the part is plain.
  bridge.applyElementPreview(section as unknown as HTMLElement, 'w:details', 'heading', null, false, doc);
  assert.equal(canvas.querySelector('style[data-hub-els="details"]')?.getAttribute('data-hub-runs') ?? null, null);
  assert.equal(section.querySelectorAll('[data-el-run]').length, 0);
});

/* ── S7 ─────────────────────────────────────────────────────────────────── */

test('S7 · every part with words can carry runs; the mark (no words) cannot', () => {
  for (const k of ['label', 'heading', 'body', 'names', 'eyebrow', 'date'] as const) assert.ok(es.HUB_ELEMENT_RUN_KEYS.includes(k), k);
  assert.ok(!es.HUB_ELEMENT_RUN_KEYS.includes('mark'));
});

test('S7 · ⛔ never on the RSVP form — the frame carries no runs there', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      HubCanvasFrame,
      { widget: widget('rsvp', { canvas: { elements: es.sanitizeHubElements({ heading: anchored([{ start: 0, end: 1, color: '#8a1c2b' }], 'RSVP') }) } }) } as never,
      React.createElement('section', null, React.createElement('h2', null, 'RSVP')),
    ),
  );
  assert.doesNotMatch(html, /data-hub-runs/);
});

test('S7 · wiring: the page mounts the cutter when a scene has runs; the selection carries its words; the sheet re-anchors', () => {
  const BODY = read('app/[slug]/_components/site-body.tsx');
  assert.match(BODY, /\{sceneRunsOnPage \? <HubSceneRuns \/> : null\}/);
  assert.match(BODY, /hubSceneRunsAttr\(sanitizeHubCanvas\(w\.config_json\)\.elements\) !== null/, 'the same test the frame puts runs on the page by');
  const RUNS = read('app/[slug]/_components/hub-scene-runs.tsx');
  assert.match(RUNS, /useEffect\(\(\) => \{\s*applyAllSceneRuns\(document, document\);/, 'after hydration, never before');
  const BRIDGE = read('app/[slug]/_components/editor-bridge.tsx');
  assert.match(BRIDGE, /whole: hit\.whole,/, 'the selection message carries the part\'s words');
  assert.match(BRIDGE, /applySceneRuns\(el, readHubSceneRuns\(tag\?\.getAttribute\('data-hub-runs'\)\), document\)/, 'a keystroke re-lays the runs');
  const SHELL = read('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');
  assert.match(SHELL, /typeof d\.whole === 'string' \? \{ was: d\.whole \} : \{\}/);
  const SHEET = read('app/dashboard/[eventId]/website/editor/_components/element-sheet.tsx');
  assert.match(SHEET, /hubRunsForRange\(style, range\)\.find\(/, 'the sheet shows the run where it now is');
});

/* ── P ──────────────────────────────────────────────────────────────────── */

test('P · a scene run\'s FONT, colour and size all go live free (font free since 2026-10-06)', () => {
  const live: HubLiveState = { events: {}, widgets: [widget('our_love_story', {})] };
  const font = mergeHubDraft(emptyHubDraft(), {
    widgets: { our_love_story: { canvas: { elements: { heading: anchored([{ start: 0, end: 3, font: FONT }], 'Our story') } } } },
  });
  // 🔤 Owner 2026-10-06 ("EVENT DETAILS IS REBUILT": font on a single part is FREE) — a run's font too.
  assert.equal(planHubDraftApply(font, live, false).refused.length, 0, 'a scene run\'s font was held as Pro');
  assert.equal(planHubDraftApply(font, live, true).refused.length, 0, 'with Pro it goes live');
  const free = mergeHubDraft(emptyHubDraft(), {
    widgets: { our_love_story: { canvas: { elements: { heading: anchored([{ start: 0, end: 3, color: '#8a1c2b', size: 120 }], 'Our story') } } } },
  });
  assert.equal(planHubDraftApply(free, live, false).refused.length, 0, 'colour and size are free');
});

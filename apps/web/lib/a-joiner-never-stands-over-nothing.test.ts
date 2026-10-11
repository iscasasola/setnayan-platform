import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PahinaMasthead } from '@/app/[slug]/_components/pahina-masthead';
import { layNames, partWords, setPartWords, tidyNames } from '@/app/[slug]/_components/type-in-place-canvas';
import { HERO_DESIGNS } from './hero-design';
import { splitCoupleNames } from './split-names';

/**
 * 🔗 A JOINER NEVER STANDS OVER NOTHING — for a guest, and in the Maker while a name is typed.
 *
 * Owner, 2026-10-11, on his own event in the new Maker: one name and no "&" in the Names line, and the cover read
 * "TEsting Event / and / (nothing)" — while typing AND after Done ("did not go away").
 *
 * Two readers of one name line. The PAGE (the masthead, drawn by the server) asks `splitCoupleNames` and draws a
 * joiner only when there is a second name: a guest never had it — held below for every design. The Maker's CANVAS
 * (`setPartWords`, the bridge's `typeText`) wrote the first name into the first person's line, an empty string into
 * the second and left the joiner where it was; the save is held (the canvas is not reloaded), so the stale cover
 * stayed until the next reload.
 *
 * Same day, on the preview of the fix: ONE name was right; then "Bolognese & Pasta" typed into the same box was a
 * single plain line — "it did not make the secondary font". The cover had been drawn for one name, so the page held
 * no joiner and no second line. THE RULE NOW HELD HERE: what the canvas shows for the Names part IS what the page
 * would draw for that line — for every design and both covers, through one → two → one, "&" and "and", and back.
 * The canvas lays the line out with the masthead's own elements (`layNames`; the masthead hands it the pair in a
 * `<template>`), and the test compares the canvas, after each line, with the server's render of that line.
 */

/* `tsx --test` compiles a `.tsx` component to the classic runtime — React is in scope before one is drawn. */
(globalThis as unknown as { React: unknown }).React = React;

const ONE_NAME = ['TEsting Event', 'Maria', 'Ana & ', 'Ana and ', 'Mateo Cruz'];
const CARD = { eyebrow: 'Together with their families', line: 'invite you to celebrate their wedding', timeLabel: null, hubHref: '#details', hubLabel: 'Open the Event Hub' };

test('one name → no second person, whatever trails it', () => {
  for (const line of ['TEsting Event', 'Maria', 'Mateo Cruz']) assert.deepEqual(splitCoupleNames(line), { first: line, second: null, joiner: null }, line);
  /* A joiner typed with nothing after it names ONE person: the page draws no joiner for it. */
  for (const line of ['Ana & ', 'Ana &', 'Ana and ']) assert.equal(splitCoupleNames(line).second, null, JSON.stringify(line));
  assert.deepEqual(splitCoupleNames('Maria & Jose'), { first: 'Maria', second: 'Jose', joiner: '&' });
  assert.deepEqual(splitCoupleNames('Ana and Leo'), { first: 'Ana', second: 'Leo', joiner: 'and' });
});

test('THE PAGE: for every cover and every design, one name is drawn with no joiner — a guest never sees one', () => {
  const draw = (displayName: string, extra: Record<string, unknown>) =>
    renderToStaticMarkup(React.createElement(PahinaMasthead, { displayName, eventDate: '2026-12-18', twoPeople: true, ...extra }));
  for (const line of ONE_NAME) {
    for (const design of HERO_DESIGNS) {
      for (const cover of [{ card: CARD }, {}] as const) {
        for (const maker of [false, true]) {
          /* The canvas's template is not drawn (and a guest's page has none): look at the page without it. */
          const html = draw(line, { design, stampElements: maker, ...cover }).replace(/<template[\s\S]*?<\/template>/g, '');
          const where = `${JSON.stringify(line)} · ${design} · ${'card' in cover ? 'the card' : 'the plain cover'} · ${maker ? 'the Maker’s canvas' : 'a guest'}`;
          /* The joiner is the gild italic line between the names (`aria-hidden`); in the Maker it is also `data-el`. */
          assert.doesNotMatch(html, /italic text-gild" aria-hidden/, `a joiner is drawn: ${where}`);
          assert.doesNotMatch(html, /data-el="joiner"/, `a joiner part is drawn: ${where}`);
          assert.doesNotMatch(html, /data-el-person="1"/, `an empty second name is drawn: ${where}`);
        }
      }
    }
  }
  /* The control: two names DO draw one. */
  assert.match(draw('Maria & Jose', { card: CARD, stampElements: true }), /data-el="joiner"[^>]*>and</);
  for (const design of HERO_DESIGNS) {
    const two = draw('Maria & Jose', { design, card: CARD, stampElements: true });
    assert.match(two, /data-el="joiner"/, `anti-vacuity: ${design} draws no joiner part for two names`);
    assert.match(two, /data-el-person="1"/, `anti-vacuity: ${design} draws no second name`);
  }
});

/* ── the Maker's canvas: a small page to patch, read from the server's own markup ──────────────────────────────── */

/** An element as the canvas code uses one — only what `type-in-place-canvas.ts` calls. */
class El {
  parent: El | null = null;
  nodes: Array<El | string> = [];
  constructor(public tagName: string, public attrs: Map<string, string> = new Map()) {}
  get children(): El[] { return this.nodes.filter((n): n is El => typeof n !== 'string'); }
  /** A template keeps its elements in `content`; nothing outside reads through it. */
  get content(): El { return this; }
  getAttribute(n: string) { return this.attrs.get(n) ?? null; }
  hasAttribute(n: string) { return this.attrs.has(n); }
  setAttribute(n: string, v: string) { this.attrs.set(n, v); }
  removeAttribute(n: string) { this.attrs.delete(n); }
  get textContent(): string { return this.tagName === 'TEMPLATE' ? '' : this.nodes.map((n) => (typeof n === 'string' ? n : n.textContent)).join(''); }
  set textContent(v: string) { for (const c of this.children) c.parent = null; this.nodes = v === '' ? [] : [v]; }
  remove() { if (this.parent) this.parent.nodes = this.parent.nodes.filter((n) => n !== this); this.parent = null; }
  after(...put: El[]) {
    const at = this.parent!.nodes.indexOf(this);
    for (const n of put) { n.remove(); n.parent = this.parent; }
    this.parent!.nodes.splice(at + 1, 0, ...put);
  }
  cloneNode(): El {
    const c = new El(this.tagName, new Map(this.attrs));
    c.nodes = this.nodes.map((n) => { if (typeof n === 'string') return n; const k = n.cloneNode(); k.parent = c; return k; });
    return c;
  }
  closest(sel: string): El | null { for (let e: El | null = this; e; e = e.parent) if (e.matches(sel)) return e; return null; }
  matches(sel: string): boolean {
    const m = /^([a-z0-9]*)(?:\[([a-z-]+)(?:="([^"]*)")?\])?$/.exec(sel);
    if (!m) throw new Error(`the test page cannot read the selector ${sel}`);
    if (m[1] && this.tagName !== m[1].toUpperCase()) return false;
    if (m[2] && (!this.attrs.has(m[2]) || (m[3] !== undefined && this.attrs.get(m[2]) !== m[3]))) return false;
    return true;
  }
  /** Everything under this element — never inside a template, as on a real page. */
  querySelectorAll(sel: string): El[] {
    const out: El[] = [];
    const walk = (e: El) => { for (const c of e.children) { if (c.matches(sel)) out.push(c); if (c.tagName !== 'TEMPLATE') walk(c); } };
    walk(this);
    return out;
  }
  querySelector(sel: string): El | null { return this.querySelectorAll(sel)[0] ?? null; }
}

const unescape = (t: string) => t.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** The names part of a drawn cover (`<h1 … data-hub-names>`), read into a page the canvas code can patch. */
function namesPart(html: string): El {
  const at = html.indexOf('<h1');
  const from = html.slice(html.lastIndexOf('<h1', html.indexOf('data-hub-names')), html.indexOf('</h1>', html.indexOf('data-hub-names')) + 5);
  assert.ok(at >= 0 && from.startsWith('<h1'), 'the names part was not found on the cover');
  const root = new El('ROOT');
  let cur = root;
  for (const m of from.matchAll(/<(\/?)([a-z0-9]+)((?:\s+[^\s=>]+(?:="[^"]*")?)*)\s*>|([^<]+)/g)) {
    if (m[4] !== undefined) { cur.nodes.push(unescape(m[4])); continue; }
    if (m[1]) { cur = cur.parent!; continue; }
    const el = new El(m[2]!.toUpperCase());
    for (const a of (m[3] ?? '').matchAll(/([^\s=>]+)(?:="([^"]*)")?/g)) el.attrs.set(a[1]!, unescape(a[2] ?? ''));
    el.parent = cur;
    cur.nodes.push(el);
    cur = el;
  }
  assert.equal(cur, root, 'the names part was not read whole');
  return root.children[0]!;
}

type Shape = { tag: string; attrs: Array<[string, string]>; nodes: Array<Shape | string> };
/** An element as a comparable value: its tag, its attributes (any order), its text and elements in order. */
function shape(el: El, keep: (name: string) => boolean = () => true, withTemplate = true): Shape {
  const nodes: Array<Shape | string> = [];
  for (const n of el.nodes) {
    if (typeof n !== 'string') { if (withTemplate || n.tagName !== 'TEMPLATE') nodes.push(shape(n, keep, withTemplate)); continue; }
    if (n === '') continue;
    if (typeof nodes[nodes.length - 1] === 'string') nodes[nodes.length - 1] = (nodes[nodes.length - 1] as string) + n;
    else nodes.push(n);
  }
  return { tag: el.tagName, attrs: [...el.attrs].filter(([k]) => keep(k)).sort(([a], [b]) => a.localeCompare(b)), nodes };
}
/** What a GUEST's page carries of it: none of the Maker's stamps, no template. */
const asGuest = (el: El) => shape(el, (k) => !k.startsWith('data-el'), false);

const drawCover = (displayName: string, extra: Record<string, unknown>) =>
  renderToStaticMarkup(React.createElement(PahinaMasthead, { displayName, eventDate: '2026-12-18', twoPeople: true, ...extra }));
const COVERS = [{ name: 'the card', props: { card: CARD } }, { name: 'the plain cover', props: {} }] as const;
const asCanvas = (part: El) => part as unknown as HTMLElement;

/** Every transition the owner made, and the ones around them: two → one → two, "&" and "and", an "&" left trailing, and back. */
const WALKS: string[][] = [
  ['Marco & Marga', 'Bolognese', 'Bolognese & Pasta', 'Ana and Ben', 'Solo', 'Ana and Ben', 'Ana & ', 'Marco & Marga'],
  /* HIS CASE: the cover was drawn for ONE name when the two were typed. */
  ['Bolognese', 'Bolognese & Pasta', 'Bolognese', 'Pasta and Bolognese', 'Toblerone Test'],
  ['Ana and Ben', 'Ana & Ben', 'Ana', 'Ben and Ana'],
];

test('THE CANVAS IS THE PAGE: after every line typed, the Names part equals the server’s render of that line — 4 designs × 2 covers', () => {
  let checked = 0;
  for (const design of HERO_DESIGNS) {
    for (const cover of COVERS) {
      for (const own of [null, '+']) {
        const props = { design, ...cover.props, ...(own ? { elements: { joiner: { word: own } } } : {}) };
        for (const walk of WALKS) {
          const part = namesPart(drawCover(walk[0]!, { ...props, stampElements: true }));
          for (const line of walk.slice(1)) {
            setPartWords(asCanvas(part), line);
            const where = `${design} · ${cover.name}${own ? ` · their own joiner "${own}"` : ''} · ${JSON.stringify(walk[0])} … → ${JSON.stringify(line)}`;
            /* The Maker's canvas, element for element — the template included. */
            assert.deepEqual(shape(part), shape(namesPart(drawCover(line, { ...props, stampElements: true }))), `the canvas is not the page: ${where}`);
            /* …and what a guest gets: the same elements, classes and words. */
            assert.deepEqual(asGuest(part), asGuest(namesPart(drawCover(line, { ...props, stampElements: false }))), `a guest would see something else: ${where}`);
            /* Said out loud: the joiner is its own element, in the gild italic face, with the PAGE's word. */
            const said = splitCoupleNames(line);
            const joiners = part.children.filter((c) => /\bitalic\b/.test(c.getAttribute('class') ?? '') && /\btext-gild\b/.test(c.getAttribute('class') ?? ''));
            if (said.second) {
              assert.equal(joiners.length, 1, `no joiner in its own face: ${where}`);
              assert.equal(joiners[0]!.getAttribute('data-el'), 'joiner', where);
              assert.equal(joiners[0]!.textContent, own ?? (said.joiner === '&' && 'card' in cover.props ? 'and' : said.joiner), `the joiner's word is not the page's: ${where}`);
              assert.deepEqual(part.querySelectorAll('[data-el-person]').map((p) => p.textContent), [said.first, said.second], where);
            } else {
              assert.equal(joiners.length, 0, `a joiner stands over nothing: ${where}`);
              assert.deepEqual(part.querySelectorAll('[data-el-person]').map((p) => p.textContent), [said.first], where);
            }
            /* What is saved is what is shown. */
            assert.equal(partWords(asCanvas(part)), [said.first, said.second].filter(Boolean).join(' & '), where);
            checked += 1;
          }
        }
      }
    }
  }
  assert.equal(checked, HERO_DESIGNS.length * COVERS.length * 2 * WALKS.reduce((n, w) => n + w.length - 1, 0), 'a cover or a walk was skipped');
});

test('THE CANVAS: the pair that comes back is the SAME pair that was put away — a look drawn on it is kept', () => {
  const part = namesPart(drawCover('Marco & Marga', { card: CARD, stampElements: true }));
  const joiner = part.querySelector('[data-el="joiner"]')!;
  const second = part.querySelectorAll('[data-el-person]')[1]!;
  setPartWords(asCanvas(part), 'Bolognese');
  assert.equal(joiner.parent, null, 'the joiner is still on the page');
  assert.equal(second.parent, null);
  setPartWords(asCanvas(part), 'Bolognese & Pasta');
  assert.equal(part.querySelector('[data-el="joiner"]'), joiner);
  assert.equal(part.querySelectorAll('[data-el-person]')[1], second);
});

test('THE CANVAS: one person at the centre is one line — an "&" in a company name is never two people', () => {
  const html = renderToStaticMarkup(React.createElement(PahinaMasthead, { displayName: 'Ayala Year-End', eventDate: '2026-12-18', twoPeople: false, card: CARD, stampElements: true }));
  assert.doesNotMatch(html, /<template/, 'a one-person event was handed the two-name pair');
  const part = namesPart(html);
  assert.equal(layNames(asCanvas(part), 'Ayala & Partners'), false);
  setPartWords(asCanvas(part), 'Ayala & Partners');
  assert.deepEqual(part.querySelectorAll('[data-el-person]').map((p) => p.textContent), ['Ayala & Partners']);
});

test('THE CANVAS: typed on the page itself, the end of typing lays the names out — and leaves a full cover alone', () => {
  /* A second name erased by hand. */
  const erased = namesPart(drawCover('Marco & Marga', { card: CARD, stampElements: true }));
  erased.querySelectorAll('[data-el-person]')[1]!.textContent = '';
  tidyNames(asCanvas(erased));
  assert.deepEqual(shape(erased), shape(namesPart(drawCover('Marco', { card: CARD, stampElements: true }))));
  /* Two names typed into the one line of a cover drawn for one. */
  const one = namesPart(drawCover('Bolognese', { card: CARD, stampElements: true }));
  one.querySelectorAll('[data-el-person]')[0]!.textContent = 'Bolognese & Pasta';
  tidyNames(asCanvas(one));
  assert.deepEqual(shape(one), shape(namesPart(drawCover('Bolognese & Pasta', { card: CARD, stampElements: true }))));
  /* Names that already read one per line are not touched — "Ana and Ben" on the plain cover keeps its "and". */
  const full = namesPart(drawCover('Ana and Ben', { stampElements: true }));
  const before = shape(full);
  tidyNames(asCanvas(full));
  assert.deepEqual(shape(full), before);
});

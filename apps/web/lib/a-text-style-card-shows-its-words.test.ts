/**
 * lib/a-text-style-card-shows-its-words.test.ts — 🖼 A TEXT PART'S STYLE CARD SHOWS ITS WORDS, LEGIBLY, ON EVERY GROUND.
 *
 * Owner, 2026-10-16, live on his own Maker (Invitation › Home › Title › Style, a phone): *"previews are not showing
 * properly. small caps shows a weird photo that is same on the other styles"*. Every Title card was the same blurred
 * slice of the Cover Scene's photo with no words on it. Two faults, both from the Cover Scene (approved 2026-10-15):
 *
 *   1. THE CARD WAS FITTED ON WHERE THE WORDS HAD BEEN. A card is the guest page asked for one part in one style
 *      (`stage-panel/style-preview.tsx`). It measured the part in a 1600 px frame and showed it in a 900 px one —
 *      and the Cover Scene is `100svh` tall with its words centred, `100svh` being the FRAME's height, so the words
 *      moved ~350 px between the measure and the picture. Every card showed the same empty slice of the cover.
 *   2. THE CARD HID THE GROUND THE WORDS ARE TONED FOR. `?only=f:hero.<part>` hid everything in the cover that is not
 *      the part — the Cover Scene's background layer too — while the words kept the cover's tone: cream over a dark
 *      ground, cream on the card's white. Nothing to read.
 *
 * And two neighbours of the same layer, on the same screen:
 *   (a) the picked part's frame took the background layer for "the part above" (gap 0), so it hugged the words and
 *       its ＋ sat on them ("AND", "PARENTS") — `add-part-sheet.tsx` `neighbourOf`;
 *   (b) the Reveal's picture read its colours off the cover's words — cream over a dark ground — and drew cream flaps
 *       on the cream page: a blank white box — `stage-tools.tsx`, `reveal-picture.tsx` `revealPageInk`.
 *
 * The property held here, through the REAL masthead and the REAL miniature CSS (`canvasOnlyCss`): for every text part
 * (Title · Names · Date · Place), every one of its styles, and every kind of Cover Scene ground, the card's page
 * DISPLAYS the part's words, and the ink they are drawn in reaches AA over whatever the card shows under them. And
 * each style of a part draws differently — the card is the style.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PahinaMasthead } from '@/app/[slug]/_components/pahina-masthead';
import { canvasOnlyCss } from '@/app/[slug]/_lib/editor-canvas';
import {
  COVER_INK,
  COVER_PAPER,
  coverGroundCss,
  coverGroundSamples,
  coverGroundShape,
  coverSceneLegibility,
  coverShadeVeil,
} from './cover-scene';
import { hubMovingBackgroundIds, sanitizeHubCoverGround, type HubCoverGround } from './hub-canvas';
import { AA_BODY, compositeOver, contrastRatio } from './hub-legibility';
import { INVITE_THEMES } from './invite-themes';
import { HERO_PART_LOOK, PART_SCENE_STYLE_SETS, partLookAttr } from './scene-styles-parts';
import { partNeighbourIsLayer, styleCardFit } from './maker-stage-room';
import { stripComments } from './strip-comments';
import { MINI_FRAME_MIN, miniatureFrameGrow, miniatureMoved } from '@/app/dashboard/[eventId]/launch/_components/stage-panel/style-preview';
import { coverPaperAsInk } from '@/app/dashboard/[eventId]/launch/_components/stage-panel/reveal-picture';


(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/* ── a small DOM: the masthead's static markup as a tree, and the miniature's CSS evaluated on it ───────────────── */

type Node = { tag: string; attrs: Record<string, string>; kids: Node[]; parent: Node | null; text: string };
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

function parse(html: string): Node {
  const root: Node = { tag: '#root', attrs: {}, kids: [], parent: null, text: '' };
  let cur = root;
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z0-9-]+)\s*>|<([a-zA-Z0-9-]+)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/g;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[1]) {
      while (cur.parent && cur.tag !== m[1].toLowerCase()) cur = cur.parent;
      if (cur.parent) cur = cur.parent;
    } else if (m[2]) {
      const attrs: Record<string, string> = {};
      for (const a of (m[3] ?? '').matchAll(/([^\s=>/]+)(?:="([^"]*)")?/g)) attrs[a[1]!] = (a[2] ?? '').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
      const n: Node = { tag: m[2].toLowerCase(), attrs, kids: [], parent: cur, text: '' };
      cur.kids.push(n);
      if (!m[4] && !VOID.has(n.tag)) cur = n;
    } else if (m[5]) {
      cur.kids.push({ tag: '#text', attrs: {}, kids: [], parent: cur, text: m[5] });
    }
  }
  return root;
}
const elements = (n: Node): Node[] => n.kids.filter((k) => k.tag !== '#text').flatMap((k) => [k, ...elements(k)]);
const textOf = (n: Node): string => (n.tag === '#text' ? n.text : n.kids.map(textOf).join(''));

/* The selector shapes `canvasOnlyCss` writes: compounds of `*`/a tag/`[a]`/`[a="v"]`/`:not(…)`/`:has(…)`, joined by
   a space or `+`. Matched right to left, as a browser does. */
type Compound = { tag: string | null; attrs: [string, string | null][]; not: Sel[]; has: Sel[] };
type Sel = { parts: Compound[]; joins: (' ' | '+')[] };

function balanced(s: string, i: number): number {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '(') depth++;
    else if (s[j] === ')' && --depth === 0) return j;
  }
  throw new Error(`unbalanced: ${s}`);
}
function parseSel(src: string): Sel {
  const parts: Compound[] = [];
  const joins: (' ' | '+')[] = [];
  let i = 0;
  const s = src.trim();
  let c: Compound = { tag: null, attrs: [], not: [], has: [] };
  let started = false;
  const push = () => {
    parts.push(c);
    c = { tag: null, attrs: [], not: [], has: [] };
    started = false;
  };
  while (i < s.length) {
    const ch = s[i]!;
    if (ch === ' ' || ch === '+') {
      let j = i;
      let plus = false;
      for (; s[j] === ' ' || s[j] === '+'; j++) if (s[j] === '+') plus = true;
      if (started) push();
      joins.push(plus ? '+' : ' ');
      i = j;
    } else if (ch === '*') {
      c.tag = null;
      started = true;
      i++;
    } else if (ch === '[') {
      const end = s.indexOf(']', i);
      const m = /^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(s.slice(i, end + 1))!;
      c.attrs.push([m[1]!, m[2] ?? null]);
      started = true;
      i = end + 1;
    } else if (s.startsWith(':not(', i) || s.startsWith(':has(', i)) {
      const end = balanced(s, i + 4);
      (s.startsWith(':not(', i) ? c.not : c.has).push(parseSel(s.slice(i + 5, end)));
      started = true;
      i = end + 1;
    } else {
      const m = /^[a-z][a-z0-9]*/.exec(s.slice(i))!;
      c.tag = m[0];
      started = true;
      i += m[0].length;
    }
  }
  if (started) push();
  return { parts, joins };
}
function compoundMatches(n: Node, c: Compound): boolean {
  if (c.tag && n.tag !== c.tag) return false;
  for (const [a, v] of c.attrs) if (!(a in n.attrs) || (v !== null && n.attrs[a] !== v)) return false;
  if (c.not.some((x) => matches(n, x))) return false;
  return c.has.every((x) => below(n).some((d) => matches(d, x)));
}
function matchesAt(n: Node, sel: Sel, k: number): boolean {
  if (!compoundMatches(n, sel.parts[k]!)) return false;
  if (k === 0) return true;
  if (sel.joins[k - 1] === '+') {
    const sibs = n.parent ? n.parent.kids.filter((x) => x.tag !== '#text') : [];
    const prev = sibs[sibs.indexOf(n) - 1];
    return Boolean(prev && matchesAt(prev, sel, k - 1));
  }
  for (let a = n.parent; a && a.tag !== '#root'; a = a.parent) if (matchesAt(a, sel, k - 1)) return true;
  return false;
}
const memo = new WeakMap<Sel, WeakMap<Node, boolean>>();
function matches(n: Node, sel: Sel): boolean {
  let m = memo.get(sel);
  if (!m) memo.set(sel, (m = new WeakMap()));
  let v = m.get(n);
  if (v === undefined) m.set(n, (v = matchesAt(n, sel, sel.parts.length - 1)));
  return v;
}
const descendants = new WeakMap<Node, Node[]>();
const below = (n: Node): Node[] => {
  let d = descendants.get(n);
  if (!d) descendants.set(n, (d = elements(n)));
  return d;
};

/** Which elements the miniature's CSS hides (`display:none`), and so everything inside them. */
const parsedCss = new Map<string, Sel[]>();
function displayed(root: Node, css: string): (n: Node) => boolean {
  const rules = parsedCss.get(css) ?? css
    .split('}')
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => {
      assert.match(r, /\{display:none!important$/, `a rule that is not a hide: ${r}`);
      return parseSel(r.slice(0, r.indexOf('{')));
    });
  parsedCss.set(css, rules);
  const hidden = new Set(elements(root).filter((n) => 'hidden' in n.attrs || rules.some((r) => matches(n, r))));
  return (n) => {
    for (let a: Node | null = n; a && a.tag !== '#root'; a = a.parent) if (hidden.has(a)) return false;
    return true;
  };
}

/* ── the grounds a couple can stand the cover on, as the guest page resolves them (`cover-scene-layer.ts`) ──────── */

const PHOTO = 'https://cdn.test/hands-and-fabric.jpg';
function layerOf(g: HubCoverGround) {
  const legible = coverSceneLegibility(g);
  const base = { shape: coverGroundShape(g), veil: coverShadeVeil(g.shade), scrim: legible.scrim, tone: legible.tone, parallax: false };
  if (g.kind === 'loop') return { ...base, css: null, still: '/std/backgrounds/velvet.webp', clip: null };
  if (g.kind === 'photo' || g.kind === 'snippet') return { ...base, css: null, still: PHOTO, clip: null };
  return { ...base, veil: g.kind === 'glass' || g.kind === 'frost' ? null : base.veil, css: coverGroundCss(g), still: null, clip: null };
}
const loops = hubMovingBackgroundIds().filter((id) => INVITE_THEMES[id].media && INVITE_THEMES[id].ready);
const GROUNDS: [string, HubCoverGround | null][] = [
  ['the theme’s own', null],
  ...(
    [
      ['a light colour', { kind: 'color', color: '#F3E9DC' }],
      ['a dark colour', { kind: 'color', color: '#1F2A3A' }],
      ['a dark colour, Full width', { kind: 'color', color: '#1F2A3A', shape: 'full' }],
      ['a diagonal', { kind: 'diagonal', color: '#5A2E3B' }],
      ['a glow', { kind: 'glow', color: '#C9A46A' }],
      ['a glass', { kind: 'glass', color: '#FFFFFF', opacity: 70 }],
      ['a frost', { kind: 'frost', color: '#203040', opacity: 90 }],
      ['a photo', { kind: 'photo', media: 'r2://setnayan-media/events/00000000-0000-4000-8000-000000000000/landing-page-hero-image/hands.jpg' }],
      ['a photo, Darker', { kind: 'photo', media: 'r2://setnayan-media/events/00000000-0000-4000-8000-000000000000/landing-page-hero-image/hands.jpg', shade: -60 }],
      ['a photo, Lighter', { kind: 'photo', media: 'r2://setnayan-media/events/00000000-0000-4000-8000-000000000000/landing-page-hero-image/hands.jpg', shade: 60 }],
      ...loops.map((loop) => [`the Scene loop ${loop}`, { kind: 'loop', loop }] as const),
    ] as [string, unknown][]
  ).map(([name, raw]) => {
    const g = sanitizeHubCoverGround(raw);
    assert.ok(g, `fixture ground "${name}" was refused by the sanitiser`);
    return [name, g] as [string, HubCoverGround];
  }),
];

/** The card's own ground where nothing of the cover is under the words: the page's paper (`style-preview.tsx` reads the body's). */
const CARD_PAPER = ['#FFFFFF', COVER_PAPER];
const TEXT_PARTS = (['eyebrow', 'names', 'date', 'venue'] as const).map((el) => ({ el, type: HERO_PART_LOOK[el] }));
const MARK = React.createElement('svg', { viewBox: '0 0 10 10' });

function cardPage(g: HubCoverGround | null, el: string, look: string | null): Node {
  const masthead = renderToStaticMarkup(
    React.createElement(PahinaMasthead, {
      displayName: 'Maria & Jose',
      eventDate: '2027-02-14',
      venueName: 'San Agustin Church, Intramuros',
      eyebrow: 'With thanksgiving to God and with the blessing of our parents,',
      monogramSlot: MARK,
      stampElements: true,
      ground: g ? (layerOf(g) as never) : null,
      looks: look ? { [el]: look } : null,
    }),
  );
  /* The guest page's own frame of the cover (`site-body.tsx`): its marker, then the cover, then the rest of the page. */
  return parse(`<html><body><main><span hidden="" data-maker-section="f:hero"></span>${masthead}<section data-maker-section-next=""><p>Our story</p></section></main></body></html>`);
}

test('(1) every text part, every style, every ground: the card displays the words, in an ink that reads over what is under them', () => {
  let checked = 0;
  for (const { el, type } of TEXT_PARTS) {
    const set = PART_SCENE_STYLE_SETS.find((s) => s.type === type)!;
    const css = canvasOnlyCss(`f:hero.${el}`);
    for (const style of set.styles) {
      for (const [groundName, g] of GROUNDS) {
        const where = `${set.label} › ${style.name} on ${groundName}`;
        const root = cardPage(g, el, partLookAttr(type, style.id));
        const shown = displayed(root, css);
        const part = elements(root).find((n) => n.attrs['data-el'] === el);
        assert.ok(part, `${where}: the part is not on the card's page`);
        assert.ok(shown(part!), `${where}: the miniature hides the part itself`);
        assert.ok(textOf(part!).replace(/\s+/g, '').length >= 2, `${where}: the part draws no words`);
        /* Nothing else of the cover's words is drawn — the card is the part alone. */
        const others = elements(root).filter((n) => n.attrs['data-el'] && n.attrs['data-el'] !== el && !elements(part!).includes(n) && shown(n));
        assert.deepEqual(others.map((n) => n.attrs['data-el']), [], `${where}: another part is drawn on the card`);

        /* The ink the words are drawn in: the cover's tone (`COVER_SCENE_CREAM_VARS` on the cover) or the page's ink. */
        let cover: Node | null = part!.parent;
        while (cover && !(cover.attrs['data-cover-scene'] !== undefined && cover.tag === 'header')) cover = cover.parent;
        const cream = Boolean(cover && /--color-ink:\s*251 250 247/.test(cover.attrs.style ?? ''));
        const ink = cream ? COVER_PAPER : COVER_INK;
        /* …and what is under them on the card: the cover's own ground under its scrim when the card shows it, else the card's paper. */
        const groundLayer = cover?.kids.find((k) => k.attrs['data-cover-scene-ground'] !== undefined) ?? null;
        const layer = g ? layerOf(g) : null;
        const under =
          g && layer && groundLayer && shown(groundLayer)
            ? coverGroundSamples(g).map((c) => (layer.scrim.opacity > 0 ? compositeOver(layer.scrim.color, layer.scrim.opacity, c) : c))
            : CARD_PAPER;
        if (g) assert.equal(cream, layer!.tone === 'cream', `${where}: the cover's words are not in the tone measured for its ground`);
        for (const u of under) {
          const ratio = contrastRatio(ink, u);
          assert.ok(ratio >= AA_BODY - 0.01, `${where}: the words are ${ink} over ${u} on the card — ${ratio.toFixed(2)}:1, nothing to read`);
        }
        checked++;
      }
    }
  }
  /* Anti-vacuity: four parts, all their styles, every ground — and at least one ground that tones the words cream. */
  assert.ok(checked >= 4 * 4 * 10, `only ${checked} cards checked`);
  assert.ok(GROUNDS.some(([, g]) => g && coverSceneLegibility(g).tone === 'cream'), 'no ground in the fixture turns the words cream — the case that failed is not tested');
});

test('(2) each style of a part draws differently — the card IS the style', () => {
  for (const { el, type } of TEXT_PARTS) {
    const set = PART_SCENE_STYLE_SETS.find((s) => s.type === type)!;
    const drawn = set.styles.map((s) => {
      const part = elements(cardPage(null, el, partLookAttr(type, s.id))).find((n) => n.attrs['data-el'] === el)!;
      return JSON.stringify([part.attrs['data-part-look'] ?? null, textOf(part), elements(part).map((n) => n.tag)]);
    });
    assert.equal(new Set(drawn).size, set.styles.length, `${set.label}: two styles draw the same card`);
  }
});

test('(3) the card is fitted on the part where it stands in the frame it is SHOWN in', () => {
  /* The Cover Scene's words, centred in a first screen as tall as the frame (`100svh` inside the miniature). */
  const words = { left: 16, width: 327, height: 48 };
  const laidOut = (frameH: number) => ({ ...words, top: Math.max(40, (frameH - words.height) / 2) });
  const box = { w: 213, h: 134 };
  /* What `StylePreview` does: measure at the frame's height; a part below it grows the frame and is measured again. */
  let frameH = MINI_FRAME_MIN;
  let at = laidOut(frameH);
  for (let grow = miniatureFrameGrow(at.top + at.height, frameH); grow !== null; grow = miniatureFrameGrow(at.top + at.height, frameH)) {
    frameH = grow;
    at = laidOut(frameH);
  }
  const f = styleCardFit(at, box);
  const shownTop = f.y + f.k * laidOut(frameH).top;
  assert.ok(shownTop >= 0 && shownTop + f.k * words.height <= box.h, `the words are drawn at ${shownTop.toFixed(0)} px in a ${box.h} px card`);
  /* Anti-vacuity: measured in a 1600 px frame and shown in this one (the shipped fault), the words leave the card. */
  const stale = styleCardFit(laidOut(1600), box);
  assert.ok(stale.y + stale.k * laidOut(frameH).top + stale.k * words.height < 0, 'the old fault would not show here — the model is too weak');
  /* A part already inside the frame never grows it; one ending below grows it to hold it. */
  assert.equal(miniatureFrameGrow(500, MINI_FRAME_MIN), null);
  assert.equal(miniatureFrameGrow(1200, MINI_FRAME_MIN), 1240);
  assert.equal(miniatureMoved({ top: 10, left: 0, width: 100, height: 20 }, { top: 10.5, left: 0, width: 100, height: 20 }), false);
  assert.equal(miniatureMoved({ top: 10, left: 0, width: 100, height: 20 }, { top: 220, left: 0, width: 100, height: 20 }), true);

  /* …and the component draws the frame at the one height it measures with — never a second, larger guess. */
  const src = read('app/dashboard/[eventId]/launch/_components/stage-panel/style-preview.tsx');
  assert.match(src, /height: frameH,/, 'the frame is drawn at a height the measure did not use');
  assert.match(src, /const grow = miniatureFrameGrow\(at\.top \+ at\.height, frameHRef\.current\);/, 'the measure does not check the frame it was taken in');
  assert.doesNotMatch(src, /\?\? 1600/, 'a frame taller before the fit than after it is back');
});

test('(a) a layer under the parts is never the part above: the frame keeps its pad, ＋ stays off the words', () => {
  const fake = (position: string) => ({ ownerDocument: { defaultView: { getComputedStyle: () => ({ position }) } } }) as unknown as Element;
  assert.equal(partNeighbourIsLayer(fake('absolute')), true, 'the Cover Scene background (absolute) is read as a neighbour');
  assert.equal(partNeighbourIsLayer(fake('fixed')), true);
  assert.equal(partNeighbourIsLayer(fake('static')), false, 'a part in the flow is no longer a neighbour');
  assert.equal(partNeighbourIsLayer(fake('relative')), false);
  const sheet = read('app/dashboard/[eventId]/launch/_components/add-part-sheet.tsx');
  const body = sheet.slice(sheet.indexOf('function neighbourOf('), sheet.indexOf('function visibleBand('));
  assert.match(body, /!partNeighbourIsLayer\(sib\)/, 'neighbourOf takes a layer for the part above again');
});

test('(b) the Reveal picture is drawn in the event’s ink, never the cover’s cream', () => {
  assert.equal(coverPaperAsInk('rgb(251, 250, 247)', '44 42 41'), 'rgb(44, 42, 41)');
  assert.equal(coverPaperAsInk('rgba(251, 250, 247, 0.72)', '44 42 41'), 'rgba(44, 42, 41, 0.72)');
  assert.equal(coverPaperAsInk('rgb(120, 30, 60)', '44 42 41'), 'rgb(120, 30, 60)', 'a colour that is not the cover’s paper is the couple’s, kept');
  assert.equal(coverPaperAsInk('rgb(251, 250, 247)', ''), 'rgb(251, 250, 247)', 'no page ink to read: as it was');
  const tools = read('app/dashboard/[eventId]/launch/_components/stage-tools.tsx');
  assert.match(tools, /const ink = revealPageInk\(doc, '\[data-el="names"\]'\);/);
  assert.match(tools, /const accent = revealPageInk\(doc, '\[data-el="eyebrow"\]'\);/);
});

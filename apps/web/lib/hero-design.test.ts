/**
 * hero-design.test.ts — THE HERO'S FOUR DESIGNS, EACH A STARTING POINT WHOSE
 * PARTS ARE TAP-TO-EDIT (owner 2026-09-26, DECISION_LOG "A HERO DESIGN IS A
 * STARTING POINT; EVERY PART OF IT IS TAP-TO-EDIT" · "DESIGN 5 IS DROPPED").
 *
 * Per design (The Card · The Marquee · The Crest · The Letter), this holds:
 *   1. the masthead renders every part — eyebrow · mark · names · joiner ·
 *      line · date · time — with the couple's words, and each part is the
 *      SAME editable element (`data-el`) the Maker's bridge and the guest
 *      page's per-part style address; `names` keeps its `arrive-names` hook so
 *      the foil and the arrival motion still find it;
 *   2. nothing forbids a long name from wrapping on a 375px phone: every text
 *      part may break (`overflow-wrap:anywhere` on the names, no `nowrap`
 *      anywhere) — the layout itself is measured in the browser
 *      (`/dev/hero-lab`), a unit test cannot lay out;
 *   3. the couple's per-part edits SURVIVE a change of design: `withHeroDesign`
 *      returns the same `elements`, and the rendered part carries the same
 *      inline style in every design;
 *   4. The Card — the shipped hero — is byte-identical with and without the
 *      prop: the designs added nothing to the default;
 *   5. the contract: only the closed set is stored, `card` is an absence, the
 *      canvas sanitizer keeps a valid design and drops an invented one;
 *   6. The Letter's names sit low, so its tile/cover is cut from the FOOT
 *      (`tileCropAnchor` → `buildTileDocument` pins the body to the bottom);
 *      every other design keeps the top;
 *   7. SOURCE: every masthead mount in site-body spreads the ONE `heroElements`
 *      object that now carries `design`; the Hero page offers the designs as
 *      one `PickMenu` (never a pill row) and mounts the first-visit tour, which
 *      is registered.
 *
 * Run from apps/web: `npx tsx --test lib/hero-design.test.ts`
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PahinaMasthead } from '@/app/[slug]/_components/pahina-masthead';
import { HUB_HERO_ELEMENT_KEYS, type HubElementStyles } from './element-style';
import { sanitizeHubCanvas, type HubSectionCanvas } from './hub-canvas';
import {
  HERO_DESIGNS,
  HERO_DESIGN_ATTR,
  HERO_DESIGN_LABEL,
  heroDesignCropAnchor,
  heroDesignOf,
  sanitizeHeroDesign,
  withHeroDesign,
  type HeroDesignId,
} from './hero-design';
import { buildTileDocument, TILE_ANCHOR_BOTTOM_CSS, tileCropAnchor, type TileHead } from './maker-tile-preview';
import { TOURS, TOUR_KEYS } from './tours';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/* ── fixtures: long names, a real mark, every word ─────────────────────────── */

const LONG_NAMES = 'Maria Clara Concepcion & Juan Miguel de los Santos';
const CARD = {
  eyebrow: 'Together with their families',
  line: 'invite you to celebrate their wedding',
  timeLabel: '1:30 PM',
  hubHref: '#hub',
  hubLabel: 'Open the Event Hub',
};
const MARK = React.createElement('svg', { 'data-mark': '', viewBox: '0 0 10 10' }, React.createElement('path', { d: 'M0 0h10v10z' }));

function render(design: HeroDesignId | undefined, extra: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(
    React.createElement(PahinaMasthead, {
      displayName: LONG_NAMES,
      eventDate: '2026-12-18',
      twoPeople: true,
      stampElements: true,
      monogramSlot: MARK,
      card: CARD,
      badgeSlot: React.createElement('p', { 'data-pill': '' }, 'Happening now'),
      ...(design ? { design } : {}),
      ...extra,
    }),
  );
}

/** The opening tag of the element stamped `data-el="<key>"`. */
function partTag(html: string, key: string): string {
  const m = new RegExp(`<[a-z0-9]+[^>]*\\sdata-el="${key}"[^>]*>`).exec(html);
  assert.ok(m, `no part data-el="${key}"`);
  return m[0];
}

/* ═══ 1 · EVERY DESIGN RENDERS EVERY PART, EACH AN EDITABLE ELEMENT ═══ */

for (const design of HERO_DESIGNS) {
  test(`1 · ${HERO_DESIGN_LABEL[design].name}: all parts render, each is a tap-to-edit element`, () => {
    const html = render(design);
    for (const key of HUB_HERO_ELEMENT_KEYS) partTag(html, key);
    // The words are the couple's, in every design.
    assert.match(html, /Maria Clara Concepcion/);
    assert.match(html, /Juan Miguel de los Santos/);
    assert.match(html, /Together with their families/);
    assert.match(html, /invite you to celebrate their wedding/);
    assert.match(html, /1:30 PM/);
    assert.match(html, /data-mark=""/, 'the mark slot was not drawn');
    assert.match(html, /data-pill=""/, 'the Happening-now pill was not drawn');
    assert.match(html, /Open the Event Hub/);
    // The names keep their motion hook (foil + arrival read it) in every design.
    assert.match(partTag(html, 'names'), /data-motion="arrive-names"/);
    assert.match(partTag(html, 'mark'), /data-motion="arrive-mark"/);
    assert.match(partTag(html, 'date'), /data-motion="arrive-date"/);
    // Exactly one masthead root, marked as the first screen.
    assert.equal(html.split('<header data-pahina-first-screen=""').length - 1, 1);
    // The design is readable off the root — off the default only.
    if (design === 'card') assert.doesNotMatch(html, new RegExp(HERO_DESIGN_ATTR));
    else assert.match(html, new RegExp(`<header[^>]*\\s${HERO_DESIGN_ATTR}="${design}"`));
  });

  test(`2 · ${HERO_DESIGN_LABEL[design].name}: no text part forbids wrapping (long names on a 375px phone)`, () => {
    const html = render(design);
    assert.doesNotMatch(html, /whitespace-nowrap|white-space:\s*nowrap|text-nowrap/, 'a part cannot wrap');
    if (design !== 'card') {
      assert.match(partTag(html, 'names'), /\[overflow-wrap:anywhere\]/, 'the names may not break a long name');
    }
  });

  test(`3 · ${HERO_DESIGN_LABEL[design].name}: a per-part edit reaches the part, the same in every design`, () => {
    const elements: HubElementStyles = {
      names: { color: '#123456', size: 120 },
      date: { font: 'fraunces', italic: true },
      eyebrow: { hidden: true },
    };
    const html = render(design, { elements });
    assert.match(partTag(html, 'names'), /color:#123456/);
    assert.match(partTag(html, 'names'), /zoom:1\.2/);
    assert.match(partTag(html, 'date'), /font-style:italic/);
    assert.match(partTag(html, 'eyebrow'), /opacity:0\.3/, 'a hidden part is ghosted in the Maker canvas');
  });
}

/* ═══ 3b · THE EDITS SURVIVE A CHANGE OF DESIGN ═══ */

test('3b · withHeroDesign changes only the design — elements, background and motion ride along', () => {
  const canvas: HubSectionCanvas = {
    elements: { names: { color: '#123456' }, joiner: { word: '+' } },
    kind: 'color',
    color: '#ffeedd',
    preset: 'cinematic',
  };
  for (const design of HERO_DESIGNS) {
    const next = withHeroDesign(canvas, design);
    assert.deepEqual(next.elements, canvas.elements, `${design}: an edit was lost`);
    assert.equal(next.kind, 'color');
    assert.equal(next.preset, 'cinematic');
    assert.equal(heroDesignOf(next), design);
    // …and it survives the canvas sanitizer on its way into the draft.
    const stored = sanitizeHubCanvas({ canvas: next });
    assert.deepEqual(stored.elements, canvas.elements, `${design}: the sanitizer dropped an edit`);
    assert.equal(heroDesignOf(stored), design);
  }
  // The input is never mutated.
  assert.equal(canvas.design, undefined);
});

/* ═══ 4 · THE CARD IS BYTE-IDENTICAL WITH AND WITHOUT THE PROP ═══ */

test('4 · The Card (the shipped hero) renders byte-identically whether or not `design` is passed', () => {
  assert.equal(render(undefined), render('card'));
  // …on the plain (hero-photo) masthead too.
  const plain = { card: undefined, mediaSlot: React.createElement('img', { alt: '' }), mediaCaption: 'San Agustin' };
  assert.equal(render(undefined, plain), render('card', plain));
});

test('4b · every design draws the plain (hero-photo) masthead too — the cover plate and every part', () => {
  for (const design of HERO_DESIGNS) {
    const html = render(design, { card: undefined, mediaSlot: React.createElement('img', { alt: '' }), mediaCaption: 'San Agustin', venueName: 'San Agustin' });
    assert.match(html, /data-pahina-parallax=/, `${design}: no cover plate`);
    for (const key of ['eyebrow', 'mark', 'names', 'joiner', 'date']) partTag(html, key);
    assert.match(html, /San Agustin/);
  }
});

/* ═══ 5 · THE CONTRACT ═══ */

test('5 · only the closed set is stored; The Card is an absence; the sanitizer keeps a design and drops an invention', () => {
  assert.deepEqual([...HERO_DESIGNS], ['card', 'marquee', 'crest', 'letter'], 'the set is 1–4; Design 5 was dropped');
  assert.equal(sanitizeHeroDesign('card'), null);
  assert.equal(sanitizeHeroDesign('marquee'), 'marquee');
  assert.equal(sanitizeHeroDesign('editorial'), null);
  assert.equal(sanitizeHeroDesign(5), null);
  assert.equal(sanitizeHubCanvas({ canvas: { design: 'crest' } }).design, 'crest');
  assert.equal(sanitizeHubCanvas({ canvas: { design: 'card' } }).design, undefined);
  assert.equal(sanitizeHubCanvas({ canvas: { design: 'editorial' } }).design, undefined);
  assert.equal(heroDesignOf(null), 'card');
  assert.equal(heroDesignOf({}), 'card');
  for (const d of HERO_DESIGNS) assert.match(HERO_DESIGN_LABEL[d].name, /^The /);
});

/* ═══ 6 · THE LETTER'S COVER IS CUT FROM THE FOOT ═══ */

test('6 · The Letter anchors its tile on the names (bottom); every other design keeps the top', () => {
  assert.equal(heroDesignCropAnchor('letter'), 'bottom');
  for (const d of HERO_DESIGNS.filter((x) => x !== 'letter')) assert.equal(heroDesignCropAnchor(d), 'top');
  const head: TileHead = { htmlAttrs: [], bodyAttrs: [], styles: [] };
  for (const design of HERO_DESIGNS) {
    const section = render(design);
    const expected = design === 'letter' ? 'bottom' : 'top';
    assert.equal(tileCropAnchor(section), expected, `${design}: the tile read the wrong anchor off the rendered hero`);
    const doc = buildTileDocument(head, { key: 'f:hero', section, chain: [], frameWidth: 375 });
    assert.equal(doc.includes(TILE_ANCHOR_BOTTOM_CSS), expected === 'bottom', `${design}: the tile document's crop`);
  }
  // A hand-made attribute outside the set never pins anything.
  assert.equal(tileCropAnchor('<header data-hero-design="editorial">'), 'top');
});

/* ═══ 7 · SOURCE ═══ */

test('7 · SOURCE: every masthead mount spreads the ONE heroElements object, which carries the design', () => {
  const body = read('app/[slug]/_components/site-body.tsx');
  const mounts = body.split('<PahinaMasthead').length - 1;
  assert.ok(mounts > 0, 'site-body.tsx no longer mounts PahinaMasthead — has it moved?');
  const spreads = body.split('{...heroElements}').length - 1;
  assert.equal(spreads, mounts, `${mounts} masthead mounts but ${spreads} spread heroElements — a mount would miss the design`);
  assert.match(body, /design:\s*heroDesignOf\(heroCanvas\)/, 'heroElements no longer carries the design');
});

test('7b · SOURCE: the Hero page offers the four designs as ONE dropdown (PickMenu), never a pill row, and drafts the whole canvas', () => {
  const picker = read('app/dashboard/[eventId]/launch/_components/maker-hero-design.tsx');
  assert.match(picker, /<PickMenu\b/);
  assert.doesNotMatch(picker, /role="radiogroup"|aria-pressed/, 'a pill row crept in');
  assert.match(picker, /HERO_DESIGNS\.map/);
  assert.match(picker, /widgets:\s*\{\s*hero:\s*\{\s*canvas:\s*next\s*\}\s*\}/, 'a pick must write the hero row’s whole canvas');
  assert.match(picker, /withHeroDesign\(latest\.current/, 'a pick must build on the LATEST canvas (two quick picks)');
  const panel = read('app/dashboard/[eventId]/launch/_components/maker-made-once.tsx');
  assert.match(panel, /<MakerHeroDesignPicker\b/);
  assert.match(panel, /<MiniTour tourKey="customer_hero_designs_v1"/);
  assert.ok(TOUR_KEYS.includes('customer_hero_designs_v1'));
  assert.ok(TOURS.customer_hero_designs_v1.slides.length >= 2);
  // The page hands the drafted AND the live hero canvas in.
  const page = read('app/dashboard/[eventId]/website/editor/page.tsx');
  assert.match(page, /heroCanvas=\{sanitizeHubCanvas\(allWidgets/);
  assert.match(page, /liveHeroCanvas=\{sanitizeHubCanvas\(liveWidgets/);
});

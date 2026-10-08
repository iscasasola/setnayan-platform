/**
 * 🧩 THE PART MAP (`lib/maker-parts.ts`) — the new Maker's Stages side.
 *
 *   1. Every part names ONE source the Maker knows (info · studio · supplier · tool).
 *   2. Date and Place (and the Venue) come from Suppliers — owner: *"suppliers"*.
 *   3. The four for-each-guest parts are marked `my`, and only they.
 *   4. The Text tool is exactly Font · Colour · Size — and `PartTextTab`, with
 *      `threeControls`, draws exactly those rows (owner 2026-10-06: *"no"* to
 *      Weight, B/I/U, line and letter spacing). Sabotage: add `weight` → red.
 *   5. Names · Date · Place are three parts; the Title is the stage's first line,
 *      never the Event Name.
 *   6. Every page's parts are real parts; every Studio source is a real Studio tile.
 *   7. Swipe continues into the next page.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  MAKER_PARTS,
  MAKER_PART_KEYS,
  MAKER_PART_TEXT_TOOLS,
  MAKER_PART_TEXT_ROW,
  MAKER_PART_TOOLS,
  MAKER_STAGE_KEYS,
  MAKER_STAGE_PAGES,
  makerPartOfTap,
  makerPartQuietRow,
  makerPartSource,
  makerPartsTappable,
  makerStepPart,
  type MakerPartKey,
} from './maker-parts';
import { STUDIO_TILE_KEYS } from './studio-tiles';
import { PartTextTab } from '../app/dashboard/[eventId]/website/editor/_components/part-inspector';

/* The neighbouring render tests' harness: the components' JSX reads a global React. */
(globalThis as unknown as { React: unknown }).React = React;
const h = React.createElement;

test('every part names one source the Maker knows', () => {
  assert.deepEqual([...MAKER_PART_KEYS].sort(), Object.keys(MAKER_PARTS).sort(), 'the key list and the map are the same parts');
  for (const k of MAKER_PART_KEYS) {
    assert.doesNotThrow(() => makerPartSource(k), `${k} has a source`);
    assert.ok(MAKER_PARTS[k].label.trim().length > 0, `${k} has a word`);
  }
});

test('Date, Place and the Venue are set in Suppliers — read-only here', () => {
  assert.deepEqual(makerPartSource('date'), { kind: 'supplier', fact: 'date' });
  assert.deepEqual(makerPartSource('place'), { kind: 'supplier', fact: 'venue' });
  assert.deepEqual(makerPartSource('venue'), { kind: 'supplier', fact: 'venue' });
  /* (Re-aimed 2026-10-09: the door's words are the approved prototype's — one line for both, `TOOLBAR-SPEC-2026-10-09.md` § EDIT.
     Which fact it is still rides in `to.suppliers`.) */
  assert.equal(makerPartQuietRow('date')?.words, 'Change it in Suppliers');
  assert.equal(makerPartQuietRow('place')?.words, 'Change it in Suppliers');
  assert.deepEqual(makerPartQuietRow('date')?.to, { suppliers: 'date' });
  assert.deepEqual(makerPartQuietRow('place')?.to, { suppliers: 'venue' });
});

test('the four for-each-guest parts are marked `my`, and only they', () => {
  const my = MAKER_PART_KEYS.filter((k) => MAKER_PARTS[k].my);
  assert.deepEqual(my, ['myrole', 'mywear', 'myarrive', 'myguests']);
  assert.deepEqual(my.map((k) => MAKER_PARTS[k].my), ['role', 'wear', 'arrive', 'guests']);
});

test('the Text rows are exactly Font · Colour · Size; the toolbar’s tools are Edit · Style · Background · Animate', () => {
  /* The shipped part sheet's three rows (the older Maker and the desktop still draw them, `threeControls`). */
  assert.deepEqual([...MAKER_PART_TEXT_TOOLS], ['font', 'colour', 'size']);
  /* 🔁 Re-aimed 2026-10-09 (owner: *"so it is just Edit | Style | Background | Animate"*): it was Style | Text |
     Animate — Text is not a tool of the toolbar any more (`lib/the-toolbar-is-four-rows.test.ts`). */
  assert.deepEqual([...MAKER_PART_TOOLS], ['edit', 'style', 'bg', 'animate']);
});

test('PartTextTab with threeControls draws Font · Colour · Size and none of the retired rows', () => {
  const style = { weight: 600, italic: true, underline: true, align: 'center' } as never;
  const render = (threeControls: boolean) =>
    renderToStaticMarkup(
      h(PartTextTab, {
        el: 'names',
        face: { font: 'fraunces', color: null, size: null } as never,
        style,
        onRange: false,
        choose: () => {},
        chooseAlign: () => {},
        resetText: () => {},
        board: ['#5B4A6B'],
        shownColour: '#2C2A29',
        contrast: null,
        eventId: 'e-1',
        threeControls,
      } as never),
    );
  const rowsOf = (html: string) => [...html.matchAll(/data-inspector-row="([a-z-]+)"/g)].map((m) => m[1]!);
  const three = rowsOf(render(true));
  assert.deepEqual(
    [...new Set(three)].sort(),
    MAKER_PART_TEXT_TOOLS.map((t) => MAKER_PART_TEXT_ROW[t]).sort(),
    `the new Maker's Text rows are exactly Font · Colour · Size — drew ${JSON.stringify(three)}`,
  );
  const html = render(true);
  for (const retired of ['data-seg="bold"', 'data-seg="italic"', 'data-seg="underline"', 'data-stepper="leading"', 'data-stepper="tracking"', 'data-inspector-row="weight"', 'data-inspector-row="align"', 'data-row="part-words"']) {
    assert.ok(!html.includes(retired), `the retired control ${retired} is not drawn`);
  }
  /* Flag off: the shipped rows are all still there (a desktop and every couple today). */
  const shipped = rowsOf(render(false));
  for (const kept of ['font', 'size', 'color', 'spacing', 'letter']) assert.ok(shipped.includes(kept), `the shipped Maker keeps ${kept}`);
});

test('Names · Date · Place are three parts; the Title is the stage line, not the Event Name', () => {
  assert.notEqual(MAKER_PARTS.names.el, MAKER_PARTS.date.el);
  assert.notEqual(MAKER_PARTS.date.el, MAKER_PARTS.place.el);
  assert.deepEqual(makerPartSource('names'), { kind: 'info', field: 'display_name' });
  assert.deepEqual(makerPartSource('ename'), { kind: 'info', field: 'title' });
  assert.equal(MAKER_PARTS.ename.el, 'eyebrow');
});

test('every page lists real parts; every Studio source is a real Studio tile', () => {
  for (const stage of MAKER_STAGE_KEYS) {
    const pages = MAKER_STAGE_PAGES[stage];
    assert.ok(pages && Object.keys(pages).length > 0, `${stage} has pages`);
    for (const [page, parts] of Object.entries(pages)) {
      for (const p of parts) assert.ok(p in MAKER_PARTS, `${stage} › ${page}: ${p} is a part`);
    }
  }
  for (const k of MAKER_PART_KEYS) {
    const src = makerPartSource(k);
    if (src.kind === 'studio') assert.ok((STUDIO_TILE_KEYS as readonly string[]).includes(src.tool), `${k} opens a real tile (${src.tool})`);
  }
});

test('a tap names its part; only parts the page drew are tiles', () => {
  const present = new Set(['f:hero', 'w:countdown']);
  /* 👆 2026-10-07 (owner: "every visible piece of the page must be a pickable part"): the cover's invite line and
     link are parts too. A reader that does not list a section's parts is answered by the section… */
  assert.deepEqual(makerPartsTappable('save_the_date', 'home', present), ['logo', 'ename', 'names', 'heroline', 'date', 'place', 'herolink', 'countdown'] satisfies MakerPartKey[]);
  /* …and one that does offers only the parts the page drew. */
  const drawn = new Set(['f:hero', 'f:hero|mark', 'f:hero|eyebrow', 'f:hero|names', 'f:hero|date', 'f:hero|venue', 'f:hero|link', 'w:countdown']);
  assert.deepEqual(makerPartsTappable('save_the_date', 'home', drawn), ['logo', 'ename', 'names', 'date', 'place', 'herolink', 'countdown'] satisfies MakerPartKey[], 'no invite line drawn → no tile');
  assert.equal(makerPartOfTap('rsvp', 'home', 'f:hero', 'line'), 'heroline', 'the invite line is its own part');
  assert.equal(makerPartOfTap('rsvp', 'home', 'f:hero', 'link'), 'herolink', 'the link is its own part');
  assert.equal(makerPartOfTap('rsvp', 'details', 'f:details', 'label'), 'details', 'THE DETAILS title and its plates are the Details block');
  assert.equal(makerPartOfTap('event', 'live', 'f:spotlight', null), 'spotlight', 'the Happening-now card is a part');
  assert.equal(makerPartOfTap('save_the_date', 'home', 'f:hero', 'date'), 'date');
  assert.equal(makerPartOfTap('rsvp', 'details', 'w:dress_code', 'heading'), 'dress');
});

test('swipe goes to the next part, and on into the next page', () => {
  const pages = ['home', 'details', 'story', 'me'];
  assert.deepEqual(makerStepPart({ parts: ['schedule', 'venue'], at: 'schedule', pages, page: 'details', dir: 1 }), { page: 'details', part: 'venue' });
  assert.deepEqual(makerStepPart({ parts: ['schedule', 'venue'], at: 'venue', pages, page: 'details', dir: 1 }), { page: 'story', part: null });
  assert.deepEqual(makerStepPart({ parts: ['schedule', 'venue'], at: 'schedule', pages, page: 'details', dir: -1 }), { page: 'home', part: null });
  assert.equal(makerStepPart({ parts: ['story'], at: 'story', pages: ['home'], page: 'home', dir: 1 }), null);
});

test('🏷 the film and the supplier thank-you parts wear their SHIPPED names', () => {
  // Owner 2026-10-07 final fixes: the Maker names a part what the rest of the
  // app already calls it — "Watch Live" (Panood) and "Supplier Stories".
  assert.equal(MAKER_PARTS.film.label, 'Watch Live');
  assert.equal(MAKER_PARTS.suppliers.label, 'Supplier Stories');
});

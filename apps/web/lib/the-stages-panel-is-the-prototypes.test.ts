/**
 * 🎨 THE STAGES PANEL IS THE PROTOTYPE'S (DECISION_LOG 2026-10-07 "THE STAGES PANEL IS
 * REDRAWN FROM THE PROTOTYPE…"; owner: *"the lower toolbar did not execute the designs
 * style we agreed on the prototype"* · *"should be a preview of the style and not text"*).
 * Every check here once failed in production while every behaviour test stayed green —
 * so each one pins what the couple SEES, behind `makerStagesStudioEnabled`:
 *
 *   1. A part tap never opens the shipped floating TypeBar: a FIRST tap on words picks
 *      the part (`makerStageMayType`), the work area takes the caret back BEFORE it would
 *      start typing, and the TypeBar under the flag is the keyboard's one bar — Done, and
 *      no Wording / Style / Hide.
 *   2. Stages never shows the retired guided picker (`data-stage-picker`): with the flag
 *      there is no guided plan, and every door into Event Details lands on Studio's home.
 *   3. Style › Look's layouts are REAL miniatures — each card carries a rendered preview,
 *      never a description line or a "Recommended" tag.
 *   4. The Reveal is locked first — no grip, no ＋ above, no 🗑; nothing drops above it.
 *   5. A scene of rows offers ONE Rows ▾ in Build in, and it writes the shipped `sequence`.
 *
 * (Every row ≥ 44 px is `the-stage-panel-fits-a-phone.test.ts`.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { makerStageMayType } from './maker-stage-type';
import { makerDropSlot, makerRevealEdges, makerSceneHasRows, makerStagePickedAttr } from './maker-parts';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');
const LAUNCH = 'app/dashboard/[eventId]/launch/_components';
const EDITOR = 'app/dashboard/[eventId]/website/editor/_components';

/* ── 1 · a part tap never opens the shipped TypeBar ──────────────────────── */

test('typing is a second tap on the picked part — never the first, never the date or the place', () => {
  const names = makerStagePickedAttr('names');
  assert.equal(names, 'f:hero|names');
  assert.equal(makerStageMayType(null, 'f:hero', 'names'), false, 'nothing picked: a tap only picks');
  assert.equal(makerStageMayType(makerStagePickedAttr('countdown'), 'f:hero', 'names'), false, 'another part picked: a tap only picks');
  assert.equal(makerStageMayType(names, 'f:hero', 'names'), true, 'the picked part: a second tap types');
  assert.equal(makerStageMayType(makerStagePickedAttr('date'), 'f:hero', 'date'), false, 'the date is Suppliers’ — never typed');
  assert.equal(makerStageMayType(makerStagePickedAttr('place'), 'f:hero', 'venue'), false, 'the place is Suppliers’ — never typed');
  /* A scene's words (its part has no `el`) type wherever in the scene the words are. */
  assert.equal(makerStageMayType(makerStagePickedAttr('message'), 'w:special_message', 'body'), true);
});

test('the work area takes a first tap’s caret back BEFORE it starts the TypeBar', () => {
  const src = read(`${EDITOR}/editor-shell.tsx`);
  const read0 = src.indexOf('const start = readTypeStart(event.data, event.source, Date.now());');
  assert.ok(read0 > 0, 'the canvas’s type-start is read in editor-shell.tsx');
  const gate = src.indexOf('if (!makerStageMayType(picked, start.key, start.el))', read0);
  const firstStart = src.indexOf('setTypeStart(start)', read0);
  assert.ok(gate > read0 && firstStart > gate, 'the Stages gate runs before any setTypeStart(start)');
  const block = src.slice(gate, firstStart);
  assert.match(block, /t: 'typeStop'/, 'the caret is taken back from the canvas');
  assert.match(block, /MAKER_STAGE_PICK_EVENT/, 'the tap is handed to the panel as a pick');
  assert.match(block, /return;/, 'and the TypeBar is never started');
});

test('under the flag the TypeBar is the keyboard’s ONE bar: Done — no Wording, no Style, no Hide', () => {
  const src = read(`${EDITOR}/type-in-place.tsx`);
  const at = src.indexOf('if (stagesStudio && !p.inline');
  assert.ok(at > 0, 'the flag-on keyboard bar exists');
  const end = src.indexOf('document.body,\n    );\n  }', at);
  const bar = src.slice(at, end);
  assert.match(bar, /data-type-bar-keys/);
  assert.match(bar, />Done</);
  for (const old of ['Wording', 'Style ▾', 'Hide', 'data-type-style', 'data-type-hide']) {
    assert.ok(!bar.includes(old), `the flag-on bar carries no "${old}"`);
  }
});

/* ── 2 · Stages never shows the guided picker ────────────────────────────── */

test('with the flag the guided flow has no plan — the stage picker cannot draw', () => {
  const src = read(`${LAUNCH}/details-workspace.tsx`);
  assert.match(src, /const plan = maker\?\.stagesStudio !== true && guide/, 'no plan under the flag');
  assert.match(src, /plan && at\?\.kind === 'stages' \? <StagePicker/, 'the picker draws only from a plan');
});

test('every door into Event Details lands on Studio’s home, never over the Stages page', () => {
  const src = read(`${LAUNCH}/maker-shell.tsx`);
  const at = src.indexOf("if (!ss || side !== 'stages' || selection?.kind !== 'tool' || selection.key !== 'details') return;");
  assert.ok(at > 0, 'the Stages side sends a Details selection away');
  const body = src.slice(at, at + 200);
  assert.match(body, /setSide\('studio'\)/);
  assert.match(body, /setStudioAt\('home'\)/);
  assert.match(body, /select\(null\)/);
});

/* ── 3 · Style › Look's layouts are real miniatures ──────────────────────── */

test('every layout card carries a rendered preview and only a short name — no description, no Recommended', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { StyleCards } = await import(`../${LAUNCH}/stage-panel/style-carousel`);
  const html = renderToStaticMarkup(
    React.createElement(StyleCards, {
      options: [
        { id: 'four-tiles', name: 'Four tiles' },
        { id: 'big-number', name: 'Big number' },
        { id: 'calendar', name: 'The calendar' },
      ],
      value: 'four-tiles',
      onPick: () => {},
      pending: false,
      canvasKey: 'w:countdown',
      sceneType: 'countdown',
    }),
  );
  const cards = html.split('data-style-card="').slice(1);
  assert.equal(cards.length, 3, 'one card per shipped style');
  for (const c of cards) {
    assert.match(c, /data-style-preview=/, 'each card holds a preview element');
    assert.ok(!/Recommended|tile each|one line/.test(c), 'no description line, no Recommended tag');
  }
});

test('the preview renders the SHIPPED style components — never a text card', () => {
  const src = read(`${LAUNCH}/stage-panel/style-preview.tsx`);
  assert.match(src, /from '@\/app\/\[slug\]\/_components\/countdown'/, 'the shipped countdown is the countdown’s miniature');
  assert.match(src, /buildTileDocument/, 'drawn in a copy of the canvas’s own document');
  assert.match(src, /<iframe/, 'a picture, not words');
});

/* ── 4 · the Reveal is locked first ──────────────────────────────────────── */

test('picked, the Reveal shows no grip, no ＋ above and no 🗑 — its ＋ below stays; every other part keeps all four', () => {
  assert.deepEqual(makerRevealEdges(true), { grip: false, addAbove: false, addBelow: true, remove: false });
  assert.deepEqual(makerRevealEdges(false), { grip: true, addAbove: true, addBelow: true, remove: true });
  const src = read(`${LAUNCH}/add-part-sheet.tsx`);
  assert.match(src, /const edgesOf = makerRevealEdges\(isReveal\);/);
  assert.match(src, /const canRemove = edgesOf\.remove &&/, '🗑 follows the lock');
  assert.match(src, /const canMove = edgesOf\.grip &&/, 'the grip follows the lock');
  assert.match(src, /\{edgesOf\.addAbove \? \(\s*<button type="button" aria-label=\{`Add above/, '＋ above follows the lock');
});

test('a drop at slot 0 on a page the Reveal leads lands at slot 1', () => {
  assert.equal(makerDropSlot(0, true), 1);
  assert.equal(makerDropSlot(3, true), 3);
  assert.equal(makerDropSlot(0, false), 0);
});

/* ── 5 · Rows ▾ in Build in writes the shipped `sequence` ────────────────── */

test('a scene of rows offers Rows ▾; a single block does not', () => {
  for (const t of ['schedule', 'our_love_story', 'venue_map', 'dress_code', 'what_to_bring']) assert.ok(makerSceneHasRows(t), `${t} is rows`);
  for (const t of ['countdown', 'special_message', 'greeting', 'hero']) assert.ok(!makerSceneHasRows(t), `${t} is one block`);
});

test('Rows ▾ writes the scene’s `sequence` — and Action carries no Parts row', () => {
  const src = read(`${EDITOR}/scene-animate-tab.tsx`);
  const at = src.indexOf('if (ss) {');
  const end = src.indexOf('return (\n    <div data-scene-tab="animate" aria-busy={pending}>', at);
  const ss = src.slice(at, end);
  assert.match(ss, /rows=\{\s*makerSceneHasRows\(widgetType\)/);
  assert.match(ss, /onPick: \(q\) => save\(\(c\) => \{ if \(q === 'auto'\) delete c\.sequence; else c\.sequence = q; \}\)/);
  const animate = read(`${LAUNCH}/stage-panel/stage-animate.tsx`);
  const act = animate.slice(animate.indexOf("phase === 'act' ?"), animate.indexOf(') : (\n        <>\n          {outAbout'));
  assert.ok(!/rows|Parts/.test(act), 'Action keeps Does ▾ and Timing ▾ only');
  assert.match(animate.slice(animate.indexOf("phase === 'in' ?"), animate.indexOf("phase === 'act' ?")), /small="Rows"/, 'Rows ▾ is Build in’s');
});

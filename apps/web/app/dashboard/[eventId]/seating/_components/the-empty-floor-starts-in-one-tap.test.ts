/**
 * the-empty-floor-starts-in-one-tap.test.ts — THE EMPTY FLOOR'S FIRST STEP (owner 2026-11-20, "Yes, your picks";
 * DECISION_LOG "GUESTS › SEATS, ROUND TWO", pick 2 and "nothing depends on pressing the floor").
 *
 *   1 · "Seat everyone for me" is THE main button; "Add a table" is second.
 *   2 · When the booked venue drew its hall, "Start from this hall" comes first — and only when there is a way to bring
 *       it in (a button that does nothing is never drawn).
 *   3 · THE BUTTONS ARE NOT ON THE FLOOR in Guests. The floor captures every press it hears for its pan, so a button
 *       drawn on it once swallowed every tap (live, 20 Nov — #8055), and the card sat on the STAGE label. In Guests they
 *       ride the thumb row's seat; any other host keeps them at the floor's FOOT, with their presses kept from the pan.
 *   4 · The lab's stand-in writes are never provided by the app.
 *
 * Sabotage (each goes red): swap the two buttons' order or `main` · draw the hall buttons without a handler · drop
 * `inGuests ? null` · drop the foot card's `stopPropagation` · provide `SeatFloorWritesContext` under app/dashboard.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'seating', '_components');
const code = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));
const noop = () => {};

async function draw(props: Record<string, unknown>): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { FloorStartButtons } = await import('./seat-floor-start');
  return renderToStaticMarkup(
    React.createElement(FloorStartButtons, { toSeat: 8, canEdit: true, onSeatEveryone: noop, onAddTable: noop, ...props } as Parameters<typeof FloorStartButtons>[0]),
  );
}

test('1 · "Seat everyone for me" is the main button, "Add a table" second', async () => {
  const html = await draw({});
  const seat = html.indexOf('data-floor-seat-everyone');
  const add = html.indexOf('data-floor-add-table');
  assert.ok(seat > 0 && add > seat, '"Seat everyone for me" is not first');
  assert.match(html, /Seat everyone for me/);
  assert.match(html, /Add a table/);
  assert.doesNotMatch(html, /Lay out your floor|Build my seating draft|Add your first table|Set room size/, 'the three old steps are back');
  const buttons = html.match(/<button[^>]*>/g) ?? [];
  assert.equal(buttons.length, 2, 'the empty floor has more than its two buttons');
  assert.match(buttons[0]!, /data-main|sn-main|is-main|data-floor-seat-everyone/);
  // the main one is the brand button: its tone differs from the second's
  const tone = (b: string) => /data-tone="([a-z]+)"/.exec(b)?.[1] ?? b;
  assert.notEqual(tone(buttons[0]!), tone(buttons[1]!), 'the two buttons weigh the same — neither is the main one');
});

test('1b · with nobody to seat, the main button says why it cannot run — "Add a table" still can', async () => {
  const html = await draw({ toSeat: 0, seatEveryoneNote: 'Add guests first' });
  assert.match(html, /data-floor-seat-everyone=""[^>]*disabled|disabled=""[^>]*data-floor-seat-everyone/);
  assert.match(html, /Add guests first/);
  assert.doesNotMatch(html.slice(html.indexOf('data-floor-add-table') - 200, html.indexOf('data-floor-add-table') + 200), /disabled=""/);
});

test('2 · "Start from this hall" comes first when the venue drew one — never as a button that does nothing', async () => {
  const hall = { shop: 'Hotel Luna', name: 'Grand Ballroom', tables: 6 };
  const withWay = await draw({ hall, onStartFromHall: noop, onStartEmpty: noop });
  assert.ok(withWay.indexOf('Start from this hall') > 0 && withWay.indexOf('Start from this hall') < withWay.indexOf('Start empty'));
  assert.match(withWay, /6 tables are already placed/);
  assert.doesNotMatch(withWay, /Seat everyone for me/);
  const noWay = await draw({ hall });
  assert.doesNotMatch(noWay, /Start from this hall/, 'a hall with no way to bring it in drew a dead button');
  assert.match(noWay, /Seat everyone for me/);
});

test('3 · the buttons are not on the floor in Guests; elsewhere they sit at its foot and keep their presses', () => {
  const ed = code('seating-editor.tsx');
  // the premise: the floor captures every press it hears
  const down = ed.slice(ed.indexOf('const onCanvasPointerDown = '), ed.indexOf('const onCanvasPointerMove'));
  assert.match(down, /canvasRef\.current\?\.setPointerCapture\(e\.pointerId\)/, 'the floor no longer captures — re-read this test');
  const at = ed.indexOf('{tables.length === 0 ? (');
  assert.ok(at > 0, 'the empty-floor branch is gone');
  const branch = ed.slice(at, ed.indexOf('{tables.map(', at));
  assert.match(branch, /inGuests \? null : \(/, 'Guests draws the first step on the floor again');
  assert.match(branch, /items-end/, 'outside Guests the card left the foot of the floor (it sat on the STAGE label, centred)');
  const card = branch.indexOf('data-floor-steps=""');
  assert.ok(card > 0, 'the foot card is not marked data-floor-steps');
  assert.match(branch.slice(card, branch.indexOf('>', branch.indexOf('className=', card))), /onPointerDown=\{\(e\) => e\.stopPropagation\(\)\}/, 'a press on a step reaches the floor’s capture');
  assert.match(branch.slice(card), /<FloorStartCard \{\.\.\.startProps\} \/>/);
  // in Guests: over the thumb row (the Guests screen's own seat — outside the floor)
  const thumb = ed.slice(ed.indexOf('const seatThumb ='), ed.indexOf('const askMoveSheet'));
  assert.match(thumb, /createPortal\(/);
  assert.match(thumb, /\{seatPop \?\? addBar \?\? tableBar \?\? startCard \?\? seatTray\}/);
  assert.match(ed, /onSeatEveryone: buildDraft,\s*onAddTable: \(\) => addTable\(\),/, 'the two buttons are not the shipped actions');
});

test('4 · only the lab stands in for the floor’s writes', () => {
  const root = join(process.cwd(), 'app');
  const providers: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) {
        if (f !== 'node_modules') walk(p);
      } else if (/\.tsx?$/.test(f) && !f.endsWith('.test.ts') && stripComments(readFileSync(p, 'utf8')).includes('SeatFloorWritesContext.Provider')) {
        providers.push(p.slice(root.length + 1));
      }
    }
  };
  walk(root);
  assert.deepEqual(providers, ['dev/guests-lab/lab-seat-floor.tsx']);
  const ed = code('seating-editor.tsx');
  for (const w of ['createTable', 'buildSeatingDraft', 'deleteTable', 'updateTablePosition']) {
    assert.match(ed, new RegExp(`floorWrites\\?\\.${w} \\?\\? ${w}\\)`), `${w}: the shipped action is not the default`);
  }
});

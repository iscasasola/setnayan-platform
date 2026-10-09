/**
 * the-rsvp-tools-stand-in-the-four-rows.test.ts — ON THE RSVP STAGE THE FOUR TOOLS STAND WHERE EVERY STAGE'S DO.
 *
 * Owner, 2026-10-10, verbatim: *"please make Edit | Style | Background | Animate Consistent in design"*. Measured that
 * day on the review copy at 375 × 812: everywhere else a tool's rows are the toolbar's four-row frame (44-px controls
 * at y = 594 / 648 / 702 / 756, the last row pinned), and the RSVP stage's own panel stacked its rows from the top
 * (Style at 592 / 642; Animate at 596 / 702, 20 px in from the side where the others stand 10).
 *
 * Held here:
 *   1 · EXECUTED — the reply pages' own tools are drawn (the real `MakerRsvpSettings`, each picked thing and tool) and
 *       every one of them IS the shared frame: its root wears `SP_ROWS` word for word, every row of it wears
 *       `SP_ROWS_ROW` and says which of the four it is, nothing is drawn outside a row, and no two rows share a place.
 *       Style's Colour · Size is the LAST row (row 4), where a cover line's is. Sabotage: the Style rows back in a
 *       column of their own → red; Colour · Size in row 2 → red.
 *   2 · THE BOX — the stage hands its panel to `StageStyle` as a `frame`: a box with no gap, no room under the rows
 *       and no scroll of its own, which makes the stage's wrapper exactly as tall as the four rows. Sabotage: the
 *       scrolling pane back → red.
 *
 * The frame is `lib/maker-stage-room.ts`'s (`SP_ROWS`, `SP_ROWS_ROW`) — this file measures against those constants,
 * never against a copy of their words.
 *
 * Lives in `lib/` because node's test glob does not descend into `[eventId]`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import { SP_ROWS, SP_ROWS_ROW } from './maker-stage-room';
import type { RsvpStageScene } from './rsvp-stage';

(globalThis as { React?: typeof React }).React = React;
/* The RSVP settings import the draft action, whose module is `server-only`: stubbed for this render, as
   `the-rsvp-stage-edits-one-line.test.ts` does. */
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const L = 'app/dashboard/[eventId]/launch/_components';
const BOARD = ['#1f2a44', '#6b7a3a', '#c8553d', '#f3ede2', '#2c2a29'];

type Picked = { tool: string; part: string | null; line: string | null };
async function panel(scene: RsvpStageScene, picked: Picked, current: Record<string, unknown> = {}) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerRsvpSettings } = await import(`../${L}/maker-rsvp-ask`);
  return renderToStaticMarkup(
    React.createElement(MakerRsvpSettings as React.FC<Record<string, unknown>>, {
      eventId: 'e-1',
      current,
      drafted: false,
      replyBy: { date: '2026-11-18', isDefault: false },
      replyByOwn: { deadline: '2026-11-18', pricingMode: 'final_only' },
      requests: { count: null, list: null },
      scene,
      picked,
      celebration: { ownsPro: false, storeShell: false, colours: BOARD },
    }),
  );
}

const has = (cls: string, every: string) => every.split(/\s+/).every((c) => cls.split(/\s+/).includes(c));
/** The frame the panel drew: its root's classes, and each row's place and classes. */
function frameOf(html: string) {
  const root = /<div class="([^"]*)"[^>]*data-rsvp-stage-rows=""/.exec(html)?.[1] ?? null;
  const rows = [...html.matchAll(/<(?:div|p) [^>]*?(?:class="([^"]*)"[^>]*?data-rsvp-row="(\d)"|data-rsvp-row="(\d)"[^>]*?class="([^"]*)")/g)].map((m) => ({ at: Number(m[2] ?? m[3]), cls: m[1] ?? m[4] ?? '' }));
  return { root, rows };
}

/** Every picked thing whose tool is the stage's own rows (Animate is `StageAnimate`'s own grid — its own test, below). */
const OWN: ReadonlyArray<{ what: string; scene: RsvpStageScene; picked: Picked; rows: number[] }> = [
  { what: 'Edit on a line with premade words', scene: 'form', picked: { tool: 'edit', part: 'rsvp', line: 'yes' }, rows: [1, 2] },
  { what: 'Style on a text line', scene: 'form', picked: { tool: 'style', part: 'rsvp', line: 'question' }, rows: [1, 4] },
  { what: 'Style on a button', scene: 'form', picked: { tool: 'style', part: 'rsvp', line: 'yes' }, rows: [1, 3, 4] },
  { what: 'Style on the pass’s Save', scene: 'thanks', picked: { tool: 'style', part: 'pass', line: 'save' }, rows: [1, 3, 4] },
  { what: 'Background on the card', scene: 'form', picked: { tool: 'bg', part: 'rsvp', line: null }, rows: [1, 2] },
  { what: 'Background on a line', scene: 'form', picked: { tool: 'bg', part: 'rsvp', line: 'question' }, rows: [1] },
];

test('1 · every tool of the reply pages’ own is the shared four-row frame — and Colour · Size is the last row', async () => {
  for (const c of OWN) {
    const html = await panel(c.scene, c.picked);
    const { root, rows } = frameOf(html);
    assert.ok(root, `${c.what}: no four-row frame was drawn`);
    assert.ok(has(root!, SP_ROWS), `${c.what}: the root is not the shared frame (${root})`);
    assert.doesNotMatch(root!, /(?:^|\s)(?:flex-col|gap-y-\[var\(--sp-rg\)\]\s+flex|overflow-y-auto)(?:\s|$)/, `${c.what}: the root is a column of its own`);
    assert.deepEqual(rows.map((r) => r.at).sort(), c.rows, `${c.what}: its rows are not in the places approved`);
    for (const r of rows) {
      assert.ok(has(r.cls, SP_ROWS_ROW), `${c.what}: row ${r.at} is not the frame's row (${r.cls})`);
      assert.ok(has(r.cls, `row-start-${r.at}`), `${c.what}: row ${r.at} does not say which of the four it is`);
      assert.equal((r.cls.match(/(?:^|\s)row-start-\d/g) ?? []).length, 1, `${c.what}: a row claims two places`);
    }
    /* Nothing of the tool is drawn OUTSIDE a row: every control it holds sits inside a `data-rsvp-row`. */
    const outside = html.replace(/<(div|p) [^>]*data-rsvp-row="\d"[\s\S]*$/, '');
    assert.doesNotMatch(outside, /<button\b|<input\b|role="slider"/, `${c.what}: a control is drawn before the first row`);
  }
  /* 🎨 STYLE'S LAST ROW IS ROW 4 — Colour · Size, as on a cover line (the toolbar draws that one in `row-start-4`). */
  const style = await panel('form', { tool: 'style', part: 'rsvp', line: 'question' });
  assert.match(style, /data-rsvp-row="4" data-rsvp-line-look-row="size"/, 'Colour · Size is not Style’s last row');
  assert.match(style, /data-rsvp-row="1" data-rsvp-line-look-row="font"/, 'Font is not Style’s first row');
  assert.match(src(`${L}/stage-tools.tsx`), /<div className="row-start-4 min-w-0">\s*<StageLookRow/, 'anti-vacuity: a cover line’s Colour · Size is the toolbar’s row 4');
  /* The rows are the frame's own classes in the source too — never a number copied. */
  const look = src(`${L}/rsvp-line-look.tsx`);
  assert.doesNotMatch(look, /flex flex-col gap-y-\[var\(--sp-rg\)\]|min-h-11`|min-h-\[var\(--sp-rh/, 'a row of the reply pages’ own is sized by hand again');
  assert.ok((look.match(/\$\{SP_ROWS_ROW\} row-start-[1-4]/g) ?? []).length >= 5, 'anti-vacuity: the rows were found');
});

test('2 · the box: the stage’s panel is a frame — no gap, no room under the rows, nothing scrolled', () => {
  const stage = src(`${L}/maker-rsvp-stage.tsx`);
  assert.equal((stage.match(/<StageStyle\b/g) ?? []).length, 1, 'anti-vacuity: the stage draws ONE panel body');
  assert.match(stage, /background=\{null\}\s*arrange=\{null\}\s*frame\s*\/>/, 'the RSVP stage’s panel is the scrolling pane again');
  const style = src(`${L}/stage-panel/stage-style.tsx`);
  const box = /const SP_FRAME_BOX = '([^']+)';/.exec(style)?.[1] ?? '';
  assert.ok(box, 'anti-vacuity: the frame’s box was found');
  assert.match(style, /if \(frame\) \{\s*return \(\s*<div className=\{SP_FRAME_BOX\} data-stage-style=\{on\} data-stage-style-frame="">/);
  const own = box.split(/\s+/).filter((c) => !c.startsWith('[&>*]:'));
  assert.deepEqual(own.sort(), ['h-full', 'min-h-0', 'px-[10px]'], 'the box adds a gap, a padding or a scroll of its own');
  /* Its one child — the stage's wrapper — is exactly the box's height, with no room under it. */
  for (const c of ['[&>*]:h-full', '[&>*]:min-h-0', '[&>*]:!pb-0']) assert.ok(box.split(/\s+/).includes(c), `the box does not make its child ${c}`);
  /* …and the side inset is the toolbar's own (Background's rows are `SP_ROWS … px-[10px]` in the same file). */
  assert.match(style, /className=\{`\$\{SP_ROWS\} h-full px-\[10px\]`\}/, 'anti-vacuity: the toolbar’s side inset');
});

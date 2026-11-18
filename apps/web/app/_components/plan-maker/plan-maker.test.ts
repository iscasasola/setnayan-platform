/**
 * 🔒 The shared PlanMaker (app/_components/plan-maker/plan-maker.tsx) — the options a supplier page and a client page
 * rely on, rendered for real (react-dom/server), never read off the source.
 *
 *   · Grid view on its own; Floor plan only when the page passes it (ruling 35: Pro, Max, Ultra), else greyed with
 *     the page's reason or not listed;
 *   · read-only: no tools, no room fields, ONE table marked with the page's words;
 *   · the guest/name layer switched off draws no names; switched on, it does;
 *   · copy says "supplier"-side words only — never "vendor".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { PlanMaker, type PlanMakerOptions } from './plan-maker';
import type { Plan } from '@/lib/plan-maker';

// tsx compiles the component's JSX as React.createElement — give it the React it looks for.
(globalThis as unknown as { React: unknown }).React = React;

const plan: Plan = {
  room: { widthM: 24, depthM: 16 },
  doors: [{ id: 'm', kind: 'main', wall: 'bottom', at: 50 }],
  tables: [
    { id: 'a', label: 'T1', kind: 'round', chairs: 8, x: 25, y: 30 },
    { id: 'b', label: 'T2', kind: 'long', chairs: 10, chairsAtEnds: true, x: 60, y: 30 },
    { id: 'c', label: 'T3', kind: 'half_moon', chairs: 4, x: 40, y: 70 },
    { id: 'd', label: 'T4', kind: 'long', chairs: 4, x: 75, y: 70 },
  ],
};

async function render(opts: PlanMakerOptions, editable = true): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(
    React.createElement(PlanMaker, { plan, onChange: editable ? () => undefined : undefined, options: opts }),
  );
}

test('Grid draws one tile per table, in name order, with the table’s words', async () => {
  const html = await render({ views: ['grid'] });
  assert.match(html, /data-plan-view="grid"/);
  assert.equal(html.match(/data-plan-tile="/g)?.length, 4);
  assert.match(html, /Long · 10 chairs · 2 at the ends/);
  assert.match(html, /Square · 4 chairs/);
  assert.match(html, /Half-moon booth · seats 4/);
  assert.match(html, /4 tables · 26 seats/);
});

test('Floor plan draws the room to its Wide × Deep shape, its doors on a wall and every table', async () => {
  const html = await render({ views: ['floor', 'grid'] });
  assert.match(html, /data-plan-view="floor"/);
  assert.match(html, /viewBox="0 0 1000 666\.6/);
  assert.match(html, /data-plan-door="main" data-plan-door-wall="bottom"/);
  assert.equal(html.match(/data-plan-table="/g)?.length, 4);
});

test('Floor plan is offered only when the page allows it; otherwise greyed with the page’s reason', async () => {
  const off = await render({ views: ['grid'] });
  assert.doesNotMatch(off, /data-plan-floor=/);
  // the reason rides on the dropdown's options; the button shows Grid
  const greyed = await render({ views: ['grid'], floorPlanNote: 'On Pro, Max and Ultra' });
  assert.match(greyed, /data-plan-view-pick/);
  assert.doesNotMatch(greyed, /data-plan-floor=/);
});

test('editable: ＋ Table, ＋ Door, Line up and the room’s Wide / Deep rows are there', async () => {
  const html = await render({ views: ['grid', 'floor'] });
  for (const hook of ['data-plan-add-table', 'data-plan-add-door', 'data-plan-line-up', 'data-plan-room-side="widthM"', 'data-plan-room-side="depthM"']) {
    assert.ok(html.includes(hook), hook);
  }
});

test('read-only: no tools, no room fields, and exactly ONE table marked with the page’s words', async () => {
  for (const view of ['grid', 'floor'] as const) {
    const html = await render({ views: [view], readOnly: true, markedTableId: 'c', markedLabel: 'Their table' }, true);
    assert.match(html, /data-plan-readonly=""/);
    assert.doesNotMatch(html, /data-plan-add-table|data-plan-line-up|data-plan-room-side/);
    assert.match(html, /Their table/);
    const marks = view === 'grid' ? html.match(/data-plan-tile-marked/g) : html.match(/data-plan-marked/g);
    assert.equal(marks?.length, 1, view);
  }
  // no onChange at all is read-only too
  assert.match(await render({ views: ['grid'] }, false), /data-plan-readonly=""/);
});

test('the name layer: off draws no names; on draws them', async () => {
  const namesByTable = { a: ['Maria', 'Jose'] };
  const off = await render({ views: ['grid'], namesByTable, showNames: false });
  assert.doesNotMatch(off, /Maria/);
  const on = await render({ views: ['grid'], namesByTable });
  assert.match(on, /Maria, Jose/);
});

test('the shared maker never says "vendor"', () => {
  for (const f of ['plan-maker.tsx', '../../../lib/plan-maker.ts']) {
    const src = readFileSync(join(__dirname, f), 'utf8');
    assert.doesNotMatch(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''), /\bvendor/i, f);
  }
});

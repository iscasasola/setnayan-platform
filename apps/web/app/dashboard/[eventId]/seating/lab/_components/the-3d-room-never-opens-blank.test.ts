/**
 * the-3d-room-never-opens-blank.test.ts — SEATS › 3D NEVER SHOWS A BLANK SCREEN (owner 2026-11-20, drawing § 6; the
 * fault, live: 15–20 s of black while the room's code and scene loaded — `now/08-seats-3d-loading.jpg`).
 *
 * The couple's floor plan is drawn AT ONCE as a poster (the shared core's `PlanPoster`), with "Building your room…"
 * over it; it lifts when the room has drawn its first frames — or when the room cannot draw at all.
 *
 * Sabotage (each goes red): give the bundle its own placeholder back · stop drawing `RoomBuilding` · drop
 * `<RoomReady>` from the Canvas · drop the `webgl.lost` lift.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'seating', 'lab', '_components');
const code = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));

test('the loader draws the plan as a poster until the room says it has drawn', () => {
  const loader = code('seating-lab-loader.tsx');
  assert.match(loader, /dynamic\(\(\) => import\('\.\/seating-lab-3d'\), \{ ssr: false, loading: \(\) => null \}\)/);
  assert.match(loader, /<SeatingLab3D \{\.\.\.props\} onRoomReady=\{onRoomReady\} \/>\s*\{ready \? null : <RoomBuilding /);
  assert.match(loader, /<PlanPoster plan=\{plan\}/, 'the poster is not the shared core’s drawing');
});

test('the room says so from inside its Canvas — and when it cannot draw at all', () => {
  const room = code('seating-lab-3d.tsx');
  assert.match(room, /\{onRoomReady \? <RoomReady onReady=\{onRoomReady\} \/> : null\}/);
  const canvas = room.slice(room.indexOf('<Canvas'), room.indexOf('</Canvas>'));
  assert.match(canvas, /<RoomReady onReady=\{onRoomReady\} \/>/, 'RoomReady is outside the Canvas — it would never tick');
  assert.match(room, /if \(webgl\.lost\) onRoomReady\?\.\(\);/, 'a room that cannot draw leaves "Building your room…" up for ever');
});

test('the poster reads "Building your room…" over the couple’s own tables', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PlanPoster } = await import('@/app/_components/plan-maker/plan-maker');
  const html = renderToStaticMarkup(
    React.createElement(PlanPoster, {
      plan: { room: { widthM: 20, depthM: 30 }, doors: [{ id: 'e', kind: 'main', wall: 'bottom', at: 50 }], tables: [{ id: 't1', label: '1', kind: 'round_10', chairs: 10, x: 50, y: 30 }] },
    }),
  );
  assert.match(html, /data-plan-poster=""/);
  assert.match(html, /Your room/);
  assert.match(html, /20 × 30 m/);
  assert.equal(html.match(/data-plan-table="/g)?.length, 1);
  assert.match(code('seating-lab-loader.tsx'), /Building your room…/);
});

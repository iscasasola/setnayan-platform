/**
 * the-server-and-client-draw-the-same.test.ts — SW-HYDR (final check 25 Nov 2026, plan batch A-6).
 *
 * A page's first client render (the hydration pass) must draw byte-for-byte what the server drew, whatever the clock
 * and time zone of the phone. When it does not, React throws #418, throws the server HTML away and re-draws the page
 * on the phone.
 *
 * Each covered page's load-time client region is rendered twice — once as the server (Manila, now) and once as a
 * phone far away and much later (another zone, another year) — and the two strings must be identical. The hydration
 * pass uses the server snapshot of `useHydrated` (false), exactly as `renderToString` does, so this is the pass React
 * compares.
 *
 *   ✅ Schedule (A2-P11) — the schedule layout's `ScheduleSavedSlot` beside the page's server-drawn slot.
 *
 * ⚠ WHAT THIS FILE DOES NOT CATCH: A2-P11's own cause was TIMING, not markup — the mark was portaled into the slot
 *   after the layout hydrated but before the page's Suspense boundary did. Both passes here draw the same string with
 *   the old code too. The guard that fails when that fix is reverted is `lib/the-saved-mark-waits-for-its-slot.test.ts`.
 *   This file holds the other half of the rule: no clock, zone or `window` read in the region's first render.
 *   ⏳ OWED: the supplier client page (A6-B09) and the admin pages (A8·P-B-1) — their region joins this file once the
 *      cause is named on the staging copy with a supplier and an admin session (probe method in PR #8349).
 *
 * ⚠ The classic-runtime global (`globalThis.React`) + DYNAMIC import, as in
 * `app/[slug]/_components/countdown-renders-the-same-for-any-clock.test.ts` (tsconfig `"jsx": "preserve"`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';

(globalThis as unknown as { React: unknown }).React = React;

type Phone = { nowMs: number; tz: string };
const SERVER: Phone = { nowMs: Date.UTC(2026, 10, 25, 6, 0, 0), tz: 'Asia/Manila' };
const FAR_PHONE: Phone = { nowMs: Date.UTC(2027, 1, 22, 23, 59, 0), tz: 'America/Los_Angeles' };

async function drawAs(phone: Phone, draw: () => Promise<React.ReactElement>): Promise<string> {
  const realNow = Date.now;
  const realTz = process.env.TZ;
  Date.now = () => phone.nowMs;
  process.env.TZ = phone.tz;
  try {
    return renderToString(await draw());
  } finally {
    Date.now = realNow;
    if (realTz === undefined) delete process.env.TZ;
    else process.env.TZ = realTz;
  }
}

/** Schedule's load-time region: the layout's slot reader, then the slot the page draws (its facts as attributes). */
async function scheduleRegion(): Promise<React.ReactElement> {
  const { ScheduleSavedSlot } = await import('@/app/_components/offline-ready/schedule-saved-slot');
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(ScheduleSavedSlot),
    React.createElement('div', {
      'data-schedule-copy': '',
      'data-sn-copy-version': 'v1.test',
      'data-sn-copy-viewer': 'u1',
      'data-sn-copy-event': 'e1',
      'data-sn-copy-path': '/dashboard/e1/schedule',
      'data-sn-copy-day': '2027-02-23',
      'data-sn-copy-day-end': '',
    }),
  );
}

test('Schedule (A2-P11): the server and a far-away, later phone draw the same first markup', async () => {
  const server = await drawAs(SERVER, scheduleRegion);
  const phone = await drawAs(FAR_PHONE, scheduleRegion);
  assert.equal(phone, server, 'the hydration pass would differ from the server HTML (React #418)');
  // …and that markup is the empty slot alone: nothing is drawn into it before React has claimed it.
  assert.match(server, /^<div data-schedule-copy=""[^>]*><\/div>$/);
});

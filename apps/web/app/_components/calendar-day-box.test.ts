/**
 * 📅 ONE PICKED MARK + ONE SWIPE (Build 2 row #37, prototype v118 `.dn` / `calSwipe`).
 *
 * The three supplier calendars (Clients month · Clients week strip · the client's Schedule page) draw ONE picked mark —
 * the day's number in a 30×30 ink box with 10 px corners that pops in 0.3 s and fades out 0.22 s, dots kept on it, a
 * blocked day struck through, today's thin ring — and step by ONE swipe (sideways only, 40 px, 320 ms, never a pick).
 * Every other calendar in the app keeps its circle: `mark` is opt-in.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CalendarGrid } from './calendar';
import { CALENDAR_SWIPE, DAY_BOX_MOTION } from './calendar-day-box';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = dirname(fileURLToPath(import.meta.url));
const BOX = readFileSync(join(HERE, 'calendar-day-box.tsx'), 'utf8');
const CAL = readFileSync(join(HERE, '..', 'vendor-dashboard', 'customers', '_components', 'customers-calendar.tsx'), 'utf8');

const grid = (mark?: 'box' | 'circle') =>
  renderToStaticMarkup(
    React.createElement(CalendarGrid, {
      value: '2026-11-12',
      today: '2026-11-08',
      startAt: '2026-11-01',
      states: new Map([
        ['2026-11-12', { dots: ['booked', 'asking'] }],
        ['2026-11-16', { blocked: true }],
      ]) as never,
      onPick: () => {},
      ...(mark ? { mark } : {}),
    }),
  );
const cell = (html: string, day: string) => html.slice(html.indexOf(`data-calendar-day="${day}"`) - 400, html.indexOf('</button>', html.indexOf(`data-calendar-day="${day}"`)));

test('the motion is the prototype’s: pop .3 s, out .22 s, swipe 40 px / 320 ms, one ease', () => {
  assert.deepEqual(DAY_BOX_MOTION, { popMs: 300, outMs: 220, ease: 'cubic-bezier(.33,1,.68,1)' });
  assert.equal(CALENDAR_SWIPE.thresholdPx, 40);
  assert.equal(CALENDAR_SWIPE.slideMs, 320);
  assert.match(BOX, /transform: 'scale\(\.55\)'/);
  // Reduced motion: no pop, no slide.
  assert.ok((BOX.match(/reducedMotion\(\)/g) ?? []).length >= 3, 'a motion runs under reduced motion');
});

test('box: ONE picked mark — the number in its ink box, dots kept, a blocked day struck, today ringed', () => {
  const html = grid('box');
  assert.equal((html.match(/data-calendar-dn="on"/g) ?? []).length, 1, 'not exactly one picked mark');
  const picked = cell(html, '2026-11-12');
  assert.match(picked, /h-\[30px\] w-\[30px\][^"]*rounded-\[10px\][^"]*bg-ink text-cream/);
  assert.doesNotMatch(picked, /rounded-full bg-sn-accent|data-pill-on/, 'the picked day is a circle again');
  assert.match(picked, /data-calendar-dot="booked"[^>]*style="background:/, 'the dots lost their colours on the picked day');
  const blocked = cell(html, '2026-11-16');
  assert.match(blocked, /line-through/);
  assert.doesNotMatch(blocked, /background-image/, 'a blocked day is hatched again — a second filled day');
  assert.match(cell(html, '2026-11-08'), /ring-\[1\.5px\] ring-inset/);
});

test('circle (every other calendar) is untouched', () => {
  const html = grid();
  assert.equal((html.match(/data-calendar-dn=/g) ?? []).length, 0);
  assert.match(cell(html, '2026-11-12'), /rounded-full/);
});

test('the three supplier calendars wear the box, and both the month and the week swipe', () => {
  assert.match(CAL, /<CalendarGrid\s+key=\{month\}\s+mark="box"/, 'the Clients / Schedule month lost the one mark');
  const strip = CAL.slice(CAL.indexOf('data-dates-week-days=""'), CAL.indexOf('A day later'));
  assert.match(strip, /<DayBox on=\{on\} struck=\{st\?\.blocked === true\}>/, 'the week strip draws its own mark');
  assert.doesNotMatch(strip, /bg-sn-accent|CALENDAR_HATCH/, 'the week strip fills a day again');
  assert.match(CAL, /useCalendarSwipe\(\s*monthRef,[\s\S]{0,200}'\[data-calendar-days\]'/);
  assert.match(CAL, /useCalendarSwipe\(stripRef, \(side\) => setWeekShift\(/, 'a week swipe must move the week, never the picked day');
  assert.match(CAL, /mark="box" \/>/, 'the legend says "hatched" over struck days');
  // A swipe never picks: the release's click is swallowed before a day hears it; a vertical drag stays the scroll.
  assert.match(BOX, /swallow = true;/);
  assert.match(BOX, /addEventListener\('click', click, true\)/);
  assert.match(BOX, /if \(!sideways\) return reset\(\);/);
});

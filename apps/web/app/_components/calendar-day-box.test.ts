/**
 * 📅 ONE PICKED MARK + ONE SWIPE (Build 2 row #37, prototype v118 `.dn` / `calSwipe`).
 *
 * The three supplier calendars (Clients month · Clients week strip · the client's Schedule page) draw ONE picked mark —
 * the day's number in a 30×30 ink box with 10 px corners that pops in 0.3 s and fades out 0.22 s, dots kept on it, a
 * blocked day struck through, today's thin ring — and step by ONE swipe (sideways only, 40 px, 320 ms, never a pick).
 * Every other calendar in the app keeps its circle: `mark` is opt-in. #28: on these calendars ONLY the picked day is filled.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CalendarGrid } from './calendar';
import { CALENDAR_SWIPE, DAY_BOX_MOTION, RETURN_MOTION, cubicBezier } from './calendar-day-box';

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
        ['2026-11-20', { part: true, dots: ['booked'] }],
      ]) as never,
      onPick: () => {},
      ...(mark ? { mark } : {}),
    }),
  );
/** The day's own <button …> tag — its fill, never its dots' colours. */
const tag = (html: string, day: string) => {
  const at = html.indexOf(`data-calendar-day="${day}"`);
  return html.slice(html.lastIndexOf('<button', at), html.indexOf('>', at) + 1);
};
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
  // #28 ONE FILLED DAY ONLY: no other day carries a fill — not today, not a part-booked day, not a blocked one.
  for (const day of ['2026-11-08', '2026-11-16', '2026-11-20']) {
    const t = tag(html, day);
    assert.ok(t.startsWith('<button') && t.includes(day), `could not read ${day}'s cell`);
    assert.doesNotMatch(t, /style="[^"]*background|bg-sn-accent|bg-ink(?![/\w-])/, `${day} is filled — only the picked day may be`);
    assert.doesNotMatch(cell(html, day), /data-calendar-dn="on"/);
  }
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

test('#27 the return rule: letting a day go glides back to where the scroller stood before ANY day opened', () => {
  assert.equal(RETURN_MOTION.ms, 520);
  assert.deepEqual([...RETURN_MOTION.ease], [0.33, 1, 0.68, 1]);
  const e = cubicBezier(...RETURN_MOTION.ease);
  assert.equal(e(0), 0);
  assert.equal(e(1), 1);
  let last = 0;
  for (let t = 0.05; t < 1; t += 0.05) {
    const v = e(t);
    assert.ok(v >= last - 1e-9 && v <= 1.0001, `the ease runs backwards at ${t}`);
    last = v;
  }
  assert.ok(e(0.5) > 0.8, 'not the ease-out the prototype uses (fast start, soft landing)');
  // Remembered when a day opens from none; given back when it closes; a step between days keeps the first memory.
  assert.match(CAL, /if \(was === null && picked !== null\) returnTop\.current = lastTop\.current;/);
  assert.match(CAL, /was !== null && picked === null && returnTop\.current !== null[\s\S]{0,160}return glideScrollTo\(scroller\.current, top\);/);
  const glide = BOX.slice(BOX.indexOf('export function glideScrollTo'));
  assert.match(glide, /const still = reducedMotion\(\);[\s\S]{0,1200}const t = still \|\| Math\.abs\(to - from\) < 1 \? 1 :/, 'reduced motion must return instantly');
  // Measured: the list grows back SOME FRAMES after the let-go — the glide waits until the spot is reachable (capped).
  assert.match(glide, /if \(to < top - 1 && now - asked < RETURN_WAIT_MS\) \{\s*raf = requestAnimationFrame\(tick\);\s*return;/, 'the glide starts against the shrunken page and lands at 0');
  assert.doesNotMatch(glide.slice(0, glide.indexOf('const tick')), /const to = /, 'the target is fixed before the page has grown back');
  // Landed, it holds the spot while the page settles — and lets go the moment the person touches, scrolls or types.
  assert.match(glide, /if \(t < 1 \|\| now - landed < RETURN_WAIT_MS\) raf = requestAnimationFrame\(tick\);/);
  assert.match(glide, /const inputs = \['wheel', 'touchstart', 'pointerdown', 'keydown'\] as const;/, 'the hold would fight the person');
  assert.match(glide, /return stop;\s*\}/);
});

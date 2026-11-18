/**
 * 🎨 THE CLIENTS CALENDAR'S KEY SAYS WHAT GREEN MEANS (EB-231, every-button walk, 16 Nov 2026).
 *
 * Found: the Dates tour said *"Green is booked here"* while 16–30 Nov and all of December were green — and day 16 opened
 * "Free · nothing on this day". The calendar was right: since the owner's 2026-11-14 ruling ("THE CLIENTS CALENDAR KEEPS
 * WHAT IT HAS — ONLY THE COLOUR CODING CHANGES") a day's FILL is the seat colour — green while it can still take a
 * booking, outlined when it cannot — and what is ON a day is its DOTS (green booked here · grey outside · gold asking).
 * The tour is the only key on Clients (the month there draws no legend), and it described the old marks.
 *
 * Measured on the real parts: the REAL `CalendarGrid` in the Clients look (`mark="box"`) — an open future day with
 * nothing on it is green-filled and carries no dot; a booked day carries the `booked` dot; a blocked or past day is
 * outlined, not green. Then the tour's own words must pair green-the-fill with "can still take a booking" and put
 * "booked" on the dots — and never call a green day booked.
 *
 * SABOTAGE (run 16 Nov 2026): restoring "Green is booked here, grey is booked elsewhere…" turned test 2 red. Test 2
 * left with the Dates tour itself (retired 16 Nov 2026, W1-B14).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { CalendarGrid } from '@/app/_components/calendar';

(globalThis as unknown as { React: unknown }).React = React;

const html = renderToStaticMarkup(
  React.createElement(CalendarGrid, {
    value: null,
    today: '2026-11-15',
    startAt: '2026-11-01',
    mark: 'box',
    states: new Map([
      ['2026-11-20', { dots: ['booked'] }],
      ['2026-11-21', { blocked: true }],
    ]) as never,
    onPick: () => {},
  }),
);
const tag = (day: string) => {
  const at = html.indexOf(`data-calendar-day="${day}"`);
  return html.slice(html.lastIndexOf('<button', at), html.indexOf('</button>', at));
};

test('1 · the month itself: green = can still take a booking; booked = a dot', () => {
  const free = tag('2026-11-16');
  assert.match(free, /background:var\(--seat-top\)/, 'an open day with nothing on it is not the green seat');
  assert.doesNotMatch(free, /data-calendar-dots/, 'an open day with nothing on it carries a dot');
  assert.match(tag('2026-11-20'), /data-calendar-dots/, 'a booked day carries no dot');
  for (const shut of ['2026-11-21', '2026-11-10']) {
    assert.match(tag(shut), /background:var\(--seat-out\)/, `${shut} (blocked / past) is not the outlined seat`);
  }
});

// 2 · (retired 16 Nov 2026, W1-B14) the Dates page tour whose words this test held was deleted with the other supplier
// page tours (owner: the supplier's journey is the one tour). Test 1 still holds the month itself.

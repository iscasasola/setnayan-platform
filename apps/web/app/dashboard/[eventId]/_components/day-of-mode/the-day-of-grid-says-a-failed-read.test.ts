/**
 * the-day-of-grid-says-a-failed-read.test.ts — 🛑 A REFUSED SCHEDULE READ IS SAID ON THE DAY (audit 2026-11-02 #1).
 * Home computed `dayOfBlocksFailed` and never passed it, so `[]` drew "No schedule blocks queued — everything looks
 * wrapped." on the wedding day. RENDERED: the grid with a failed read says "Couldn’t load the schedule" in the banner,
 * Happening now and Up next, never "wrapped" or "nothing queued"; and Home hands it the flag.
 * Sabotage (2026-11-02, each reverted, each red): `blocksFailed` dropped from Home's `<DayOfModeGrid>` · the banner's
 * `failed` branch removed · LiveScheduleCard ignoring `failed`.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

// The cards are compiled with the classic JSX runtime here — React must be in scope before they load.
(globalThis as { React?: typeof React }).React = React;
let DayOfModeBanner: typeof import('./banner').DayOfModeBanner;
let LiveScheduleCard: typeof import('./live-schedule-card').LiveScheduleCard;
let WhatsHappeningCard: typeof import('./whats-happening-card').WhatsHappeningCard;
let DAY_OF_SCHEDULE_UNREAD: string;
before(async () => {
  ({ DayOfModeBanner } = await import('./banner'));
  ({ LiveScheduleCard } = await import('./live-schedule-card'));
  ({ WhatsHappeningCard } = await import('./whats-happening-card'));
  ({ DAY_OF_SCHEDULE_UNREAD } = await import('./schedule-unread'));
});

const said = (html: string) => html.replace(/&#x27;|&rsquo;|’/g, '’');

test('a failed read is said in the banner, Happening now and Up next — never "wrapped"', () => {
  // 🔔 The banner is a live notice since the one notice system (14 Nov 2026): it REGISTERS and the page's top slot
  // draws it, so it renders nothing where it is written. Its failed branch is read from the source instead.
  assert.equal(renderToStaticMarkup(React.createElement(DayOfModeBanner, { eventId: 'e1', blocks: [], failed: true })), '');
  const banner = stripComments(readFileSync(join(import.meta.dirname, 'banner.tsx'), 'utf8'));
  assert.match(banner, /\{failed \? <ScheduleUnread \/> :/, 'the live notice no longer says a failed read');
  const parts = [
    renderToStaticMarkup(React.createElement(WhatsHappeningCard, { blocks: [], failed: true })),
    renderToStaticMarkup(React.createElement(LiveScheduleCard, { eventId: 'e1', blocks: [], failed: true })),
  ].map(said);
  for (const html of parts) {
    assert.ok(html.includes(DAY_OF_SCHEDULE_UNREAD), `a failed read is not said:\n${html.slice(0, 300)}`);
    assert.doesNotMatch(html, /everything looks wrapped|Nothing else queued|wrapped up/i, 'a failed read reads as a finished day');
  }
  // And a day that really is empty still says so — the failed branch is the read's, not the day's.
  const empty = renderToStaticMarkup(React.createElement(LiveScheduleCard, { eventId: 'e1', blocks: [] }));
  assert.match(empty, /Nothing else queued/);
});

test('Home hands the grid its failed read', () => {
  const page = stripComments(readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'page.tsx'), 'utf8'));
  const grid = page.slice(page.indexOf('<DayOfModeGrid'), page.indexOf('/>', page.indexOf('sameDayVendors={dayOfSameDayVendors}')));
  assert.match(grid, /blocksFailed=\{dayOfBlocksFailed\}/, 'Home does not pass the failed schedule read to the day-of grid');
  const g = stripComments(readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', '_components', 'day-of-mode', 'grid.tsx'), 'utf8'));
  for (const c of ['<DayOfModeBanner', '<WhatsHappeningCard', '<LiveScheduleCard']) {
    assert.match(g, new RegExp(`${c}[^>]*failed=\\{blocksFailed\\}`), `${c} is not told the read failed`);
  }
});

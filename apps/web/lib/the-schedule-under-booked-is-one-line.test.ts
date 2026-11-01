/**
 * the-schedule-under-booked-is-one-line.test.ts — 📅 SUPPLIERS › BOOKED › SCHEDULE: ONE ROW, ONE LINE, THE DATE LINE,
 * THEN THE MOMENTS.
 *
 * Owner 2026-10-31, live iPhone, verbatim: *"so many design error on schedule. the pop up. design template. how the
 * space is strategically used. so many upper space not used."* — at rest the Schedule stacked SEVEN rows before its
 * first moment. The approved frames (19 · 20) draw: the page's one row, then `[Event Day ▾] … 🔊`, then the date line
 * (everything else in its ⓘ), then the items. Held, each as a PROPERTY:
 *   1. The frame draws EXACTLY two things before the views — the line and the date line (executed: rendered).
 *   2. Under Booked the page draws the frame and none of the old chrome rows (the role pill, the segmented view switch,
 *      the "fills in automatically" band, the "+ Add to schedule" button, the day's own date heading).
 *   3. A view switch asks the server nothing: every view is drawn once and a pick only swaps what shows.
 *
 * Sabotage (2026-10-31, each reverted, each red): a third `<p>` added above the views in the frame · `<ScheduleModeToggle`
 * drawn under Booked · the rail's day heading made visible under Booked · the pick switched to `router.push`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from './strip-comments';
import { BookedScheduleFrame } from '@/app/dashboard/[eventId]/schedule/_components/booked-schedule-frame';

// The components are compiled with the classic JSX runtime here (as every rendering guard in lib/ does).
(globalThis as unknown as { React: unknown }).React = React;

const S = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'schedule');
const read = (...p: string[]) => stripComments(readFileSync(join(S, ...p), 'utf8'));

const VOID = new Set(['area', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
/** The tag names of an element's DIRECT children (a small depth walk over static markup). */
function topLevelChildren(html: string, rootMark: string): string[] {
  const at = html.indexOf(rootMark);
  const open = html.indexOf('>', at) + 1;
  const out: string[] = [];
  let depth = 0;
  for (const m of html.slice(open).matchAll(/<(\/?)([a-zA-Z][\w-]*)[^>]*?(\/?)>/g)) {
    const [, close, tag, self] = m;
    const t = (tag ?? '').toLowerCase();
    if (close) {
      if (depth === 0) break;
      depth -= 1;
      continue;
    }
    if (depth === 0) out.push(t);
    if (!self && !VOID.has(t)) depth += 1;
  }
  return out;
}

test('1 · the frame draws the line and the date line — and nothing else — before the moments', () => {
  const html = renderToStaticMarkup(
    React.createElement(BookedScheduleFrame, {
      initial: 'event-day',
      views: [
        { key: 'event-day', label: 'Event Day', count: 7 },
        { key: 'preparation', label: 'Preparation', count: 3 },
        { key: 'journey', label: 'Journey', count: 9 },
      ],
      dateLine: 'Friday 18 December 2026 · 48 days to go',
      info: React.createElement('b', null, 'Ana & Paolo'),
      notes: {},
      announce: React.createElement('button', { 'data-announce-door': 'round' }),
      panels: {
        'event-day': React.createElement('i', { 'data-first-moment': '' }),
        preparation: React.createElement('i', null),
        journey: React.createElement('i', null),
      },
    }),
  );
  const before = html.slice(0, html.indexOf('data-first-moment'));
  // The frame's own top-level children, in order: the line, the date line, the views.
  const root = before.slice(before.indexOf('data-booked-schedule='));
  const marks = [...root.matchAll(/data-(schedule-line|schedule-date-line|schedule-panel)=/g)].map((m) => m[1]);
  assert.deepEqual(marks.slice(0, 3), ['schedule-line', 'schedule-date-line', 'schedule-panel'], 'a row was added above the moments');
  // …and nothing unnamed either: the frame's root has exactly three children — the line, the date line, the views.
  assert.deepEqual(topLevelChildren(html, 'data-booked-schedule="event-day"'), ['div', 'p', 'div'], 'a row was added to the frame');
  assert.match(before, /data-schedule-view=/, 'the line lost the view dropdown');
  assert.match(before, /data-announce-door="round"/, 'Announce is not on the line');
  assert.match(before, /Friday 18 December 2026 · 48 days to go/, 'the date line is gone');
  assert.doesNotMatch(before, /Ana &amp; Paolo/, 'the couple’s names are printed above the moments — they belong in the ⓘ');
});

test('2 · under Booked the page draws the frame and none of the old chrome rows', () => {
  const page = read('page.tsx');
  const start = page.search(/\{inBooked \? \(\s*<BookedScheduleFrame\b/);
  const rest = start < 0 ? '' : page.slice(start);
  const end = rest.search(/\)\s*:\s*\(\s*<>[\s{}]*<header\b/);
  const booked = end < 0 ? '' : rest.slice(0, end);
  assert.ok(booked.length > 100, 'the Booked branch is gone');
  assert.match(booked, /<BookedScheduleFrame\b/);
  assert.doesNotMatch(booked, /<ScheduleModeToggle\b|roleLabel\}\s*<Tip|<PageMasthead\b/, 'an old chrome row is drawn under Booked');
  assert.match(booked, /<AnnounceButton\b[^>]*\bround\b/, 'Announce is not the line’s round');
  const prep = read('_components', 'preparation-agenda.tsx');
  assert.match(prep, /\{booked \? \(\s*<AddPreparationItem eventId=\{eventId\} door="pill" \/>/, 'Preparation’s add is not the thumb-zone pill under Booked');
  const rail = read('_components', 'day-rail.tsx');
  assert.match(rail, /className=\{booked && rails\.length === 1 \? 'sr-only'/, 'the day’s own heading is drawn again under the date line');
  assert.match(rail, /<InSlot id=\{booked \? toolsSlot : null\}>/, 'the day’s tools are a row of their own again');
  assert.match(rail, /\{canEdit && !booked \? \(\s*<button/, 'a second Add button is drawn up top under Booked');
});

test('3 · a view switch asks the server nothing — every view is drawn once, a pick swaps what shows', () => {
  const frame = stripComments(readFileSync(join(S, '_components', 'booked-schedule-frame.tsx'), 'utf8'));
  assert.doesNotMatch(frame, /router\.(push|replace|refresh)|useRouter|<Link\b|fetch\(/, 'a view switch goes to the server');
  assert.match(frame, /window\.history\.replaceState\(/, 'the view is not written to `?view=` (a reload would lose it)');
  assert.match(frame, /<div key=\{k\} hidden=\{k !== view\} data-schedule-panel=\{k\}>/, 'the views are not all kept');
});

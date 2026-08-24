/**
 * THE BOARD MUST NOT CONTRADICT THE SCREEN BESIDE IT.
 *
 * Three defects observed live on 2026-08-24, all one family: a card said
 * "Celebrated" and "0% planned" one line apart; a ring said "7%" beside a line
 * saying "7% planned"; and the "Worth planning" shelf listed weddings sitting
 * in Planning two shelves up. Two of the three were fixes that had already
 * landed on ONE surface (the event dashboard) while this identical surface
 * kept the defect. ~70 tested changes shipped around them, because no test
 * asks whether a screen contradicts the screen beside it. These do.
 *
 * All source assertions strip comments first — the fixes carry comments that
 * name the removed strings, and a raw-source match would report the defect the
 * fix documents.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  buildYearMoments,
  worthPlanningMoments,
  momentIsEventOwnDay,
  type MomentEvent,
} from '../../../lib/year-moments';

const stripped = (rel: string) =>
  readFileSync(path.join(__dirname, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');

// ─── 1 · THE TWO SHELVES, FED FROM ONE FIXTURE ─────────────────────────────
// The same events the board renders on Planning are handed to the moments
// builder the "Worth planning" shelf reads. The shelf's rule (owner naming
// ruling, DECISION_LOG 2026-08-21) is that it holds days that do NOT exist as
// events — so nothing that IS an event's own day may survive the shelf filter,
// while derived days (an anniversary of a past wedding) must.
test('a celebration on the Planning shelf never re-lists itself under Worth planning', () => {
  const today = '2026-08-24';
  const events: MomentEvent[] = [
    // Sits in Planning: an upcoming wedding. Its own day must not reach the shelf.
    {
      event_id: 'wed-upcoming',
      event_type: 'wedding',
      display_name: 'Cale & Ice',
      event_date: '2026-12-12',
      anchor_date: null,
      anchor_origin: null,
      recurs: false,
      archived: false,
    },
    // Sits in Planning: a recurring event. Its next occurrence must not reach it either.
    {
      event_id: 'movie-night',
      event_type: 'celebration',
      display_name: 'Movie Night',
      event_date: '2026-08-20',
      anchor_date: null,
      anchor_origin: null,
      recurs: true,
      recur_cadence: 'monthly',
      archived: false,
    },
    // Finished years ago: its ANNIVERSARY is a derived day, not an event — it must survive.
    {
      event_id: 'wed-past',
      event_type: 'wedding',
      display_name: 'Maria & Jose',
      event_date: '2023-10-01',
      anchor_date: null,
      anchor_origin: null,
      recurs: false,
      archived: false,
    },
  ];

  const all = buildYearMoments(events, today, { includeHolidays: false });
  const shelf = worthPlanningMoments(all);

  // The builder still describes the whole year truthfully — the wedding
  // countdown exists as a MOMENT…
  assert.ok(
    all.some((m) => m.kind === 'wedding' && m.eventId === 'wed-upcoming'),
    'fixture failed to produce the wedding-countdown moment — the test is not exercising the rule',
  );
  assert.ok(
    all.some((m) => m.kind === 'recurring' && m.eventId === 'movie-night'),
    'fixture failed to produce the recurring-occurrence moment',
  );

  // …and the SHELF refuses both events' own days.
  const ownDayLeaks = shelf.filter((m) => momentIsEventOwnDay(m));
  assert.deepEqual(
    ownDayLeaks.map((m) => m.label),
    [],
    'the Worth-planning shelf is listing an existing event\'s own day — it belongs on Planning, not here',
  );
  assert.ok(
    !shelf.some((m) => m.label === 'Cale & Ice — your wedding'),
    'the upcoming wedding re-listed itself under Worth planning',
  );

  // FLOOR — the filter is a membership rule, not a delete-all: the past
  // wedding's anniversary (a day that is NOT an event) must still be there.
  assert.ok(
    shelf.some((m) => m.kind === 'anniversary' && m.eventId === 'wed-past'),
    'the filter swept away the derived anniversary row — that deletes the owner-directed reminder lines, not the defect',
  );
});

// ─── 2 · THE SHELF ACTUALLY CALLS THE FILTER ───────────────────────────────
// Without this, worthPlanningMoments is a correct function nothing calls — the
// gate-with-no-handle shape this repo has now found six times.
test('the Worth-planning strip routes its rows through worthPlanningMoments', () => {
  const strip = stripped('_components/year-moments-strip.tsx');
  const calls = strip.match(/worthPlanningMoments\(/g) ?? [];
  assert.equal(
    calls.length,
    1,
    `expected the strip to apply worthPlanningMoments exactly once, found ${calls.length}`,
  );
});

/**
 * the-empty-hub-lists-the-next-events.test.ts — owner "Yes to all", 2026-10-21,
 * item 5 of `shots-2026-10-21/supplier-dash-audit/AUDIT.md`: *"Hub = the Event
 * Hub … on a day with no event it lists the next booked events (each locked
 * until its booking fee is paid …), not just 'No event today'."*
 *
 * ── THE PROPERTIES ──────────────────────────────────────────────────────────
 *   1. A locked day's row says it is locked, carries the gate's own sentence and
 *      the bill's pay link, and offers NO "Set up" door into the event — rendered,
 *      not grepped. An unlocked day keeps its "Set up". A past day never shows a
 *      lock (there is nothing left to open).
 *   2. The words and the amount come from the SHIPPED gate and copy
 *      (`resolveEventFeeGates` → `feeLockCopy`) — the row has no peso sign of its
 *      own, so no price is ever derived from code.
 *   3. The empty day lists the days still ahead FIRST, under "Your next events",
 *      with the locks handed in; past days keep a list of their own, below.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { EventPicker, type PickerBooking, type PickerLock } from './_components/event-picker';
import { stripComments } from '@/lib/strip-comments';

(globalThis as { React?: typeof React }).React = React;

const DAYS: PickerBooking[] = [
  { eventId: 'e-locked', eventName: 'Ana & Ben', bookedDate: '2026-11-08', when: 'upcoming' },
  { eventId: 'e-open', eventName: 'Carla & Dino', bookedDate: '2026-11-15', when: 'upcoming' },
  { eventId: 'e-past', eventName: 'Ella & Felix', bookedDate: '2026-09-01', when: 'past' },
];
const LOCK: PickerLock = { headline: 'GATE-HEADLINE', cta: 'GATE-CTA', payHref: '/vendor-dashboard/booking-fees/pay/o-1' };

function render(locks: Record<string, PickerLock>): string {
  return renderToStaticMarkup(
    React.createElement(EventPicker, { bookings: DAYS, activeEventId: null, heading: 'Your next events', locks }),
  );
}

/** The `<li>` that names this couple. */
function rowOf(html: string, name: string): string {
  const at = html.indexOf(name.replace('&', '&amp;'));
  assert.ok(at > 0, `premise: ${name} is listed`);
  return html.slice(html.lastIndexOf('<li', at), html.indexOf('</li>', at));
}

test('a locked day says so, carries the gate’s words and the bill’s link — and no Set up', () => {
  const html = render({ 'e-locked': LOCK, 'e-past': LOCK });
  const locked = rowOf(html, 'Ana & Ben');
  assert.match(locked, /data-hub-day-locked/);
  assert.match(locked, /Locked/);
  assert.match(locked, /GATE-HEADLINE/, 'the row lost the gate’s sentence');
  assert.match(locked, /href="\/vendor-dashboard\/booking-fees\/pay\/o-1"[^>]*>GATE-CTA/, 'the row lost the way to pay');
  assert.doesNotMatch(locked, /\?event=e-locked/, 'a locked event still opens its set-up — the lock is a door, not a label');
  // An unlocked day keeps its set-up; a past day is never shown locked.
  assert.match(rowOf(html, 'Carla & Dino'), /href="\/vendor-dashboard\/on-the-day\?event=e-open"/);
  assert.doesNotMatch(rowOf(html, 'Ella & Felix'), /data-hub-day-locked|GATE-HEADLINE/);
  assert.match(html, /Your next events/);
});

test('a lock with nothing to pay (no bill yet) offers no pay button', () => {
  const locked = rowOf(render({ 'e-locked': { ...LOCK, cta: null } }), 'Ana & Ben');
  assert.match(locked, /GATE-HEADLINE/);
  assert.doesNotMatch(locked, /booking-fees\/pay/);
});

test('no price is written in code — the words and the amount are the gate’s', () => {
  const picker = stripComments(readFileSync(join(import.meta.dirname, '_components', 'event-picker.tsx'), 'utf8'));
  assert.doesNotMatch(picker, /₱|PHP|amountPhp/, 'the row formats a price of its own');
  const page = stripComments(readFileSync(join(import.meta.dirname, 'page.tsx'), 'utf8'));
  assert.match(page, /await resolveEventFeeGates\(profile\.vendor_profile_id, ahead\)/, 'the empty day no longer asks the shipped gate');
  assert.match(page, /feeLockCopy\(\{ stage: gate\.stage, owed: gate\.access\.owed/, 'the row’s words no longer come from feeLockCopy');
});

test('the empty day lists the days ahead first, with their locks; past days below, on their own', () => {
  const page = stripComments(readFileSync(join(import.meta.dirname, 'page.tsx'), 'utf8'));
  const compact = page.slice(page.indexOf('function CompactDayOf('));
  const next = compact.indexOf('heading="Your next events" locks={locks}');
  const empty = compact.indexOf('No event today');
  const past = compact.indexOf('heading="Earlier"');
  assert.ok(next > 0, 'the empty day does not list the next events with their locks');
  assert.ok(empty > next, '"No event today" sits above the next events again');
  assert.ok(past > empty, 'past days are not kept, below');
  assert.match(page, /<CompactDayOf[^>]*locks=\{dayLocks\}/, 'the page does not hand the locks to the empty day');
});

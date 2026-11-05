/**
 * GUARD — the quiet refresh of a guest's saved schedule (owner-approved 5 Nov, item 1): Home and the Event Hub refresh
 * the guest's saved Me copy AT MOST EVERY 30 MINUTES and ONLY AROUND EVENT DAYS, refresh-only, drawing nothing.
 * The rules are `lib/quiet-schedule-refresh.ts`; the saving is the existing worker's (`app/sw-offline-copies.test.ts`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { AUTO_REFRESH_AFTER_MS } from './offline-copies';
import { QUIET_REFRESH_EVERY_MS, quietRefreshDue } from './quiet-schedule-refresh';

const MIN = 60_000;
const DAY = '2026-11-14';
/** Noon on the event day, Philippine time. */
const ON_THE_DAY = Date.parse(`${DAY}T12:00:00+08:00`);

const due = (o: Partial<Parameters<typeof quietRefreshDue>[0]> = {}) =>
  quietRefreshDue({ now: ON_THE_DAY, eventDate: DAY, savedAt: ON_THE_DAY - 31 * MIN, lastTriedAt: null, ...o });

test('the ceiling is 30 minutes — the worker’s own number, never a second constant', () => {
  assert.equal(QUIET_REFRESH_EVERY_MS, 30 * MIN);
  assert.equal(QUIET_REFRESH_EVERY_MS, AUTO_REFRESH_AFTER_MS);
});

test('at most every 30 minutes: not while the copy is younger than that', () => {
  assert.equal(due({ savedAt: ON_THE_DAY - 29 * MIN }), false);
  assert.equal(due({ savedAt: ON_THE_DAY - 30 * MIN + 1 }), false);
  assert.equal(due({ savedAt: ON_THE_DAY - 30 * MIN }), true);
  assert.equal(due({ savedAt: ON_THE_DAY - 3 * 60 * MIN }), true);
});

test('at most every 30 minutes: not within 30 minutes of the last quiet try, even one that failed', () => {
  assert.equal(due({ lastTriedAt: ON_THE_DAY - 5 * MIN }), false);
  assert.equal(due({ lastTriedAt: ON_THE_DAY - 30 * MIN + 1 }), false);
  assert.equal(due({ lastTriedAt: ON_THE_DAY - 30 * MIN }), true);
  // A stored try from the future (clock moved back) does not block for ever.
  assert.equal(due({ lastTriedAt: ON_THE_DAY + 60 * MIN }), true);
});

test('only around event days: T-3 days → the end of the day after, Philippine time', () => {
  const at = (iso: string) => Date.parse(iso);
  const old = (now: number) => ({ now, savedAt: now - 60 * MIN });
  assert.equal(due(old(at('2026-11-10T23:59:00+08:00'))), false, 'four days before — nothing');
  assert.equal(due(old(at('2026-11-11T00:00:00+08:00'))), true, 'three days before — on');
  assert.equal(due(old(at('2026-11-15T23:59:00+08:00'))), true, 'the day after — on');
  assert.equal(due(old(at('2026-11-16T00:00:00+08:00'))), false, 'two days after — off');
  assert.equal(due(old(at('2026-10-01T12:00:00+08:00'))), false, 'weeks before — nothing');
  assert.equal(due({ eventDate: null }), false, 'a dateless event — never');
  // A multi-day event stays on through the day after its last day.
  assert.equal(due({ ...old(at('2026-11-16T12:00:00+08:00')), eventEndDate: '2026-11-15' }), true);
});

test('a refresh, never a first save: no copy of this viewer’s → nothing is asked', () => {
  assert.equal(due({ savedAt: null }), false);
  assert.equal(due({ savedAt: Number.NaN }), false);
});

test('the component draws nothing, never forces, and is mounted on Home and the Hub — not on Me', () => {
  const root = join(__dirname, '..');
  const comp = readFileSync(join(root, 'app/_components/offline-ready/quiet-schedule-refresh.tsx'), 'utf8');
  assert.match(comp, /return null;\s*\}\s*$/, 'it draws nothing — freshness is Me’s line alone');
  assert.match(comp, /force: false/);
  assert.doesNotMatch(comp, /force: true/);
  assert.match(comp, /quietRefreshDue\(/, 'every ask goes through the rule');
  assert.doesNotMatch(comp, /setInterval|EventSource|WebSocket|supabase/i, 'no live connection, no polling');

  const hub = readFileSync(join(root, 'app/[slug]/page.tsx'), 'utf8');
  assert.match(hub, /search\.tab !== 'me' && !isEditorCanvas \? \(\s*<QuietScheduleRefresh/, 'the Hub’s other tabs, never Me or the Maker');
  const home = readFileSync(join(root, 'app/dashboard/(launcher)/page.tsx'), 'utf8');
  assert.match(home, /<QuietScheduleRefresh viewer=\{user\.id\}/, 'Home');
  assert.match(home, /invitedEvents\s*\n?\s*\.filter/, 'Home asks only for events this account is invited to');
});

/**
 * a-venue-holds-its-chapter-hours.test.ts — 🏛 event chapters slice 3, VENUE HOURS (owner 2026-11-04; approved prototype
 * "Event chapters — 4 Nov 2026", frames 2, 7b). The database half (the lock itself): tests/db/a-venue-holds-its-chapter-hours.db.test.ts.
 *
 *   1 · the venue sends its chapter's hours (Starts · Ends · Setup from · Pack-up until) as ONE request of kind `hours`;
 *   2 · the host's one accept path applies `hours` — and a venue's YES to the host's ask on a held chapter — through the
 *       one database door (`apply_venue_hours`), never a direct update;
 *   3 · a held chapter shows "Hours from <venue> 🔒" with "Ask <venue> to change" (the shipped ask, on its own), and its
 *       sheet shows the hours as a fact, never as fields;
 *   4 · the host's Requests sheet words a venue's hours;
 *   5 · the hours line reads "5:00 PM – 10:00 PM · setup from 1 PM, out by 11:30 PM" (the prototype's words).
 *
 * ⚠ This file shipped EMPTY in #7238 (a lab edit truncated it before its first commit) — rewritten 2026-11-04.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { heldHoursLine } from '@/lib/schedule-chapters';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (f: string) => stripComments(readFileSync(join(WEB, f), 'utf8'));
const SCHED = 'app/dashboard/[eventId]/schedule/_components/';

test('5 · the hours line, in the prototype’s words', () => {
  const start = '2099-12-18T17:00:00.000Z';
  assert.equal(
    heldHoursLine({ start_at: start, end_at: '2099-12-18T22:00:00.000Z', ingress_minutes_before: 240, egress_minutes_after: 390 }),
    '5:00 PM – 10:00 PM · setup from 1 PM, out by 11:30 PM',
  );
  assert.equal(
    heldHoursLine({ start_at: start, end_at: '2099-12-18T22:00:00.000Z', ingress_minutes_before: 210, egress_minutes_after: null }),
    '5:00 PM – 10:00 PM · setup from 1:30 PM',
  );
  assert.equal(heldHoursLine({ start_at: start, end_at: null, ingress_minutes_before: null, egress_minutes_after: null }), '5:00 PM onward');
});

test('1 · the venue sends its hours as one `hours` request', () => {
  const actions = code('app/vendor-dashboard/clients/[eventId]/actions.ts');
  const at = actions.indexOf("if (request === 'hours') {");
  assert.ok(at > 0, 'the venue has no way to send its hours');
  const branch = actions.slice(at, actions.indexOf('// ── My times', at));
  assert.match(branch, /kind: 'hours',\s*block_id: chapterId,/, 'the hours are not one request on the chapter');
  assert.match(branch, /proposed_ingress_minutes: hours\.ingress,\s*proposed_egress_minutes: hours\.egress/);
  const sheet = code('app/vendor-dashboard/clients/[eventId]/_components/supplier-schedule.tsx');
  assert.match(sheet, /\{c\.setsHours \? \(/, 'the hours row is drawn for a supplier that is not the chapter’s venue');
  for (const row of ['Starts', 'Ends', 'Setup from', 'Pack-up until']) assert.match(sheet, new RegExp(`name="${row}"`), `the hours sheet has no ${row}`);
  assert.match(sheet, /request: 'hours',/);
  const lib = code('lib/supplier-schedule.ts');
  assert.match(lib, /setsHours: c\.responsible_vendor_ids\.some\(\(id\) => venueIds\.has\(id\)\)/, 'a non-venue booking may set hours');
});

test('2 · the accept path applies hours through the one door', () => {
  const decide = code('lib/schedule-suggestion-decide.server.ts');
  assert.match(
    decide,
    /suggestion\.kind === 'hours' && suggestion\.block_id\) \{\s*const \{ error \} = await db\.rpc\('apply_venue_hours'/,
    'hours are applied some other way',
  );
  assert.match(
    decide,
    /toSupplier && \(await chapterIsHeld\(db, suggestion\.block_id\)\)\) \{\s*const \{ error \} = await db\.rpc\('apply_venue_hours'/,
    'a venue’s yes to the host’s ask bypasses the door',
  );
  const hoursBranch = decide.slice(
    decide.indexOf("suggestion.kind === 'hours'"),
    decide.indexOf("} else if (suggestion.kind === 'adjust' && suggestion.block_id) {"),
  );
  assert.doesNotMatch(hoursBranch, /from\('event_schedule_blocks'\)\s*\.update/, 'held hours are written directly');
});

test('3 · a held chapter: "Hours from <venue> 🔒", the ask on its own, and facts not fields', () => {
  const host = code(`${SCHED}chapters-host.tsx`);
  assert.match(host, /Hours from \{held\.name\} <span aria-label="Held by the venue">🔒<\/span>/);
  assert.match(host, /askLabel=\{`Ask \$\{held\.name\} to change`\}\s*bare/, 'the ask is not "Ask <venue> to change", on its own');
  assert.match(host, /current\.hours_vendor_id\s*\?\s*\{/, 'the held state is not read from the chapter');
  const ask = code(`${SCHED}ask-supplier-section.tsx`);
  assert.match(ask, /label=\{askLabel\}/);
  assert.match(ask, /\{bare && mine\.length === 0 \? null : \(/, 'a held chapter’s ask still carries the "Asked of suppliers" heading');
  const sheet = code(`${SCHED}chapter-sheets.tsx`);
  assert.match(sheet, /\{heldBy \? \(\s*<FactRow\s*name="Hours"/, 'a held chapter’s hours are not a fact row');
  for (const row of ['Ends', 'Ingress from', 'Egress until']) {
    assert.match(sheet, new RegExp(`\\{c\\.time_tba \\|\\| heldBy \\? null : \\(\\s*<TimeRow\\s*name="${row}"`), `${row} is still a field on a held chapter`);
  }
});

test('4 · the Requests sheet words a venue’s hours', () => {
  const sheets = code(`${SCHED}day-sheets.tsx`);
  assert.match(sheets, /r\.kind === 'hours' \? 'the chapter’s hours'/);
  assert.match(sheets, /Approving sets the chapter’s hours and \$\{r\.by\} holds them/);
});

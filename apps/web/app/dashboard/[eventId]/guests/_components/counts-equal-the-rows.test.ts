/**
 * counts-equal-the-rows.test.ts — "List N" AND "N attending" EQUAL THE ROWS
 * DRAWN BELOW THEM (controller, measured on the combined preview 2026-10-07:
 * maria-and-jose read "List 0 · 0 attending · 0% replied" above rows that said
 * "Maria Santos ✓ Attending" — a real figure rendered as a zero).
 *
 * Two causes, both held here:
 *   1. ONE SOURCE. The counts come from `rosterStats(roster)` — the very list
 *      `rosterSections` draws the rows from — never a second read.
 *   2. A FIGURE NEVER STICKS ON ITS START. `Count` / `Fill` showed `from` (0 on
 *      load) BEFORE the first animation frame; a document-hidden page (a
 *      background tab, a preview pane) never runs that frame, so 0 stayed.
 *      Now `from` is shown only by a frame, and a hidden page gets the value.
 *
 * SABOTAGE (seen red): put `setDisplay(from);` back before the timer.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import type { GuestRow } from '@/lib/guests';
import { rosterSections, rosterStats, type RosterFacts, hasNotAnswered } from '@/lib/guest-roster-view';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCREEN = stripComments(readFileSync(join(HERE, 'guests-screen.tsx'), 'utf8'));
const COUNT = stripComments(readFileSync(join(HERE, '..', '..', '..', '..', '..', 'components', 'count.tsx'), 'utf8'));

const g = (id: string, p: Partial<GuestRow>): GuestRow =>
  ({ guest_id: id, first_name: id, last_name: 'X', role: 'guest', side: 'bride', rsvp_status: 'pending', extra_roles: [], invitation_sent_at: '2026-09-01', entry_source: null, passed_away: false, ...p }) as GuestRow;

// maria-and-jose's shape: the couple attending, sponsors, guests.
const ROSTER: GuestRow[] = [
  g('maria', { role: 'bride', rsvp_status: 'attending' }),
  g('jose', { role: 'groom', side: 'groom', rsvp_status: 'attending' }),
  g('ninong', { role: 'principal_sponsor_ninong', rsvp_status: 'attending' }),
  g('ana', { rsvp_status: 'declined' }),
  g('ben', { rsvp_status: 'pending' }),
  g('cita', { rsvp_status: 'pending', invitation_sent_at: null }),
  g('dan', { rsvp_status: 'maybe' }),
];
const facts: RosterFacts = { hasSides: true, groupsOf: () => [], tableOf: () => null };

test('the List count and the attending count equal the rendered rows (executed)', () => {
  const rows = rosterSections(ROSTER, 'role', facts).flatMap((s) => s.guests);
  const stats = rosterStats(ROSTER);
  assert.equal(stats.total, rows.length, 'List N is not the number of rows drawn');
  assert.equal(stats.yes, rows.filter((r) => r.rsvp_status === 'attending').length, 'N attending is not the attending rows');
  assert.equal(stats.yes, 3);
  // The replies partition everyone; "to invite" OVERLAPS "no reply" (owner 2026-10-07: no reply =
  // every guest who has not answered, invited or not), so it is not part of the sum.
  assert.equal(
    stats.no + stats.none + stats.yes + rows.filter((r) => r.rsvp_status === 'maybe').length + rows.filter((r) => r.rsvp_status === 'pending' && !hasNotAnswered(r)).length,
    rows.length,
  );
  assert.ok(stats.total > 0 && stats.yes > 0, 'a fixture with attending rows counts zero');
});

test('the screen reads its counts off the same list as its rows', () => {
  assert.match(SCREEN, /const stats = rosterStats\(roster\);/);
  assert.match(SCREEN, /const visible = useMemo\(\(\) => \(q \? roster\.filter/, 'the rows are not drawn from the same `roster`');
  assert.match(SCREEN, /\{measured \? \(/, 'an unmeasured read prints counts instead of saying nothing');
});

test('Count and Fill never sit on their start value when no frame runs', () => {
  const engine = COUNT.slice(COUNT.indexOf('export function useCountTo('), COUNT.indexOf('export type CountFormat'));
  const timerAt = engine.indexOf('const timer = window.setTimeout(');
  assert.ok(timerAt > 0, 'the count engine moved — re-aim');
  assert.doesNotMatch(engine.slice(0, timerAt), /setDisplay\(from\)/, '`from` is shown before a frame has run — a hidden page keeps it');
  assert.match(engine, /document\.visibilityState === 'hidden'/, 'a hidden page animates (and never finishes) instead of showing the value');
  const fill = COUNT.slice(COUNT.indexOf('export function Fill('));
  assert.match(fill, /document\.visibilityState === 'hidden'/, 'a hidden page leaves the bar at its start');
});

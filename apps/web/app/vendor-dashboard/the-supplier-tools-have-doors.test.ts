/**
 * 🚪 THE SUPPLIER'S EVENT TOOLS HAVE DOORS FROM THE SUPPLIER DASHBOARD (S9, owner 2026-10-29: the approved supplier
 * tools *"must exist on the supplier dashboard as well"* — DECISION_LOG "A SUPPLIER'S BADGES LIVE ON THEIR SHOP
 * PERFORMANCE PAGE"). Two doors, each into a SHIPPED tool, no new pattern:
 *   · 🪑 "Find a guest's seat" — a Hub row for today's booked event → the live console's `SeatScanner` (`#seat-finder`);
 *   · 📣 "Message everyone" — an Events row per event they may announce to → the couple's shipped announcement sheet
 *     (`?announce=1` opens it), drawn only where the broadcast's own rule and flag would let it send.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { eventsYouRun, type CoordinatorSeatRow } from '@/lib/events-you-run';
import { messageEveryoneHref, seatFinderHref } from './_components/events-you-run-rows';

const WEB = join(import.meta.dirname, '..', '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('🪑 the Hub opens the shipped seat finder, anchored', () => {
  assert.equal(seatFinderHref('e1'), '/vendor-dashboard/on-the-day/live/e1#seat-finder');
  const fc = src('app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/floor-command.tsx');
  assert.match(fc, /<div id="seat-finder" className="scroll-mt-24">\s*\{model\.seatFinder\.state === 'ready' \? \(\s*<SeatScanner/);
  assert.match(src('app/vendor-dashboard/on-the-day/page.tsx'), /\{todaysBooking \? <SeatFinderRow eventId=\{todaysBooking\.eventId\}/);
});

test('📣 Message everyone opens the shipped announcement sheet — only where it can send', () => {
  assert.equal(messageEveryoneHref('e1'), '/dashboard/e1/schedule?announce=1');
  const btn = src('app/dashboard/[eventId]/schedule/_components/announce-button.tsx');
  assert.match(btn, /useSearchParams\(\)\?\.get\('announce'\) === '1'/);
  assert.match(btn, /useState\(arrivedToAnnounce\)/);
  const rows = src('app/vendor-dashboard/_components/events-you-run-rows.tsx');
  assert.match(rows, /const live = enabled \? events\.filter\(\(e\) => e\.rank !== 2 && e\.canAnnounce\) : \[\];/);
  const page = src('app/vendor-dashboard/events/page.tsx');
  assert.match(page, /isCoordinatorP3Enabled\(\)\.catch\(\(\) => false\)/, 'the door ignores the feature flag the composer obeys');
  assert.match(page, /<MessageEveryoneRows events=\{events\} enabled=\{announceOn\} \/>/);

  // The rule is the broadcast's: a full co-host, or schedule at Edit; a schedule-view seat gets no door.
  const ev = { event_id: 'e1', display_name: 'C & I', event_type: 'wedding', event_date: '2026-12-12', event_end_date: null, event_date_precision: 'day', venue_name: null };
  const row = (role: string, schedule: 'edit' | 'view' | null): CoordinatorSeatRow => ({
    event_id: 'e1',
    role_subtype: role,
    permissions_json: { edit_all: false, checkout: false, invite_hosts: false, remove_hosts: false, areas: { guest_list: 'edit', seat_plan: 'edit', schedule, vendors: 'edit' } },
    accepted_at: '2026-10-01T00:00:00Z',
    removed_at: null,
    events: ev,
  });
  const now = new Date('2026-10-29T00:00:00Z');
  const served = new Set(['e1']); // this shop is on the event (rule (a), `readEventsYouRun`)
  assert.equal(eventsYouRun([row('wedding_planner_external', 'edit')], now, '2026-10-29', served)[0]!.canAnnounce, true);
  // The co-host seat a supplier gets is the hosts' "Full access" answer (`access_level: 'full'`).
  const fullCohost = { ...row('co_host', null), permissions_json: { ...row('co_host', null).permissions_json!, access_level: 'full' } as CoordinatorSeatRow['permissions_json'] };
  assert.equal(eventsYouRun([fullCohost], now, '2026-10-29', served)[0]!.canAnnounce, true);
  const viewOnly = { ...row('wedding_planner_external', 'view'), permissions_json: { edit_all: false, checkout: false, invite_hosts: false, remove_hosts: false, areas: { guest_list: 'view', seat_plan: 'view', schedule: 'view', vendors: 'view' }, access_level: 'limited' } as CoordinatorSeatRow['permissions_json'] };
  assert.equal(eventsYouRun([viewOnly], now, '2026-10-29', served)[0]!.canAnnounce, false, 'a Limited coordinator is offered a send the database refuses');
});

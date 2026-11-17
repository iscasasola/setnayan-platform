/**
 * W1-B29 (supplier walk, 16 Nov 2026): a Clients header read "Schedules" with nothing while a meeting existed — the
 * picked client's Schedules cell was a hard-coded "— · none yet" for every client not booked yet. Now every Schedules
 * figure (the Clients tile, the list it opens, the picked client's cell) asks `event_appointments` with ONE rule
 * (`OPEN_MEETING_STATUSES` + `openMeetingsWindow`), and the cell says the count it read.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OPEN_MEETING_STATUSES, openMeetingsWindow } from './clients-tiles';
import { detailsNumbers } from '../clients/[eventId]/_components/details-numbers';

const notBooked = {
  isBooked: false,
  todayIso: '2026-11-16',
  eventDate: '2027-02-14',
  ledger: null,
  onPlan: false,
  sentQuotePhp: undefined,
  peso: (n: number) => `₱${n}`,
} as const;
const cell = (meetings: number | null | undefined) => {
  const c = detailsNumbers({ ...notBooked, meetings }).find((x) => x.key === 'schedules')!;
  return `${c.value}|${c.sub}`;
};

test('the picked client’s Schedules cell says the meetings it read', () => {
  assert.equal(cell(2), '2|coming up', 'a client with meetings was told "none yet"');
  assert.equal(cell(1), '1|coming up');
  assert.equal(cell(0), '—|none yet');
  assert.equal(cell(null), '—|couldn’t load', 'a refused read must never read as "none yet"');
});

test('one rule: proposed or confirmed, from the start of Manila today or undated', () => {
  assert.deepEqual([...OPEN_MEETING_STATUSES], ['proposed', 'confirmed']);
  assert.equal(openMeetingsWindow('2026-11-16'), 'scheduled_at.gte.2026-11-15T16:00:00.000Z,scheduled_at.is.null');
});

test('the Clients tile and the picked client both read with that rule', () => {
  const list = readFileSync('app/vendor-dashboard/customers/page.tsx', 'utf8');
  const q = list.slice(list.indexOf(".from('event_appointments')"), list.indexOf(".from('event_appointments')") + 400);
  assert.match(q, /\.in\('status', \[\.\.\.OPEN_MEETING_STATUSES\]\)\s*\.or\(openMeetingsWindow\(todayIso\)\)/);
  assert.match(list, /\{ key: 'schedules', value: countWords\(meetingsCount\)/, 'the tile no longer counts the list’s own read');
  assert.match(list, /schedules: <MeetingsList meetings=\{meetings\}/, 'the tile opens a different list');
  const card = readFileSync('app/vendor-dashboard/clients/[eventId]/page.tsx', 'utf8');
  assert.match(card, /\.in\('status', \[\.\.\.OPEN_MEETING_STATUSES\]\)\s*\.or\(openMeetingsWindow\(manilaTodayIso\(\)\)\)/);
  assert.match(card, /meetings: openMeetings,/, 'the cell is not handed the count');
  const numbers = readFileSync('app/vendor-dashboard/clients/[eventId]/_components/details-numbers.ts', 'utf8');
  assert.doesNotMatch(numbers, /label: 'Schedules', value: '—', sub: 'none yet'/, 'the hard-coded "none yet" is back');
});

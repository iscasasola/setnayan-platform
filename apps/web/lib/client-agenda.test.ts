/**
 * 🔒 The dated list (Unichat F, drawing v3 `riseBody('next')`): rows from what the page read, the drawing's weeks, a
 * Done fold, and nothing invented.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agendaLine, clientAgenda, dayMonthWords, rangeWords } from './client-agenda';
import { clientScheduleDays } from './schedule-days';

// The drawing's day: today Fri 20 Nov, the event Fri 18 Dec.
const days = clientScheduleDays({
  eventDate: '2026-12-18',
  chapters: [],
  meetings: [
    { appointment_id: 'm1', label: 'Ocular', scheduled_at: '2026-11-20T07:00:00Z', status: 'proposed' },
    { appointment_id: 'm2', label: 'Tasting', scheduled_at: '2026-11-12T07:00:00Z', status: 'done' },
  ],
  payments: [
    { label: 'Downpayment', due_date: '2026-11-15', state: 'paid' },
    { label: 'Second payment', due_date: '2026-12-10', state: 'due' },
    { label: 'Balance', due_date: '2026-12-19', state: 'due' },
  ],
});
const a = clientAgenda({ todayIso: '2026-11-20', eventDate: '2026-12-18', days, quote: { version: 2, validUntil: '2026-11-26' } });

test('1 · the drawing’s weeks: This week · Next week · ranges, clipped at the day before the event', () => {
  assert.deepEqual(
    a.groups.map((g) => g.heading),
    ['This week · Nov 20 – 22', 'Next week · Nov 23 – 29', 'Dec 7 – 13', 'After the event'],
  );
  assert.equal(rangeWords('2026-11-30', '2026-12-06'), 'Nov 30 – Dec 6');
  const lastWeek = clientAgenda({ todayIso: '2026-11-20', eventDate: '2026-12-18', days: [], quote: { version: 1, validUntil: '2026-12-16' } });
  assert.equal(lastWeek.groups[0]!.heading, 'Dec 14 – 17', 'the event’s own week runs past the day before it');
});

test('2 · Done folds away; statuses are the shipped facts', () => {
  assert.deepEqual(a.done.map((r) => r.title), ['Tasting', 'Downpayment due']);
  const ocular = a.groups[0]!.rows[0]!;
  assert.deepEqual([ocular.title, ocular.status, ocular.mon, ocular.d, ocular.kind], ['Ocular', 'Asked', 'Nov', '20', 'meeting']);
  assert.deepEqual(a.groups[1]!.rows.map((r) => [r.title, r.status]), [['Quote v2 good until', 'Due']]);
});

test('3 · nothing invented: no event row, no quote row without a date, an empty list says so', () => {
  assert.ok(!a.groups.flatMap((g) => g.rows).some((r) => r.title === 'Event day'), 'the event day became a row');
  const bare = clientAgenda({ todayIso: '2026-11-20', eventDate: '2026-12-18', days: [], quote: { version: 1, validUntil: null } });
  assert.equal(bare.nothingAhead, true);
  assert.equal(bare.done.length, 0);
});

test('4 · the head’s line counts the days', () => {
  assert.equal(agendaLine(a, '2026-12-18'), '28 days to the event');
  assert.equal(dayMonthWords('2026-12-18'), '18 Dec');
  assert.equal(dayMonthWords(null), null);
  assert.equal(agendaLine(clientAgenda({ todayIso: '2026-12-18', eventDate: '2026-12-18', days: [], quote: null }), '2026-12-18'), 'The event is today');
  assert.equal(agendaLine(clientAgenda({ todayIso: '2026-12-20', eventDate: '2026-12-18', days: [], quote: null }), '2026-12-18'), 'After the event');
  assert.equal(agendaLine(clientAgenda({ todayIso: '2026-12-20', eventDate: null, days: [], quote: null }), null), 'No event date yet');
});

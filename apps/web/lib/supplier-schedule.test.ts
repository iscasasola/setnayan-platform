/**
 * supplier-schedule.test.ts — the pure half of the supplier's part of the schedule (Step 4b, `lib/supplier-schedule.ts`).
 * Their day (own moments open, everybody else's greyed, waiting requests in place), the final week, Seen, crew, and the
 * requests My times asks for.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSupplierDay,
  changedSinceSeen,
  crewFromText,
  inFinalWeek,
  momentStartIn,
  timesRequests,
  type SupplierBlockRow,
  type SupplierRequestRow,
} from '@/lib/supplier-schedule';

const B = (over: Partial<SupplierBlockRow> & { block_id: string }): SupplierBlockRow => ({
  parent_block_id: null,
  label: over.block_id,
  start_at: '2026-12-18T15:00:00.000Z',
  end_at: null,
  location: null,
  spot: null,
  time_tba: false,
  is_optional: false,
  responsible_vendor_ids: [],
  created_at: '2026-11-01T00:00:00.000Z',
  updated_at: '2026-11-01T00:00:00.000Z',
  ...over,
});
const R = (over: Partial<SupplierRequestRow> & { suggestion_id: string }): SupplierRequestRow => ({
  block_id: null,
  kind: 'new',
  proposed_label: null,
  proposed_start_at: null,
  proposed_end_at: null,
  proposed_parent_block_id: null,
  proposed_crew: null,
  note: 'x',
  status: 'open',
  created_at: '2026-11-02T00:00:00.000Z',
  ...over,
});

test('their day: linked chapters, their moments open, everybody else’s greyed, waits in place', () => {
  const day = buildSupplierDay({
    blocks: [
      B({ block_id: 'ceremony', start_at: '2026-12-18T15:00:00.000Z', end_at: '2026-12-18T16:00:00.000Z', location: 'San Vicente', responsible_vendor_ids: ['ev1'] }),
      B({ block_id: 'reception', start_at: '2026-12-18T18:00:00.000Z', responsible_vendor_ids: ['ev2'] }),
      B({ block_id: 'lights', parent_block_id: 'ceremony', start_at: '2026-12-18T14:00:00.000Z', end_at: '2026-12-18T14:30:00.000Z', responsible_vendor_ids: ['ev1'] }),
      B({ block_id: 'vows', parent_block_id: 'ceremony', start_at: '2026-12-18T15:20:00.000Z' }),
      B({ block_id: 'dance', parent_block_id: 'reception', responsible_vendor_ids: ['ev2'] }),
    ],
    myBookingIds: ['ev1'],
    tasks: [
      { block_id: 'lights', vendor_id: 'ev1', crew: 'Team A' },
      { block_id: 'lights', vendor_id: 'ev2', crew: 'Not ours' },
    ],
    requests: [
      R({ suggestion_id: 'add', proposed_parent_block_id: 'ceremony', proposed_label: 'Detail shots' }),
      R({ suggestion_id: 'del', kind: 'remove', block_id: 'lights' }),
      R({ suggestion_id: 'words', kind: 'adjust', block_id: 'vows' }),
      R({ suggestion_id: 'done', status: 'accepted', proposed_parent_block_id: 'ceremony' }),
    ],
  });
  const [ceremony, reception] = day.chapters;
  assert.equal(ceremony!.linked, true);
  assert.equal(reception!.linked, false, 'a chapter of another supplier reads as theirs');
  assert.equal(ceremony!.where, 'San Vicente');
  assert.equal(reception!.where, 'Venue TBA');
  const [lights, vows] = ceremony!.moments;
  assert.deepEqual([lights!.mine, vows!.mine], [true, false]);
  assert.deepEqual(lights!.crew, ['Team A'], 'another supplier’s crew is shown as theirs');
  assert.equal(lights!.section, 'Ingress');
  assert.equal(lights!.minutes, 30);
  assert.equal(lights!.waiting?.suggestion_id, 'del');
  assert.equal(vows!.waiting, null, 'a moment that is not theirs carries their wait');
  assert.deepEqual(ceremony!.waitingAdds.map((r) => r.suggestion_id), ['add'], 'an answered add still reads as waiting');
  assert.deepEqual(day.otherWaiting.map((r) => r.suggestion_id), ['words']);
});

test('Seen: never seen with a schedule = changed; a later edit = changed; nothing since = not', () => {
  assert.equal(changedSinceSeen(['2026-11-01T00:00:00Z'], null), true);
  assert.equal(changedSinceSeen(['2026-11-01T00:00:00Z'], '2026-11-02T00:00:00Z'), false);
  assert.equal(changedSinceSeen(['2026-11-03T00:00:00Z'], '2026-11-02T00:00:00Z'), true);
  assert.equal(changedSinceSeen([], null), false);
});

test('the final week is the seven days up to and including the day', () => {
  assert.equal(inFinalWeek('2026-12-18', '2026-12-11'), true);
  assert.equal(inFinalWeek('2026-12-18', '2026-12-18'), true);
  assert.equal(inFinalWeek('2026-12-18', '2026-12-10'), false);
  assert.equal(inFinalWeek('2026-12-18', '2026-12-19'), false);
  assert.equal(inFinalWeek(null, '2026-12-18'), false);
});

test('crew: names by comma, trimmed, once each, at most twelve', () => {
  assert.deepEqual(crewFromText(' Team A ,team a, Second   shooter,,'), ['Team A', 'Second shooter']);
  assert.equal(crewFromText(Array.from({ length: 20 }, (_, i) => `C${i}`).join(',')).length, 12);
  assert.deepEqual(crewFromText(''), []);
});

test('times and moments cross midnight the way the day does', () => {
  const reception = { block_id: 'r', start_at: '2026-12-18T18:00:00.000Z' };
  assert.equal(momentStartIn(reception, '01:00', 'Egress'), '2026-12-19T01:00:00.000Z');
  assert.equal(momentStartIn({ start_at: '2026-12-18T06:00:00.000Z' }, '23:00', 'Ingress'), '2026-12-17T23:00:00.000Z');
  assert.equal(momentStartIn(reception, '16:00', 'Event'), '2026-12-18T16:00:00.000Z');
  const t = timesRequests({ shop: 'Lumina', chapter: reception, arrive: '16:00', done: '01:00' });
  assert.deepEqual(
    t.map((x) => [x.label, x.start]),
    [
      ['Lumina arrives', '2026-12-18T16:00:00.000Z'],
      ['Lumina is done', '2026-12-19T01:00:00.000Z'],
    ],
  );
  assert.deepEqual(timesRequests({ shop: 'Lumina', chapter: reception, arrive: '', done: '' }), []);
});

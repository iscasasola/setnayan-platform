/**
 * Unit suite for the travel multi-day itinerary engine (ai-travel-scheduling ·
 * Setnayan_AI_Gap_Leaves_Travel_Dinner_Date_2026-07-17 Part B). Pins the four
 * behaviors the spec locks:
 *   • night-block expansion — a hotel stay covers check-in day → the night
 *     BEFORE check-out (the "room × nights" geometry);
 *   • the day-by-day itinerary lens over one master timeline (pure filter);
 *   • the GRD-06 clash guard — overlapping tour time-blocks + trip nights
 *     with no hotel booked, with the guard's copy rendered verbatim;
 *   • the save-time double-book check (back-to-back is fine, overlap is not).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_ITINERARY_DAYS,
  TRAVEL_ONLY_BLOCK_TYPES,
  TRAVEL_SCHEDULE_BLOCK_TYPES,
  buildTravelItinerary,
  detectTravelClashes,
  expandLodgingNights,
  findTourOverlap,
  isTravelEventType,
  isTravelOnlyBlockType,
  tourDoubleBookMessage,
  travelClashCopy,
  travelDayKey,
  type TravelBlock,
} from './schedule-travel';

let seq = 0;
function block(partial: Partial<TravelBlock> & Pick<TravelBlock, 'start_at'>): TravelBlock {
  seq += 1;
  return {
    block_id: partial.block_id ?? `b${seq}`,
    label: partial.label ?? `Block ${seq}`,
    block_type: partial.block_type ?? 'tour',
    end_at: partial.end_at ?? null,
    parent_block_id: partial.parent_block_id ?? null,
    ...partial,
  } as TravelBlock;
}

// ── type gates ───────────────────────────────────────────────────────────────

test('travel gates: only the travel event type + only lodging/tour are travel-only', () => {
  assert.equal(isTravelEventType('travel'), true);
  assert.equal(isTravelEventType('wedding'), false);
  assert.equal(isTravelEventType(null), false);
  assert.deepEqual([...TRAVEL_ONLY_BLOCK_TYPES], ['lodging', 'tour']);
  assert.equal(isTravelOnlyBlockType('lodging'), true);
  assert.equal(isTravelOnlyBlockType('tour'), true);
  assert.equal(isTravelOnlyBlockType('ceremony'), false);
  // The travel add-menu leads with the two itinerary classes.
  assert.deepEqual(TRAVEL_SCHEDULE_BLOCK_TYPES.slice(0, 2), ['lodging', 'tour']);
});

// ── night-block expansion ────────────────────────────────────────────────────

test('expandLodgingNights: check-in → check-out covers every night, not the check-out day', () => {
  const stay = block({
    block_type: 'lodging',
    start_at: '2026-08-03T14:00:00Z', // check-in Aug 3
    end_at: '2026-08-06T11:00:00Z', // check-out Aug 6
  });
  assert.deepEqual(expandLodgingNights(stay), ['2026-08-03', '2026-08-04', '2026-08-05']);
});

test('expandLodgingNights: no end / same-day end / inverted range = one night', () => {
  assert.deepEqual(
    expandLodgingNights(block({ block_type: 'lodging', start_at: '2026-08-03T14:00:00Z' })),
    ['2026-08-03'],
  );
  assert.deepEqual(
    expandLodgingNights(
      block({
        block_type: 'lodging',
        start_at: '2026-08-03T14:00:00Z',
        end_at: '2026-08-03T20:00:00Z',
      }),
    ),
    ['2026-08-03'],
  );
  assert.deepEqual(
    expandLodgingNights(
      block({
        block_type: 'lodging',
        start_at: '2026-08-03T14:00:00Z',
        end_at: '2026-08-01T11:00:00Z',
      }),
    ),
    ['2026-08-03'],
  );
});

test('expandLodgingNights: caps a typo-length stay at MAX_ITINERARY_DAYS nights', () => {
  const stay = block({
    block_type: 'lodging',
    start_at: '2026-08-03T14:00:00Z',
    end_at: '2027-08-03T11:00:00Z', // a "year-long" typo
  });
  assert.equal(expandLodgingNights(stay).length, MAX_ITINERARY_DAYS);
});

test('travelDayKey reads the stored wall-clock day', () => {
  assert.equal(travelDayKey('2026-08-03T23:30:00Z'), '2026-08-03');
  assert.equal(travelDayKey('2026-08-03'), '2026-08-03');
  assert.equal(travelDayKey('not-a-date'), null);
  assert.equal(travelDayKey(null), null);
});

// ── itinerary building ───────────────────────────────────────────────────────

test('buildTravelItinerary: two hotels + tours land on their trip days', () => {
  const hotelA = block({
    block_id: 'hotelA',
    label: 'Hotel A',
    block_type: 'lodging',
    start_at: '2026-08-03T14:00:00Z',
    end_at: '2026-08-05T11:00:00Z', // nights 3–4
  });
  const hotelB = block({
    block_id: 'hotelB',
    label: 'Hotel B',
    block_type: 'lodging',
    start_at: '2026-08-05T14:00:00Z',
    end_at: '2026-08-07T11:00:00Z', // nights 5–6
  });
  const tour = block({
    block_id: 'tour1',
    label: 'Island hopping',
    block_type: 'tour',
    start_at: '2026-08-04T08:00:00Z',
    end_at: '2026-08-04T15:00:00Z',
  });
  const { days, isMultiDay } = buildTravelItinerary([hotelA, hotelB, tour]);

  assert.equal(isMultiDay, true);
  assert.deepEqual(
    days.map((d) => d.dayKey),
    ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07'],
  );
  assert.deepEqual(
    days.map((d) => d.dayNumber),
    [1, 2, 3, 4, 5],
  );
  // Night coverage: A on 3+4, B on 5+6, nothing on the final (check-out) day.
  assert.deepEqual(
    days.map((d) => d.lodging.map((l) => l.block_id)),
    [['hotelA'], ['hotelA'], ['hotelB'], ['hotelB'], []],
  );
  // The tour sits on day 2; no lodging gap anywhere (fully covered trip).
  assert.deepEqual(days[1]!.tours.map((t) => t.block_id), ['tour1']);
  assert.deepEqual(days.map((d) => d.isLodgingGap), [false, false, false, false, false]);
});

test('buildTravelItinerary: the trip date range fills days even with no blocks', () => {
  const { days } = buildTravelItinerary([], {
    tripStart: '2026-08-03',
    tripEnd: '2026-08-05',
  });
  assert.deepEqual(
    days.map((d) => d.dayKey),
    ['2026-08-03', '2026-08-04', '2026-08-05'],
  );
  // Both trip nights are uncovered; the final day needs no night.
  assert.deepEqual(days.map((d) => d.isLodgingGap), [true, true, false]);
});

test('buildTravelItinerary: single-day domain has no nights, so no gap', () => {
  const { days, isMultiDay } = buildTravelItinerary([], { tripStart: '2026-08-03' });
  assert.equal(isMultiDay, false);
  assert.equal(days.length, 1);
  assert.equal(days[0]!.isLodgingGap, false);
});

test('buildTravelItinerary: child rows are ignored (top-level timeline only)', () => {
  const child = block({
    block_type: 'tour',
    start_at: '2026-08-04T08:00:00Z',
    parent_block_id: 'parent-1',
  });
  const { days } = buildTravelItinerary([child]);
  assert.equal(days.length, 0);
});

// ── clash detection: GRD-06 tour overlaps ────────────────────────────────────

test('detectTravelClashes: overlapping tours fire GRD-06 with the shared slot', () => {
  const a = block({
    label: 'Island hopping',
    block_type: 'tour',
    start_at: '2026-08-04T08:00:00Z',
    end_at: '2026-08-04T12:00:00Z',
  });
  const b = block({
    label: 'Underground river',
    block_type: 'tour',
    start_at: '2026-08-04T11:00:00Z',
    end_at: '2026-08-04T14:00:00Z',
  });
  // A lodging block covering the night keeps the gap guard quiet.
  const stay = block({
    block_type: 'lodging',
    start_at: '2026-08-04T14:00:00Z',
    end_at: '2026-08-05T11:00:00Z',
  });
  const clashes = detectTravelClashes([a, b, stay]);
  assert.equal(clashes.length, 1);
  const clash = clashes[0]!;
  assert.equal(clash.kind, 'tour_overlap');
  if (clash.kind === 'tour_overlap') {
    assert.equal(clash.itemA, 'Island hopping');
    assert.equal(clash.itemB, 'Underground river');
    assert.equal(clash.dayKey, '2026-08-04');
    // The shared slot is the overlap window, formatted deterministically (UTC).
    assert.equal(clash.slot, 'Tue, Aug 4 · 11:00 AM – 12:00 PM');
    // The traveler-facing copy is the GRD-06 guard template VERBATIM.
    assert.equal(
      travelClashCopy(clash),
      'Two things land on Tue, Aug 4 · 11:00 AM – 12:00 PM: Island hopping and Underground river. That’s a clash — want to resolve it now?',
    );
  }
});

test('detectTravelClashes: back-to-back tours do not clash', () => {
  const a = block({
    block_type: 'tour',
    start_at: '2026-08-04T08:00:00Z',
    end_at: '2026-08-04T11:00:00Z',
  });
  const b = block({
    block_type: 'tour',
    start_at: '2026-08-04T11:00:00Z',
    end_at: '2026-08-04T14:00:00Z',
  });
  const stay = block({
    block_type: 'lodging',
    start_at: '2026-08-04T14:00:00Z',
    end_at: '2026-08-05T11:00:00Z',
  });
  assert.deepEqual(detectTravelClashes([a, b, stay]), []);
});

test('detectTravelClashes: three-way overlap reports each clashing pair', () => {
  const mk = (label: string, s: string, e: string) =>
    block({ label, block_type: 'tour', start_at: s, end_at: e });
  const clashes = detectTravelClashes([
    mk('A', '2026-08-04T08:00:00Z', '2026-08-04T12:00:00Z'),
    mk('B', '2026-08-04T09:00:00Z', '2026-08-04T13:00:00Z'),
    mk('C', '2026-08-04T10:00:00Z', '2026-08-04T14:00:00Z'),
    block({
      block_type: 'lodging',
      start_at: '2026-08-04T14:00:00Z',
      end_at: '2026-08-05T11:00:00Z',
    }),
  ]);
  const overlaps = clashes.filter((c) => c.kind === 'tour_overlap');
  assert.equal(overlaps.length, 3); // A×B, A×C, B×C
});

// ── clash detection: lodging gaps ────────────────────────────────────────────

test('detectTravelClashes: a hotel gap night is flagged with the spec copy', () => {
  const hotelA = block({
    label: 'Hotel A',
    block_type: 'lodging',
    start_at: '2026-08-03T14:00:00Z',
    end_at: '2026-08-04T11:00:00Z', // night 3 only
  });
  const hotelB = block({
    label: 'Hotel B',
    block_type: 'lodging',
    start_at: '2026-08-05T14:00:00Z',
    end_at: '2026-08-06T11:00:00Z', // night 5 only — night 4 uncovered
  });
  const clashes = detectTravelClashes([hotelA, hotelB]);
  assert.equal(clashes.length, 1);
  const gap = clashes[0]!;
  assert.equal(gap.kind, 'lodging_gap');
  if (gap.kind === 'lodging_gap') {
    assert.deepEqual(gap.nights, ['2026-08-04']);
    assert.equal(
      travelClashCopy(gap),
      'No hotel booked for the night of Tue, Aug 4 — a gap in your lodging. Add a stay so every night of the trip is covered.',
    );
  }
});

test('detectTravelClashes: consecutive uncovered nights group into one ranged clash', () => {
  const clashes = detectTravelClashes([], {
    tripStart: '2026-08-03',
    tripEnd: '2026-08-07',
  });
  assert.equal(clashes.length, 1);
  const gap = clashes[0]!;
  assert.equal(gap.kind, 'lodging_gap');
  if (gap.kind === 'lodging_gap') {
    assert.deepEqual(gap.nights, ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06']);
    assert.match(travelClashCopy(gap), /the nights of Mon, Aug 3 – Thu, Aug 6/);
  }
});

test('detectTravelClashes: a conflict-free multi-hotel trip is clean', () => {
  const hotelA = block({
    block_type: 'lodging',
    start_at: '2026-08-03T14:00:00Z',
    end_at: '2026-08-05T11:00:00Z',
  });
  const hotelB = block({
    block_type: 'lodging',
    start_at: '2026-08-05T14:00:00Z',
    end_at: '2026-08-07T11:00:00Z',
  });
  const tourDay2 = block({
    block_type: 'tour',
    start_at: '2026-08-04T08:00:00Z',
    end_at: '2026-08-04T12:00:00Z',
  });
  const tourDay3 = block({
    block_type: 'tour',
    start_at: '2026-08-05T08:00:00Z',
    end_at: '2026-08-05T12:00:00Z',
  });
  assert.deepEqual(
    detectTravelClashes([hotelA, hotelB, tourDay2, tourDay3], {
      tripStart: '2026-08-03',
      tripEnd: '2026-08-07',
    }),
    [],
  );
});

// ── save-time double-book ────────────────────────────────────────────────────

test('findTourOverlap: rejects an overlapping candidate, allows back-to-back', () => {
  const existing = [
    block({
      block_id: 'existing-tour',
      label: 'Island hopping',
      block_type: 'tour',
      start_at: '2026-08-04T08:00:00Z',
      end_at: '2026-08-04T12:00:00Z',
    }),
    block({
      block_type: 'lodging',
      start_at: '2026-08-04T14:00:00Z',
      end_at: '2026-08-05T11:00:00Z',
    }),
  ];
  const conflict = findTourOverlap(
    { start_at: '2026-08-04T11:00:00Z', end_at: '2026-08-04T13:00:00Z' },
    existing,
  );
  assert.equal(conflict?.block_id, 'existing-tour');
  assert.equal(
    findTourOverlap(
      { start_at: '2026-08-04T12:00:00Z', end_at: '2026-08-04T14:00:00Z' },
      existing,
    ),
    null,
  );
  // Lodging never constrains a tour slot.
  assert.equal(
    findTourOverlap(
      { start_at: '2026-08-04T15:00:00Z', end_at: '2026-08-04T16:00:00Z' },
      existing,
    ),
    null,
  );
});

test('findTourOverlap: an update excludes its own row', () => {
  const existing = [
    block({
      block_id: 'self',
      block_type: 'tour',
      start_at: '2026-08-04T08:00:00Z',
      end_at: '2026-08-04T12:00:00Z',
    }),
  ];
  // Retiming 'self' within its own old window is not a self-clash…
  assert.equal(
    findTourOverlap(
      { start_at: '2026-08-04T09:00:00Z', end_at: '2026-08-04T11:00:00Z', block_id: 'self' },
      existing,
    ),
    null,
  );
  // …but the same times from a NEW row do clash.
  assert.equal(
    findTourOverlap(
      { start_at: '2026-08-04T09:00:00Z', end_at: '2026-08-04T11:00:00Z' },
      existing,
    )?.block_id,
    'self',
  );
});

test('findTourOverlap: a point-in-time candidate inside a tour clashes', () => {
  const existing = [
    block({
      block_id: 't',
      block_type: 'tour',
      start_at: '2026-08-04T08:00:00Z',
      end_at: '2026-08-04T12:00:00Z',
    }),
  ];
  assert.equal(
    findTourOverlap({ start_at: '2026-08-04T10:00:00Z', end_at: null }, existing)?.block_id,
    't',
  );
  assert.equal(
    findTourOverlap({ start_at: '2026-08-04T12:00:00Z', end_at: null }, existing),
    null,
  );
});

test('tourDoubleBookMessage: the rejection is the GRD-06 copy with both labels', () => {
  const conflict = block({
    label: 'Island hopping',
    block_type: 'tour',
    start_at: '2026-08-04T08:00:00Z',
    end_at: '2026-08-04T12:00:00Z',
  });
  const msg = tourDoubleBookMessage(
    { label: 'Underground river', start_at: '2026-08-04T11:00:00Z', end_at: '2026-08-04T13:00:00Z' },
    conflict,
  );
  assert.equal(
    msg,
    'Two things land on Tue, Aug 4 · 11:00 AM – 12:00 PM: Island hopping and Underground river. That’s a clash — want to resolve it now?',
  );
});

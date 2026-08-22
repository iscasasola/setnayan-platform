/**
 * alaala-chapters.test.ts — the chapters hold the right pictures.
 *
 * The fixture below is PRODUCTION'S OWN SCHEDULE, copied from the live database:
 * Hair & make-up 08:00–11:00 · Cocktails 17:00–18:00 · Grand Entrance
 * 18:15–18:30 · Dinner 18:45–19:45 · First Dance 20:00–20:15. Stored as the
 * venue's wall clock in a UTC column, exactly as the real rows are.
 *
 * ⚠ THE TEST THAT MATTERS IS THE FIRST ONE. Comparing a stored wall clock to a
 * real capture time puts every frame eight hours out in Manila, and NOTHING
 * ERRORS — the chapters render beautifully and hold the wrong photographs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { groupIntoChapters, timeOfDayLabel, type ChapterBlock } from './alaala-chapters';

const TZ = 'Asia/Manila';

/** Production's schedule, verbatim in shape: wall clock in a +00 column. */
const BLOCKS: ChapterBlock[] = [
  { blockId: 'b1', label: 'Hair & make-up', startAt: '2026-08-01T08:00:00+00', endAt: '2026-08-01T11:00:00+00' },
  { blockId: 'b2', label: 'Cocktails', startAt: '2026-08-01T17:00:00+00', endAt: '2026-08-01T18:00:00+00' },
  { blockId: 'b3', label: 'Grand Entrance', startAt: '2026-08-01T18:15:00+00', endAt: '2026-08-01T18:30:00+00' },
  { blockId: 'b4', label: 'Dinner', startAt: '2026-08-01T18:45:00+00', endAt: '2026-08-01T19:45:00+00' },
  { blockId: 'b5', label: 'First Dance', startAt: '2026-08-01T20:00:00+00', endAt: '2026-08-01T20:15:00+00' },
];

/** A frame shot at a Manila wall-clock time, expressed as the real instant. */
function shotAt(manilaHHMM: string, id = manilaHHMM) {
  const [h, m] = manilaHHMM.split(':').map(Number);
  const utcHour = h! - 8; // Manila is UTC+8
  const day = utcHour < 0 ? '07-31' : '08-01';
  const hh = String(((utcHour % 24) + 24) % 24).padStart(2, '0');
  return { id, capturedAt: `2026-${day}T${hh}:${String(m!).padStart(2, '0')}:00.000Z` };
}

test('a dinner photo lands in Dinner — not eight hours away', () => {
  // 19:00 at the venue is 11:00Z. Read the schedule naively and 11:00Z falls in
  // "Hair & make-up" (08:00–11:00 as raw values), which is the whole bug.
  const { days } = groupIntoChapters({ frames: [shotAt('19:00')], blocks: BLOCKS, tz: TZ });
  const labels = days.flatMap((d) => d.chapters.map((c) => c.label));
  assert.deepEqual(labels, ['Dinner'],
    'A 7pm photo did not land in Dinner. If it says "Hair & make-up", the wall ' +
    'clock is being compared to a real instant and every chapter is 8h wrong.');
});

test('each moment of the night gets its own frame', () => {
  const frames = [shotAt('09:30'), shotAt('17:30'), shotAt('18:20'), shotAt('19:00'), shotAt('20:05')];
  const { days } = groupIntoChapters({ frames, blocks: BLOCKS, tz: TZ });
  assert.equal(days.length, 1, 'one venue day');
  assert.deepEqual(
    days[0]!.chapters.map((c) => c.label),
    ['Hair & make-up', 'Cocktails', 'Grand Entrance', 'Dinner', 'First Dance'],
    'chapters must run in the order the night ran',
  );
});

test('a photo in a gap gets its own chapter, named by time of day', () => {
  // 14:30 at the venue: hair & make-up ended 11:00, cocktails start 17:00.
  const { days } = groupIntoChapters({ frames: [shotAt('14:30')], blocks: BLOCKS, tz: TZ });
  const c = days[0]!.chapters[0]!;
  assert.equal(c.fromGap, true, 'a frame in no block must not be forced into one');
  assert.equal(c.label, 'Afternoon');
  assert.equal(c.frames.length, 1, 'the frame is kept, never dropped');
});

test('with no schedule at all, frames still group by day and nothing is lost', () => {
  const frames = [shotAt('09:00', 'a'), shotAt('21:00', 'b')];
  const { days, undated } = groupIntoChapters({ frames, blocks: [], tz: TZ });
  assert.equal(undated.length, 0);
  assert.equal(days.length, 1, 'both frames are the same venue day');
  assert.equal(days[0]!.chapters.every((c) => c.fromGap), true);
  assert.equal(days[0]!.chapters.flatMap((c) => c.frames).length, 2, 'no frame is dropped');
});

test('the real clock beats the plan when the day ran late', () => {
  // The ceremony was scheduled 14:00–15:30 but actually ran 15:00–16:30.
  // A 15:45 photo belongs to the ceremony that HAPPENED, not the one planned.
  const late: ChapterBlock[] = [
    {
      blockId: 'c1', label: 'Ceremony',
      startAt: '2026-08-01T14:00:00+00', endAt: '2026-08-01T15:30:00+00',
      actualStartAt: '2026-08-01T07:00:00.000Z', // 15:00 Manila
      actualEndAt: '2026-08-01T08:30:00.000Z',   // 16:30 Manila
    },
  ];
  const { days } = groupIntoChapters({ frames: [shotAt('15:45')], blocks: late, tz: TZ });
  assert.equal(days[0]!.chapters[0]!.label, 'Ceremony');
  assert.equal(days[0]!.chapters[0]!.fromGap, false);
});

test('an actual time is NOT converted a second time', () => {
  // actualStartAt is already an instant. Running it through the wall-clock
  // conversion would shift it again — the bug wearing the fix's clothes.
  const b: ChapterBlock[] = [
    {
      blockId: 'c1', label: 'Ceremony',
      startAt: '2026-08-01T14:00:00+00', endAt: '2026-08-01T15:30:00+00',
      actualStartAt: '2026-08-01T06:00:00.000Z', // 14:00 Manila
      actualEndAt: '2026-08-01T07:30:00.000Z',   // 15:30 Manila
    },
  ];
  const inside = groupIntoChapters({ frames: [shotAt('14:30')], blocks: b, tz: TZ });
  assert.equal(inside.days[0]!.chapters[0]!.label, 'Ceremony',
    'a 14:30 frame is inside the ceremony that actually ran 14:00–15:30');
  const after = groupIntoChapters({ frames: [shotAt('23:30')], blocks: b, tz: TZ });
  assert.equal(after.days[0]!.chapters[0]!.fromGap, true,
    'a 23:30 frame is outside it; if this passes as "Ceremony" the window was shifted');
});

test('when two blocks overlap, the shorter window wins', () => {
  // Production really has this: preparations 08:00–12:00 overlapping vendor
  // ingress 10:00–13:00. An 11:00 frame is inside both.
  const overlapping: ChapterBlock[] = [
    { blockId: 'p', label: 'Hair & makeup / preparations', startAt: '2026-08-01T08:00:00+00', endAt: '2026-08-01T12:00:00+00' },
    { blockId: 'v', label: 'Vendor ingress & styling', startAt: '2026-08-01T10:00:00+00', endAt: '2026-08-01T13:00:00+00' },
  ];
  const { days } = groupIntoChapters({ frames: [shotAt('11:00')], blocks: overlapping, tz: TZ });
  assert.equal(days[0]!.chapters[0]!.label, 'Vendor ingress & styling',
    'the tighter 3h window is the more specific moment; the 4h one is background');
});

test('a backstage block still makes a chapter — time decides, not who it was for', () => {
  // Owner 2026-08-19: "chapter happens depending on the time, not who took it."
  const withBackstage: ChapterBlock[] = [
    { blockId: 'x', label: 'Post-ceremony photos', startAt: '2026-08-01T15:30:00+00', endAt: '2026-08-01T16:00:00+00' },
  ];
  const { days } = groupIntoChapters({ frames: [shotAt('15:45')], blocks: withBackstage, tz: TZ });
  assert.equal(days[0]!.chapters[0]!.label, 'Post-ceremony photos',
    'the backstage window is where the portraits are taken; excluding it strands them');
});

test('a frame with no capture time is kept, not dropped', () => {
  const { days, undated } = groupIntoChapters({
    frames: [{ id: 'nodate', capturedAt: null }, shotAt('19:00')],
    blocks: BLOCKS, tz: TZ,
  });
  assert.equal(undated.length, 1, 'it must survive somewhere');
  assert.equal(days.flatMap((d) => d.chapters).flatMap((c) => c.frames).length, 1);
});

test('a multi-day event splits by venue day', () => {
  const frames = [
    { id: 'd1', capturedAt: '2026-08-01T11:00:00.000Z' }, // 19:00 Manila, 1 Aug
    { id: 'd2', capturedAt: '2026-08-01T17:00:00.000Z' }, // 01:00 Manila, 2 Aug
  ];
  const { days } = groupIntoChapters({ frames, blocks: [], tz: TZ });
  assert.deepEqual(days.map((d) => d.dayKey), ['2026-08-01', '2026-08-02'],
    'the venue day rolls at midnight IN MANILA, not at midnight UTC');
});

test('time-of-day names cover the whole clock', () => {
  const seen = new Set(Array.from({ length: 24 }, (_, h) => timeOfDayLabel(h)));
  assert.ok(seen.size >= 5, 'the labels must actually vary across a day');
});

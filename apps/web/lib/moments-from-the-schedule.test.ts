/**
 * Guard — a moment takes its name from the couple's own run-of-show.
 *
 * ⚠⚠ THE WALL-CLOCK TRAP IS THE POINT OF THIS SUITE.
 * `event_schedule_blocks.start_at` stores the VENUE'S WALL CLOCK in a
 * timestamptz column — prod holds `14:00+00` for a 2pm Manila ceremony — while a
 * photo's `captured_at` is a REAL INSTANT. Comparing them raw is out by the
 * venue offset (480 minutes in Manila) and files every afternoon photo under the
 * morning. This repo shipped that exact defect nine times in one day elsewhere.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { scheduleWindows, labelForCapture } from './moments-from-the-schedule';

const TZ = 'Asia/Manila';

/** A real Manila run-of-show, stored the way prod stores it: wall clock in a
 *  UTC-typed column. 2pm at the venue is written `14:00+00`. */
const BLOCKS = [
  { label: 'Getting ready', start_at: '2026-12-18T07:00:00+00:00', end_at: '2026-12-18T12:00:00+00:00' },
  { label: 'Ceremony',      start_at: '2026-12-18T14:00:00+00:00', end_at: '2026-12-18T15:00:00+00:00' },
  { label: 'Reception',     start_at: '2026-12-18T18:00:00+00:00', end_at: null },
];

/** 2:14pm IN MANILA, as a real instant — 06:14Z. This is what a camera stamps. */
const CEREMONY_SHOT = '2026-12-18T06:14:00Z';

test('a 2:14pm photo lands in the 2pm ceremony', () => {
  const w = scheduleWindows(BLOCKS, TZ);
  assert.equal(
    labelForCapture(CEREMONY_SHOT, w),
    'Ceremony',
    'the venue wall clock was compared against a real instant — every afternoon ' +
      'photo files under the morning, out by the venue offset',
  );
});

test('the raw comparison would have been wrong — proving the lift matters', () => {
  // Read raw, `14:00+00` IS 10pm in Manila — so the ceremony would appear to
  // start eight hours after it did, and the 2:14pm shot would fall outside it.
  const rawStart = Date.parse('2026-12-18T14:00:00+00:00');
  const lifted = scheduleWindows(BLOCKS, TZ).find((x) => x.label === 'Ceremony')!.startMs;
  assert.notEqual(lifted, rawStart, 'the block time was not lifted out of wall clock');
  // Manila is UTC+8, so 2pm AT THE VENUE is 06:00Z — EIGHT HOURS EARLIER than
  // the raw `14:00+00` the column literally holds. The sign is the whole bug:
  // read raw, the ceremony looks like it happened at 10pm.
  assert.equal(rawStart - lifted, 8 * 60 * 60 * 1000, 'Manila is UTC+8; the lift moves it 8 hours earlier');
});

test('a photo in no block keeps no name, rather than borrowing one', () => {
  // 4:30pm Manila — between the ceremony ending and the reception starting.
  assert.equal(labelForCapture('2026-12-18T08:30:00Z', scheduleWindows(BLOCKS, TZ)), null);
});

test('an open-ended block is closed by the next one, not left to swallow the day', () => {
  const w = scheduleWindows(
    [
      { label: 'Ceremony',  start_at: '2026-12-18T14:00:00+00:00', end_at: null },
      { label: 'Reception', start_at: '2026-12-18T18:00:00+00:00', end_at: null },
    ],
    TZ,
  );
  // 5:30pm Manila (09:30Z) is after the ceremony and before the reception.
  assert.equal(labelForCapture('2026-12-18T09:30:00Z', w), null,
    'the open ceremony block ran on and swallowed the gap');
  assert.equal(labelForCapture('2026-12-18T06:30:00Z', w), 'Ceremony');
});

test('the last open block runs a bounded time, never forever', () => {
  const w = scheduleWindows([{ label: 'Reception', start_at: '2026-12-18T18:00:00+00:00', end_at: null }], TZ);
  assert.equal(labelForCapture('2026-12-18T10:30:00Z', w), 'Reception'); // 6:30pm
  assert.equal(labelForCapture('2026-12-18T16:00:00Z', w), null,          // midnight
    'the last block never ends — a photo hours later still claims to be the reception');
});

test('a boundary photo belongs to the block that STARTS there', () => {
  const w = scheduleWindows(BLOCKS, TZ);
  // Exactly 3:00pm Manila = 07:00Z — the ceremony's end.
  assert.equal(labelForCapture('2026-12-18T07:00:00Z', w), null,
    'an end-inclusive window files every boundary photo in the moment that just finished');
});

test('unnamed and unparseable blocks are dropped, never guessed', () => {
  const w = scheduleWindows(
    [
      { label: '   ',       start_at: '2026-12-18T14:00:00+00:00', end_at: null },
      { label: 'Nonsense',  start_at: 'not-a-time',                end_at: null },
      { label: 'Ceremony',  start_at: '2026-12-18T14:00:00+00:00', end_at: null },
    ],
    TZ,
  );
  assert.equal(w.length, 1, 'a block that names nothing or cannot be placed was kept');
  assert.equal(w[0]!.label, 'Ceremony');
});

test('a photo with no capture time keeps no name', () => {
  assert.equal(labelForCapture(null, scheduleWindows(BLOCKS, TZ)), null);
});

/**
 * THE RECEIPT MUST STATE THE CLOCK THE SWEEP ENFORCES — AND NOTHING ELSE.
 *
 * ⚠⚠ WHAT A GREEN HERE MEANS, IN THE TEST'S OWN WORDS.
 * A pass means: THE WORDS THE RECEIPT RENDERS MATCH THE CONSTANT
 * `faceDataIsPastRetention` COMPARES AGAINST, and they branch correctly on the
 * face mode. That is all.
 *
 * A pass does NOT mean a real guest has ever seen this. Measured against
 * production on 2026-09-16: `guest_face_enrollments` = 0, `user_face_profiles`
 * = 0, `guests` with `photo_source='selfie'` = 0. NOBODY HAS ENROLLED A FACE.
 * Every input below is constructed by this file, so an assertion phrased as
 * "the receipt is correct for the enrolments we have" would pass on an empty
 * world and prove nothing. The assertions are therefore phrased against the
 * CONSTANT and against CONSTRUCTED dates, and each one that could go vacuous
 * carries a positive control that fails first if the detector is blind.
 *
 * A pass ALSO does not mean the deletion has ever happened. The
 * `face-data-retention` job is next due 2026-09-20 and has not yet recorded an
 * outcome. The receipt states what the code is written to do; that it DOES it
 * is a separate question this file cannot answer.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FACE_RECEIPT_GRACE_DAYS,
  faceDataApproxMonths,
  faceDataDeletionDay,
  faceDataPeriodPhrase,
  faceReceiptLines,
} from './face-receipt';
import { FACE_DATA_POST_EVENT_GRACE_DAYS } from './face-data-retention-core';
import { FULL_RES_POST_EVENT_GRACE_DAYS } from './papic-fullres-drop-core';
import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');

/**
 * Comments stripped, so a docblock explaining a rule can never satisfy it.
 * The ONE string-aware stripper — a hand-rolled regex here would blank real code
 * from the first `image/*` onward and then assert against the blank.
 */
function code(rel: string): string {
  return stripComments(readFileSync(join(WEB, rel), 'utf8'));
}

const WORDS = { eventWord: 'wedding', theOrganizer: 'the couple' } as const;
const body = (mode: 'mode_a' | 'mode_b', key: string, dates?: [string | null, string | null]) => {
  const lines = faceReceiptLines({
    faceMode: mode,
    ...WORDS,
    eventDate: dates?.[0] ?? null,
    eventEndDate: dates?.[1] ?? null,
  });
  const line = lines.find((l) => l.key === key);
  assert.ok(line, `no "${key}" line in the receipt — the four facts are the receipt`);
  return line.body;
};

// ── 1. THE CLOCK IS THE SWEEP'S CLOCK ───────────────────────────────────────

test('the receipt reads the same constant the deletion predicate does', () => {
  assert.equal(
    FACE_RECEIPT_GRACE_DAYS,
    FACE_DATA_POST_EVENT_GRACE_DAYS,
    'the receipt is quoting a period the sweep does not enforce — that is a written ' +
      'commitment nothing keeps, which is worse than saying nothing at all',
  );
  // And that constant is deliberately an ALIAS of the full-resolution floor, so
  // face data and photo originals cannot drift apart. Pinning it here means
  // re-pointing the receipt at some other number fails before it ships.
  assert.equal(
    FACE_DATA_POST_EVENT_GRACE_DAYS,
    FULL_RES_POST_EVENT_GRACE_DAYS,
    'face data and the full-resolution photo floor are one clock by design',
  );
});

test('the rendered period states that constant, in days, from the event’s LAST day', () => {
  const phrase = faceDataPeriodPhrase('wedding');
  assert.match(
    phrase,
    new RegExp(`\\b${FACE_DATA_POST_EVENT_GRACE_DAYS} days\\b`),
    `the period must print ${FACE_DATA_POST_EVENT_GRACE_DAYS} days, the figure the sweep compares against`,
  );
  assert.match(
    phrase,
    /last day of the wedding/,
    'the sweep measures from the event’s LAST day (its end date where it spans several ' +
      'days), so the receipt must say last day — "after the wedding" is a different clock',
  );
  // POSITIVE CONTROL for the matcher above: a wrong figure must fail it.
  assert.doesNotMatch(
    phrase,
    new RegExp(`\\b${FACE_DATA_POST_EVENT_GRACE_DAYS + 1} days\\b`),
    'the day matcher would accept any number — it is not testing anything',
  );
});

test('the month wording is COMPUTED from the day count, never typed', () => {
  assert.equal(faceDataApproxMonths(92), 3);
  // The one that proves it is arithmetic and not a literal: move the constant
  // and the English must move with it.
  assert.equal(faceDataApproxMonths(180), 6);
  assert.equal(faceDataApproxMonths(365), 12);
});

test('no surface types a duration of its own', () => {
  // Every file that renders the receipt, plus the module that writes it. A bare
  // month or day count here is a second source of truth for one fact — this
  // repo has paid for that shape twice in one week.
  const FILES = [
    'lib/face-receipt.ts',
    'app/[slug]/_components/face-receipt-card.tsx',
    'app/[slug]/_components/selfie-capture.tsx',
    'app/[slug]/_components/face-data-notice.tsx',
  ];
  const TYPED = /\b(?:3|three|92|ninety-two)\s*(?:months?|days?)\b/i;
  for (const rel of FILES) {
    const src = code(rel);
    assert.doesNotMatch(
      src,
      TYPED,
      `${rel} types a retention duration. It must be derived from ` +
        'FACE_DATA_POST_EVENT_GRACE_DAYS, or it will drift from the sweep the day the ' +
        'owner moves the period.',
    );
  }
  // POSITIVE CONTROL: the pattern must be able to see one.
  assert.match('deleted 3 months after the event', TYPED);
  assert.match('kept for 92 days', TYPED);
});

// ── 2. THE FOUR FACTS ───────────────────────────────────────────────────────

test('the receipt answers what, why, how long, and how to undo', () => {
  const keys = faceReceiptLines({ faceMode: 'mode_a', ...WORDS }).map((l) => l.key);
  assert.deepEqual(keys, ['collected', 'why', 'how_long', 'undo']);
});

test('“Deleting it removes no photo and no tag” is said in BOTH modes', () => {
  // The single sentence that decides whether a real person feels able to use
  // the removal control at all. Nothing in the sweep cascades into photos or
  // tags — face-data-retention-blast-radius.db.test.ts is what holds that true.
  for (const mode of ['mode_a', 'mode_b'] as const) {
    assert.match(
      body(mode, 'undo'),
      /removes no photo and no tag/,
      `${mode}: the receipt must say deleting the face data costs her no pictures`,
    );
  }
});

test('the undo line names the control that actually exists', () => {
  // withdrawFaceConsent, surfaced as this button in face-data-notice.tsx. A
  // receipt pointing at a control nobody built is the same defect one level up.
  const undo = body('mode_a', 'undo');
  assert.match(undo, /Remove my photo & face data/);
  const notice = code('app/[slug]/_components/face-data-notice.tsx');
  assert.match(
    notice,
    /Remove my photo &amp; face data/,
    'the button the receipt sends her to is gone or renamed — the receipt now points nowhere',
  );
});

// ── 3. THE WORDS FOLLOW THE PROCESSING ──────────────────────────────────────

test('a mode_b receipt never claims a face vector exists', () => {
  // faceVectorForMode hard-nulls the descriptor outside mode_a, and mode_b is
  // the fail-closed default. Telling a guest we hold a measurement of her face
  // when we hold none is false in the most alarming direction available.
  const collected = body('mode_b', 'collected');
  assert.doesNotMatch(collected, /a face vector measured from it/);
  assert.match(collected, /No face vector is measured/);
  assert.match(body('mode_b', 'why'), /No photo is matched to you by your face/);
});

test('a mode_a receipt names the vector and where the photos come from', () => {
  assert.match(body('mode_a', 'collected'), /face vector measured from it/);
  assert.match(body('mode_a', 'why'), /photos other guests take on their own phones/);
});

// ── 4. THE DATE ─────────────────────────────────────────────────────────────

test('the deletion day is the event’s LAST day plus the constant', () => {
  // A celebration that runs 1–3 January: the clock starts on the 3rd, not the 1st.
  const day = faceDataDeletionDay('2026-01-01', '2026-01-03');
  assert.equal(day, '5 April 2026');
  // Reading only the start date is the bug this pins — it would give 3 April.
  assert.notEqual(day, faceDataDeletionDay('2026-01-01', null));
  // No usable date → no date printed. It must NEVER guess one.
  assert.equal(faceDataDeletionDay(null, null), null);
});

test('the receipt prints the day only when it knows it', () => {
  const withDates = body('mode_a', 'how_long', ['2026-01-01', '2026-01-03']);
  assert.match(withDates, /That day is 5 April 2026\./);
  const without = body('mode_a', 'how_long');
  assert.doesNotMatch(
    without,
    /That day is/,
    'with no event dates the receipt must state the period and stop — a date it ' +
      'cannot compute is a date it must not print',
  );
});

// ── 5. IT IS ACTUALLY ON THE SCREEN ─────────────────────────────────────────

test('the receipt is mounted on the enrolment card AND on the after-the-fact notice', () => {
  // Shown once at the moment of consent and never again is not a receipt; and
  // reachable only afterwards is not a disclosure. Both, or this row is not done.
  for (const rel of [
    'app/[slug]/_components/selfie-capture.tsx',
    'app/[slug]/_components/face-data-notice.tsx',
  ]) {
    const src = code(rel);
    const mounts = src.match(/<FaceReceiptCard\b/g) ?? [];
    assert.equal(
      mounts.length,
      1,
      `${rel} mounts the receipt ${mounts.length} time(s) — expected exactly 1`,
    );
    assert.match(
      src,
      /<FaceReceiptCard[\s\S]{0,400}?faceMode=\{/,
      `${rel} renders the receipt without threading the face mode — it would describe ` +
        'processing this event may not do',
    );
  }
});

test('every enrolment surface reaches the receipt through SelfieCapture', () => {
  // The day-of landing, the hub and the Papic guest camera all mount
  // DayOfFaceEnroll, which mounts SelfieCapture; the Event Hub RSVP card mounts
  // SelfieCapture directly. One mount, four surfaces. If that stops being true
  // the receipt silently vanishes from a surface and nothing else notices.
  const enroll = code('app/[slug]/_components/day-of-face-enroll.tsx');
  assert.match(enroll, /<SelfieCapture\b/, 'the day-of enrol card no longer wraps SelfieCapture');
  for (const rel of [
    'app/[slug]/_components/site-body.tsx',
    'app/[slug]/hub/page.tsx',
    'app/papic/guest/_components/papic-guest-capture.tsx',
  ]) {
    assert.match(
      code(rel),
      /<DayOfFaceEnroll\b/,
      `${rel} no longer mounts DayOfFaceEnroll — an enrolment surface without the receipt`,
    );
  }
});

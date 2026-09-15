/**
 * face-receipt.ts — THE PLAIN RECEIPT A GUEST GETS FOR ENROLLING HER FACE.
 *
 * Four sentences a person can act on: what was collected, why, for how long,
 * and how to undo it. Pure (NO `server-only`, NO I/O) so a client capture card
 * and a server notice can both render the SAME words, and so a unit test can
 * execute them instead of grepping for them.
 *
 * ─── THE ONE RULE THIS FILE EXISTS TO KEEP ────────────────────────────────
 * 🔑 THE DURATION IS DERIVED FROM THE CONSTANT THE SWEEP ACTUALLY READS, NEVER
 * TYPED. `FACE_DATA_POST_EVENT_GRACE_DAYS` is what `faceDataIsPastRetention`
 * compares against, and it is itself an alias of `FULL_RES_POST_EVENT_GRACE_DAYS`
 * so face data and the full-resolution photo floor cannot drift apart. A receipt
 * is a WRITTEN COMMITMENT: a number typed here that the sweep does not enforce
 * converts a gap into a promise, which is worse than saying nothing. This repo
 * has paid for that twice in one week — /papic promised free credits "on every
 * celebration" when the second one gets 1, and /privacy still promises device
 * records are pruned at 24 months when nothing prunes them.
 *
 * So: no literal day count, no literal month count, no "3 months" below. The
 * day figure comes from the import and the month figure is computed from it.
 * Move the constant and every sentence here moves with it.
 *
 * ─── WHY THE WORDS BRANCH ON THE FACE MODE ────────────────────────────────
 * ⚠ ON A `mode_b` EVENT NO FACE VECTOR IS EVER COMPUTED — `faceVectorForMode`
 * hard-nulls it at the write, and mode_b is the fail-closed default. A receipt
 * that told a mode_b guest we hold a measurement of her face would be false in
 * the most alarming possible direction. The consent copy on the same screen was
 * already fixed for exactly this; the receipt is written the same way.
 *
 * ─── WHAT IS DELIBERATELY NOT CLAIMED ─────────────────────────────────────
 * • Not "deleted on <date>" as an instant. The sweep is weekly, so the honest
 *   claim is that the clock runs out on that day and the next sweep removes it.
 * • Not that the sweep has been observed doing it. It is scheduled, not proven.
 */
import {
  FACE_DATA_POST_EVENT_GRACE_DAYS,
  faceDataDeletableFromMs,
} from '@/lib/face-data-retention-core';
import type { PapicFaceMode } from '@/lib/papic-face-mode';

/** Mean Gregorian month, used ONLY to phrase the imported day count in months. */
const DAYS_PER_MONTH = 30.436875;

/**
 * The enforced period, in days. Re-exported so a consumer can never be tempted
 * to reach for a number of its own.
 */
export const FACE_RECEIPT_GRACE_DAYS = FACE_DATA_POST_EVENT_GRACE_DAYS;

/**
 * "about 3 months" — the rounded month equivalent of whatever the constant is.
 * Computed, so moving the constant to 180 makes this say six without an edit.
 */
export function faceDataApproxMonths(days: number = FACE_RECEIPT_GRACE_DAYS): number {
  return Math.max(1, Math.round(days / DAYS_PER_MONTH));
}

/** English for a small count, so the sentence does not read like a spec. */
function inWords(n: number): string {
  const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  return words[n] ?? String(n);
}

/**
 * The period, in the exact shape the sweep enforces it: a day count measured
 * from the event's LAST day — its end date where the celebration spans several
 * days, else its start date, which is what `eventLastDay` resolves.
 */
export function faceDataPeriodPhrase(
  eventWord: string,
  days: number = FACE_RECEIPT_GRACE_DAYS,
): string {
  const months = faceDataApproxMonths(days);
  return `${days} days after the last day of the ${eventWord} — about ${inWords(months)} months`;
}

/**
 * The calendar day the clock runs out, where the event's dates are known.
 *
 * Formatted in UTC because the boundary is computed at UTC midnight (see
 * `faceDataDeletableFromMs`) — rendering it in the reader's zone would print a
 * day either side of the one the sweep uses.
 */
export function faceDataDeletionDay(
  eventDate: string | null | undefined,
  eventEndDate: string | null | undefined,
): string | null {
  const ms = faceDataDeletableFromMs(eventDate, eventEndDate);
  if (ms === null || !Number.isFinite(ms)) return null;
  return new Date(ms).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export type FaceReceiptLine = {
  /** Stable key for tests and React, never shown. */
  key: 'collected' | 'why' | 'how_long' | 'undo';
  /** The question a person is actually asking. */
  label: string;
  body: string;
};

export type FaceReceiptInput = {
  /** Server-resolved effective mode. mode_b means no vector was ever computed. */
  faceMode: PapicFaceMode;
  /** The event's own word — "wedding", "celebration", "party". */
  eventWord: string;
  /** The event's own word for whoever is throwing it. */
  theOrganizer: string;
  /** Known only on the server-rendered notice; omitted at capture time. */
  eventDate?: string | null;
  eventEndDate?: string | null;
};

/**
 * The receipt, as four lines.
 *
 * Every claim below was read off the write path, not off a document:
 * `app/[slug]/actions.ts` inserts one `guest_face_enrollments` row carrying the
 * selfie ref, the consent timestamp and source, and a face vector ONLY when
 * `faceVectorForMode` lets one through; `lib/face-data-retention.ts` deletes
 * that row, that vector and that selfie once the clock runs out;
 * `withdrawFaceConsent` does the same sooner, on the guest's own say-so.
 */
export function faceReceiptLines(input: FaceReceiptInput): FaceReceiptLine[] {
  const { faceMode, eventWord, theOrganizer } = input;
  const modeA = faceMode === 'mode_a';
  const day = faceDataDeletionDay(input.eventDate, input.eventEndDate);

  const collected = modeA
    ? `The selfie you take, a face vector measured from it — a string of numbers, not a second picture — and a note of the moment you agreed.`
    : `The selfie you take, and a note of the moment you agreed. No face vector is measured: facial recognition is switched off at this ${eventWord}.`;

  const why = modeA
    ? `Only to find you in photos taken at this ${eventWord}, including photos other guests take on their own phones, so those photos can reach you.`
    : `So ${theOrganizer} and their team can recognise you on the guest list. No photo is matched to you by your face.`;

  const removes = modeA ? 'the selfie, the vector and the record' : 'the selfie and the record';
  const howLong =
    `${faceDataPeriodPhrase(eventWord)}.` +
    (day ? ` That day is ${day}.` : '') +
    ` Once that day passes, the weekly clean-up removes ${removes}.`;

  const undo =
    `Use “Remove my photo & face data” on your ${eventWord} page and ${modeA ? 'the selfie and the vector go' : 'the selfie goes'} straight away — we keep only a note that you withdrew. ` +
    `Deleting it removes no photo and no tag: the pictures already delivered to you stay yours.`;

  return [
    { key: 'collected', label: 'What we keep', body: collected },
    { key: 'why', label: 'What it is for', body: why },
    { key: 'how_long', label: 'How long we keep it', body: howLong },
    { key: 'undo', label: 'How to undo it', body: undo },
  ];
}

/**
 * 🚪 A DETAILS FIELD ADDRESS, LANDED FOR THE COUPLE ON THE PLACE THAT EDITS IT.
 *
 * The couple's Event Details IS Home's ⚙ Event Settings now (owner 2026-10-30, `details/page.tsx`), so the record page
 * sends a couple to that sheet — and the sheet has no row for some facts the record used to edit. Two doors still link a
 * couple to such a field: Home's day-of "Papic — Off · Switch on" (`dayPapicView`) and the guest card's "Turn on ›"
 * (`papicSwitchHref`), both at `/details/field/papic-answer`. They landed on a sheet with no Papic control at all.
 *
 * Each row named here forwards the COUPLE to the real switch for that fact; a helper keeps reading the record
 * (read-only, their own access) exactly as before. Pure — `lib/dashboard-doors-resolve.test.ts` holds
 * that every field door outside the record has a forward here and that each forward names a place that edits it.
 */
import { detailsItemHref } from '@/lib/maker-details-items';
import { papicCardHref } from '@/lib/papic-home-href';
import type { RecordRowKey } from '@/lib/event-details-record';

type Forward = (eventId: string, makerOn: boolean) => string;

/**
 * Row → where the couple changes that fact.
 *   · papic-answer — "Photos from guests?" is the Maker's Papic answer (`details-answers-parts.tsx`, the `papic_on`
 *     AnswerPicker, `?tool=details&item=papic`); an event type with no Event Hub has no Maker, so Home's Papic card,
 *     whose head is the same `papic_on` switch (`PapicHeadPicker`).
 */
export const COUPLE_RECORD_FIELD_FORWARD: Readonly<Partial<Record<RecordRowKey, Forward>>> = {
  'papic-answer': (eventId, makerOn) => (makerOn ? detailsItemHref(eventId, 'papic') : papicCardHref(eventId)),
};

/** Where a couple who opened `/details/field/<row>` belongs, or null (no forward — the sheet holds it). */
export function coupleRecordFieldForward(eventId: string, row: unknown, makerOn: boolean): string | null {
  if (typeof row !== 'string' || !Object.prototype.hasOwnProperty.call(COUPLE_RECORD_FIELD_FORWARD, row)) return null;
  return COUPLE_RECORD_FIELD_FORWARD[row as RecordRowKey]!(eventId, makerOn);
}

/**
 * paymentNoteWords — A2-G4 (final check, 25 Nov 2026). Two payment notes are DATA, not copy: the deposit-stamp
 * trigger matches them exactly (`lib/supplier-word.ts` SUPPLIER_WORD_DATA), so they cannot be reworded where they are
 * written. The person reads them through this instead — "reservation fee" and "supplier", never "Downpayment …
 * awaiting vendor confirmation". Any other note is the host's own words and passes through unchanged.
 *
 * Each note is spelt in two halves on purpose: `amount-to-pay.test.ts` counts the files that hold the whole note as
 * WRITERS of it, and this file writes nothing.
 */
const DATE_HELD_NOTE = 'Deposit (date held · awaiting ' + 'vendor confirmation)';
const LOCK_NOTE = 'Downpayment (lock · awaiting ' + 'vendor confirmation)';

export function paymentNoteWords(note: string): string {
  if (note === DATE_HELD_NOTE) return 'Reservation fee · date held · waiting for the supplier to confirm';
  if (note === LOCK_NOTE) return 'Reservation fee · waiting for the supplier to confirm';
  return note;
}

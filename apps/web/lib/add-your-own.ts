/**
 * add-your-own.ts — THE WORDS AND THE RULES OF "ADD YOUR OWN SUPPLIER"
 * (owner-approved 2026-10-10, approval 10; the contract is
 * `prototypes/suppliers_add_your_own_2026-10-10.html`, cases A1–A5).
 *
 * The first add is a FOUR-STEP WALK on a phone — Name · What they do · Contact
 * · Their link — and editing is the one form that already ships
 * (`NewManualVendorModal` in edit mode). Owner, same day: price and "already
 * booked?" are NOT steps in the first walk ("out").
 *
 * PURE and client-safe: the walk (`add-your-own-walk.tsx`), the connect panel
 * and the tests all read this one file, so the sentences cannot drift between
 * the sheet, the record and the guard.
 */

/** The four steps, in the order drawn. Their names are the progress line's. */
export const ADD_OWN_STEPS = ['Name', 'What they do', 'Contact', 'Their link'] as const;
export type AddOwnStep = 1 | 2 | 3 | 4;

/** "Step 2 of 4 · What they do" */
export function addOwnStepLine(step: AddOwnStep): string {
  return `Step ${step} of ${ADD_OWN_STEPS.length} · ${ADD_OWN_STEPS[step - 1]}`;
}

export const ADD_OWN_TITLE = 'Add your own supplier';
export const ADD_OWN_SUB = 'Someone you already talk to outside Setnayan.';

/** The heading over the name matches — the shop already exists here. */
export const ADD_OWN_MATCH_HEAD = 'Is it one of these?';
export const ADD_OWN_MATCH_TAIL = 'already on Setnayan';

/** A typed name shorter than this is not searched — the shipped search's own floor. */
export const ADD_OWN_SEARCH_MIN = 2;

/** "Nobody called “Tita Baby's Catering” in Catering yet — add them as your own." */
export function addOwnNobodyLine(name: string, categoryLabel: string): string {
  return `Nobody called “${name.trim()}” in ${categoryLabel} yet — add them as your own.`;
}

/** Step 1 with no name typed. */
export const ADD_OWN_NAME_ERROR = 'Type their name first.';

/**
 * Step 3: who they talk to, OR their mobile — one is enough (the prototype's
 * rule; `event_manual_vendors` has allowed either to be empty since
 * 20271259075750). Null = fine.
 */
export function addOwnContactError(who: string, mobile: string): string | null {
  return who.trim().length === 0 && mobile.trim().length === 0
    ? 'Add who you talk to, or their mobile.'
    : null;
}

/** The note under the link, and the toast after Done — the couple's record is not a booking. */
export function addOwnRecordNote(name: string): { lead: string; strong: string } {
  return { lead: `Until they join, what you write about ${name} is `, strong: 'your record, not a booking' };
}
export function addOwnDoneLine(name: string): string {
  return `You added ${name} — your record, not a booking`;
}
/** After "Yes — Inquire": the real shop was asked; no hand-made twin exists. */
export function addOwnAskedLine(name: string): string {
  return `Asked ${name} — now under Yours`;
}

/** The pill on the record sheet (edit mode). */
export const OWN_RECORD_PILL = 'Your record, not a booking';

/**
 * "Their claim link" — the words over the QR, wherever the link is shown (the
 * walk's last step, the record sheet, the card's Connect).
 */
export function claimLinkWords(vendorName: string): { heading: string; how: string; fileBase: string } {
  const name = vendorName.trim() || 'them';
  return {
    heading: 'Their claim link',
    how: `Show ${name} this or send the link. They sign up, fill in their own card and price, and it starts from what you wrote.`,
    // A file name a phone's gallery can show: letters, digits and dashes only.
    fileBase:
      `${(vendorName || 'supplier').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'supplier'}-setnayan-link`,
  };
}

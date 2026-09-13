/**
 * WHAT THE SUPPLIER IS TOLD AFTER THEY ANSWER A BOOKING ASK.
 *
 * 🔴 WHY THIS FILE EXISTS. `vendorAgreeToLock` / `vendorDeclineLock` end with
 * `redirect('/vendor-dashboard?lock_agree=<status>')`. Until this module, a grep
 * of the whole app for `lock_agree` returned exactly ONE hit — that redirect.
 * NOTHING READ IT. So every refusal the RPC can return landed as a page reload
 * with the request card still sitting there, and a supplier who pressed Agree
 * and was refused saw the same page, the same card, and no message at all.
 * Success is self-evident (the card disappears); every failure was
 * indistinguishable from a dead button.
 *
 * 🔑 THE STATUS LIST IS NOT HAND-KEPT. `vendor_agree_to_lock` and
 * `vendor_decline_lock` are the authority, and
 * `tests/db/every-lock-answer-has-a-sentence.db.test.ts` reads their REPLAYED
 * bodies, extracts every `jsonb_build_object('status', '<x>' …)` literal, and
 * fails if any of them has no sentence here. Add a status in SQL and the guard
 * tells you; it cannot go quiet.
 *
 * 🗣 PLAIN ENGLISH, AND ACTIONABLE. The reader is a shop owner, not an
 * engineer: every line says what happened and what they can do about it. No
 * status codes, no table names.
 */

/** Whether the notice is good news, a refusal, or a nothing-changed. */
export type LockAnswerTone = 'ok' | 'refused' | 'noop';

export type LockAnswerNotice = { tone: LockAnswerTone; text: string };

/** Extra facts the RPC hands back alongside a refusal. */
export type LockAnswerContext = {
  /** `resolve_others_first` — how many other couples are waiting on this date. */
  competing?: number | null;
};

const AGREE: Record<string, (ctx: LockAnswerContext) => LockAnswerNotice> = {
  ok: () => ({
    tone: 'ok',
    text: 'You took the booking. The couple has been told, and they will send you their payment details next.',
  }),
  already: () => ({
    tone: 'noop',
    text: 'You had already agreed to this one — nothing changed.',
  }),
  not_requested: () => ({
    tone: 'noop',
    text: 'There is nothing to answer here — this couple has not asked you to take the booking.',
  }),
  not_pending: () => ({
    tone: 'refused',
    text: 'This request is already closed, so it can no longer be agreed to. If they still want you, ask them to send the booking again.',
  }),
  expired: () => ({
    tone: 'refused',
    text: 'This request ran out of time before it was answered, so it has closed. If the couple still wants you, ask them to send it again.',
  }),
  group_taken: () => ({
    tone: 'refused',
    text: 'The couple has already booked someone else for this job, so the request is closed. Nothing you can do here.',
  }),
  resolve_others_first: (ctx) => ({
    tone: 'refused',
    text:
      (ctx.competing && ctx.competing > 0
        ? `${ctx.competing} other ${ctx.competing === 1 ? 'couple is' : 'couples are'} still waiting on you for that same date. `
        : 'Other couples are still waiting on you for that same date. ') +
      'Answer them first — take one or turn the rest down — then come back and agree to this one. Nobody should be left hanging.',
  }),
  slot_full: () => ({
    tone: 'refused',
    text: 'That time slot is already full on that date, so this booking cannot be added to it. Raise the slot\u2019s capacity in your calendar if you can take more, or turn this one down.',
  }),
  daily_limit_reached: () => ({
    // The card's own "Bookings per day" (vendor_services.daily_capacity) is
    // already used up on that date — counted by the same number the couple's
    // ask and the bench search use. No number is printed: the RPC decides it.
    tone: 'refused',
    text: 'That date already has as many bookings for this service as your “Bookings per day” allows, so this one cannot be added. If you can take more, raise “Bookings per day” on this service; if not, turn this one down so the couple can look elsewhere.',
  }),
  not_verified: () => ({
    tone: 'refused',
    text: 'Setnayan has not approved your shop yet, so a couple cannot book you. Finish your shop verification and this booking can go through.',
  }),
  fully_booked: () => ({
    // Mirrors the database's own HINT on `free_tier_booking_cap`, read out of
    // production: a free shop holds a fixed number of live bookings at once.
    // No number is printed here — the cap is decided in SQL and a second copy
    // of it would drift.
    tone: 'refused',
    text: 'You are holding as many live bookings at once as a free shop can. Finish one of your current events to free a slot, or move to a paid plan to take on more.',
  }),
  error: () => ({
    tone: 'refused',
    text: 'That did not go through. Nothing changed — please try again.',
  }),
};

const DECLINE: Record<string, (ctx: LockAnswerContext) => LockAnswerNotice> = {
  ok: () => ({
    tone: 'ok',
    text: 'You turned this booking down. The couple has been told, with your reason if you left one.',
  }),
  already: () => ({
    tone: 'noop',
    text: 'You had already turned this one down — nothing changed.',
  }),
  already_agreed: () => ({
    tone: 'refused',
    text: 'You already agreed to this booking, so it can no longer be turned down here. If you truly cannot do it, message the couple — cancelling a booking is their move to make.',
  }),
  not_requested: () => ({
    tone: 'noop',
    text: 'There is nothing to answer here — this couple has not asked you to take the booking.',
  }),
  not_pending: () => ({
    tone: 'refused',
    text: 'This request is already closed, so there is nothing left to turn down.',
  }),
  expired: () => ({
    tone: 'refused',
    text: 'This request ran out of time before it was answered, so it has closed on its own.',
  }),
  error: () => ({
    tone: 'refused',
    text: 'That did not go through. Nothing changed — please try again.',
  }),
};

/** Every status `vendor_agree_to_lock` can answer with, as this file knows them. */
export const LOCK_AGREE_STATUSES = Object.keys(AGREE);
/** Every status `vendor_decline_lock` can answer with, as this file knows them. */
export const LOCK_DECLINE_STATUSES = Object.keys(DECLINE);

/**
 * The sentence for an AGREE answer. An unknown status falls back to the generic
 * refusal rather than to silence — the whole defect this file fixes is a
 * refusal that says nothing, and a status nobody wrote a line for is still a
 * refusal the supplier has to be told about.
 */
export function lockAgreeNotice(
  status: string | null | undefined,
  ctx: LockAnswerContext = {},
): LockAnswerNotice | null {
  if (!status) return null;
  return (AGREE[status] ?? AGREE.error!)(ctx);
}

/** The sentence for a DECLINE answer. Same unknown-status rule as above. */
export function lockDeclineNotice(
  status: string | null | undefined,
  ctx: LockAnswerContext = {},
): LockAnswerNotice | null {
  if (!status) return null;
  return (DECLINE[status] ?? DECLINE.error!)(ctx);
}

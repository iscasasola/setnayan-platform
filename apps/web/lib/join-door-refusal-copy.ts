/**
 * apps/web/lib/join-door-refusal-copy.ts
 *
 * B1(b) — the join door must name the REAL reason it turned someone away.
 *
 * 🛑 THE LIE THIS FILE EXISTS TO KILL. `app/join/[eventId]/actions.ts` had two
 * gates guarding the join write: is the token itself valid, and — a SEPARATE
 * question, added later (2026-08-06) — is the event's effective visibility
 * `private`? Both redirected with the exact same `error=invalid_token`, so a
 * guest who scanned a perfectly good poster and typed a perfectly good token
 * was told:
 *
 *     "This invite link is no longer valid. Ask the couple to send you a
 *      fresh one."
 *
 * The link IS valid. The token IS valid. The event is private. Asking for "a
 * fresh one" sends the guest chasing a link that was never the problem, while
 * the actual fix — the host needs to open the event up, or send a personal
 * invite instead of the poster — never reaches anyone.
 *
 * This is the one place the refusal-reason → user-visible message mapping
 * lives for this door, so a reword can never quietly collapse the two reasons
 * back into one sentence. PURE + unit-testable. No DB, no I/O, no React.
 */

/** The event's own word for whoever is throwing it — see `event-words.ts`. */
export type JoinDoorOrganizerWords = {
  /** e.g. "the couple" · "the host" · "the family". */
  theOrganizer: string;
};

export const JOIN_DOOR_ERROR_KEYS = [
  'invalid_token',
  'event_is_private',
  'invalid_role',
  'missing_name',
  'already_member',
  'join_closed',
  'join_failed',
] as const;

export type JoinDoorErrorKey = (typeof JOIN_DOOR_ERROR_KEYS)[number];

/**
 * The refusal sentences, resolved from the event's own word for whoever is
 * throwing it (see `event-words.ts` for why there is no "host" fallback).
 *
 * `event_is_private` is its OWN code with its OWN sentence — never folded
 * back into `invalid_token`. A private event's guest is told the event is
 * private, not that their link died.
 */
export function joinDoorRefusalMessages(w: JoinDoorOrganizerWords): Record<JoinDoorErrorKey, string> {
  return {
    invalid_token: `This invite link is no longer valid. Ask ${w.theOrganizer} to send you a fresh one.`,
    event_is_private: `This celebration is set to private right now — ask ${w.theOrganizer} to make it visible, or to send you a personal invite instead.`,
    invalid_role: 'Please pick a valid role.',
    missing_name: `Please enter your name so ${w.theOrganizer} can find you on their list.`,
    already_member: "You're already on this event's guest list.",
    join_closed: `This event has reached its sign-up limit. Please ask ${w.theOrganizer} to add you.`,
    join_failed: `Something went wrong adding you. Please try again, or ask ${w.theOrganizer}.`,
  };
}

/** Look up one refusal sentence; an unrecognised key echoes itself back
 *  (matches the previous inline fallback in `join-flow.tsx`). */
export function joinDoorRefusalMessage(
  errorKey: string | null | undefined,
  w: JoinDoorOrganizerWords,
): string | null {
  if (!errorKey) return null;
  const messages = joinDoorRefusalMessages(w) as Record<string, string>;
  return messages[errorKey] ?? errorKey;
}

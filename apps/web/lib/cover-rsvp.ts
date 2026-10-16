/**
 * lib/cover-rsvp.ts — 🔘 THE COVER'S RSVP BUTTON: what it draws for this reader.
 *
 * Owner 2026-10-16, DECISION_LOG "THE COVER: WORDS IN THE UPPER PART, AN RSVP BUTTON AND A 'SWIPE UP' HINT AT THE FOOT" ·
 * "SHIMMER IS AN ANIMATE EFFECT FOR ANY TEXT · 'CONFIRM ATTENDANCE' IS THE RSVP" (verbatim: *"Confirm Attendance is
 * RSVP"*); approved prototype `Setnayan/prototypes/cover_scene_edit_animate_2026-10-16.html` (v2, f484bca7).
 *
 * The cover's foot button (hero el `rsvp`, Maker part "RSVP button") opens the SHIPPED Reply — the reply page, which
 * asks a visitor without a key for the passcode first — and reads the guest's own state, the Reply card's
 * (`replyCardOf`, `lib/guest-me-parts.ts`): before → the couple's words (default "Confirm attendance",
 * `HUB_RSVP_DEFAULT_WORDS`) · coming → "You're coming ✓ · Change" · can't → "You can't make it · Change" · a shut
 * window → its line, plain text, no frame, not pressable.
 *
 * Pure. No I/O, no React. Held by `lib/the-cover-has-its-rsvp-button.test.ts`.
 */
import type { ReplyCard } from './guest-me-parts';

/** What the cover's foot button draws for this reader. */
export type CoverRsvp =
  | { kind: 'ask' | 'going' | 'declined'; href: string }
  | { kind: 'closed' | 'not_yet'; line: string };

/** The words of the two answered states (the prototype's), and of a shut window. */
export const COVER_RSVP_GOING = 'You’re coming';
export const COVER_RSVP_DECLINED = 'You can’t make it';
export const COVER_RSVP_CHANGE = 'Change';
export const COVER_RSVP_CLOSED = 'Replies are closed';

/**
 * The button for a GUEST (from their Reply card — the page's one action, in its reply states) or a VISITOR without a
 * key (the shipped reply door, which asks for the passcode first). Null: no button (no reply on this page).
 */
export function coverRsvpOf(input: { card: ReplyCard | null; visitorHref?: string | null }): CoverRsvp | null {
  const c = input.card;
  if (c) {
    if (c.kind === 'closed') return { kind: 'closed', line: COVER_RSVP_CLOSED };
    if (c.kind === 'not_yet' || c.href === null) return { kind: 'not_yet', line: c.line };
    return { kind: c.kind, href: c.href };
  }
  return input.visitorHref ? { kind: 'ask', href: input.visitorHref } : null;
}

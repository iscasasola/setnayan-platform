/**
 * lib/cover-rsvp.ts — 🔘 THE COVER'S RSVP BUTTON: what it draws for this reader.
 *
 * Owner 2026-10-16, DECISION_LOG "THE COVER: WORDS IN THE UPPER PART, AN RSVP BUTTON AND A 'SWIPE UP' HINT AT THE FOOT" ·
 * "SHIMMER IS AN ANIMATE EFFECT FOR ANY TEXT · 'CONFIRM ATTENDANCE' IS THE RSVP" (verbatim: *"Confirm Attendance is
 * RSVP"*); approved prototype `Setnayan/prototypes/cover_scene_edit_animate_2026-10-16.html` (v2, f484bca7).
 *
 * The cover's foot button (hero el `rsvp`, Maker part "RSVP button") TAKES the reader to the page's RSVP part — the
 * Reply card under the cover (`COVER_RSVP_PART`, owner 2026-10-17), whose own button opens the shipped Reply — and reads
 * the guest's own state, the Reply card's
 * (`replyCardOf`, `lib/guest-me-parts.ts`): before → the couple's words (default "Confirm attendance",
 * `HUB_RSVP_DEFAULT_WORDS`) · coming → "You're coming ✓ · Change" · can't → "You can't make it · Change" · a shut
 * window → its line, plain text, no frame, not pressable.
 *
 * ✉️ …AND COMING WITH ANSWERS STILL MISSING → "You're coming ✓ · N more answers" (owner 2026-10-20, DECISION_LOG "THE
 * COVER'S REPLY BUTTON HAS THREE STATES"; "1 more answer" for one). N is the Reply card's `more` — the reply page's own
 * missing set (`moreAnswersOf`, lib/guest-one-path.ts), never a second count — and the tap OPENS the reply page, which
 * asks only those (owner: *"tap opens only the missing ones"*), rather than gliding to the card. Complete → "Change", as
 * shipped. Held by `lib/the-cover-counts-the-reply-pages-questions.test.ts`.
 *
 * Pure. No I/O, no React. Held by `lib/the-cover-has-its-rsvp-button.test.ts`.
 */
import type { ReplyCard } from './guest-me-parts';

/** What the cover's foot button draws for this reader. */
export type CoverRsvp =
  | { kind: 'ask' | 'going' | 'declined'; href: string; /** ✉️ 'going' only, > 0: the answers still owed. */ more?: number }
  | { kind: 'closed' | 'not_yet'; line: string };

/** The words of the two answered states (the prototype's), and of a shut window. */
export const COVER_RSVP_GOING = 'You’re coming';
export const COVER_RSVP_DECLINED = 'You can’t make it';
export const COVER_RSVP_CHANGE = 'Change';
export const COVER_RSVP_CLOSED = 'Replies are closed';

/**
 * The button for a GUEST (from their Reply card — the page's one action, in its reply states; `toPart`: an in-page link
 * to that card, `COVER_RSVP_PART`) or a canvas VISITOR (`visitorHref`, the reply door — which keeps only a reader holding
 * a guest pass: anyone else is sent back to the event page, `replyEntry`). Null: no button (no reply on this page).
 */
export function coverRsvpOf(input: { card: ReplyCard | null; visitorHref?: string | null; toPart?: boolean }): CoverRsvp | null {
  const c = input.card;
  if (c) {
    if (c.kind === 'closed') return { kind: 'closed', line: COVER_RSVP_CLOSED };
    if (c.kind === 'not_yet' || c.href === null) return { kind: 'not_yet', line: c.line };
    // ✉️ Answers still owed: straight to the reply page, which asks only those — never the glide to the card.
    if (c.kind === 'going' && c.more && c.more > 0) return { kind: 'going', href: c.href, more: c.more };
    return { kind: c.kind, href: input.toPart ? `#${COVER_RSVP_PART}` : c.href };
  }
  return input.visitorHref ? { kind: 'ask', href: input.visitorHref } : null;
}

/**
 * 🧭 THE RSVP PART OF THE PAGE — where the cover's button TAKES the reader (owner 2026-10-17, on live cale-ice: *"confirm
 * attendance is not doing anything?"* · *"it is not going to the RSVP part?"*). The Reply card under the cover carries
 * this id; the button on the cover (`toPart`) is an in-page link to it: the cover lifts away and the page moves down to
 * the card, whose own button opens the shipped Reply. With no script it is a plain jump to the same place.
 *
 * Why the button no longer opens the reply page straight away: the reply page keeps only a reader who holds a guest pass
 * for this event (`replyEntry`, lib/guest-pass-hop.ts) — anyone else (the HOST on their own page, a guest whose pass went
 * missing) is sent back to `/{slug}` with a 307, so the tap reloaded the very cover it was pressed on. Measured on live
 * 2026-10-17: `GET /cale-ice/invite/reply` → 307 → `/cale-ice`.
 */
export const COVER_RSVP_PART = 'site-reply';

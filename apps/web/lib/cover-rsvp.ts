/**
 * lib/cover-rsvp.ts — 🔘 THE COVER'S RSVP BUTTON: what it draws for this reader.
 *
 * Owner 2026-10-16, DECISION_LOG "THE COVER: WORDS IN THE UPPER PART, AN RSVP BUTTON AND A 'SWIPE UP' HINT AT THE FOOT" ·
 * "SHIMMER IS AN ANIMATE EFFECT FOR ANY TEXT · 'CONFIRM ATTENDANCE' IS THE RSVP" (verbatim: *"Confirm Attendance is
 * RSVP"*); approved prototype `Setnayan/prototypes/cover_scene_edit_animate_2026-10-16.html` (v2, f484bca7).
 *
 * The cover's foot button (hero el `rsvp`, Maker part "RSVP button") OPENS THE RSVP PAGE — the reply form itself, one
 * tap (owner 2026-10-26, verbatim: *"instead of jumping to will you join us? (REPLY) make it go directly to the RSVP
 * Page"*; it used to stop at the page's RSVP part first — `COVER_RSVP_PART`, below) — and reads the guest's own state,
 * the Reply card's
 * (`replyCardOf`, `lib/guest-me-parts.ts`): before → the couple's words (default "Confirm attendance",
 * `HUB_RSVP_DEFAULT_WORDS`) · coming → "You're coming ✓ · Change" · can't → "You can't make it · Change" · a shut
 * window → its line, plain text, no frame, not pressable.
 *
 * ✉️ …AND COMING WITH ANSWERS STILL MISSING → "You're coming ✓ · N more answers" (owner 2026-10-20, DECISION_LOG "THE
 * COVER'S REPLY BUTTON HAS THREE STATES"; "1 more answer" for one). N is the Reply card's `more` — the reply page's own
 * missing set (`moreAnswersOf`, lib/guest-one-path.ts), never a second count — and the tap opens the reply page, which
 * asks only those (owner: *"tap opens only the missing ones"*). Complete → "Change", to the same reply page. Held by
 * `lib/the-cover-counts-the-reply-pages-questions.test.ts`.
 *
 * Pure. No I/O, no React. Held by `lib/the-cover-has-its-rsvp-button.test.ts` and, on the real page, by
 * `app/[slug]/_components/the-cover-rsvp-reaches-its-action.test.ts`.
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
 * The button for a GUEST or the HOST on their own page (from their Reply card — the page's one action, in its reply
 * states: its `href` is the reply page, `inviteReplyPath`) or a canvas VISITOR (`visitorHref`, the reply door). Null: no
 * button (no reply on this page). Every pressable state opens the reply page itself — never a mark on this page.
 */
export function coverRsvpOf(input: { card: ReplyCard | null; visitorHref?: string | null }): CoverRsvp | null {
  const c = input.card;
  if (c) {
    if (c.kind === 'closed') return { kind: 'closed', line: COVER_RSVP_CLOSED };
    if (c.kind === 'not_yet' || c.href === null) return { kind: 'not_yet', line: c.line };
    // ✉️ Answers still owed: the reply page, which asks only those.
    if (c.kind === 'going' && c.more && c.more > 0) return { kind: 'going', href: c.href, more: c.more };
    return { kind: c.kind, href: c.href };
  }
  return input.visitorHref ? { kind: 'ask', href: input.visitorHref } : null;
}

/**
 * 🧭 THE RSVP PART OF THE PAGE — the Reply card under the cover (a page that is one scroll, and the host's own page)
 * carries this id. From 2026-10-17 the cover's button was an in-page link to it (with a glide), because the reply page
 * then sent anyone without a guest pass for this event — the HOST on their own page — back to `/{slug}` with a 307
 * (measured on live: `GET /cale-ice/invite/reply` → 307 → `/cale-ice`). Since 2026-10-24 the reply page replies as
 * exactly whom the Event Hub is viewing as (`readReplyIdentityForEvent` — a signed-in host's OWN row, or a plain "you
 * are not on the list", `NoReplyHere`), so the stop went (owner 2026-10-26: *"make it go directly to the RSVP Page"*):
 * the button opens the reply page, and the card stays, for a reader who scrolls to it.
 */
export const COVER_RSVP_PART = 'site-reply';

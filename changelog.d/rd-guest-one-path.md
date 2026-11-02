## 2026-09-25 · fix(guest): one path for an invited guest — form then sign-up, or sign-up then form

Owner: *"the process should be: Fillup your form. and sign up. or sign up then a form must still
be completed. The link process must be easy to understand and manoeuvered."* · *"When a new
account is created via an event must be simple and easy."* Built on the shipped mechanisms
(`event_members.guest_id`, `linkGuestSessionToUser`, `connectEventForUser`,
`sendEventAccountMagicLink`, `RsvpWidget`/`RsvpSheet`, `submitRsvp`, `JoinFlow`, the three
doors). Decisions live in `lib/guest-one-path.ts` and `lib/signup-landing.ts`, pinned by
`lib/guest-one-path.test.ts`.

- **Form first, then sign up — one address, one press.** The reply form's email IS the sign-up
  on BOTH the `/{slug}` sheet and the Reply door: an unticked *"Keep this invitation on my phone ·
  I agree to the Terms"* box beside it, and the same Save emails the sign-in link
  (`submitRsvp` → `sendKeepLinkOnce`). The sheet used to save the address and send nothing, and a
  second box then asked for it again. The Terms agreement is recorded on the new account.
- **One account prompt.** `GuestAccountCard` replaces the second email box, the "Link to account"
  chip, the "Keep this event for good" note and the "box near the top" notes: *This is me — keep
  this invitation in my account* → *Check your email* → *Linked to <email> ✓*. The host pitch
  shows only after linking, as one quiet line.
- **Sign up first, then the form.** Google/Apple, magic link and `/signup?ref=guest` all return
  through `/join/{id}/connect`, which lands an unanswered guest AT the reply (`/{slug}#your-details`).
- **A signed-in guest on a new device sees their own invitation** — `/{slug}` answers from the
  account's seat when the cookie does not name the event (also ends the second-event
  `wrong_event` dead end); the Save accepts the same viewer; the pass is written to the browser on
  mount by `adoptSeatSessionAction` (never on render, never behind a link).
- **An account made from an invitation (owner "1. yes")** skips the You card and couple
  onboarding, gets no "your couple account is ready" welcome email, and takes its display name
  from the seat. Decided by the event-connect return, not the 120-second `isBrandNewAccount` clock.
- Signed-in `JoinFlow` offers "Continue as <name>" instead of a blank name box; an existing guest
  member goes straight to `/{slug}`. `PrivateLanding` gets a "Sign in" link. `selfJoinAction`
  refusals return to `/{slug}/invite` (or `/{slug}` when private), and its dead `email` read is gone.
- 📱 The reply sheet follows the phone keyboard (`visualViewport`) and scrolls a focused field
  into view; new controls are ≥ 44px.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-25 row "THE GUEST'S ONE PATH SHIPS" — records owner item 8
("1. yes") and REFINES L3839 "the email IS the login": the sign-in link is now sent only when the
guest ticks the keep/Terms box (sending it creates an account). Flagged for owner sign-off.

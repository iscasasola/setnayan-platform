## 2026-10-22 · feat(first-run): one Terms tick for every sign-up door · the event-type grid opens first · a birthday asks the name once

Owner, 22 Oct, on `prototypes/journey_fixes_2026-10-22.html`: *"Yes to all"* — Host 1 option B, Host 3 option B, Host 6.

- **Host 1 — one Terms tick above Google, Apple and email** (`/signup`). The clickwrap box (unticked, required)
  now sits ABOVE the Google / Apple buttons as well as the email form (`form=` still posts it with the email form).
  Google / Apple are dimmed until it is ticked; pressing one unticked nudges the box ("Tick the Terms first.").
  Ticked, the tick is carried through the provider round trip as an httpOnly cookie that the server sets only from an
  affirmative posted tick (`app/auth/terms-carry-action.ts`, `SIGNUP_TERMS_COOKIE`). `/auth/callback` records it on
  an account with no agreement on record and spends the cookie. A new Google / Apple account that ticked no longer
  sees the full-screen "One quick thing" re-ask; an account without the stamp still does. The "By continuing with
  Google or Apple…" line (browsewrap, recorded nothing) is gone from /signup. **OAuth `state` was not usable**:
  Supabase's auth server owns `state` on the provider leg, and our callback only receives `?code=` and the
  `redirectTo` query (anyone can type a URL). The desktop loopback never reaches the callback, so it records the tick
  itself after sign-in through the existing `acceptTermsNow`. The phone app's Google / Apple code is untouched (the
  gate wraps it from outside). One exported server action was freed for the carry by deleting the uncalled
  `setGuestRole` wrapper (the count stays 1225 / 1225).
- **Host 3 — "Para kanino ito?" is no longer a step.** "+ New event" opens on the type grid, sorted for You. A
  "For · You ▾" dropdown (the shipped `PickMenu`) appears above the grid only when the account has a loved one on
  file; picking a row re-sorts the grid in place. Rows: You · Your own event / each loved one · the shipped
  "Loved one · person" line / Someone else · Show me everything. The expander reads "Planning for someone else?
  **Show all event types**" and still shows only when something is hidden.
- **Host 6 — a birthday asks the celebrant's name once.** On the "A few details" screen the Celebrant field is shown
  as "Celebrant · Lola Rosa  Change" when it is the name already given; Change goes back to the "Who are we
  celebrating?" screen. The birthday's Event name example is its own ("Lola Rosa turns 80", or "<name> turns <age>"
  from what the flow knows), never the hangout's "Movie night sa bahay".

Guards: `app/signup/one-tick-covers-every-door.test.ts`, `create-event/the-grid-opens-first.test.ts`,
`lib/onboarding/asked-once.test.ts`; `every-signup-door-agrees.test.ts` and `lib/one-oauth-wording.test.ts` learn the
`form=` / `TermsFirst` mechanism (not weakened — each still fails on an unticked, missing or misplaced box).

SPEC IMPACT: `DECISION_LOG.md` row 2026-10-22 (Host 1 option B · Host 3 option B · Host 6) — the three rulings on
`prototypes/journey_fixes_2026-10-22.html`, recorded with the OAuth-`state` finding.

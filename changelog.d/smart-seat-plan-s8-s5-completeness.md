## 2026-07-08 · feat(events): complete account auto-surface opt-out + notice mechanism, still FLAG-OFF (Smart Seat-Plan · S8, #7b G5/G6)

Closes the two S5 completeness gaps — still entirely behind
`FEATURE_ACCOUNT_AUTOSURFACE` (default OFF), so inert in prod.

- **G5 — Leave affordance.** `fetchUserEvents` now surfaces `auto_surfaced`;
  a new flag-gated `AutoSurfacedEvents` section on the account home lists
  auto-surfaced events with a one-tap **Leave** (server action
  `leaveAutoSurfacedEvent`, already shipped). Rendered only when the flag is on,
  so **zero extra query** on the account page while off. Second "no" path (RSVP
  decline) stays handled DB-side by `hide_autosurfaced_on_decline`.
- **G6 — RA 10173 notice mechanism.** New `notification_type` enum value
  `event_auto_surfaced` (migration `20270525559914`, additive/idempotent) + the
  surface fn now check-then-inserts the membership and `emitNotification`s the
  "you were added" notice — only when NEWLY surfaced (no re-notify). The notice
  **copy lives in one `AUTOSURFACE_NOTICE` constant marked COUNSEL SIGN-OFF
  REQUIRED**; PH counsel must approve it before the flag is enabled.

Typecheck + lint clean. Still counsel-gated: turning the feature on needs counsel
to approve the notice copy AND flip `FEATURE_ACCOUNT_AUTOSURFACE`.

SPEC IMPACT: Completes the #7b opt-out + notice plumbing for `02_Specifications/Smart_Seat_Planning_Guest_Reactive_2026-07-08.md`; the notice copy remains the one counsel-defined piece. Corpus already carries the spec.

## 2026-09-11 · fix(onboarding): the "wedding in planning" refusal no longer strands the couple

A couple whose account already has a wedding in planning saw the correct
message ("You already have a wedding in planning…") beside a button labelled
"Go to my dashboard" — but on the terminal onboarding screen that button was
still wired to the commit CTA, so pressing it just re-asked the server, which
can only ever answer `wedding_exists` again. The couple was stuck on the
screen forever with no way forward (owner report 2026-09-11, screenshot).

- `apps/web/app/onboarding/wedding/actions.ts`: `commitOnboardingWedding` now
  reads the existing in-planning wedding's event id off the same guard row it
  already fetches (`getInPlanningWedding`) and returns it as
  `existingEventId` on the `wedding_exists` refusal, instead of discarding it.
- `apps/web/app/onboarding/wedding/_components/onboarding-shell.tsx`:
  `handleFinish` now remembers the refusal in a `weddingExists` state. Once
  set, every "finish" CTA on this screen (Purchase Now, continue free, "Go to
  my dashboard", the bottom bar's commit button) navigates straight to that
  wedding's dashboard (or `/dashboard` when the id wasn't available) instead
  of re-committing. The unsaved onboarding draft is left untouched — the
  couple can still put the other wedding away and come back to finish this
  one. Never mints a second wedding (owner-locked one-wedding rule,
  2026-07-12).
- `apps/web/app/onboarding/[type]/_components/generic-onboarding.tsx`: the
  same dead end existed for event types with no honoree field to
  disambiguate with (a `life_event_exists` refusal with nowhere to route
  back to) — same fix, `blockedTerminal` state, CTA navigates to the
  blocking event's dashboard.
- New source guard:
  `apps/web/app/onboarding/wedding/_components/wedding-exists-cta-navigates.test.ts`
  — fails if either CTA is ever rewired back onto the commit call without a
  navigating early-return guard, or if the guard runs after (not before) the
  commit call.

SPEC IMPACT: None — this is a bug fix against the already-locked one-wedding
/ one-life-event-per-type rules (2026-07-12, 2026-07-17); no rule changed.

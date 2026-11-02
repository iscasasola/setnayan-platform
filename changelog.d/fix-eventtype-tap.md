## 2026-06-28 · fix(create-event): event-type tap now scrolls its name form into view

The create-event "what kind of event" photo picker (`event-type-picker.tsx`)
felt "not clickable" for the event types that have no tailored onboarding yet
(debut, gender_reveal, birthday, celebration, travel, corporate, tournament,
christening — `onboarding_href` NULL in `event_type_vocab`). Tapping one set
`selectedKey` and mounted the inline "Event name" form BELOW the full-bleed
photo deck; on a phone that's past the fold with no scroll, so the tap produced
no visible change.

- `event-type-picker.tsx` — on select, `scrollIntoView({block:'center'})` the
  inline form and focus the name field (`preventScroll` so focus doesn't fight
  the smooth scroll). Replaced the input's `autoFocus` (which only fired on
  mount and didn't scroll) with the explicit ref-driven focus.

Context surfaced to owner (no code change here): only `wedding` (/onboarding/
wedding) and `simple_event` (/onboarding/simple) have a tailored onboarding. The
other 8 enabled types have a BUILT-but-DARK generic onboarding at
`/onboarding/[type]` gated behind `NEXT_PUBLIC_EXPERIENCE_QUIZ_ENABLED`. The
backing migration (events.experience_persona/for_whom/axes) is ALREADY APPLIED
in prod, so go-live is now a single env flip + redeploy — but that same flag
also reshapes the LIVE wedding funnel (swaps the vendor-category picker screens
for the experience quiz), so it stays an explicit owner go-live decision.

SPEC IMPACT: None — UX hardening of an existing fallback path; no schema/SKU/pricing/flow change.

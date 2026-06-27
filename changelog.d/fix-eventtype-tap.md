## 2026-06-28 · fix(create-event): event-type tiles are now single-tap clickable

The create-event "What kind of event" photo picker felt "all not clickable":
the full-page `EventTypePhotoPicker` was a TWO-STEP picker — a tap on any
off-center photo only re-centered it, and only the already-centered photo
actually began (2026-06-04 behavior). So tapping any tile that wasn't dead-center
did nothing visible. (The in-chrome add-event carousel already committed on any
tap; only this picker was two-step.)

- `event-type-photo-picker.tsx` — `onTap` now commits on a single tap of ANY
  enabled tile: snap it to center for continuity, then `onSelect` (which
  navigates). Swipe still browses without committing. Footer hint updated to
  "tap any photo to begin". This revises the 2026-06-04 "only the centered photo
  is clickable" directive — flagged to owner.
- `event-type-picker.tsx` — defensive hardening of the inline name-form fallback
  (scroll it into view + focus on select). This path is only reached when
  `NEXT_PUBLIC_EXPERIENCE_QUIZ_ENABLED` is OFF; it's on in prod today, but the
  fallback should never feel dead if the flag is ever flipped off.

Verified live: the experience-quiz flag is ALREADY `true` in prod (set 6d ago,
built since), so all 9 enabled event types already route to a real onboarding
(`/onboarding/wedding`, `/onboarding/simple`, `/onboarding/[type]` for the rest —
confirmed `/onboarding/birthday` renders "Let's plan your birthday"). No env or
schema change needed; this PR is purely the picker tap fix.

SPEC IMPACT: None — picker interaction fix; no schema/SKU/pricing/flow change.

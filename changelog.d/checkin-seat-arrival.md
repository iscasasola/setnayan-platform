### 2026-06-22 — Day-of seat pass greets the guest on arrival (check-in → bloom)

Closes a flywheel gap: until now a guest's day-of check-in (`guest_checkins`)
only fed the planner's "arrived" counter — the guest's own seat pass never
reacted. Now, for an identified guest in the live/post (day-of) window, their
seat surface reads whether they've checked in and celebrates the arrival with a
warm, personalized bloom.

- **Read-side:** `apps/web/app/[slug]/page.tsx` reads `guest_checkins.checked_in_at`
  for this guest+event via the admin/service client (RLS on `guest_checkins` is
  couple/coordinator/admin-only, so a guest session can't read it directly).
  Gated to `dayOfPhase ∈ {live, post}`; graceful-degrade on `42P01`/`42703` (and
  any unexpected error) → falls back to the normal pre-arrival seat pass.
  `guestArrived` threads into `GuestHubData.arrived`.
- **UI:** new `apps/web/app/[slug]/_components/arrival-greeting.tsx` (`ArrivalGreeting`)
  renders "Welcome, {firstName}. You're checked in — you're at {table}." with a
  one-shot champagne bloom. `YourSeatBlock` swaps its neutral header for the
  greeting + a champagne-gradient card when `arrived`; the `GuestHubCard` seat
  tile blooms + greets when checked in AND seated. Before check-in, both stay the
  normal seat pass.
- **Motion:** pure CSS keyframes `.sn-arrival-bloom` + `.sn-arrival-ring` in
  `apps/web/app/globals.css`; the global `prefers-reduced-motion: reduce` block
  freezes them to their end-state instantly (reduced-motion guests get the warm
  copy with no movement). All new guest-facing text is `text-xs`+ (≥12px), above
  the legibility floor.
- Read-side + UI only. No migration, no new check-in writer (check-in already
  happens at the kiosk/coordinator desk).

SPEC IMPACT: 0031 day-of / 0008 seating — the guest's seat pass now blooms and
greets on arrival when they've checked in, closing the
check-in → day-of-experience gap.

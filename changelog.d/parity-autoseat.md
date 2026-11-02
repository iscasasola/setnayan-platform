## 2026-06-26 · feat(seating-3d): 2D→3D parity phase 2a — Auto-seat in the 3D lab

The audit's recommended keystone: the single biggest parity gap. An "Auto-seat"
button in the 3D lab's build toolbar fills every unseated guest.

- Runs the SAME canonical solver as the 2D editor — server-side `autoSeatGuests`
  (→ `computeAutoSeat`, tier + priority + keep-apart aware) — so there's **zero
  drift** and no re-implemented client solver.
- State-sync (the audit's flagged risk): after the action, a **one-shot
  `seatResyncRef`** re-derives the lab's local `seats` map from the refreshed
  server truth on the next `guests` prop change — without clobbering ordinary
  optimistic edits (which never arm the ref). `deriveSeatsFromGuests` is now a
  shared helper used by both the initial state and the resync.
- Composes with the existing **"Walk everyone in"** crowd animation — auto-seat,
  then watch the guests walk to their seats (the "+ animations" payoff).

Next parity phases (per the audit roadmap): assignGroup / unassignGuest /
seatRoleAtTable (reuse this fill pattern) · table label + link/unlink · floor
sizing · keep-apart rules + priority tiers.

SPEC IMPACT: 0008 Seating — 3D lab gains auto-seat (parity phase 2a).

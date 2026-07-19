## 2026-07-08 · feat(seating): auto-seating toggle + capacity-shortfall banner (Smart Seat-Plan · S6)

Smart Seat-Plan guest-reactive program, **PR S6** — makes the Phase 5/6 behavior
visible and controllable, entirely on the seating **page** (no change to the
seating editor).

- **Auto-seating toggle** — a pill in the seating page header flips
  `events.seating_autoplace_enabled` (new server action `setSeatingAutoplace`,
  couple-scoped). On = new/re-roled guests get a provisional seat; Off = seating
  stays a manual Auto-Arrange/drag action. Plain server-action form, no client JS.
- **Capacity-shortfall banner** — when non-declined guests exceed total effective
  seats, a banner nudges the couple to add tables ("N guests but only M seats"),
  since reconcile can only seat guests it has chairs for. Surfaces the `needsTable`
  signal from S2 at the couple level.

Typecheck + lint clean. No schema change (reuses the S3 flag column).

SPEC IMPACT: Implements the S3 follow-up UI (autoplace toggle + needs-a-table surface) from `02_Specifications/Smart_Seat_Planning_Guest_Reactive_2026-07-08.md`. Corpus already carries the spec.

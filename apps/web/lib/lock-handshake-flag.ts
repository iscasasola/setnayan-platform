/**
 * Lock-handshake feature flag (Explore_Replan_BUILD_SPEC_2026-07-27.md §7).
 *
 * ─── What the flag moves ─────────────────────────────────────────────────
 * The owner ruled on 2026-07-27 that a couple's Lock is a **REQUEST**, and the
 * booking is only real when the VENDOR accepts the payment:
 *
 *   couple locks → vendor agrees → vendor sends payment request →
 *   couple pays + screenshot → **vendor accepts payment → SCHEDULE LOCKED**
 *
 * Two things hang off that last step, and this flag moves both:
 *   1 · the **syncing fee** ("billed alongside accepting"), and
 *   2 · the **schedule-pool acquire** — the reservation itself.
 *
 * ─── Why it needs its own flag ───────────────────────────────────────────
 * `NEXT_PUBLIC_BOOKING_FEE_ENABLED` answers "may we bill at all", and it is
 * ARMED IN PROD (owner set it 2026-07-27; ONE key, not two — see
 * `booking-fee-lock.server.ts`). It cannot also answer "bill at WHICH step":
 * flipping it off to move the trigger would switch billing off entirely.
 *
 * So the two questions stay separate, and the composition is:
 *   fee ENABLED + handshake OFF → charge at LOCK      (today's shipped behaviour)
 *   fee ENABLED + handshake ON  → charge at ACKNOWLEDGE (the 2026-07-27 ruling)
 *   fee DISABLED + either       → charge nowhere
 *
 * With this flag OFF, every lock path bills exactly where it bills today and
 * the acknowledge path is a pure no-op — so the move is reversible by env var,
 * which is what a live-money change requires.
 *
 * ⚠ THE TRIGGER HAS BEEN RULED ON FIVE TIMES. Ruling 4 (2026-07-24) put it at
 * the lock and IS what the code does today; ruling 5 (2026-07-27, the handshake
 * row) moves it to vendor payment-acceptance and is what this flag turns on.
 * Confirmed on 2026-08-04 that no ruling 6 exists — the only later fee rows
 * (2026-08-03) restate the RATE (5% then 1%) and the "Setnayan holds no money"
 * posture, neither of which touches the trigger. Re-check the log before
 * assuming this is still current.
 */
export function isLockHandshakeEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_LOCK_HANDSHAKE_ENABLED;
  return v === 'true' || v === '1' || v === 'TRUE';
}

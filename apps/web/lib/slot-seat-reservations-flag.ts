/**
 * slot-seat-reservations-flag.ts — the NEXT_PUBLIC flag that opens table
 * reservations ("Setnayan holds the reservation", owner 2026-08-01).
 *
 * NEXT_PUBLIC so the couple-facing availability UI and the server action agree
 * on whether the surface exists at all. Default OFF: with the flag down, no
 * reserve/cancel call is ever issued and the shipped tier-#3 lock path behaves
 * exactly as it does today.
 *
 * The flag gates the SURFACE, not the safety. The DB guard (the per-(slot x
 * date) ledger + its CHECK) is unconditional — flipping this flag can expose a
 * reservation UI, it can never expose an unguarded one.
 *
 * Kept in its own file so the logic module stays I/O-free and tsx --test-able.
 */
export function areSlotSeatReservationsEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_TABLE_RESERVATIONS_ENABLED;
  return v === '1' || v === 'true';
}

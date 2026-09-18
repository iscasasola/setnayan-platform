import { envFlagEnabled } from '@/lib/env-flag';

/**
 * Venue-door throttle — feature flag. SHIPS OFF.
 *
 * Gates the per-connection throttle in `lib/venue-door-throttle.ts` on the three
 * doors that mint a Supabase ANONYMOUS session for someone standing at an event:
 * the Papic crew-seat claim, the Panood camera claim, and the Live Studio
 * guest-pick tap. OFF (unset, and every unrecognised value) ⇒ those three paths
 * are byte-identical to before the throttle existed — the throttle is never
 * called, so it cannot refuse anyone and never writes a limiter row.
 *
 * ⚖ WHY IT IS OFF — an OPEN OWNER DECISION, not an unfinished build.
 * "The seat-claim trade" (owner decision 2, 2026-09-18): is a scarce,
 * single-claim, event-scoped token plus a venue-sized throttle a sufficient lock
 * on these doors, given the token is already checked with the admin client and
 * captcha is a second lock on the same door? The guest-list join door already
 * made exactly that trade (`lib/join-door-throttle.ts`). Flipping this flag is
 * part of the owner's answer, not an engineering call.
 *
 * Server-only (no `NEXT_PUBLIC_`): every reader is a server action. One reader,
 * enforced by `lib/flag-chokepoint-scan.test.ts`.
 */
export function venueDoorThrottleEnabled(): boolean {
  return envFlagEnabled(process.env.VENUE_DOOR_THROTTLE_ENABLED);
}

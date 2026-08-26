import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * GIVE BACK THE CREDITS A CAPTURE RESERVED BUT NEVER USED — AND SAY SO IF IT FAILS.
 *
 * 🚨 THE DEFECT THIS EXISTS FOR. Both capture paths reserved credits, and when
 * the row then failed to land they released them like this:
 *
 *     .then(() => undefined, () => undefined)
 *
 * 🔑 SUPABASE DOES NOT THROW — IT RESOLVES WITH `{ error }`. So the second
 * handler almost never ran, and the FIRST one discarded a real failure. A
 * revoked grant, a replaced function signature, a lock wait: the credits stayed
 * spent, the photo did not exist, and **nothing anywhere knew**. The couple is
 * charged for a photo they do not have, in silence.
 *
 * ⚠ BEST-EFFORT IS STILL RIGHT — IT IS *SILENT* THAT WAS WRONG. A failed
 * release must never break a camera mid-wedding: the capture already failed,
 * and turning that into a thrown error would take the shutter down too. So this
 * still never throws. It just stops being invisible.
 *
 * 🔑 ONE CALL, BOTH HALVES. The dedicated and pool figures are passed back
 * exactly as the reserve returned them — which is the whole reason the reserve
 * returns them. Do not re-derive either: the balance has already moved, and a
 * second read cannot tell "spent its last credit" from "never had any".
 */
export async function releaseCaptureCredits(
  admin: SupabaseClient,
  args: {
    seatId: string | null;
    /**
     * ⚠ NULLABLE ON PURPOSE. The seat path carries the event id as
     * `string | null` — it is captured alongside the reserve figures, and on
     * the branch where nothing was reserved it was never set. A release with no
     * event to release against is a no-op, not a runtime error, so this widens
     * rather than forcing a non-null assertion at the call site. An `!` there
     * would be the same claim with none of the handling.
     */
    eventId: string | null;
    dedicatedSpent: number;
    poolSpent: number;
    /** Where this ran, so a failure names the path that lost the credits. */
    callSite: string;
  },
): Promise<{ released: boolean }> {
  const { seatId, eventId, dedicatedSpent, poolSpent, callSite } = args;

  // Nothing was reserved, or nothing to release it against ⇒ nothing to give
  // back. Not a failure, and not something to log: no credits moved.
  if (!eventId) return { released: true };
  if (!(dedicatedSpent > 0 || poolSpent > 0)) return { released: true };

  try {
    const { error } = await admin.rpc('papic_release_capture_split', {
      p_seat_id: seatId,
      p_event_id: eventId,
      p_dedicated_spent: dedicatedSpent,
      p_pool_spent: poolSpent,
    });
    if (error) {
      // ⚠ 'will_throw' is deliberate even though this does not throw: the
      // severity describes the CONSEQUENCE, and the consequence is that a
      // person has been charged for a photo that does not exist. A
      // graceful_degrade line reads as "we coped", and we did not.
      logQueryError(
        callSite,
        error,
        { event_id: eventId, seat_id: seatId, dedicated_spent: dedicatedSpent, pool_spent: poolSpent },
        'will_throw',
      );
      return { released: false };
    }
    return { released: true };
  } catch (e) {
    logQueryError(
      callSite,
      e,
      { event_id: eventId, seat_id: seatId, dedicated_spent: dedicatedSpent, pool_spent: poolSpent },
      'will_throw',
    );
    return { released: false };
  }
}

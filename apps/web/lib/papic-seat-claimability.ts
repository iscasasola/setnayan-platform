import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Resolve whether a claim token points at a CLAIMABLE seat — without an account. Admin client (a visitor can't read
 * paparazzi_seats under RLS); returns a verdict only, never seat data. Moved here from `app/papic/actions.ts` (final
 * check, 25 Nov) so the claim PAGE can ask it on arrival too:
 *
 *   · A4-B03 — "Claim your photo-crew seat · Start shooting" was drawn for a token that opens nothing; only the press
 *     found out. The page now shows the dead link at once (and the retryable notice when the read was refused).
 */
export type SeatClaimability = 'claimable' | 'taken' | 'invalid' | 'unreadable';

export async function seatClaimability(token: string): Promise<SeatClaimability> {
  try {
    const admin = createAdminClient();
    const { data: seat, error } = await admin
      .from('paparazzi_seats')
      .select('claimer_user_id, revoked_at')
      .eq('claim_qr_token', token)
      .maybeSingle();
    if (error) {
      console.error('[supabase-error] lib/papic-seat-claimability.ts · from:paparazzi_seats.select', error);
      return 'unreadable';
    }
    if (!seat) return 'invalid';
    if (seat.revoked_at) return 'invalid';
    if (seat.claimer_user_id) return 'taken';
    return 'claimable';
  } catch {
    return 'unreadable';
  }
}

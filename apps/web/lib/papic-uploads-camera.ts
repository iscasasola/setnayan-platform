import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { PAPIC_UPLOADS_CAMERA_INDEX } from '@/lib/papic-cameras';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * The couple's UPLOADS camera — the seat "Add to your library" (and, since
 * 2026-10-03, the Kwento scrapbook page) saves through. Lifted out of the Papic
 * studio page so both screens ask the same question the same way.
 *
 * `token` is handed out ONLY to the user who claimed the seat; anybody else
 * (a coordinator, the other partner before they claim) gets `claimed: false`
 * and no token. A refused read is logged and reads as not-claimed — the screen
 * then offers to claim, which is the safe direction (claiming is idempotent).
 */
export async function readCoupleUploadsCamera(
  admin: SupabaseClient,
  eventId: string,
  userId: string,
  callSite: string,
): Promise<{ token: string | null; claimed: boolean }> {
  const { data: up, error } = await admin
    .from('paparazzi_seats')
    .select('claim_qr_token, claimer_user_id')
    .eq('event_id', eventId)
    .eq('seat_index', PAPIC_UPLOADS_CAMERA_INDEX)
    .is('revoked_at', null)
    .maybeSingle();
  if (error) {
    logQueryError(callSite, error, { eventId }, 'graceful_degrade');
    return { token: null, claimed: false };
  }
  if (!up) return { token: null, claimed: false };
  const claimed = !!up.claimer_user_id && up.claimer_user_id === userId;
  return { token: claimed ? ((up.claim_qr_token as string) ?? null) : null, claimed };
}

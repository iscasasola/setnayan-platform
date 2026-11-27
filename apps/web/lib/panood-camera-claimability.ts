import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Resolve whether a claim token points at a CLAIMABLE camera — without an account. Runs on the admin client because
 * an unauthenticated visitor can't read panood_camera_operators under the control-room-only RLS. Returns only a
 * verdict (never camera data); the claim action uses it to decide whether to mint a login-free anonymous session, so
 * an invalid/taken/reissued (or bot-prefetched) link never leaks an orphan anon identity. Mirrors seatClaimability()
 * in app/papic/actions.ts.
 *
 * What a Live Watch camera link can do right now — the ONE reading, shared by the join page (on arrival) and the
 * claim action (on the press). Moved here from `app/panood/actions.ts` (final check, 25 Nov):
 *
 *   · A4-B03 — the page greeted a token that opens nothing as "You're invited to operate a camera" and asked for a
 *     sign-in first; it now asks this on arrival and shows the dead link at once.
 *   · A4-10 — a refused read was folded into 'invalid' ("This link isn't active"); it is 'unreadable' now, and both
 *     doors say "we couldn't check — your link is probably fine".
 */
export type CameraClaimability = 'claimable' | 'taken' | 'invalid' | 'unreadable';

export async function cameraClaimability(token: string): Promise<CameraClaimability> {
  try {
    const admin = createAdminClient();
    const { data: cam, error } = await admin
      .from('panood_camera_operators')
      .select('claimer_user_id, revoked_at, status')
      .eq('claim_qr_token', token)
      .maybeSingle();
    if (error) {
      console.error('[supabase-error] lib/panood-camera-claimability.ts · from:panood_camera_operators.select', error);
      return 'unreadable';
    }
    if (!cam) return 'invalid';
    if (cam.revoked_at || cam.status === 'revoked') return 'invalid';
    if (cam.claimer_user_id) return 'taken';
    return 'claimable';
  } catch {
    return 'unreadable';
  }
}

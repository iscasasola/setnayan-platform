'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { clientIp } from '@/lib/client-ip';
import { rateLimit } from '@/lib/rate-limit';
import { normalizePairCode, pairCodeUsable, canUseVenueScreens } from '@/lib/live-screens';
import { resolveBroadcastWindow } from '@/lib/live-studio-window-server';
import {
  LIVE_SCREEN_COOKIE_MAX_AGE_SECONDS,
  LIVE_SCREEN_COOKIE_NAME,
  signLiveScreenToken,
} from '@/lib/live-screen-session';

/**
 * Pair a venue screen (DAY-12). Anonymous by design: the device is a TV, not a
 * person. What stands in for a login is a short code the couple's controller
 * issued, which is:
 *   • single-use — pairing clears it, guarded by `.eq('pairing_code', code)`,
 *     so two devices racing the same code cannot both win;
 *   • short-lived — LIVE_SCREEN_CODE_TTL_MS;
 *   • throttled per client address below (best-effort, per instance — see
 *     lib/rate-limit.ts's own honest limitation). ~30 bits per code and a
 *     handful of live codes at any moment keep online guessing impractical.
 *
 * Reads and writes run on the service-role client because the table's RLS is
 * couple/coordinator-only and a TV has no session. The only row it can reach
 * is the one whose live code was typed.
 *
 * ENTITLEMENT (owner ruling 2026-09-20, lib/live-screens.ts): screens come
 * WITH the paid Live Studio unlock. Checked here too, not only in the
 * controller's `addLiveScreen` — a code minted while entitled can still be
 * sitting unused when the entitlement lapses (a comp grant revoked, an order
 * refunded), and a TV must never be able to claim one for a locked event.
 */

const ATTEMPTS_PER_WINDOW = 10;
const WINDOW_MS = 10 * 60 * 1000;

export async function pairLiveScreen(formData: FormData): Promise<void> {
  const h = await headers();
  const ip = clientIp(h) ?? 'unknown';
  if (!rateLimit(`live-screen-pair:${ip}`, ATTEMPTS_PER_WINDOW, WINDOW_MS).ok) {
    redirect('/live?error=slow');
  }

  const code = normalizePairCode(formData.get('code'));
  if (!code) redirect('/live?error=code');

  const admin = createAdminClient();
  const { data: row, error: readError } = await admin
    .from('panood_screens')
    .select('id, event_id, pairing_code, pairing_expires_at, revoked_at')
    .eq('pairing_code', code)
    .is('revoked_at', null)
    .maybeSingle();
  if (readError) {
    console.error('[supabase-error] app/live/actions.ts · pairLiveScreen read', readError);
    redirect('/live?error=down');
  }
  const found = row as {
    id: number;
    event_id: string;
    pairing_code: string | null;
    pairing_expires_at: string | null;
    revoked_at: string | null;
  } | null;
  if (!found || !pairCodeUsable(found, Date.now())) redirect('/live?error=code');

  const broadcastWindow = await resolveBroadcastWindow(admin, found.event_id);
  if (!canUseVenueScreens({ liveStudioActive: broadcastWindow.multiCam })) redirect('/live?error=locked');

  const pairedAt = new Date().toISOString();
  const { data: claimed, error: writeError } = await admin
    .from('panood_screens')
    .update({
      paired_at: pairedAt,
      pairing_code: null,
      pairing_expires_at: null,
      status: 'online',
      last_seen_at: pairedAt,
      updated_at: pairedAt,
    })
    .eq('id', found.id)
    .eq('pairing_code', code)
    .is('revoked_at', null)
    .select('id, event_id, paired_at');
  if (writeError) {
    console.error('[supabase-error] app/live/actions.ts · pairLiveScreen claim', writeError);
    redirect('/live?error=down');
  }
  // Zero rows = another device used this code a moment earlier. Say so.
  const won = (claimed ?? [])[0] as { id: number; event_id: string; paired_at: string } | undefined;
  if (!won) redirect('/live?error=code');

  const token = await signLiveScreenToken({
    screen_id: won.id,
    event_id: won.event_id,
    paired_at: won.paired_at,
  });
  if (!token) redirect('/live?error=down');

  const jar = await cookies();
  jar.set({
    name: LIVE_SCREEN_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/live',
    maxAge: LIVE_SCREEN_COOKIE_MAX_AGE_SECONDS,
  });

  redirect('/live/screen');
}

/** Forget this device's pairing (the "use a different code" link). */
export async function forgetLiveScreen(): Promise<void> {
  const jar = await cookies();
  jar.set({ name: LIVE_SCREEN_COOKIE_NAME, value: '', path: '/live', maxAge: 0 });
  redirect('/live');
}

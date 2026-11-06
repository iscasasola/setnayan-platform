import 'server-only';

/**
 * lib/home-booth-card.server.ts — WHAT HOME'S VIDEO BOOTH CARD READS (owner 2026-10-23, approved
 * `prototypes/home_service_widgets_2026-10-23.html` frame 8): reels in the last 24 h against the soft cap (the booth's
 * own count — `patiktok_render_jobs` enqueued in the last 24 h, `PATIKTOK_VIDEO_SOFT_CAP`), the renders kept, and the
 * TikTok account when one is linked.
 *
 * 🔒 HONEST — the prototype's NEW guard: the booth page computes `submissionsMeasured` and then draws 0 over a refusal
 * ("40 left"). The card does not: either count refused → `{ ok: false }`, "couldn't load". A refused TikTok read is
 * `tiktok: 'unread'`, never "Connect" (which would offer to link an account they already linked).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { PATIKTOK_VIDEO_SOFT_CAP } from '@/lib/patiktok';
import { getTiktokOAuthConfig } from '@/lib/patiktok-tiktok';

export type HomeBoothCardRead =
  | { ok: false }
  | {
      ok: true;
      today: number;
      cap: number;
      renders: number;
      /** The TikTok account — null when TikTok posting is not set up on Setnayan, 'unread' when its read was refused. */
      tiktok: { handle: string | null } | 'none' | 'unread' | null;
    };

export async function readHomeBoothCard(supabase: SupabaseClient, eventId: string, owned: boolean): Promise<HomeBoothCardRead> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const tiktokReady = owned ? await getTiktokOAuthConfig().then((c) => c.ready, () => false) : false;
  const [todayRes, allRes, grantRes] = await Promise.all([
    supabase.from('patiktok_render_jobs').select('job_id', { count: 'exact', head: true }).eq('event_id', eventId).gte('enqueued_at', since),
    supabase.from('patiktok_render_jobs').select('job_id', { count: 'exact', head: true }).eq('event_id', eventId),
    tiktokReady
      ? supabase.from('patiktok_oauth_grants').select('tiktok_handle').eq('event_id', eventId).is('revoked_at', null).maybeSingle()
      : Promise.resolve(null),
  ]);
  if (todayRes.error || todayRes.count === null || allRes.error || allRes.count === null) return { ok: false };
  return {
    ok: true,
    today: todayRes.count,
    cap: PATIKTOK_VIDEO_SOFT_CAP,
    renders: allRes.count,
    tiktok: !grantRes
      ? null
      : grantRes.error
        ? 'unread'
        : grantRes.data
          ? { handle: (grantRes.data as { tiktok_handle: string | null }).tiktok_handle ?? null }
          : 'none',
  };
}

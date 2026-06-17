/**
 * Iteration 0011 Panood — live-broadcast orchestration (server-side only).
 *
 * The DB/token layer for the "upgraded" Panood, sitting on top of the pure
 * YouTube Data API helpers in lib/panood-youtube.ts (the same split as
 * lib/drive-copy.ts over lib/papic-drive.ts). The broadcast state lives in the
 * server-only `panood_broadcasts` table (the stream key is a secret, like an
 * oauth_grants refresh_token), and the public watch URL round-trips through the
 * existing events.panood_watch_url column so the event-page embed is reused.
 *
 * THIS MODULE IS SERVER-SIDE ONLY. Never import from a client component.
 */

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getYoutubeOAuthConfig,
  refreshYoutubeAccessToken,
} from '@/lib/panood-youtube';

const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // refresh within 5 min of expiry

/**
 * Read the event's YouTube access token from oauth_grants(provider='youtube'),
 * refreshing it when missing or within 5 minutes of expiry. Mirrors
 * getEventDriveAccessToken (lib/drive-copy.ts) exactly — including the
 * connection_health write so a Google-side revoke surfaces as 'needs_reauth'
 * (for a future Panood reconnect banner) instead of silently failing. This is
 * the token source for every live-broadcast API call.
 *
 * Returns null when there is no active grant, the OAuth env is unset, or the
 * refresh fails (caller should prompt a reconnect).
 */
export async function getEventYoutubeAccessToken(
  eventId: string,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data: grant } = await admin
    .from('oauth_grants')
    .select(
      'grant_id, refresh_token, access_token, access_token_expires_at, revoked_at',
    )
    .eq('event_id', eventId)
    .eq('provider', 'youtube')
    .maybeSingle();
  if (!grant || grant.revoked_at) return null;

  const expiresAt = grant.access_token_expires_at
    ? new Date(grant.access_token_expires_at as string).getTime()
    : 0;
  if (grant.access_token && expiresAt > Date.now() + TOKEN_REFRESH_THRESHOLD_MS) {
    return grant.access_token as string;
  }

  const cfg = getYoutubeOAuthConfig();
  if (!cfg.ready) return null;

  try {
    const refreshed = await refreshYoutubeAccessToken({
      refreshToken: grant.refresh_token as string,
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
    });
    const newExpiresAt = new Date(
      Date.now() + refreshed.expires_in * 1000,
    ).toISOString();
    await admin
      .from('oauth_grants')
      .update({
        access_token: refreshed.access_token,
        access_token_expires_at: newExpiresAt,
        last_refreshed_at: new Date().toISOString(),
        connection_health: 'ok',
      })
      .eq('grant_id', grant.grant_id);
    return refreshed.access_token;
  } catch {
    // Google rejected the refresh_token (revoked in the couple's Google
    // security settings, or a password reset). Flag it for the reconnect prompt.
    await admin
      .from('oauth_grants')
      .update({ connection_health: 'needs_reauth' })
      .eq('grant_id', grant.grant_id);
    return null;
  }
}

/** A Panood broadcast row, minus the secret stream_key (for general reads). */
export type PanoodBroadcast = {
  id: number;
  broadcast_id: string;
  stream_id: string;
  ingestion_url: string;
  status: 'ready' | 'testing' | 'live' | 'complete' | 'errored';
  scheduled_start_at: string | null;
  went_live_at: string | null;
  ended_at: string | null;
};

/**
 * The active (non-complete) broadcast for an event, if any — WITHOUT the secret
 * stream key. Server-only (admin client); the setup page reads this to decide
 * which control state to render.
 */
export async function getActivePanoodBroadcast(
  eventId: string,
): Promise<PanoodBroadcast | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('panood_broadcasts')
    .select(
      'id, broadcast_id, stream_id, ingestion_url, status, scheduled_start_at, went_live_at, ended_at',
    )
    .eq('event_id', eventId)
    .neq('status', 'complete')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as PanoodBroadcast | null) ?? null;
}

/**
 * The active broadcast's stream key — read ONLY when the couple explicitly
 * reveals it (the encoder-setup card). Kept out of getActivePanoodBroadcast so
 * the secret never rides along in general renders. Server-only.
 */
export async function getActivePanoodStreamKey(
  eventId: string,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('panood_broadcasts')
    .select('stream_key')
    .eq('event_id', eventId)
    .neq('status', 'complete')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.stream_key as string | undefined) ?? null;
}

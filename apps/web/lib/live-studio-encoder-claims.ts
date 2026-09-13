/**
 * S8 — the hosted-channel half of "the stream key, two sources, one Rust sink"
 * (build-sessions/encoder/S8.md). Server-side only.
 *
 * THREAT MODEL (stated once, here, for both API routes that use this module):
 * the operator can always obtain their own stream key — nothing stops someone
 * from typing OBS's own "Reveal" flow on a browser tab that isn't the desktop
 * app. What THIS module protects against is XSS / a compromised third-party
 * script on setnayan.com reading a Setnayan-HELD (hosted-channel) key out of
 * React state or a JSON IPC payload the renderer can see. The durable
 * mitigation underneath it is unrelated to this nonce: a key scoped to ONE
 * broadcast, deleted from YouTube (`deleteYoutubeStream` in panood-youtube.ts)
 * the moment that broadcast completes, so a key that did leak stops being
 * useful within one YouTube API call of the couple pressing "End broadcast".
 *
 * FLOW:
 *   1. The webview (host, authenticated) calls `mintEncoderClaim` — this is the
 *      ONLY thing that ever crosses into React state / the Tauri IPC boundary
 *      on the hosted-channel path. It is a single-use, 60s-TTL, CSPRNG token
 *      bound to (event, broadcast, requesting user). Never the key itself.
 *   2. The Rust process takes ONLY that token and calls
 *      `POST /api/live-studio/encoder/exchange` over its own reqwest/rustls TLS
 *      connection (never through the Tauri IPC channel — the whole point is
 *      that the renderer never sees the response). `exchangeEncoderClaim`
 *      backs that route: it deletes the claim row it reads (single-use,
 *      regardless of outcome — mirrors the YouTube OAuth callback's state-token
 *      handling in api/oauth/youtube/callback/route.ts), then resolves the
 *      bound `panood_broadcasts` row for the real ingestion URL + key.
 *
 * DSK-3 — `rtmpsUrl` IS NOW THE TLS ADDRESS, AND `rtmpsBackupUrl` CAN BE REAL.
 * This block used to say the backup was "always null today… a real, separate
 * gap (worth its own follow-up)". That follow-up is this: `panood_broadcasts`
 * now carries `rtmps_ingestion_url` and `rtmps_backup_ingestion_url`, both
 * writers persist them, and `resolveEncoderIngest` picks between them below.
 *
 * What has NOT changed: a row created before DSK-3, or one YouTube gave no TLS
 * address for, still resolves to the plain-RTMP `ingestion_url` and a null
 * backup. Null still means NO BACKUP and is still never invented — the encoder
 * treats it correctly (`ingest_for_attempt` stays on the primary when
 * `has_backup` is false), and a fabricated backup host is a wedding published to
 * a server that was never provisioned.
 */

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getActivePanoodBroadcast } from '@/lib/panood-broadcast';
import { generateYoutubeStateToken } from '@/lib/panood-youtube';
import { resolveEncoderIngest } from '@/lib/live-studio-hosted-ingest';

const CLAIM_TTL_MS = 60_000; // matches the migration's `expires_at` default

export type EncoderClaim = {
  claimToken: string;
  expiresAt: string;
};

/**
 * Mint a single-use claim nonce for the event's currently active broadcast.
 * Returns null when there is no active (non-complete) broadcast to bind to —
 * the caller (the claim API route) turns that into a 409, not a 500: it is an
 * ordinary race (the couple ended the broadcast in the same instant they
 * clicked "connect encoder"), not a server fault.
 */
export async function mintEncoderClaim(
  eventId: string,
  requestedBy: string,
): Promise<EncoderClaim | null> {
  const admin = createAdminClient();
  const active = await getActivePanoodBroadcast(eventId);
  if (!active) return null;

  const claimToken = generateYoutubeStateToken();
  const { error } = await admin.from('live_studio_encoder_claims').insert({
    claim_token: claimToken,
    event_id: eventId,
    broadcast_id: active.id,
    requested_by: requestedBy,
  });
  if (error) return null;

  return {
    claimToken,
    expiresAt: new Date(Date.now() + CLAIM_TTL_MS).toISOString(),
  };
}

export type ExchangedStreamKey = {
  rtmpsUrl: string;
  rtmpsBackupUrl: string | null;
  streamKey: string;
};

/**
 * Consume a claim nonce and resolve it to the real encoder credentials.
 * Deletes the claim row it reads REGARDLESS of outcome (single-use even on a
 * failure path — an expired or already-consumed token must not become
 * retryable). Returns null for: unknown token, expired token, or a broadcast
 * that is no longer active (ended between mint and exchange).
 */
export async function exchangeEncoderClaim(
  claimToken: string,
): Promise<ExchangedStreamKey | null> {
  const admin = createAdminClient();

  const { data: row } = await admin
    .from('live_studio_encoder_claims')
    .select('broadcast_id, created_at, expires_at')
    .eq('claim_token', claimToken)
    .maybeSingle();
  if (!row) return null;

  // Single-use: delete on read, before any further validation, so a token that
  // fails the TTL or broadcast check below cannot be retried either.
  await admin.from('live_studio_encoder_claims').delete().eq('claim_token', claimToken);

  const claim = row as { broadcast_id: number; expires_at: string };
  if (new Date(claim.expires_at).getTime() < Date.now()) return null;

  const { data: broadcast } = await admin
    .from('panood_broadcasts')
    .select(
      'ingestion_url, rtmps_ingestion_url, rtmps_backup_ingestion_url, stream_key, status',
    )
    .eq('id', claim.broadcast_id)
    .maybeSingle();
  if (!broadcast) return null;
  const b = broadcast as {
    ingestion_url: string;
    rtmps_ingestion_url: string | null;
    rtmps_backup_ingestion_url: string | null;
    stream_key: string;
    status: string;
  };
  if (b.status === 'complete') return null;

  // DSK-3 — the TLS pair when this broadcast has one, the plain-RTMP primary
  // when it does not. The fallback direction lives in `resolveEncoderIngest`
  // (and is tested there) rather than as a `??` here, because getting it wrong
  // is silent both ways: too timid and a wedding goes out on 1935 behind a hotel
  // firewall; too eager on the BACKUP and the encoder alternates to an address
  // YouTube never provisioned.
  const ingest = resolveEncoderIngest(b);

  return {
    rtmpsUrl: ingest.rtmpsUrl,
    rtmpsBackupUrl: ingest.rtmpsBackupUrl,
    streamKey: b.stream_key,
  };
}

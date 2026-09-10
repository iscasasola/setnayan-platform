/**
 * S5 — the token that authorizes a Tauri `encoder_start` call
 * (build-sessions/encoder/S5.md § ACL).
 *
 * WHY THIS EXISTS, AND HOW IT DIFFERS FROM live-studio-encoder-claims.ts (S8):
 * that module hands the Rust process the REAL hosted-channel stream key. This
 * module authorizes nothing about the stream KEY — it authorizes the Tauri
 * COMMAND CALL itself. `capabilities/default.json` grants
 * `allow-encoder-{start,config,push,stop}` under the EXISTING `remote.urls`
 * capability for setnayan.com, and that capability is scoped to an ORIGIN, not
 * to a session: any XSS on setnayan.com could otherwise call `encoder_start`
 * directly. So `encoder_start(token)` requires a server-minted, single-use
 * token bound to (user, event, broadcast) before Rust will hold the session
 * open for `encoder_config`/`encoder_push`/`encoder_stop` — true for BOTH the
 * own-channel (Part A — no `live_studio_encoder_claims` row ever exists on
 * this path) and hosted-channel (Part B) tiers, which is exactly why this
 * cannot just be a widened claims table.
 *
 * FLOW:
 *   1. The webview (host, authenticated) calls `mintEncoderToken` via
 *      `POST /api/live-studio/encoder/token` — single-use, 60s-TTL, CSPRNG.
 *   2. Rust's `encoder_start` takes ONLY that token and calls
 *      `POST /api/live-studio/encoder/token/verify` over its own reqwest/rustls
 *      connection (never through the Tauri IPC channel). `verifyEncoderToken`
 *      backs that route: it deletes the row it reads (single-use, regardless
 *      of outcome — same shape as `exchangeEncoderClaim`), then confirms the
 *      bound `panood_broadcasts` row is still active before authorizing.
 */

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getActivePanoodBroadcast } from '@/lib/panood-broadcast';
import { generateYoutubeStateToken } from '@/lib/panood-youtube';

const TOKEN_TTL_MS = 60_000; // matches the migration's `expires_at` default

export type EncoderToken = {
  token: string;
  expiresAt: string;
};

/**
 * Mint a single-use authorization token for the event's currently active
 * broadcast. Returns null when there is no active (non-complete) broadcast to
 * bind to — the caller (the token API route) turns that into a 409, not a
 * 500: an ordinary race, not a server fault.
 */
export async function mintEncoderToken(
  eventId: string,
  requestedBy: string,
): Promise<EncoderToken | null> {
  const admin = createAdminClient();
  const active = await getActivePanoodBroadcast(eventId);
  if (!active) return null;

  const token = generateYoutubeStateToken();
  const { error } = await admin.from('live_studio_encoder_tokens').insert({
    token,
    event_id: eventId,
    broadcast_id: active.id,
    requested_by: requestedBy,
  });
  if (error) return null;

  return {
    token,
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
  };
}

export type VerifiedEncoderSession = {
  eventId: string;
  broadcastId: number;
  requestedBy: string;
};

/**
 * Consume an authorization token. Deletes the row it reads REGARDLESS of
 * outcome (single-use even on a failure path — an expired or already-consumed
 * token must not become retryable). Returns null for: unknown token, expired
 * token, or a broadcast that is no longer active (ended between mint and
 * verify) — Rust's `encoder_start` treats any null as "refuse, do not stream".
 */
export async function verifyEncoderToken(
  token: string,
): Promise<VerifiedEncoderSession | null> {
  const admin = createAdminClient();

  const { data: row } = await admin
    .from('live_studio_encoder_tokens')
    .select('event_id, broadcast_id, requested_by, expires_at')
    .eq('token', token)
    .maybeSingle();
  if (!row) return null;

  // Single-use: delete on read, before any further validation, so a token
  // that fails the TTL or broadcast check below cannot be retried either.
  await admin.from('live_studio_encoder_tokens').delete().eq('token', token);

  const claim = row as {
    event_id: string;
    broadcast_id: number;
    requested_by: string;
    expires_at: string;
  };
  if (new Date(claim.expires_at).getTime() < Date.now()) return null;

  const { data: broadcast } = await admin
    .from('panood_broadcasts')
    .select('status')
    .eq('id', claim.broadcast_id)
    .maybeSingle();
  if (!broadcast) return null;
  if ((broadcast as { status: string }).status === 'complete') return null;

  return {
    eventId: claim.event_id,
    broadcastId: claim.broadcast_id,
    requestedBy: claim.requested_by,
  };
}

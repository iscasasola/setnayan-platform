'use client';

/**
 * S8 — thin client-side wrappers over the Rust stream-key commands
 * (src-tauri/src/stream_key.rs), gated the same way lib/desktop-oauth.ts gates
 * OAuth: `window.__TAURI__` only exists in the rebuilt desktop app, so web and
 * mobile never reach these calls. Reuses that module's `tauri()` accessor
 * rather than re-declaring the `window.__TAURI__` shape here.
 *
 * These are the ONLY functions in the web app allowed to invoke the
 * stream-key commands. Neither function here ever returns the raw stream key
 * to its caller:
 *   · `setPastedStreamKey` — fire-and-forget; the key is consumed by Rust and
 *     never comes back.
 *   · `claimHostedStreamKey` — returns `ClaimedEncoderTarget`
 *     (`{ ready, rtmpsUrl }`), the exact non-secret shape the Rust command
 *     itself returns. There is no `streamKey` field to accidentally thread
 *     into React state — see the Rust command's docblock for why that's a
 *     type-level guarantee, not just a convention here.
 */

import { tauri } from '@/lib/desktop-oauth';

export { isTauri } from '@/lib/desktop-oauth';

/**
 * OWN-CHANNEL (default tier): hand the couple's pasted YouTube stream key
 * straight to Rust. Throws if called outside the desktop shell — callers must
 * gate on `isTauri()` before ever rendering the paste field in the first
 * place, so this should never fire in practice.
 *
 * DSK-1 — `rtmpsUrl` is the ingest address the key publishes to. OPTIONAL and
 * NON-SECRET: pass the couple's own when they supplied one, and omit it to have
 * Rust hold the key against YouTube's documented primary
 * (`YOUTUBE_RTMPS_PRIMARY`, defined once, in Rust, so the two halves cannot
 * disagree about the default). Without an address the key could not publish at
 * all — Rust stored `rtmps_url: ""`, which fails `RtmpEndpoint::parse`, so
 * `destinations()` returned `None` and `encoder_start` refused with
 * `no_stream_key`.
 *
 * THE ERROR IS THE POINT OF THE RETURN TYPE CHANGE: this used to be
 * fire-and-forget, and Rust's refusals (`unusable_ingest_address`,
 * `key_looks_like_ingest_address`) have to reach the couple as words. The
 * rejection carries Rust's own reason string; the caller turns it into a
 * sentence.
 */
export async function setPastedStreamKey(
  key: string,
  rtmpsUrl?: string | null,
): Promise<void> {
  const t = tauri();
  if (!t) throw new Error('not_desktop');
  await t.core.invoke('stream_key_set_pasted', {
    key,
    // Tauri maps a camelCase arg onto the Rust snake_case parameter. `null`
    // rather than omitted so the argument is always present in the payload and
    // deserializes to `None` — an absent field and an explicit null both land as
    // `Option::None`, and sending it makes that intent readable on the wire.
    rtmpsUrl: rtmpsUrl && rtmpsUrl.trim() ? rtmpsUrl.trim() : null,
  });
}

export type ClaimedEncoderTarget = {
  ready: boolean;
  rtmpsUrl: string;
};

/**
 * HOSTED-CHANNEL (add-on): hand Rust the single-use claim nonce minted by
 * `POST /api/live-studio/encoder/claim`. Rust exchanges it for the real
 * credentials over its own connection; only this non-secret confirmation
 * comes back across IPC.
 */
export async function claimHostedStreamKey(
  claimToken: string,
): Promise<ClaimedEncoderTarget> {
  const t = tauri();
  if (!t) throw new Error('not_desktop');
  return (await t.core.invoke('stream_key_claim_hosted', {
    claimToken,
  })) as ClaimedEncoderTarget;
}

/** Part C — forget the held key immediately. See the Rust command's docblock. */
export async function forgetStreamKey(): Promise<void> {
  const t = tauri();
  if (!t) return;
  await t.core.invoke('stream_key_forget');
}

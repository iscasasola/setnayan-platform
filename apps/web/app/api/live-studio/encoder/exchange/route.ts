import { NextResponse, type NextRequest } from 'next/server';
import { exchangeEncoderClaim } from '@/lib/live-studio-encoder-claims';

/**
 * S8 — exchange a single-use encoder claim nonce for the real hosted-channel
 * encoder credentials.
 *
 * POST /api/live-studio/encoder/exchange   body: { claimToken: string }
 *
 * Called ONLY by the Rust desktop process, over its own `reqwest` (rustls)
 * connection — NEVER through the Tauri IPC channel, and never by the webview.
 * That is the entire point of this route existing separately from `claim/`:
 * the response body here (`rtmps_url` / `rtmps_backup_url` / `stream_key`)
 * must never be JSON the renderer's `invoke()` call can see.
 *
 * The claim token itself IS the bearer credential for this one-shot exchange
 * (like a magic link) — it is already short-TTL, single-use, and was minted
 * only for a host of the specific event/broadcast it's bound to, so no
 * additional session/cookie auth is layered on top here. An invalid, expired,
 * or already-consumed token gets a generic 404 (no distinguishing error text)
 * so this endpoint can't be used to probe which tokens are "real".
 *
 * See lib/live-studio-encoder-claims.ts for the single-use delete-on-read
 * semantics and build-sessions/encoder/S8.md for the full design.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const claimToken =
    typeof body === 'object' && body !== null && 'claimToken' in body
      ? (body as { claimToken: unknown }).claimToken
      : null;
  if (typeof claimToken !== 'string' || claimToken.length === 0) {
    return NextResponse.json({ error: 'missing_claim_token' }, { status: 400 });
  }

  const resolved = await exchangeEncoderClaim(claimToken);
  if (!resolved) {
    // Deliberately generic — see docblock. Do not add a more specific reason.
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({
    rtmps_url: resolved.rtmpsUrl,
    rtmps_backup_url: resolved.rtmpsBackupUrl,
    stream_key: resolved.streamKey,
  });
}

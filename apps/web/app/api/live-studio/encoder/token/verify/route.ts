import { NextResponse, type NextRequest } from 'next/server';
import { verifyEncoderToken } from '@/lib/live-studio-encoder-tokens';

/**
 * POST /api/live-studio/encoder/token/verify   body: { token: string }
 *
 * S5 — consume the single-use token minted by `POST /api/live-studio/encoder/token`
 * and confirm it authorizes an `encoder_start` call right now
 * (build-sessions/encoder/S5.md § ACL).
 *
 * Called ONLY by the Rust desktop process, over its OWN `reqwest` (rustls)
 * connection — NEVER through the Tauri IPC channel, and never by the webview.
 * Same shape as `POST /api/live-studio/encoder/exchange` (S8): the token IS
 * the bearer credential for this one-shot verify (already short-TTL,
 * single-use, minted only for a host of the specific event/broadcast it is
 * bound to), so no additional session/cookie auth is layered on top. An
 * invalid, expired, or already-consumed token gets a generic `{ ok: false }`
 * with a 200 status rather than a distinguishing error, so this endpoint
 * cannot be used to probe which tokens are "real" from timing or status code.
 *
 * See lib/live-studio-encoder-tokens.ts for the single-use delete-on-read
 * semantics.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  const token =
    typeof body === 'object' && body !== null && 'token' in body
      ? (body as { token: unknown }).token
      : null;
  if (typeof token !== 'string' || token.length === 0) {
    return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 400 });
  }

  const resolved = await verifyEncoderToken(token);
  if (!resolved) {
    // Deliberately generic — see docblock. Do not add a more specific reason.
    return NextResponse.json({ ok: false });
  }

  return NextResponse.json({
    ok: true,
    eventId: resolved.eventId,
    broadcastId: resolved.broadcastId,
  });
}

import { NextResponse, type NextRequest } from 'next/server';
import { getHostUserId } from '@/lib/host-gate';
import { mintEncoderClaim } from '@/lib/live-studio-encoder-claims';

/**
 * S8 — mint a single-use encoder claim nonce for the HOSTED-CHANNEL add-on.
 *
 * POST /api/live-studio/encoder/claim   body: { eventId: string }
 *
 * Called from the webview (never from Rust — Rust only ever sees the resulting
 * `claimToken`, and this route never returns a stream key). Host-gated the same
 * way every other Live Studio mutation is (`lib/host-gate.ts`): a moderator or
 * the couple. The claim is bound server-side to whichever `panood_broadcasts`
 * row is currently active for the event — the client never supplies a
 * broadcast id, so it cannot mint a claim for a broadcast it doesn't own.
 *
 * See build-sessions/encoder/S8.md and lib/live-studio-encoder-claims.ts for
 * the full flow and threat model.
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
  const eventId =
    typeof body === 'object' && body !== null && 'eventId' in body
      ? (body as { eventId: unknown }).eventId
      : null;
  if (typeof eventId !== 'string' || eventId.length === 0) {
    return NextResponse.json({ error: 'missing_event_id' }, { status: 400 });
  }

  // getHostUserId redirect()s to /login for an anonymous caller (the shared
  // page-action behavior) rather than returning null — wrong for a fetch()-
  // driven API route, so catch next/navigation's internal throw (a NEXT_REDIRECT
  // digest) here and turn it into a clean 401. A non-host AUTHENTICATED caller
  // still gets a normal null → 403 below; only the "no session at all" path
  // needs this rescue.
  let userId: string | null;
  try {
    userId = await getHostUserId(eventId);
  } catch (err) {
    const digest = (err as { digest?: string } | null)?.digest;
    if (typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    throw err;
  }
  if (userId === null) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const claim = await mintEncoderClaim(eventId, userId);
  if (!claim) {
    return NextResponse.json({ error: 'no_active_broadcast' }, { status: 409 });
  }

  return NextResponse.json({
    claimToken: claim.claimToken,
    expiresAt: claim.expiresAt,
  });
}

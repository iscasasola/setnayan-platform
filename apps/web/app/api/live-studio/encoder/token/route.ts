import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isLiveStudioSetupHost } from '@/lib/panood-control-room-access';
import { mintEncoderToken } from '@/lib/live-studio-encoder-tokens';

/**
 * POST /api/live-studio/encoder/token   body: { eventId: string }
 *
 * S5 — mint a single-use token that authorizes ONE `encoder_start` call
 * (build-sessions/encoder/S5.md § ACL). Host-gated the SAME way
 * `/api/live-studio/ingest-health` is (`isLiveStudioSetupHost` against
 * `supabase.auth.getUser()`), rather than `getHostUserId`'s redirect-on-
 * anonymous behavior used by the S8 claim route: this is called from the
 * desktop webview's own fetch, not a page action, so a clean 401/403 JSON
 * body is what the caller can actually branch on.
 *
 * The token is bound server-side to whichever `panood_broadcasts` row is
 * currently active for the event — the client never supplies a broadcast id,
 * so it cannot mint a token for a broadcast it doesn't own. See
 * lib/live-studio-encoder-tokens.ts for the full flow and threat model.
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (!(await isLiveStudioSetupHost(eventId, user.id))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const minted = await mintEncoderToken(eventId, user.id);
  if (!minted) {
    return NextResponse.json({ error: 'no_active_broadcast' }, { status: 409 });
  }

  return NextResponse.json({
    token: minted.token,
    expiresAt: minted.expiresAt,
  });
}

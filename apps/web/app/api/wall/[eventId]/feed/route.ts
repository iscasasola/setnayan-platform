import { NextResponse } from 'next/server';
import { getWallSnapshot, isWallSessionLive, readWallDisplayCookie } from '@/lib/live-wall';

// GET /api/wall/[eventId]/feed?since=<ISO> — the projection's backfill +
// reconcile read (Salamisim P1).
//
// Auth: the display-session JWT cookie minted by /api/wall/claim, scoped to
// THIS event and re-checked against wall_display_sessions.revoked_at on every
// call (a couple revoking a screen takes effect on the next tick). The read
// itself runs service-role through the audited wall_visible_photos DEFINER
// reader — the anonymous projector never holds a table-read credential
// (P0 invariant), and event scope comes from the JWT, never the URL alone.

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  ctx: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await ctx.params;

  const session = await readWallDisplayCookie();
  if (!session || session.event_id !== eventId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!(await isWallSessionLive(session))) {
    return NextResponse.json({ error: 'revoked' }, { status: 401 });
  }

  const url = new URL(req.url);
  const since = url.searchParams.get('since');

  const snapshot = await getWallSnapshot(eventId, since);
  return NextResponse.json(snapshot, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

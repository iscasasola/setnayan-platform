import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { readEventWatchUrls, resolveWatchLinks } from '@/lib/watch-live-links';
import { getLatestPanoodBroadcastStatus } from '@/lib/panood-broadcast';
import { decideGuestWatchState } from '@/lib/live-watch-state';

/**
 * GET /api/live/[slug]/watch — W1: the guest-facing poll that keeps
 * watch-live-block.tsx's link (and embed) pointed at whatever broadcast is
 * actually running, instead of the one that was live when the page rendered.
 *
 * PUBLIC, no session — guests hold this page open for hours and this is the
 * only thing keeping their copy of the watch link honest. Reads exactly what
 * the story page already reads for `watchLive`
 * (app/[slug]/_lib/loaders.ts → readEventWatchUrls + resolveWatchLinks), so
 * this route can never disagree with what a fresh page load would show.
 *
 * Cached 15s (Cache-Control below): potentially hundreds of guests on one
 * event poll this every 30s, and the answer is the same for all of them
 * between broadcast changes — no per-guest work, no YouTube call (see
 * lib/live-watch-state.ts's docblock on why not).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ error: 'slug required' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: eventRow, error: eventError } = await admin
    .from('events')
    .select('event_id')
    .ilike('slug', slug)
    .maybeSingle();
  if (eventError || !eventRow) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  const eventId = (eventRow as { event_id: string }).event_id;

  const watchUrls = await readEventWatchUrls(admin, eventId);
  const watchLive = resolveWatchLinks(watchUrls);
  const latestBroadcastStatus = await getLatestPanoodBroadcastStatus(eventId);

  const state = decideGuestWatchState({ watchLive, latestBroadcastStatus });

  return NextResponse.json(
    { watchUrl: watchLive?.watchUrl ?? null, state },
    { headers: { 'Cache-Control': 'public, max-age=15' } },
  );
}

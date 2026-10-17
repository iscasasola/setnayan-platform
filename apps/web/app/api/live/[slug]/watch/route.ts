import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { readEventWatchUrls, resolveWatchLinks } from '@/lib/watch-live-links';
import { getLatestPanoodBroadcastStatus } from '@/lib/panood-broadcast';
import { decideGuestWatchState, type GuestWatchState } from '@/lib/live-watch-state';
import { liveEdgeHeaders, NOT_HELD, notRemembered, rememberedLiveRead } from '@/lib/live-day-cache';

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
 * Potentially hundreds of guests on one event poll this every 30s, and the
 * answer is the same for all of them between broadcast changes — no per-guest
 * work, no YouTube call (see lib/live-watch-state.ts's docblock on why not).
 *
 * 🧯 ONE ANSWER PER EVENT (2026-10-18, live-day polling). It used to say
 * `max-age=15` — a BROWSER cache, which the embed's `cache: 'no-store'` fetch
 * skips anyway, so every poll from every phone was three database reads. Now:
 *   · the answer is remembered per event for `LIVE_DAY_SECONDS`
 *     (lib/live-day-cache.ts) — the database is asked once per event per window;
 *   · the event row is read ONCE (slug + both watch links in one select; the old
 *     two-step read is kept only as the fallback for a schema without the
 *     Facebook column);
 *   · the broadcast status is read only when there is no watch link — a staged
 *     link already decides 'live' (`decideGuestWatchState`'s first line);
 *   · a definite answer is handed to the CDN for a few seconds (`liveEdgeHeaders`:
 *     max-age + stale-while-revalidate, for Vercel's CDN only — the browser revalidates).
 * ⛔ 'unknown' (the status read was REFUSED) and "no such event" are answered to
 * this phone only — never remembered, never cached at the edge.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EDGE = liveEdgeHeaders(10, 20);

type WatchAnswer = {
  status: 200 | 404;
  body: { watchUrl: string | null; state: GuestWatchState } | { error: string };
};

async function watchAnswer(slug: string): Promise<WatchAnswer> {
  const admin = createAdminClient();

  // ONE read: the event and both links. A schema without the Facebook column (42703) falls back to the old path.
  const { data: eventRow, error: eventError } = await admin
    .from('events')
    .select('event_id, panood_watch_url, panood_watch_url_facebook')
    .ilike('slug', slug)
    .maybeSingle();
  let eventId: string | null = null;
  let watchUrls: { youtubeWatchUrl: string | null; facebookWatchUrl: string | null } | null = null;
  if (!eventError && eventRow) {
    const row = eventRow as { event_id: string; panood_watch_url: string | null; panood_watch_url_facebook: string | null };
    eventId = row.event_id;
    watchUrls = { youtubeWatchUrl: row.panood_watch_url ?? null, facebookWatchUrl: row.panood_watch_url_facebook ?? null };
  } else if (eventError) {
    // Said, not swallowed: the one-read path failed (a schema without the Facebook column is the expected case).
    console.error('[supabase-error] app/api/live/[slug]/watch/route.ts · from:events.select', eventError);
    const { data: idRow, error: idError } = await admin
      .from('events')
      .select('event_id')
      .ilike('slug', slug)
      .maybeSingle();
    if (idError) console.error('[supabase-error] app/api/live/[slug]/watch/route.ts · from:events.select (fallback)', idError);
    if (!idError && idRow) {
      eventId = (idRow as { event_id: string }).event_id;
      watchUrls = await readEventWatchUrls(admin, eventId);
    }
  }
  if (!eventId || !watchUrls) {
    return notRemembered<WatchAnswer>({ status: 404, body: { error: 'not found' } });
  }

  const watchLive = resolveWatchLinks(watchUrls);
  // A staged link decides 'live' on its own; the broadcast row is asked only when there is none.
  const latestBroadcastStatus = watchLive ? null : await getLatestPanoodBroadcastStatus(eventId);

  const state = decideGuestWatchState({ watchLive, latestBroadcastStatus });
  const answer: WatchAnswer = { status: 200, body: { watchUrl: watchLive?.watchUrl ?? null, state } };
  return state === 'unknown' ? notRemembered(answer) : answer;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ error: 'slug required' }, { status: 400 });
  }

  const key = slug.toLowerCase();
  const answer = await rememberedLiveRead(`live-watch-v1:${key}`, key, () => watchAnswer(key));
  const definite = answer.status === 200 && 'state' in answer.body && answer.body.state !== 'unknown';
  return NextResponse.json(answer.body, {
    status: answer.status,
    headers: definite ? EDGE : NOT_HELD,
  });
}

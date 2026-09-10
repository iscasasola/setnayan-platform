import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isLiveStudioSetupHost } from '@/lib/panood-control-room-access';
import {
  createPanoodBroadcast,
  getActivePanoodBroadcast,
  getActivePanoodStreamKey,
  getEventYoutubeAccessToken,
  markPanoodBroadcastReconnecting,
} from '@/lib/panood-broadcast';
import { getHeldChannelAccessToken } from '@/lib/live-studio-roam-provision';
import { createYoutubeBroadcast, bindYoutubeBroadcast } from '@/lib/panood-youtube';
import { normalizeYouTubeWatchUrl } from '@/lib/panood-watch';
import { liveStudioControlPath } from '@/lib/live-studio-control';

/**
 * POST /api/live-studio/encoder/broadcast-ended — W1's other half.
 *
 * S7 (RTMPS + reconnect, not yet built — see build-sessions/encoder/README.md)
 * ends a YouTube broadcast whenever the ingest drops long enough that it can't
 * be resumed, because YouTube cannot resume video INTO an already-ended
 * broadcast. The stream (the RTMP ingest — same URL, same key) survives; only
 * the broadcast (the video container) needs replacing. This route is what S7
 * calls to make that replacement, and IS "the existing provisioning" the W1
 * prompt points at: it reuses `bindYoutubeBroadcast` (never a second binder)
 * and `createPanoodBroadcast` (the same close-prior-then-insert step
 * `goLivePanood` already uses), on the SAME `stream_id` — no new
 * `createYoutubeStream` call, so the encoder's RTMP target never changes.
 *
 * Host-gated with the SAME predicate as the control room's own poll
 * (`isLiveStudioSetupHost` — app/api/live-studio/ingest-health/route.ts),
 * since the Tauri controller is the same session-cookied Next app in a
 * webview (build-sessions/encoder/README.md rule 22), not a separate service
 * with its own credential.
 *
 * The row is flipped to 'errored' BEFORE the YouTube calls
 * (markPanoodBroadcastReconnecting) specifically so a guest polling
 * GET /api/live/[slug]/watch during the gap sees 'reconnecting' for the WHOLE
 * gap, not only after this finishes.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let eventId: string | null = null;
  try {
    const body = (await req.json()) as { event_id?: unknown };
    eventId = typeof body.event_id === 'string' && body.event_id.length > 0 ? body.event_id : null;
  } catch {
    eventId = null;
  }
  if (!eventId) {
    return NextResponse.json({ error: 'event_id required' }, { status: 400 });
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

  // Snapshot the broadcast about to be superseded BEFORE flipping its status:
  // stream_id/ingestion_url stay bound to the SAME RTMP stream S7 just
  // reconnected to — only the YouTube broadcast (video) container is new.
  const active = await getActivePanoodBroadcast(eventId);
  if (!active) {
    // Nothing Setnayan-provisioned is open — a by-hand host (own-channel
    // paste, live-studio-manual-air.ts), or this event's broadcast already
    // ended. Idempotent no-op so a duplicate/late call can't error.
    return NextResponse.json({ ok: true, skipped: 'no_active_broadcast' });
  }

  // Mark it 'errored' immediately — see this function's docblock for why the
  // guest-facing read needs this written before the slow part below runs.
  await markPanoodBroadcastReconnecting(eventId);

  const admin = createAdminClient();
  const pooled = await getHeldChannelAccessToken(admin, eventId);
  const accessToken = pooled ?? (await getEventYoutubeAccessToken(eventId));
  if (!accessToken) {
    return NextResponse.json(
      { error: 'No YouTube access token available to rebind the broadcast.' },
      { status: 409 },
    );
  }

  // getActivePanoodStreamKey still matches this row: 'errored' is not
  // 'complete', and both accessors filter only on `.neq('status', 'complete')`.
  const streamKey = await getActivePanoodStreamKey(eventId);
  if (!streamKey) {
    return NextResponse.json(
      { error: 'Could not read the stream key for the active broadcast.' },
      { status: 500 },
    );
  }

  const { data: ev } = await admin
    .from('events')
    .select('display_name')
    .eq('event_id', eventId)
    .maybeSingle();
  const displayName = (ev as { display_name?: string } | null)?.display_name;
  const title = displayName ? `${displayName} — Live` : 'Setnayan Live Broadcast';

  let broadcastId: string;
  try {
    const scheduledStartAt = new Date().toISOString();
    const broadcast = await createYoutubeBroadcast(accessToken, {
      title,
      scheduledStartTime: scheduledStartAt,
      privacyStatus: 'unlisted',
    });
    broadcastId = broadcast.broadcastId;

    // Reuse the SAME stream — never write a second binder.
    await bindYoutubeBroadcast(accessToken, broadcastId, active.stream_id);

    await createPanoodBroadcast(eventId, {
      broadcastId,
      streamId: active.stream_id,
      ingestionUrl: active.ingestion_url,
      streamKey,
      scheduledStartAt,
    });
  } catch (err) {
    // The row stays 'errored' — the guest read keeps reporting 'reconnecting'
    // and S7 (or the host, via the existing Go-live control) can retry.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not rebind the broadcast.' },
      { status: 502 },
    );
  }

  const watchUrl = normalizeYouTubeWatchUrl(`https://www.youtube.com/watch?v=${broadcastId}`);
  if (watchUrl) {
    await admin.from('events').update({ panood_watch_url: watchUrl }).eq('event_id', eventId);
  }

  revalidatePath(`/dashboard/${eventId}/studio/panood/setup`);
  revalidatePath(liveStudioControlPath(eventId));
  revalidatePath('/[slug]', 'page');

  return NextResponse.json({ ok: true, broadcastId });
}

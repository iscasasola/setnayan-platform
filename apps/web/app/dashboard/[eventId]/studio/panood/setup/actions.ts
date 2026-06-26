'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { normalizeYouTubeWatchUrl } from '@/lib/panood-watch';
import {
  getEventYoutubeAccessToken,
  createPanoodBroadcast,
  getActivePanoodBroadcast,
  completePanoodBroadcast,
} from '@/lib/panood-broadcast';
import {
  createYoutubeBroadcast,
  createYoutubeStream,
  bindYoutubeBroadcast,
  transitionYoutubeBroadcast,
} from '@/lib/panood-youtube';

/**
 * Server actions for the Panood setup page's watch-URL field — the FIRST real
 * persistence on this surface (everything else is still the 0011 mock seam).
 *
 * The couple pastes their YouTube watch/share/live link; we normalize to the
 * canonical https://www.youtube.com/watch?v=<id> form (lib/panood-watch.ts)
 * and persist to events.panood_watch_url (migration 20261122000000). The
 * guest day-of page embeds it (youtube-nocookie) during the live window
 * whenever the watch URL is present — single-cam Panood live is FREE for any
 * host (owner model 2026-06-26; PANOOD_SYSTEM is the paid multi-camera control
 * room tier, now built at /studio/panood/broadcast). Non-YouTube input is silently dropped — the value
 * renders in an iframe on the public wedding page, so normalize-or-reject is
 * the injection barrier. When the broadcaster auto-creation lands (YouTube
 * Data API), it writes this same column and this manual field becomes the
 * fallback.
 *
 * Auth mirrors the shipped requireHostMembership pattern (hero-photo /
 * site-editor actions): moderators OR legacy couple membership; RLS on events
 * UPDATE is the backstop.
 */

async function requireHostMembership(eventId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: moderator } = await supabase
    .from('event_moderators')
    .select('moderator_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .is('removed_at', null)
    .maybeSingle();
  if (moderator) return;

  const { data: legacy } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (legacy?.member_type === 'couple') return;

  redirect('/dashboard');
}

export async function savePanoodWatchUrl(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  const urlRaw = formData.get('watch_url');
  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) return;
  const eventId = eventIdRaw;
  if (typeof urlRaw !== 'string') return;

  const normalized = normalizeYouTubeWatchUrl(urlRaw);
  if (!normalized) {
    // Not a YouTube video URL — bounce back with a flag the page surfaces.
    redirect(`/dashboard/${eventId}/studio/panood/setup?watch_url_error=1`);
  }

  await requireHostMembership(eventId);
  const supabase = await createClient();
  await supabase
    .from('events')
    .update({ panood_watch_url: normalized })
    .eq('event_id', eventId);

  revalidatePath(`/dashboard/${eventId}/studio/panood/setup`);
  revalidatePath('/[slug]', 'page');
  redirect(`/dashboard/${eventId}/studio/panood/setup?watch_url_saved=1`);
}

/* -------------------------------------------------------------------------- */
/*  One-tap "Go live" — auto-create the YouTube broadcast + OBS stream         */
/* -------------------------------------------------------------------------- */
//
// Phase 1 of the real broadcaster: instead of asking the couple to create the
// broadcast by hand on YouTube and paste the link back, "Go live" does it for
// them — liveBroadcasts.insert → liveStreams.insert → bind — persists the row
// (with the secret stream_key) in panood_broadcasts, and writes the watch URL
// into events.panood_watch_url so the existing event-page embed lights up. The
// couple then streams INTO that broadcast from OBS (RTMP server + stream key
// shown on the page) or the YouTube app. Setnayan never sends video bytes.
//
// Returns a {ok}|{error} result (never throws to the client) so the page can
// surface a friendly message — critical because the YouTube `youtube` OAuth
// scope is gated behind Google's verified-app review: until that clears, the
// token is null for non-test users and this must degrade gracefully, not 500.

export type GoLiveResult = { ok: true } | { error: string };

export async function goLivePanood(eventId: string): Promise<GoLiveResult> {
  // (a) Host-only. requireHostMembership redirects (throws) for non-hosts.
  //     This is the ONLY gate on single-cam go-live: it's an auth scope, not a
  //     paywall. Owner model 2026-06-26 — single-cam Panood live is FREE for any
  //     host ("the tool is free; the premium layer is paid"). PANOOD_SYSTEM is
  //     the PAID multi-camera control room + broadcast-style overlays tier (now
  //     built at /studio/panood/broadcast), so we intentionally do NOT
  //     eventSkuActive-gate single-cam go-live.
  await requireHostMembership(eventId);

  const supabase = await createClient();

  // (b) Per-event YouTube access token. null when the channel isn't connected,
  //     the OAuth env/config is unset, or the verified-app review hasn't cleared
  //     for this account — never throw, just prompt the couple to connect.
  const accessToken = await getEventYoutubeAccessToken(eventId);
  if (!accessToken) {
    return { error: 'Connect your YouTube channel first' };
  }

  // (d) Create + wire the broadcast on the couple's own channel. Any YouTube
  //     API error (quota, scope not yet granted, transient) is caught and
  //     surfaced as a friendly message rather than crashing the action.
  let broadcastId: string;
  let stream: { streamId: string; ingestionAddress: string; streamName: string };
  const scheduledStartAt = new Date().toISOString();
  try {
    const { data: ev } = await supabase
      .from('events')
      .select('display_name')
      .eq('event_id', eventId)
      .maybeSingle();
    const title = ev?.display_name
      ? `${ev.display_name} — Live`
      : 'Setnayan Live Broadcast';

    const broadcast = await createYoutubeBroadcast(accessToken, {
      title,
      scheduledStartTime: scheduledStartAt,
      privacyStatus: 'unlisted',
    });
    broadcastId = broadcast.broadcastId;

    stream = await createYoutubeStream(accessToken, { title });
    await bindYoutubeBroadcast(accessToken, broadcastId, stream.streamId);
  } catch {
    return {
      error:
        'YouTube could not create the broadcast. This usually means the YouTube connection needs reconnecting, or live streaming is not yet enabled on your channel. Try reconnecting in step 1.',
    };
  }

  // (e) Persist the broadcast (with the secret stream key). createPanoodBroadcast
  //     closes any prior active row first and throws a friendly Error on a
  //     missing table — catch it into the {error} contract.
  try {
    await createPanoodBroadcast(eventId, {
      broadcastId,
      streamId: stream.streamId,
      ingestionUrl: stream.ingestionAddress,
      streamKey: stream.streamName,
      scheduledStartAt,
    });
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : 'Could not save your broadcast. Please try again.',
    };
  }

  // (f) Mirror the watch URL into events.panood_watch_url (the broadcastId IS
  //     the public videoId) via the same normalize-or-reject path the manual
  //     paste form uses, so the event-page embed lights up with zero changes.
  const watchUrl = normalizeYouTubeWatchUrl(
    `https://www.youtube.com/watch?v=${broadcastId}`,
  );
  if (watchUrl) {
    await supabase
      .from('events')
      .update({ panood_watch_url: watchUrl })
      .eq('event_id', eventId);
  }

  // (g) Refresh the setup page (so the OBS card appears) + the public page embed.
  revalidatePath(`/dashboard/${eventId}/studio/panood/setup`);
  revalidatePath('/[slug]', 'page');
  return { ok: true };
}

/**
 * Stop the event's active broadcast: mark the panood_broadcasts row complete
 * and transition it complete on YouTube (best-effort — a YouTube error or an
 * auto-completed broadcast is treated as success so the couple is never stuck
 * with a row they can't clear). Clears the embed's watch URL too. Host-only.
 */
export async function endPanoodBroadcast(eventId: string): Promise<GoLiveResult> {
  await requireHostMembership(eventId);

  // Read the active row first (broadcast_id needed for the YouTube transition),
  // then close it in the DB so the couple can always stop even if YouTube errors.
  const active = await getActivePanoodBroadcast(eventId);
  const closed = await completePanoodBroadcast(eventId);
  const broadcastId = closed?.broadcastId ?? active?.broadcast_id ?? null;

  if (broadcastId) {
    const accessToken = await getEventYoutubeAccessToken(eventId);
    if (accessToken) {
      try {
        await transitionYoutubeBroadcast(accessToken, broadcastId, 'complete');
      } catch {
        // Already complete on YouTube (autoStop), or a transient error — the
        // local row is already 'complete', which is the source of truth.
      }
    }
  }

  // Clear the embed so the event page stops showing a finished broadcast.
  const supabase = await createClient();
  await supabase
    .from('events')
    .update({ panood_watch_url: null })
    .eq('event_id', eventId);

  revalidatePath(`/dashboard/${eventId}/studio/panood/setup`);
  revalidatePath('/[slug]', 'page');
  return { ok: true };
}

export async function clearPanoodWatchUrl(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) return;
  const eventId = eventIdRaw;

  await requireHostMembership(eventId);
  const supabase = await createClient();
  await supabase
    .from('events')
    .update({ panood_watch_url: null })
    .eq('event_id', eventId);

  revalidatePath(`/dashboard/${eventId}/studio/panood/setup`);
  revalidatePath('/[slug]', 'page');
  redirect(`/dashboard/${eventId}/studio/panood/setup`);
}

'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeYouTubeWatchUrl } from '@/lib/panood-watch';
import {
  getEventYoutubeAccessToken,
  getActivePanoodBroadcast,
  getActivePanoodStreamKey,
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
 * guest day-of page embeds it (youtube-nocookie) during the live window when
 * PANOOD_SYSTEM is active. Non-YouTube input is silently dropped — the value
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
    redirect(`/dashboard/${eventId}/add-ons/panood/setup?watch_url_error=1`);
  }

  await requireHostMembership(eventId);
  const supabase = await createClient();
  await supabase
    .from('events')
    .update({ panood_watch_url: normalized })
    .eq('event_id', eventId);

  revalidatePath(`/dashboard/${eventId}/add-ons/panood/setup`);
  revalidatePath('/[slug]', 'page');
  redirect(`/dashboard/${eventId}/add-ons/panood/setup?watch_url_saved=1`);
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

  revalidatePath(`/dashboard/${eventId}/add-ons/panood/setup`);
  revalidatePath('/[slug]', 'page');
  redirect(`/dashboard/${eventId}/add-ons/panood/setup`);
}

/* -------------------------------------------------------------------------- */
/*  Upgraded Panood — broadcast lifecycle (the "Setnayan is the switcher" tier) */
/* -------------------------------------------------------------------------- */
//
// These actions create + run a YouTube live broadcast ON the couple's own
// channel via the shipped foundation (lib/panood-youtube.ts + panood-broadcast.ts)
// and persist it to panood_broadcasts. The on-device native switcher (Capacitor
// HaishinKit/RootEncoder plugin — see Panood_Local_Switcher_Runbook) calls
// createBroadcast to get the RTMP ingestion URL + stream key, pushes the
// composited feed to it, then goLiveBroadcast writes the watch URL into
// events.panood_watch_url so the existing event-page embed lights up.
//
// SECURITY: requireHostMembership gates every action to the event's own host —
// you can only run a broadcast on your own event. TODO(GA): also gate on the
// paid Panood add-on (resolveAddOnState 'launch') before charging quota in prod.

export type CreateBroadcastResult =
  | {
      ok: true;
      broadcastId: string;
      ingestionUrl: string;
      streamKey: string;
      watchUrl: string;
    }
  | { ok: false; error: string };

/**
 * Create (or reuse) the YouTube broadcast + stream on the couple's channel and
 * return the RTMP target for the on-device encoder. Idempotent: an existing
 * active broadcast is returned rather than double-spending YouTube quota.
 */
export async function createBroadcast(eventId: string): Promise<CreateBroadcastResult> {
  await requireHostMembership(eventId);

  const existing = await getActivePanoodBroadcast(eventId);
  if (existing) {
    const key = await getActivePanoodStreamKey(eventId);
    if (key) {
      return {
        ok: true,
        broadcastId: existing.broadcast_id,
        ingestionUrl: existing.ingestion_url,
        streamKey: key,
        watchUrl: `https://www.youtube.com/watch?v=${existing.broadcast_id}`,
      };
    }
  }

  const accessToken = await getEventYoutubeAccessToken(eventId);
  if (!accessToken) return { ok: false, error: 'youtube_not_connected' };

  try {
    const broadcast = await createYoutubeBroadcast(accessToken, {
      title: 'Setnayan — Live',
      scheduledStartTime: new Date(Date.now() + 60_000).toISOString(),
      privacyStatus: 'unlisted',
    });
    const stream = await createYoutubeStream(accessToken, { title: 'Setnayan — Live' });
    await bindYoutubeBroadcast(accessToken, broadcast.broadcastId, stream.streamId);

    const admin = createAdminClient();
    const { error } = await admin.from('panood_broadcasts').insert({
      event_id: eventId,
      broadcast_id: broadcast.broadcastId,
      stream_id: stream.streamId,
      stream_key: stream.streamName,
      ingestion_url: stream.ingestionAddress,
      status: 'ready',
    });
    if (error) return { ok: false, error: `persist_failed:${error.message.slice(0, 80)}` };

    return {
      ok: true,
      broadcastId: broadcast.broadcastId,
      ingestionUrl: stream.ingestionAddress,
      streamKey: stream.streamName,
      watchUrl: `https://www.youtube.com/watch?v=${broadcast.broadcastId}`,
    };
  } catch (e) {
    const msg = (e as Error).message;
    // A fresh channel must be live-streaming-enabled (phone-verified, ~24h lead).
    if (/liveStreaming.{0,3}(Not|Dis)|not enabled for live|forbidden/i.test(msg)) {
      return { ok: false, error: 'channel_not_live_enabled' };
    }
    return { ok: false, error: `create_failed:${msg.slice(0, 100)}` };
  }
}

/**
 * Transition the broadcast to live (fallback — enableAutoStart usually does this
 * when the encoder connects) and write the watch URL into events.panood_watch_url
 * so the event-page embed lights up during the live window.
 */
export async function goLiveBroadcast(
  eventId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireHostMembership(eventId);
  const existing = await getActivePanoodBroadcast(eventId);
  if (!existing) return { ok: false, error: 'no_broadcast' };
  const accessToken = await getEventYoutubeAccessToken(eventId);
  if (!accessToken) return { ok: false, error: 'youtube_not_connected' };

  try {
    // An already-live broadcast (auto-started when the encoder connected) throws
    // a redundant/invalid-transition error — treat that as success.
    try {
      await transitionYoutubeBroadcast(accessToken, existing.broadcast_id, 'live');
    } catch (e) {
      if (!/redundant|invalidTransition|already|notReady/i.test((e as Error).message)) {
        throw e;
      }
    }

    const watchUrl = `https://www.youtube.com/watch?v=${existing.broadcast_id}`;
    const supabase = await createClient();
    const admin = createAdminClient();
    await supabase
      .from('events')
      .update({ panood_watch_url: watchUrl })
      .eq('event_id', eventId);
    await admin
      .from('panood_broadcasts')
      .update({
        status: 'live',
        went_live_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('event_id', eventId)
      .neq('status', 'complete');

    revalidatePath(`/dashboard/${eventId}/add-ons/panood/setup`);
    revalidatePath('/[slug]', 'page');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `golive_failed:${(e as Error).message.slice(0, 100)}` };
  }
}

/** End the broadcast (transition complete) and retire the event-page embed. */
export async function endBroadcast(
  eventId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireHostMembership(eventId);
  const existing = await getActivePanoodBroadcast(eventId);
  if (!existing) return { ok: true };
  const accessToken = await getEventYoutubeAccessToken(eventId);

  try {
    if (accessToken) {
      try {
        await transitionYoutubeBroadcast(accessToken, existing.broadcast_id, 'complete');
      } catch {
        // best-effort — we still mark it complete on our side
      }
    }
    const supabase = await createClient();
    const admin = createAdminClient();
    await admin
      .from('panood_broadcasts')
      .update({
        status: 'complete',
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('event_id', eventId)
      .neq('status', 'complete');
    await supabase
      .from('events')
      .update({ panood_watch_url: null })
      .eq('event_id', eventId);

    revalidatePath(`/dashboard/${eventId}/add-ons/panood/setup`);
    revalidatePath('/[slug]', 'page');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `end_failed:${(e as Error).message.slice(0, 100)}` };
  }
}

'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeYouTubeWatchUrl } from '@/lib/panood-watch';
import { liveStudioRoamEnabled } from '@/lib/live-studio-roam';
import { stampFirstLiveAt } from '@/lib/live-studio-window-server';
import {
  getHeldChannelAccessToken,
  provisionRoamBroadcasts,
  releasePoolChannelIfIdle,
  resolveEventBroadcastToken,
} from '@/lib/live-studio-roam-provision';
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
 * host (owner model 2026-06-26; PANOOD_SYSTEM gates the PAID multi-camera
 * control-room upgrade, built at ./broadcast). Non-YouTube input is silently
 * dropped — the value
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
  //     host ("the tool is free; the premium layer is paid"). PANOOD_SYSTEM
  //     gates the PAID multi-camera control-room + broadcast-style overlays
  //     upgrade (built at ./broadcast), so we intentionally do NOT
  //     eventSkuActive-gate go-live.
  await requireHostMembership(eventId);

  const supabase = await createClient();

  // (b) ⭐ WAVE 9 · THE SETNAYAN-OWNED CHANNEL COMES FIRST
  //     (owner-confirmed 2026-07-26 · Live_Studio_Unified_Spec § 4h)
  //
  // The whole point of Wave 9 is that a couple never connects a Google account.
  // That promise is NOT delivered by the ROAM picker alone — this action creates
  // the single directed broadcast the program output actually feeds, and until
  // now it hard-stopped at "Connect your YouTube channel first". So when the flag
  // is on we check a Setnayan channel out of the pool and use ITS token.
  //
  // BYO is kept as the FALLBACK, not removed: the legacy Cast room is live and
  // selling on it, and a host who already connected their own channel must keep
  // working. Flag OFF → this block is skipped entirely and the line below is the
  // byte-identical original behaviour.
  let accessToken: string | null = null;
  let usedPoolChannel = false;
  if (liveStudioRoamEnabled()) {
    const pooled = await resolveEventBroadcastToken(createAdminClient(), eventId);
    if (pooled) {
      accessToken = pooled.accessToken;
      usedPoolChannel = true;
    }
  }
  if (!accessToken) {
    accessToken = await getEventYoutubeAccessToken(eventId);
  }
  if (!accessToken) {
    // Flag-aware copy. Telling a host to "connect your YouTube channel" under the
    // Wave 9 model would be asking them for the exact thing the model removed —
    // and they cannot fix it, because the missing piece is on Setnayan's side.
    return {
      error: liveStudioRoamEnabled()
        ? 'No Setnayan broadcast channel is available for your event yet. This is on our side — please contact Setnayan.'
        : 'Connect your YouTube channel first',
    };
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
    // Wave 9: a pool-channel failure is not the host's to fix, and the channel
    // must go back so the next event is not blocked behind a broken one. Only
    // released when nothing is riding on it (releasePoolChannelIfIdle).
    if (usedPoolChannel) {
      await releasePoolChannelIfIdle(createAdminClient(), eventId);
      return {
        error:
          'YouTube could not create the broadcast on the Setnayan channel. This is on our side — please contact Setnayan.',
      };
    }
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

  // (g) ⭐ WAVE 7 · STAMP THE BROADCAST-WINDOW ANCHOR
  //     (owner-locked 2026-07-25 · Live_Studio_Unified_Spec § 4f ② · lib/live-studio-window.ts)
  //
  // ₱2,999 buys ONE EVENT-DAY of multi-cam broadcasting, anchored on FIRST GO-LIVE rather than a
  // calendar day — no timezone ambiguity, and buying early costs the couple nothing because the
  // clock does not start until this line runs. Wave 5 noted that the unified go-live path never
  // wrote `first_live_at`; this is that gap closed.
  //
  // AFTER the broadcast is persisted, deliberately: every failure above returns early, so a
  // go-live that never reached YouTube cannot burn a day the couple paid for. Write-once by DB
  // trigger (trg_panood_first_live_at_immutable), so pressing live again can never move, restart
  // or extend the window. Admin client because `panood_control_state` is couple-RLS and a
  // coordinator running the controller must still be able to start the show.
  //
  // FLAG-GATED. `first_live_at` is ALSO read by the legacy 24-hour watermark model
  // (lib/panood-watermark.ts), which is untouched while the flag is off — stamping it there would
  // start that clock for a host pressing go-live on the setup page, which is a live behaviour
  // change on a selling product. Flag on, the legacy model is retired (§ 4f ①) and this anchor is
  // the only thing reading the column.
  if (liveStudioRoamEnabled()) {
    const admin = createAdminClient();
    await stampFirstLiveAt(admin, eventId);

    // ⭐ WAVE 9 · provision the per-camera ROAM broadcasts on the same pool channel
    // and re-mirror the public picker manifest.
    //
    // THIS IS THE FIRST CALLER `mirrorRoamManifest` HAS EVER HAD. Spec § 4c noted
    // that guest-pick enforcement was real but "not yet observable because nothing
    // writes live_studio_roam_streams" — this is that gap closed, and it is why the
    // publish gate inside the mirror starts biting from here on.
    //
    // Best-effort and AFTER the single-camera broadcast is already persisted: the
    // free single-cam livestream is a published promise, and a multi-cam
    // provisioning hiccup must never be the reason it did not go out. A failure
    // returns a reason object; it does not throw and it does not change this
    // action's result.
    await provisionRoamBroadcasts(admin, eventId, {
      titlePrefix: 'Setnayan Live',
      scheduledStartTime: scheduledStartAt,
    });
  }

  // (h) Refresh the setup page (so the OBS card appears) + the public page embed.
  // Also refresh the unified Live Studio controller, which mounts this same
  // GoLiveCard (2026-07-25) — so its live monitor reflects the new broadcast.
  revalidatePath(`/dashboard/${eventId}/studio/panood/setup`);
  revalidatePath(`/dashboard/${eventId}/studio/live-studio-control/setup`);
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
    // WAVE 9 · a broadcast created on a Setnayan pool channel must be ENDED with
    // that channel's token, not the couple's (which under the pool model does not
    // exist). READ-ONLY lookup — `getHeldChannelAccessToken` never claims a
    // channel, so pressing End cannot consume pool inventory.
    // `createAdminClient()` is constructed only behind the flag — it throws when
    // SUPABASE_SERVICE_ROLE_KEY is absent, and a flag-off End must not acquire a
    // new way to fail.
    const pooled = liveStudioRoamEnabled()
      ? await getHeldChannelAccessToken(createAdminClient(), eventId)
      : null;
    const accessToken = pooled ?? (await getEventYoutubeAccessToken(eventId));
    if (accessToken) {
      try {
        await transitionYoutubeBroadcast(accessToken, broadcastId, 'complete');
      } catch {
        // Already complete on YouTube (autoStop), or a transient error — the
        // local row is already 'complete', which is the source of truth.
      }
    }
  }

  // 🚫 THE POOL CHANNEL IS DELIBERATELY *NOT* RELEASED HERE.
  //
  // The obvious move — "broadcast over, give the channel back" — would be a bug.
  // § 4h has Setnayan handing the RECORDING back to the couple (VOD pull →
  // dashboard / Alaala) and only then wiping and reusing the channel. That pull is
  // not built. Releasing on End would let the next wedding claim a channel while
  // this couple's ceremony recording is still the only copy sitting on it — and
  // "wipe + reuse" is exactly what happens next to a released channel.
  //
  // It also would not survive a host who ends and restarts mid-day. Release is
  // therefore an explicit admin act (/admin/live-studio-channels → Release), where
  // the age of the checkout is on screen next to the button.

  // Clear the embed so the event page stops showing a finished broadcast.
  const supabase = await createClient();
  await supabase
    .from('events')
    .update({ panood_watch_url: null })
    .eq('event_id', eventId);

  revalidatePath(`/dashboard/${eventId}/studio/panood/setup`);
  revalidatePath(`/dashboard/${eventId}/studio/live-studio-control/setup`);
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

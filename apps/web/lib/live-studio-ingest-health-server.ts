import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getActivePanoodBroadcast, getEventYoutubeAccessToken } from '@/lib/panood-broadcast';
import { getHeldChannelAccessToken } from '@/lib/live-studio-roam-provision';
import { getYoutubeStreamStatus } from '@/lib/panood-youtube';

/**
 * apps/web/lib/live-studio-ingest-health-server.ts
 *
 * The READ behind lib/live-studio-ingest-health.ts — same split as
 * lib/live-studio-readiness-server.ts. The decision is pure and lives there;
 * this file only gathers ONE fresh fact: what does YouTube say about this
 * event's stream right now.
 *
 * ⚠ READ-ONLY BY CONSTRUCTION. Uses `getHeldChannelAccessToken` — which,
 * unlike `resolveEventBroadcastToken`, never checks a pool channel OUT — so a
 * health poll can never consume pool inventory as a side effect of running.
 * Falls back to the couple's own BYO grant (`getEventYoutubeAccessToken`),
 * mirroring the same preference order `goLivePanood` uses so this read never
 * asks about a channel that isn't the one actually broadcasting.
 *
 * FAIL-HONEST: every failure returns `streamStatus: null` (never a guessed
 * status), which the pure decider turns into "cannot tell", never "receiving".
 */
export type IngestHealthRead = {
  /**
   * Is there a Setnayan-managed broadcast for this event right now — the SAME
   * predicate the controller's tally uses (`Boolean(activeBroadcast)`, i.e.
   * `resolveLiveAir`'s `hasActiveBroadcast`). `false` means there is nothing
   * of this kind to poll (off air, or on air by hand with no Setnayan stream).
   */
  live: boolean;
  /** This tick's fresh `liveStreams.status.streamStatus`, or `null` on any failure. */
  streamStatus: string | null;
  /** This tick's fresh `liveStreams.status.healthStatus.status`, or `null`. */
  healthStatus: string | null;
};

const NOT_POLLABLE: IngestHealthRead = { live: false, streamStatus: null, healthStatus: null };

/**
 * One fresh YouTube read for this event's Setnayan-managed stream.
 *
 * Never throws: every failure mode (no active broadcast, no resolvable
 * access token, the YouTube call itself erroring) degrades to an honest
 * `streamStatus: null` rather than crashing the poller or silently reporting
 * "fine".
 */
export async function readIngestHealth(
  admin: SupabaseClient,
  eventId: string,
): Promise<IngestHealthRead> {
  let streamId: string | null = null;
  try {
    const broadcast = await getActivePanoodBroadcast(eventId);
    streamId = broadcast?.stream_id ?? null;
  } catch {
    return NOT_POLLABLE;
  }
  if (!streamId) return NOT_POLLABLE;

  let accessToken: string | null = null;
  try {
    accessToken = await getHeldChannelAccessToken(admin, eventId);
    if (!accessToken) accessToken = await getEventYoutubeAccessToken(eventId);
  } catch {
    accessToken = null;
  }
  if (!accessToken) return { live: true, streamStatus: null, healthStatus: null };

  try {
    const { streamStatus, healthStatus } = await getYoutubeStreamStatus(accessToken, streamId);
    return { live: true, streamStatus, healthStatus };
  } catch {
    return { live: true, streamStatus: null, healthStatus: null };
  }
}

import type { SupabaseClient } from '@supabase/supabase-js';
import { getYoutubeOAuthConfig } from '@/lib/panood-youtube';
import { liveStudioRoamEnabled } from '@/lib/live-studio-roam';
import {
  decideBroadcastReadiness,
  type ReadinessDecision,
  type ReadinessFacts,
} from '@/lib/live-studio-readiness';

/**
 * apps/web/lib/live-studio-readiness-server.ts
 *
 * WAVE 9 · the READS behind lib/live-studio-readiness.ts. The decision is pure and
 * lives there; this file only gathers facts. Same split as
 * lib/live-studio-window-server.ts (Wave 7), for the same reason: the pure module
 * must stay importable from a `'use client'` component without dragging DB queries
 * into the browser bundle.
 *
 * ⚠ PASS A SERVICE-ROLE CLIENT. `live_studio_channel_grants` has RLS on and NO
 * policy (it carries a Setnayan channel's refresh token), and
 * `live_studio_roam_channel_pool` is admin-only. A session client reads zero rows
 * here and would report a connected channel as "not connected" — telling a host
 * their wedding cannot stream when it can.
 *
 * ⚠ NOTHING IN HERE RETURNS A TOKEN. It asks whether grants EXIST and whether they
 * are healthy; it never selects `refresh_token` / `access_token`, so no readiness
 * caller can leak one even by rendering the whole object.
 */

const UNDEFINED_TABLE = '42P01';

/**
 * Gather readiness facts for an event, then decide.
 *
 * FAIL-HONEST, not fail-closed: every read that cannot be answered reports the
 * pessimistic value, so an unknown state shows as "not ready" with a nameable
 * reason. The asymmetry against the paywall modules is deliberate — there, failing
 * closed protects revenue; here, the failure mode to avoid is a host being told
 * they are ready when nobody knows whether they are.
 *
 * Returns `null` when the flag is off, so a caller renders nothing at all rather
 * than a readiness card for a dark product.
 */
export async function resolveLiveStudioReadiness(
  admin: SupabaseClient,
  eventId: string,
): Promise<ReadinessDecision | null> {
  if (!liveStudioRoamEnabled()) return null;
  return decideBroadcastReadiness(await fetchReadinessFacts(admin, eventId));
}

/** The facts, separated so tests can drive the decision without a database. */
export async function fetchReadinessFacts(
  admin: SupabaseClient,
  eventId: string,
): Promise<ReadinessFacts> {
  const oauthConfigured = (await getYoutubeOAuthConfig()).ready;

  let channelAvailable = false;
  let channelConnected = false;
  let channelNeedsReauth = false;
  let cameraCount = 0;
  let provisionedCount = 0;

  // ── Which pool channel is (or would be) this event's? ──────────────────────
  // The one already checked out to it, else the first free verified one. Same
  // preference order checkoutPoolChannel uses, so the readiness card and the
  // provisioner agree about which channel is being talked about.
  let channelPoolId: number | null = null;
  try {
    const { data: held, error: heldErr } = await admin
      .from('live_studio_roam_channel_pool')
      .select('id')
      .eq('checked_out_event_id', eventId)
      .eq('status', 'checked_out')
      .maybeSingle();
    if (heldErr?.code === UNDEFINED_TABLE) {
      // Pre-migration DB: nothing is available and nothing is connected.
      return { oauthConfigured, channelAvailable: false, channelConnected: false, channelNeedsReauth: false, cameraCount: 0, provisionedCount: 0 };
    }
    if (held) {
      channelPoolId = (held as { id: number }).id;
    } else {
      const { data: free } = await admin
        .from('live_studio_roam_channel_pool')
        .select('id')
        .eq('status', 'available')
        .eq('verified', true)
        .order('id', { ascending: true })
        .limit(1)
        .maybeSingle();
      channelPoolId = (free as { id: number } | null)?.id ?? null;
    }
    channelAvailable = channelPoolId !== null;
  } catch {
    channelAvailable = false;
  }

  // ── Is that channel connected, and is the connection healthy? ─────────────
  if (channelPoolId !== null) {
    try {
      const { data } = await admin
        .from('live_studio_channel_grants')
        .select('connection_health, revoked_at')
        .eq('channel_pool_id', channelPoolId)
        .maybeSingle();
      const row = data as { connection_health?: string | null; revoked_at?: string | null } | null;
      channelConnected = Boolean(row) && !row?.revoked_at;
      channelNeedsReauth = channelConnected && row?.connection_health === 'needs_reauth';
    } catch {
      channelConnected = false;
    }
  }

  // ── The host's own side ───────────────────────────────────────────────────
  try {
    const { count } = await admin
      .from('live_studio_roam_zones')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .neq('status', 'disabled');
    cameraCount = count ?? 0;
  } catch {
    cameraCount = 0;
  }

  try {
    const { count } = await admin
      .from('live_studio_roam_streams')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .not('status', 'in', '("complete","errored")');
    provisionedCount = count ?? 0;
  } catch {
    provisionedCount = 0;
  }

  return { oauthConfigured, channelAvailable, channelConnected, channelNeedsReauth, cameraCount, provisionedCount };
}

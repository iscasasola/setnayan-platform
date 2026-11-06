import 'server-only';

/**
 * lib/home-live-card.server.ts — WHAT HOME'S LIVE STREAM CARD READS (owner 2026-10-23, approved
 * `prototypes/home_service_widgets_2026-10-23.html` frame 6: on/off air, the channels, "Guests choose their view", the
 * three overlays — "the controller stays the controller").
 *
 * The same facts the controller (`app/panood/control/[eventId]/page.tsx`) reads, from the same tables — but HONEST:
 * the controller keeps its fail-soft reads (a pre-migration room must still run a broadcast), while a card that would
 * say "Off air" over a refused read is the disease this repo fences. So: the event row, the channels, the on-air
 * trace or the overlay row refused → `{ ok: false }` and the card says "couldn't load" (no switch, no "Off air").
 *
 * The caller has already established that the viewer is the couple (Home draws the card for them alone); the
 * service-role reads are the controller's own (`panood_manual_on_air_at` has no column grant; the camera seats carry
 * their claim tokens).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveLiveAir, type LiveAirSource } from '@/lib/live-studio-manual-air';
import { MAX_ROAM_ZONES } from '@/lib/live-studio-roam-zones';
import { fetchChannelCameras, resolveChannelStatus } from '@/lib/live-studio-channel-cameras';
import { channelReadyCaption } from '@/lib/live-studio-control';
import { readOverlaySettingsMeasured, type OverlaySettings } from '@/lib/live-studio-overlays';
import { fetchEventRecordings, type RoamRecording } from '@/lib/live-studio-recordings';
import { readEventWatchUrls } from '@/lib/watch-live-links';

export type HomeLiveChannel = { id: number; label: string; caption: string; live: boolean; mainStage: boolean };

export type HomeLiveCardRead =
  | { ok: false }
  | {
      ok: true;
      onAir: boolean;
      source: LiveAirSource | null;
      channels: HomeLiveChannel[];
      maxChannels: number;
      /** `events.live_studio_guest_pick_enabled` — anything but `false` is ON, as the controller reads it. */
      guestPick: boolean;
      overlays: OverlaySettings;
      watchUrl: string | null;
      recordings: RoamRecording[];
    };

export async function readHomeLiveCard(supabase: SupabaseClient, eventId: string, appUrl: string): Promise<HomeLiveCardRead> {
  const admin = createAdminClient();
  const [zonesRes, pickRes, airRes, broadcastRes, overlays, watch] = await Promise.all([
    supabase
      .from('live_studio_roam_zones')
      .select('id, zone_index, label, is_main_stage, status, camera_operator_id')
      .eq('event_id', eventId)
      .order('zone_index', { ascending: true }),
    supabase.from('events').select('live_studio_guest_pick_enabled').eq('event_id', eventId).maybeSingle(),
    admin.from('events').select('panood_manual_on_air_at').eq('event_id', eventId).maybeSingle(),
    admin
      .from('panood_broadcasts')
      .select('went_live_at, scheduled_start_at')
      .eq('event_id', eventId)
      .neq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    readOverlaySettingsMeasured(supabase, eventId),
    readEventWatchUrls(supabase, eventId).catch((): null => null),
  ]);
  if (zonesRes.error || !zonesRes.data || pickRes.error || airRes.error || broadcastRes.error || !overlays) return { ok: false };

  const zones = zonesRes.data as Array<{ id: number; zone_index: number; label: string | null; is_main_stage: boolean | null; status: string | null; camera_operator_id: number | null }>;
  const [cameras, recordings] = await Promise.all([
    fetchChannelCameras(admin, eventId, zones, appUrl).catch((): null => null),
    fetchEventRecordings(admin, eventId).catch((): RoamRecording[] => []),
  ]);
  // The seats could not be read: every channel's camera state is unknown — not "Waiting for a camera".
  if (!cameras) return { ok: false };

  const now = new Date();
  const channels = zones.map((z, i): HomeLiveChannel => {
    const camera = cameras.get(z.id) ?? null;
    const status = resolveChannelStatus({ status: z.status, lastSeenAt: camera?.lastSeenAt ?? null, bound: Boolean(camera), claimed: camera?.claimed ?? false, now });
    return {
      id: z.id,
      label: z.label?.trim() || `Channel ${i + 1}`,
      caption: channelReadyCaption(status),
      live: status === 'live',
      mainStage: z.is_main_stage === true,
    };
  });

  const broadcast = broadcastRes.data as { went_live_at: string | null; scheduled_start_at: string | null } | null;
  const air = resolveLiveAir({
    hasActiveBroadcast: Boolean(broadcast),
    broadcastStartedAt: broadcast?.went_live_at ?? broadcast?.scheduled_start_at ?? null,
    manualOnAirAt: (airRes.data as { panood_manual_on_air_at?: string | null } | null)?.panood_manual_on_air_at ?? null,
  });

  return {
    ok: true,
    onAir: air.isLive,
    source: air.source,
    channels,
    maxChannels: MAX_ROAM_ZONES,
    guestPick: (pickRes.data as { live_studio_guest_pick_enabled?: unknown } | null)?.live_studio_guest_pick_enabled !== false,
    overlays,
    watchUrl: watch?.youtubeWatchUrl ?? null,
    recordings,
  };
}

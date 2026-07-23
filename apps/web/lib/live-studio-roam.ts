import type { SupabaseClient } from '@supabase/supabase-js';
import { isYouTubeVideoId } from '@/lib/panood-watch';

/**
 * apps/web/lib/live-studio-roam.ts
 *
 * The data layer for Live Studio ROAM — the "guests pick which camera / wander
 * the venue" product (2026-07-23 owner design session; see
 * Live_Studio_Cast_and_Roam_2026-07-23.md). ROAM exposes N concurrent camera
 * feeds per event (across zones and venues) and lets a remote guest choose which
 * one to watch, with the directed feed as the default.
 *
 * ROAM is deliberately isolated from CAST (the existing directed single-feed
 * product): its own tables (live_studio_roam_zones / live_studio_roam_channel_pool /
 * live_studio_roam_streams, migration 20270918111955) so it can run many concurrent
 * broadcasts without loosening CAST's single-active panood_broadcasts index.
 *
 * The public picker never reads the roam tables. Their non-secret fields are
 * mirrored into events.live_studio_roam_manifest (a jsonb array), exactly as CAST's
 * watch URL mirrors into events.panood_watch_url — so the public event page reads
 * ONE column and never sees a stream key. This module holds the flag, the
 * manifest types, and the pure manifest helpers shared by the reader and the
 * picker component.
 *
 * The "roam" code namespace is prefixed panood_ to stay clear of the unrelated
 * 3D-avatar "roam" (tap-to-walk) feature.
 */

/**
 * Live Studio ROAM feature flag (owner-gated · default OFF). When OFF, nothing
 * reads the roam tables or renders the picker, and the event page behaves exactly
 * as today (CAST single embed). Going live also needs the owner actions in the
 * spec (S2 price · G1 verify Setnayan channel(s) · G3 DB creds · G4 API quota).
 *
 * NEXT_PUBLIC_ so the server-rendered event page and the client picker read the
 * SAME flag — one source of truth.
 */
export function liveStudioRoamEnabled(): boolean {
  return process.env.NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED === 'true';
}

/** Zone lifecycle (mirrors the live_studio_roam_zones CHECK constraint). */
export const ROAM_ZONE_STATUSES = ['planned', 'live', 'offline', 'disabled'] as const;
export type RoamZoneStatus = (typeof ROAM_ZONE_STATUSES)[number];

/**
 * One entry in the PUBLIC picker manifest (events.live_studio_roam_manifest). Only
 * non-secret, viewer-facing fields — never a stream key. `videoId` is the YouTube
 * liveBroadcast id (== the public watch id).
 */
export type RoamZoneManifestEntry = {
  zoneIndex: number;
  label: string;
  venueLabel: string | null;
  videoId: string;
  featured: boolean;
  status: RoamZoneStatus;
};

export type RoamManifest = RoamZoneManifestEntry[];

/**
 * Parse + validate the jsonb manifest into a safe, render-ready array.
 *
 * This value renders inside YouTube iframes on the PUBLIC wedding page, so it is
 * an injection barrier: every entry must carry a valid 11-char YouTube video id
 * (isYouTubeVideoId) or it is dropped. Non-array / malformed input → []. Pure +
 * exported so the reader and the picker component share one source of truth.
 */
export function parseRoamManifest(raw: unknown): RoamManifest {
  if (!Array.isArray(raw)) return [];
  const out: RoamManifest = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const videoId = r.videoId;
    if (!isYouTubeVideoId(videoId)) continue; // reject anything that isn't a real video id
    const label = typeof r.label === 'string' && r.label.trim() ? r.label.trim() : null;
    if (!label) continue;
    const zoneIndex = typeof r.zoneIndex === 'number' && Number.isFinite(r.zoneIndex) ? r.zoneIndex : out.length + 1;
    const venueLabel =
      typeof r.venueLabel === 'string' && r.venueLabel.trim() ? r.venueLabel.trim() : null;
    const status = (ROAM_ZONE_STATUSES as readonly string[]).includes(r.status as string)
      ? (r.status as RoamZoneStatus)
      : 'live';
    out.push({
      zoneIndex,
      label,
      venueLabel,
      videoId,
      featured: r.featured === true,
      status,
    });
  }
  // Stable order: by zoneIndex ascending (the couple's intended picker order).
  return out.sort((a, b) => a.zoneIndex - b.zoneIndex);
}

/**
 * Pick the zone the picker should land on by default: the featured zone, else the
 * first live one, else the first entry, else null (empty manifest). Pure +
 * exported so it is unit-tested and shared with the picker's initial state.
 */
export function selectFeaturedZone(manifest: RoamManifest): RoamZoneManifestEntry | null {
  if (manifest.length === 0) return null;
  return (
    manifest.find((z) => z.featured) ??
    manifest.find((z) => z.status === 'live') ??
    manifest[0] ??
    null
  );
}

/**
 * Group manifest entries by venue for the picker UI. Entries without a venue fall
 * under a single unlabeled group (key ''). Preserves within-group order. Pure.
 */
export function groupZonesByVenue(manifest: RoamManifest): { venue: string | null; zones: RoamManifest }[] {
  const order: string[] = [];
  const byVenue = new Map<string, RoamManifest>();
  for (const z of manifest) {
    const key = z.venueLabel ?? '';
    if (!byVenue.has(key)) {
      byVenue.set(key, []);
      order.push(key);
    }
    byVenue.get(key)!.push(z);
  }
  return order.map((key) => ({ venue: key === '' ? null : key, zones: byVenue.get(key)! }));
}

/**
 * Read + parse the public ROAM manifest for an event from
 * events.live_studio_roam_manifest. Graceful-degrade to [] on a missing/legacy column
 * (42703) or table (42P01) so a pre-migration database shows the CAST single
 * embed rather than crashing — matches the panood-seats.ts / panood-watch posture.
 */
export async function fetchRoamManifest(
  supabase: SupabaseClient,
  eventId: string,
): Promise<RoamManifest> {
  const { data, error } = await supabase
    .from('events')
    .select('live_studio_roam_manifest')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) {
    if (error.code === '42P01' || error.code === '42703') return [];
    return [];
  }
  return parseRoamManifest((data as { live_studio_roam_manifest?: unknown } | null)?.live_studio_roam_manifest);
}

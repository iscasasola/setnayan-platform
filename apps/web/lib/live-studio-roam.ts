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
  /**
   * Unified Live Studio (2026-07-25): this zone is the one currently CUT to the
   * directed **Main Stage** output (at most one true per event). The viewer plays
   * the main-stage zone on the "Main Stage" channel; a later provisioning mirror
   * stamps this from live_studio_roam_zones.is_main_stage. Defaults false, so a
   * pre-unified manifest simply has no cut and the Main Stage falls back to the
   * featured zone (selectMainStageZone).
   */
  mainStage: boolean;
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
      mainStage: r.mainStage === true,
      status,
    });
  }
  // Stable order: by zoneIndex ascending (the couple's intended picker order).
  return out.sort((a, b) => a.zoneIndex - b.zoneIndex);
}

/**
 * The DEFAULT-CHANNEL rule, over anything that carries the two fields it reads.
 *
 * "The host's ★ default, else the first one that is actually live, else the first
 * one at all." Generic because the same rule has to run over two different shapes:
 * the public manifest (RoamZoneManifestEntry, below) and the host's raw channel
 * rows (lib/live-studio-publish.ts → decideProgramAir, which picks the ONE channel
 * a free host may put to air). Two spellings of "which channel is the default" is
 * exactly how a paywall and a viewer end up disagreeing about which camera is the
 * free one.
 *
 * Deliberately CUT-BLIND: it never looks at `mainStage`. Callers that want the cut
 * to win layer it on top (selectMainStageZone), and callers that must NOT let the
 * cut move the answer — the free tier's pinned channel — use this directly.
 */
export function selectDefaultChannel<T extends { featured: boolean; status: string }>(
  channels: readonly T[],
): T | null {
  if (channels.length === 0) return null;
  return (
    channels.find((z) => z.featured) ??
    channels.find((z) => z.status === 'live') ??
    channels[0] ??
    null
  );
}

/**
 * Pick the zone the picker should land on by default: the featured zone, else the
 * first live one, else the first entry, else null (empty manifest). Pure +
 * exported so it is unit-tested and shared with the picker's initial state.
 */
export function selectFeaturedZone(manifest: RoamManifest): RoamZoneManifestEntry | null {
  return selectDefaultChannel(manifest);
}

/**
 * Pick the zone whose feed the directed **Main Stage** (channel 1 of the unified
 * Live Studio) should currently carry: the zone explicitly cut to Main Stage
 * (mainStage), else the featured/default zone, else the first live one, else the
 * first entry, else null (empty manifest). Switching only — Main Stage always
 * mirrors exactly ONE camera's feed (no compositing). Pure + exported so the
 * viewer's Main-Stage channel and the unit tests share one source of truth.
 */
export function selectMainStageZone(manifest: RoamManifest): RoamZoneManifestEntry | null {
  if (manifest.length === 0) return null;
  return manifest.find((z) => z.mainStage) ?? selectFeaturedZone(manifest);
}

/**
 * GUEST-PICK — the host's real, optional switch (owner-locked 2026-07-25 "make it
 * optional"; Live_Studio_Unified_Spec § 4b Wave 2). ON = guests may leave Channel 1
 * for any camera channel; OFF = everyone watches the host's cut.
 *
 * ENFORCED BY OMISSION, and this is the whole point of doing it here rather than in
 * the picker component. Hiding the picker buttons while still serialising every
 * channel's `videoId` into the page would be theatre: the ids ship inside the client
 * component's props, so anyone who opens the page source could watch the channels
 * their host chose not to publish. So when guest-pick is OFF the server reduces the
 * manifest to the ONE entry Channel 1 is carrying — the other ids never leave the
 * server, and the picker's existing `manifest.length > 1` guard then hides itself
 * for free.
 *
 * (Honest limit: the underlying YouTube broadcasts are still public URLs, so a guest
 * who finds the channel another way can watch it. Not shipping the ids is the part
 * we control; making the broadcasts unlisted is a provisioning-side concern.)
 *
 * Pure + exported so the loader and the unit tests share one source of truth.
 */
export function applyGuestPick(manifest: RoamManifest, guestPickEnabled: boolean): RoamManifest {
  if (guestPickEnabled) return manifest;
  const onAir = selectMainStageZone(manifest);
  return onAir ? [onAir] : [];
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
 * Read the public viewer state for an event: the parsed ROAM manifest
 * (events.live_studio_roam_manifest) AND the host's guest-pick switch
 * (events.live_studio_guest_pick_enabled) in ONE row read — they are both columns on
 * `events` precisely so the wedding page pays for one query, not two, inside the
 * live window.
 *
 * Graceful-degrade on a missing/legacy column (42703) or table (42P01): empty
 * manifest + guest-pick TRUE (the default), so a pre-migration database shows the
 * CAST single embed rather than crashing — matches the panood-watch posture.
 *
 * NOTE the caller still has to apply `applyGuestPick` — this returns the raw pair so
 * the reduction happens in one obvious, tested place.
 */
export async function fetchRoamViewerState(
  supabase: SupabaseClient,
  eventId: string,
): Promise<{ manifest: RoamManifest; guestPickEnabled: boolean }> {
  const { data, error } = await supabase
    .from('events')
    .select('live_studio_roam_manifest, live_studio_guest_pick_enabled')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) return { manifest: [], guestPickEnabled: true };
  const row = data as
    | { live_studio_roam_manifest?: unknown; live_studio_guest_pick_enabled?: unknown }
    | null;
  return {
    manifest: parseRoamManifest(row?.live_studio_roam_manifest),
    // Only an explicit `false` turns it off — an absent column (pre-migration) or a
    // null must not silently strip a paid host's guest-pick.
    guestPickEnabled: row?.live_studio_guest_pick_enabled !== false,
  };
}

import type { SupabaseClient } from '@supabase/supabase-js';
import { isYouTubeVideoId } from '@/lib/panood-watch';
import type { RoamManifest, PanoodRoamZoneStatus } from '@/lib/panood-roam';

/**
 * apps/web/lib/panood-roam-provision.ts
 *
 * The provisioning SPINE for Live Studio ROAM (2026-07-23 owner design session;
 * `Live_Studio_Cast_and_Roam_2026-07-23.md`). Three concerns, all flag-dark
 * (`NEXT_PUBLIC_PANOOD_ROAM_ENABLED`) and isolated from CAST:
 *
 *   1. CHANNEL POOL lifecycle — check a Setnayan-owned channel out of the pool
 *      for an event's window, return it after (the owner-locked "our own channel"
 *      model; one channel per event isolates concurrency + copyright-strike blast
 *      radius).
 *   2. MANIFEST MIRROR — build the PUBLIC picker manifest from the (control-plane)
 *      zones + (service-role) streams and write it to events.panood_roam_manifest,
 *      exactly as CAST mirrors its watch URL into events.panood_watch_url. This is
 *      what makes the event-page picker light up.
 *   3. YOUTUBE BROADCAST creation (N per event) — see provisionRoamBroadcasts
 *      below: NOT wired yet. It reuses the CAST YouTube lifecycle
 *      (lib/panood-youtube.ts createYoutubeBroadcast/Stream/bind) but needs the
 *      POOL CHANNEL's own OAuth token, which is gated on G1 (a verified Setnayan
 *      channel exists) + the OAuth-path decision (Workspace-Internal vs External).
 *
 * DB functions take a SupabaseClient so they are testable and callable from either
 * a control-room session or the service-role admin client. buildRoamManifest is
 * pure (unit-tested). Graceful-degrade on a missing/legacy table/column (42P01 /
 * 42703) so a pre-migration DB never crashes — matches panood-camera-seats.ts.
 */

const UNDEFINED_TABLE = '42P01';
const UNDEFINED_COLUMN = '42703';

// ── Row shapes (the fields these helpers read) ──────────────────────────────

export type RoamZoneRow = {
  id: number;
  zone_index: number;
  label: string;
  venue_label: string | null;
  is_featured: boolean;
  status: PanoodRoamZoneStatus;
};

export type RoamStreamRow = {
  zone_id: number | null;
  broadcast_id: string; // YouTube liveBroadcast id == the public videoId
  status: 'ready' | 'testing' | 'live' | 'complete' | 'errored';
};

export type RoamChannelRow = {
  id: number;
  youtube_channel_id: string;
  label: string | null;
  status: 'available' | 'checked_out' | 'maintenance' | 'retired';
  verified: boolean;
  concurrent_cap: number;
};

/** A stream still eligible to appear in the picker (not finished/broken). */
function isLiveableStream(s: RoamStreamRow): boolean {
  return s.status !== 'complete' && s.status !== 'errored';
}

/**
 * Build the PUBLIC picker manifest from a zone set + its streams. PURE +
 * exported so it is unit-tested and shared by the mirror writer.
 *
 * A zone appears ONLY when it has an active (non-complete/errored) stream whose
 * broadcast_id is a real 11-char YouTube video id — so a planned-but-not-yet-live
 * zone, or one whose stream failed, is silently omitted rather than rendering a
 * dead tile. This is the WRITE-side injection barrier (parseRoamManifest is the
 * READ-side one). Output is ordered by zone_index.
 */
export function buildRoamManifest(zones: RoamZoneRow[], streams: RoamStreamRow[]): RoamManifest {
  // Newest-eligible stream per zone (later rows win; provisioning inserts in order).
  const streamByZone = new Map<number, RoamStreamRow>();
  for (const s of streams) {
    if (s.zone_id == null || !isLiveableStream(s)) continue;
    if (!isYouTubeVideoId(s.broadcast_id)) continue;
    streamByZone.set(s.zone_id, s);
  }

  const out: RoamManifest = [];
  for (const z of zones) {
    if (z.status === 'disabled') continue; // couple turned this zone off
    const stream = streamByZone.get(z.id);
    if (!stream) continue; // no live video for this zone → omit
    out.push({
      zoneIndex: z.zone_index,
      label: z.label,
      venueLabel: z.venue_label,
      videoId: stream.broadcast_id,
      featured: z.is_featured === true,
      status: z.status,
    });
  }
  return out.sort((a, b) => a.zoneIndex - b.zoneIndex);
}

/**
 * Rebuild + persist events.panood_roam_manifest from the current zones + streams.
 * Call after any provisioning / go-live / zone change so the public picker
 * reflects reality. Service-role (admin) — reads the secret-bearing streams table.
 * Returns the number of zones written, or 0 on a pre-migration DB.
 */
export async function mirrorRoamManifest(admin: SupabaseClient, eventId: string): Promise<number> {
  if (!eventId) return 0;
  try {
    const [{ data: zones, error: zErr }, { data: streams, error: sErr }] = await Promise.all([
      admin
        .from('panood_roam_zones')
        .select('id, zone_index, label, venue_label, is_featured, status')
        .eq('event_id', eventId),
      admin.from('panood_roam_streams').select('zone_id, broadcast_id, status').eq('event_id', eventId),
    ]);
    if (zErr?.code === UNDEFINED_TABLE || sErr?.code === UNDEFINED_TABLE) return 0;
    if (zErr || sErr) return 0;

    const manifest = buildRoamManifest(
      (zones ?? []) as RoamZoneRow[],
      (streams ?? []) as RoamStreamRow[],
    );
    const { error: upErr } = await admin
      .from('events')
      .update({ panood_roam_manifest: manifest })
      .eq('event_id', eventId);
    if (upErr?.code === UNDEFINED_COLUMN || upErr) return 0;
    return manifest.length;
  } catch {
    return 0;
  }
}

/**
 * Check a Setnayan-owned channel out of the pool for an event's live window.
 *
 * Idempotent: if the event already holds a channel, that one is returned. Else
 * the first available + verified channel is claimed (status → 'checked_out'). The
 * partial unique index panood_roam_channel_pool_one_per_event is the hard backstop
 * against a race binding two channels to one event. Service-role (admin).
 *
 * Returns the claimed channel, or null when the pool is empty / all busy — the
 * caller surfaces "no Roam channel available, add one" rather than crashing.
 */
export async function checkoutPoolChannel(
  admin: SupabaseClient,
  eventId: string,
): Promise<RoamChannelRow | null> {
  if (!eventId) return null;
  const SELECT = 'id, youtube_channel_id, label, status, verified, concurrent_cap';
  try {
    // Already holding one? (idempotent re-provision)
    const { data: existing, error: exErr } = await admin
      .from('panood_roam_channel_pool')
      .select(SELECT)
      .eq('checked_out_event_id', eventId)
      .eq('status', 'checked_out')
      .maybeSingle();
    if (exErr?.code === UNDEFINED_TABLE) return null;
    if (existing) return existing as RoamChannelRow;

    // Claim the first available, verified channel.
    const { data: free, error: freeErr } = await admin
      .from('panood_roam_channel_pool')
      .select(SELECT)
      .eq('status', 'available')
      .eq('verified', true)
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (freeErr || !free) return null;

    const { data: claimed, error: claimErr } = await admin
      .from('panood_roam_channel_pool')
      .update({
        status: 'checked_out',
        checked_out_event_id: eventId,
        checked_out_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', (free as RoamChannelRow).id)
      .eq('status', 'available') // lost-update guard: only if still free
      .select(SELECT)
      .maybeSingle();
    if (claimErr || !claimed) return null; // raced — caller may retry
    return claimed as RoamChannelRow;
  } catch {
    return null;
  }
}

/**
 * Return the event's checked-out channel to the pool (recycle after the event +
 * after the recording has been pulled). Best-effort + idempotent. Service-role.
 */
export async function returnPoolChannel(admin: SupabaseClient, eventId: string): Promise<boolean> {
  if (!eventId) return false;
  try {
    const { error } = await admin
      .from('panood_roam_channel_pool')
      .update({
        status: 'available',
        checked_out_event_id: null,
        checked_out_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('checked_out_event_id', eventId)
      .eq('status', 'checked_out');
    return !error;
  } catch {
    return false;
  }
}

/**
 * ⛔ NOT WIRED YET — the YouTube broadcast-creation step (create N liveBroadcasts,
 * one per zone, on the checked-out pool channel; persist to panood_roam_streams;
 * then mirrorRoamManifest). It reuses the CAST lifecycle verbatim
 * (lib/panood-youtube.ts: createYoutubeBroadcast → createYoutubeStream →
 * bindYoutubeBroadcast → transitionYoutubeBroadcast), looping over zones instead
 * of the single CAST broadcast.
 *
 * It is intentionally left unimplemented in this PR because it needs the POOL
 * CHANNEL's own OAuth access token, and that token model is gated on:
 *   • G1 — a verified Setnayan channel actually exists, and
 *   • the OAuth-path decision (Workspace-Internal vs External) — which determines
 *     where the pool channel's grant is stored (an oauth_grants row keyed by the
 *     pool channel rather than by event_id, unlike CAST's per-couple grant).
 *
 * Wiring shape (for the follow-up PR):
 *   const channel = await checkoutPoolChannel(admin, eventId);
 *   const accessToken = await getPoolChannelAccessToken(channel.id);  // TODO (token model)
 *   for (const zone of zones) {
 *     const b = await createYoutubeBroadcast(accessToken, { title: zone.label, ... });
 *     const s = await createYoutubeStream(accessToken, { ... });
 *     await bindYoutubeBroadcast(accessToken, b.id, s.id);
 *     // insert { event_id, zone_id, channel_pool_id: channel.id, broadcast_id: b.id,
 *     //          stream_id: s.id, stream_key: s.streamKey, ingestion_url, status:'ready' }
 *   }
 *   await mirrorRoamManifest(admin, eventId);
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchPapicGallery } from '@/lib/papic-gallery';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchScheduleBlocks, DEFAULT_EVENT_TZ } from '@/lib/schedule';
import { groupIntoChapters } from '@/lib/alaala-chapters';
import type { MemoriesChallenge, MemoriesItem, MemoriesLook, MemoriesSource } from '@/lib/event-memories';
export type { MemoriesItem } from '@/lib/event-memories';
import { hubImageRefs } from '@/lib/event-memories';

/**
 * event-memories.server.ts — ONE READ FOR AN EVENT'S MEMORIES, every album at once (owner 2026-10-23; the albums and
 * their rules are `lib/event-memories.ts`).
 *
 *   Papic · Your uploads · Suppliers  — `fetchPapicGallery(…, { compressedOnly, includeHeld })`: the compressed copies
 *                                       only, and (for the host) the frames only the host may act on, marked
 *   Challenges                        — the link that already exists: `papic_mission_completions.capture_id`
 *                                       (a guest's answer to a challenge IS a guest capture) — no new schema
 *   Event Hub                         — the image files the APPLIED Hub points at, in this event's own folder
 *   Needs a look                      — `user_reports` (target_type 'photo') + the content screen's verdict
 *
 * 🔑 EVERY PART SAYS WHETHER IT WAS READ. A refused part is reported, never an empty album.
 */

export type EventMemoriesRead = {
  items: MemoriesItem[];
  challenges: MemoriesChallenge[];
  /** The day's moments from the run of show, for "Follow the moments in order" — null without a schedule. */
  chapters: { key: string; label: string; time: string | null; photoIds: string[] }[] | null;
  /** Guests stopped from shooting at this event (Stop · Let shoot again). */
  blockedGuests: string[];
  /** The booked suppliers whose shots can reach Memories, with their whole-delivery switch. */
  suppliers: { vendorProfileId: string; vendorRowId: string; name: string; hidden: boolean }[];
  /** Per part — true when that part's read was refused. */
  refused: { photos: boolean; hub: boolean; challenges: boolean; reports: boolean };
};

export async function readEventMemories(
  supabase: SupabaseClient,
  eventId: string,
  { host, viewerIsCouple }: { host: boolean; viewerIsCouple?: boolean },
): Promise<EventMemoriesRead> {
  // WHICH capture reads were refused (review of #6851) — any one makes the photos part "couldn't load".
  const status: { refused: Array<'seat' | 'guest' | 'vendor' | 'hiddenSuppliers'> } = { refused: [] };
  const [photos, hubRes, missionsRes, completionsRes, reportsRes, blockedRes, suppliersRes, blocksRes] = await Promise.all([
    fetchPapicGallery(supabase, eventId, { compressedOnly: true, includeHeld: host, status, viewerIsCouple }),
    Promise.all([
      supabase.from('events').select('landing_page_hero_image_url, our_photos').eq('event_id', eventId).maybeSingle(),
      supabase.from('invitation_widgets').select('widget_type, config_json').eq('event_id', eventId),
    ]),
    // The board's own order (`couple-challenges-manager.tsx`): slot, then when it was made.
    supabase
      .from('papic_missions')
      .select('mission_id, prompt, source, vendor_id, board_slot')
      .eq('event_id', eventId)
      .eq('approved', true)
      .order('board_slot', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true }),
    supabase.from('papic_mission_completions').select('mission_id, capture_id').eq('event_id', eventId).not('capture_id', 'is', null),
    host
      ? supabase.from('user_reports').select('target_id').eq('event_id', eventId).eq('target_type', 'photo')
      : Promise.resolve({ data: [] as { target_id: string }[], error: null }),
    host
      ? supabase.from('event_blocked_users').select('blocked_guest_id').eq('event_id', eventId)
      : Promise.resolve({ data: [] as { blocked_guest_id: string | null }[], error: null }),
    supabase
      .from('event_vendors')
      .select('vendor_id, linked_vendor_profile_id, vendor_name, papic_captures_hidden')
      .eq('event_id', eventId)
      .not('linked_vendor_profile_id', 'is', null),
    fetchScheduleBlocks(supabase, eventId).catch(() => null),
  ]);

  // ── Challenges ────────────────────────────────────────────────────────────
  const [eventRow, widgets] = hubRes;
  const challengesRefused = Boolean(missionsRes.error || completionsRes.error);
  if (missionsRes.error) logQueryError('readEventMemories.missions', missionsRes.error, { event_id: eventId }, 'graceful_degrade');
  if (completionsRes.error) logQueryError('readEventMemories.completions', completionsRes.error, { event_id: eventId }, 'graceful_degrade');
  const missions = (missionsRes.data ?? []) as { mission_id: string; prompt: string | null; source: string | null; vendor_id: string | null }[];
  const vendorIds = [...new Set(missions.filter((m) => m.source === 'vendor' && m.vendor_id).map((m) => m.vendor_id as string))];
  const { data: vendorRows } = vendorIds.length
    ? await supabase.from('event_vendors').select('vendor_id, vendor_name').in('vendor_id', vendorIds)
    : { data: [] as { vendor_id: string; vendor_name: string | null }[] };
  const vendorName = new Map((vendorRows ?? []).map((v) => [v.vendor_id as string, (v.vendor_name as string | null) ?? null]));
  const challenges: MemoriesChallenge[] = missions.map((m) => ({
    id: m.mission_id,
    title: (m.prompt ?? '').trim() || 'A challenge',
    supplier: m.source === 'vendor' && m.vendor_id ? (vendorName.get(m.vendor_id) ?? null) : null,
  }));
  const missionOfCapture = new Map(
    ((completionsRes.data ?? []) as { mission_id: string; capture_id: string | null }[])
      .filter((c) => c.capture_id)
      .map((c) => [c.capture_id as string, c.mission_id]),
  );

  // ── Needs a look ─────────────────────────────────────────────────────────
  if (reportsRes.error) logQueryError('readEventMemories.reports', reportsRes.error, { event_id: eventId }, 'graceful_degrade');
  const reported = new Set(((reportsRes.data ?? []) as { target_id: string }[]).map((r) => r.target_id));

  const items: MemoriesItem[] = photos.map((p) => {
    const memSource: MemoriesSource = p.source === 'vendor' ? 'suppliers' : p.uploads ? 'uploads' : 'papic';
    const look: MemoriesLook =
      p.held === 'screened' ? 'screened' : reported.has(p.id) ? 'reported' : p.held === 'hidden' ? 'hidden' : 'ok';
    return {
      ...p,
      memSource,
      look,
      table: p.source === 'seat' ? 'papic_photos' : p.source === 'guest' ? 'papic_guest_captures' : 'vendor_papic_captures',
      challengeId: p.source === 'guest' ? (missionOfCapture.get(p.id) ?? null) : null,
      hubUse: null,
    };
  });

  // ── Event Hub ────────────────────────────────────────────────────────────
  const hubRefused = Boolean(eventRow.error || widgets.error);
  if (eventRow.error) logQueryError('readEventMemories.hubEvent', eventRow.error, { event_id: eventId }, 'graceful_degrade');
  if (widgets.error) logQueryError('readEventMemories.hubWidgets', widgets.error, { event_id: eventId }, 'graceful_degrade');
  const hubRefs = hubImageRefs([eventRow.data ?? null, widgets.data ?? []], eventId);
  const hubItems: MemoriesItem[] = await Promise.all(
    hubRefs.map(async ({ ref, use }, i) => {
      const url = await displayUrlForStoredAsset(ref);
      return {
        id: `hub-${i}`,
        url,
        viewUrl: url,
        largeUrl: url,
        kind: 'photo' as const,
        source: 'seat' as const,
        tagged: false,
        tagSource: 'untagged' as const,
        capturedAt: '',
        capturedBy: use,
        memSource: 'hub' as const,
        look: 'ok' as const,
        table: 'hub' as const,
        challengeId: null,
        hubUse: use,
        // The Hub's own file is already the copy it serves (uploads compress in the browser) — save that.
        saveUrl: null,
        downloadUrl: url,
      };
    }),
  );

  // ── The day's moments (the Papic gallery's own rule — `lib/alaala-chapters.ts`) ─────────────────────────
  let chapters: EventMemoriesRead['chapters'] = null;
  if (blocksRes && blocksRes.length > 0 && items.length > 0) {
    const { days } = groupIntoChapters({
      frames: items.map((p) => ({ id: p.id, capturedAt: p.capturedAt })),
      blocks: blocksRes.map((b) => ({
        blockId: b.block_id,
        label: b.label,
        startAt: b.start_at,
        endAt: b.end_at,
        actualStartAt: b.actual_start_at,
        actualEndAt: b.actual_end_at,
      })),
      tz: DEFAULT_EVENT_TZ,
    });
    const flat = days.flatMap((d) => d.chapters);
    chapters = flat.length > 1 ? flat.map((c) => ({ key: c.key, label: c.label, time: null, photoIds: c.frames.map((f) => f.id) })) : null;
  }

  return {
    items: [...items, ...hubItems],
    challenges,
    chapters,
    blockedGuests: ((blockedRes.data ?? []) as { blocked_guest_id: string | null }[])
      .map((b) => b.blocked_guest_id)
      .filter((g): g is string => typeof g === 'string'),
    suppliers: ((suppliersRes.data ?? []) as { vendor_id: string; linked_vendor_profile_id: string; vendor_name: string | null; papic_captures_hidden: boolean | null }[]).map(
      (v) => ({ vendorProfileId: v.linked_vendor_profile_id, vendorRowId: v.vendor_id, name: (v.vendor_name ?? '').trim() || 'Your supplier', hidden: v.papic_captures_hidden === true }),
    ),
    refused: { photos: status.refused.length > 0, hub: hubRefused, challenges: challengesRefused, reports: Boolean(reportsRes.error) },
  };
}

/**
 * The booked suppliers who have shot at this event, each with its whole-delivery switch — for the supplier's own row
 * in Event Details › Event access (owner 2026-10-23: "a supplier's whole delivery is hidden from the supplier's own
 * row"). Keyed by `event_vendors.vendor_id`. Null when either read was refused — the rows then draw no switch.
 */
export async function readSupplierShots(supabase: SupabaseClient, eventId: string): Promise<Record<string, { hidden: boolean }> | null> {
  const [vendors, shots] = await Promise.all([
    supabase
      .from('event_vendors')
      .select('vendor_id, linked_vendor_profile_id, papic_captures_hidden')
      .eq('event_id', eventId)
      .not('linked_vendor_profile_id', 'is', null),
    supabase.from('vendor_papic_captures').select('vendor_profile_id').eq('event_id', eventId),
  ]);
  if (vendors.error || shots.error) {
    if (vendors.error) logQueryError('readSupplierShots.vendors', vendors.error, { event_id: eventId }, 'graceful_degrade');
    if (shots.error) logQueryError('readSupplierShots.shots', shots.error, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  const shooters = new Set((shots.data ?? []).map((r) => (r as { vendor_profile_id: string | null }).vendor_profile_id).filter(Boolean));
  const out: Record<string, { hidden: boolean }> = {};
  for (const v of (vendors.data ?? []) as { vendor_id: string; linked_vendor_profile_id: string | null; papic_captures_hidden: boolean | null }[]) {
    if (v.linked_vendor_profile_id && shooters.has(v.linked_vendor_profile_id)) out[v.vendor_id] = { hidden: v.papic_captures_hidden === true };
  }
  return out;
}

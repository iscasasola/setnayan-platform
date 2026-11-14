import 'server-only';

/**
 * 🏷 A SUPPLIER TAGS ITS EVENT PHOTOS TO INSPIRATIONS — server reads (DECISION_LOG 2026-11-14; migration 20271345380761).
 *
 * 🔑 `event_file_id` IS GRANTED TO NOBODY BUT THE SERVICE ROLE (like `source_event_id`), so every read of it here takes
 * the service-role client — always scoped by a shop the CALLER already proved (the picked-client page's own shop), never
 * one the browser sent.
 *
 * 🔑 THE SERVICE ROLE SKIPS THE PUBLIC READ POLICY, so a public reader on it (the shop page) must ask the listing rule
 * itself: `shownTagFilter` keeps a Files tag only while its photo is in `event_supplier_photos_listed` — the same view
 * the policy asks through `inspiration_photo_is_on_the_shop`. Nothing reaches an inspiration before the shop shows it.
 *
 * A refused read is `null` — said by the caller, never drawn as "no tags".
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { getInspirationParts } from '@/lib/inspiration-parts-db';
import { inspirationPartsInOrder } from '@/lib/inspiration-parts';
import { canonicalServicesForSlot } from '@/lib/moodboard-gallery';
import { libraryUploadVerdict, libraryPartLabel } from '@/lib/moodboard-gallery-upload';
import { cardsForPart } from '@/lib/inspiration-card-link';
import { readShopCards } from '@/lib/inspiration-card-link.server';
import { eventTypeLabel } from '@/lib/demand-radar';
import { eventLineWords, tagStateOf, type FileTag, type OfferedPart, type TagPart } from '@/lib/inspiration-tags';
import type { EventFile } from '@/lib/supplier-files.server';

export type EventTagBoard = {
  tags: FileTag[];
  /** Per quoted service card: the inspirations it offers (ruling 3 — `inspiration_part_services`). */
  offered: Record<string, OfferedPart[]>;
};

/**
 * The Files board's tags and choices for ONE event of ONE shop. `admin` is the service-role client; `shop` is the shop
 * the page resolved for the signed-in supplier.
 */
export async function readEventTagBoard(
  admin: SupabaseClient,
  args: { eventId: string; shop: string; files: readonly EventFile[]; quotedIds: readonly string[] },
): Promise<EventTagBoard | null> {
  const photoIds = args.files.filter((f) => f.grp === 'service' && f.kind === 'photo').map((f) => f.fileId);
  const [tagsRes, listedRes, cards, prof, parts] = await Promise.all([
    photoIds.length
      ? admin
          .from('moodboard_library_assets')
          .select('asset_id, event_file_id, asset_subtype, approved_at, rejected_at, rejection_reason')
          .eq('vendor_profile_id', args.shop)
          .eq('asset_type', 'supplier_gallery')
          .in('event_file_id', photoIds)
          .is('retired_at', null)
      : Promise.resolve({ data: [], error: null }),
    photoIds.length
      ? admin.from('event_supplier_photos_listed').select('file_id').eq('event_id', args.eventId).eq('vendor_profile_id', args.shop)
      : Promise.resolve({ data: [], error: null }),
    readShopCards(admin, args.shop),
    admin.from('vendor_profiles').select('services').eq('vendor_profile_id', args.shop).maybeSingle(),
    getInspirationParts(),
  ]);
  const err = tagsRes.error ?? listedRes.error ?? prof.error;
  if (err || cards === null) {
    if (err) logQueryError('readEventTagBoard', err, { event_id: args.eventId }, 'graceful_degrade');
    return null;
  }
  const listed = new Set(((listedRes.data ?? []) as { file_id: string }[]).map((r) => r.file_id));
  const byId = new Map(args.files.map((f) => [f.fileId, f]));
  const tags: FileTag[] = (
    (tagsRes.data ?? []) as {
      asset_id: string;
      event_file_id: string;
      asset_subtype: string;
      approved_at: string | null;
      rejected_at: string | null;
      rejection_reason: string | null;
    }[]
  ).map((r) => ({
    assetId: r.asset_id,
    fileId: r.event_file_id,
    slotKey: r.asset_subtype,
    label: libraryPartLabel(r.asset_subtype, parts) ?? 'Inspiration',
    state: tagStateOf(r, { listed: listed.has(r.event_file_id), shopState: byId.get(r.event_file_id)?.state ?? null }),
    reason: r.rejection_reason,
  }));

  const services = ((prof.data as { services: string[] | null } | null)?.services ?? []) as string[];
  const ordered = inspirationPartsInOrder(parts).filter((p) => p.kind === 'part');
  const offered: Record<string, OfferedPart[]> = {};
  for (const id of args.quotedIds) {
    const card = cards.find((c) => c.vendor_service_id === id);
    offered[id] = card
      ? ordered
          .filter((p) => cardsForPart([card], canonicalServicesForSlot(p.slotKey, parts)).length > 0)
          .filter((p) => libraryUploadVerdict(p.slotKey, services, parts).allowed)
          .map((p) => ({ slotKey: p.slotKey, label: p.label }))
      : [];
  }
  return { tags, offered };
}

/**
 * For a public read on the SERVICE ROLE: which of these rows may show. A row with no Files photo is unaffected; a Files
 * tag shows only while its photo is listed. `null` = the listing could not be read — the caller shows NO Files tag then
 * (fail closed), never all of them.
 */
export async function shownTagFilter(
  admin: SupabaseClient,
  rows: readonly { event_file_id: string | null }[],
): Promise<((row: { event_file_id: string | null }) => boolean) | null> {
  const fileIds = [...new Set(rows.map((r) => r.event_file_id).filter((x): x is string => Boolean(x)))];
  if (fileIds.length === 0) return () => true;
  const listed = new Set<string>();
  for (let i = 0; i < fileIds.length; i += 200) {
    const { data, error } = await admin.from('event_supplier_photos_listed').select('file_id').in('file_id', fileIds.slice(i, i + 200));
    if (error) {
      logQueryError('shownTagFilter', error, { files: fileIds.length }, 'graceful_degrade');
      return null;
    }
    for (const r of (data ?? []) as { file_id: string }[]) listed.add(r.file_id);
  }
  return (row) => !row.event_file_id || listed.has(row.event_file_id);
}

/** The shop page's gate for `fetchShopInspirationLooks` — the listed Files photos among these, on the service role. */
export function listedFilesGate(admin: SupabaseClient): (fileIds: readonly string[]) => Promise<ReadonlySet<string> | null> {
  return async (fileIds) => {
    const keep = await shownTagFilter(admin, fileIds.map((id) => ({ event_file_id: id })));
    if (!keep) return null;
    return new Set(fileIds.filter((id) => keep({ event_file_id: id })));
  };
}

/** One tagged photo's public line: "Wedding · Makati Shangri-La · Sep 2026", and the other parts it is also in. */
export type TagEventLine = { line: string | null; alsoIn: { slotKey: string; label: string }[] };

/**
 * The event line for public tags (ruling 4) — through `inspiration_tag_event_lines`, which answers only for a tag that
 * is publicly readable right now and returns type · venue · month (never a name, never an id). Works on any client.
 * A refused read is an empty map: the tile then simply carries no line — it never guesses one.
 */
export async function readTagEventLines(client: SupabaseClient, assetIds: readonly string[]): Promise<Map<string, TagEventLine>> {
  const out = new Map<string, TagEventLine>();
  const ids = [...new Set(assetIds)].slice(0, 500);
  if (ids.length === 0) return out;
  const [{ data, error }, parts] = await Promise.all([client.rpc('inspiration_tag_event_lines', { p_asset_ids: ids }), getInspirationParts()]);
  if (error) {
    logQueryError('readTagEventLines', error, { assets: ids.length }, 'graceful_degrade');
    return out;
  }
  for (const r of (data ?? []) as { asset_id: string; event_type: string | null; venue_name: string | null; event_month: string | null; also_in: string[] | null }[]) {
    out.set(r.asset_id, {
      line: eventLineWords({ typeLabel: r.event_type ? eventTypeLabel(r.event_type) : null, venue: r.venue_name, month: r.event_month }),
      alsoIn: (r.also_in ?? []).map((k) => ({ slotKey: k, label: libraryPartLabel(k, parts) ?? 'Inspiration' })),
    });
  }
  return out;
}

/**
 * Frames 6–7: the inspirations each Files photo is IN (approved, not retired, not refused) — keyed by file id. On the
 * service role (`event_file_id` is granted to nobody else), scoped to the shop the caller proved. `null` = unread —
 * the album then simply carries no inspiration row (never a wrong one).
 */
export async function readAlbumTags(admin: SupabaseClient, shop: string, fileIds: readonly string[]): Promise<Map<string, TagPart[]> | null> {
  const ids = [...new Set(fileIds)];
  const out = new Map<string, TagPart[]>();
  if (ids.length === 0) return out;
  const parts = await getInspirationParts();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await admin
      .from('moodboard_library_assets')
      .select('event_file_id, asset_subtype')
      .eq('vendor_profile_id', shop)
      .eq('asset_type', 'supplier_gallery')
      .in('event_file_id', ids.slice(i, i + 200))
      .not('approved_at', 'is', null)
      .is('retired_at', null)
      .is('rejected_at', null);
    if (error) {
      logQueryError('readAlbumTags', error, { files: ids.length }, 'graceful_degrade');
      return null;
    }
    for (const r of (data ?? []) as { event_file_id: string; asset_subtype: string }[]) {
      const list = out.get(r.event_file_id) ?? [];
      list.push({ slotKey: r.asset_subtype, label: libraryPartLabel(r.asset_subtype, parts) ?? 'Inspiration' });
      out.set(r.event_file_id, list);
    }
  }
  return out;
}

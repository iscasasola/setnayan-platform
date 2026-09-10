/**
 * event-media-sweep-core.ts — WHICH OBJECTS "Remove for good" MAY DELETE.
 *
 * Pure, so the rule is a unit test. The I/O half (read the rows, then delete)
 * is `lib/event-media-sweep.ts`.
 *
 * ─── WHY THIS IS NOT JUST "THE MEDIA BUCKET" ANY MORE (2026-09-10) ─────────
 * The sweep used to keep any `r2://setnayan-media/…` ref it found on the event's
 * rows and delete it with the admin client once the event was gone. The bucket
 * pin was real and it was not enough: `setnayan-media` holds EVERY couple's
 * photographs and EVERY supplier's logo, and the rows it reads are ones their
 * owners can write — a couple held UPDATE on their own photo's `r2_object_key`
 * and on their event's hero, film, music and `our_photos`, a booked supplier held
 * INSERT/UPDATE on their capture's keys. So a couple could put another couple's
 * photograph, or a supplier's logo, onto their own row, press "Remove for good"
 * on their own celebration, and our job would delete the stranger's file. No
 * admin step; the owner's ruling lets a couple delete their own event.
 *
 * Every ref is now held to the folder its OWN row's writer files it in:
 *   • papic_photos            → `papic/event-<event_id>/…` (+ `derivatives/…`)
 *   • vendor_papic_captures   → `papic/vendor-<vendor_profile_id>/event-<event_id>/…`
 *   • the event row's media   → `events/<event_id>/…`
 * Anything else is REFUSED and counted — never obeyed, never guessed at.
 *
 * ⛔ Still by KEY, never by prefix listing (see the I/O file): a listing under
 * an event-shaped prefix would reach dispute evidence and paperwork in other
 * buckets. And CHAT ATTACHMENTS are still not swept — owner ruled KEEP.
 */
import {
  eventSiteMediaScope,
  papicSeatCaptureScope,
  papicVendorCaptureScope,
  planCleanupDelete,
  type CleanupScope,
  type PlannedDelete,
} from '@/lib/cleanup-delete-scope';

/**
 * Every R2 key a papic capture can carry. SEVEN per row, not one — the original
 * plus six derivatives. Deleting only `r2_object_key` would leave the display,
 * thumbnail, poster, tile, wall-safe and web-clip copies fetchable at plain
 * URLs, which is the same defect one layer down: the photograph is still there,
 * just at a different address.
 */
export const PAPIC_KEY_COLUMNS = [
  'r2_object_key',
  'display_r2_key',
  'thumb_r2_key',
  'poster_r2_key',
  'tile_r2_key',
  'wall_safe_r2_key',
  'clip_web_r2_key',
] as const;

/**
 * A SUPPLIER'S OWN CAPTURES at this celebration (`vendor_papic_captures`).
 *
 * 🔑 THE ROWS CASCADE; THE FILES DO NOT. That table's `event_id` is
 * `ON DELETE CASCADE`, so deleting the celebration removes every row — and with
 * the rows go the only records of which objects those photographs were. The
 * owner's ruling of 2026-08-20 is that when a couple deletes their own
 * celebration the photographs go with it, supplier captures included.
 *
 * `vendor_profile_id` is read with the keys because it is half the tenant.
 */
export const VENDOR_CAPTURE_KEY_COLUMNS = ['r2_object_key', 'poster_r2_key'] as const;

/** The event's own website media — hero, film, music, the delivered song. */
export const EVENT_KEY_COLUMNS = [
  'landing_page_hero_image_url',
  'landing_page_hero_video_r2_key',
  'site_bg_music_r2_key',
  'pakanta_song_r2_key',
] as const;

/** JSONB columns holding arrays of refs (or of objects carrying one). */
export const EVENT_JSON_COLUMNS = ['our_photos', 'photo_wall_photos'] as const;

export type EventMediaRows = {
  eventId: string;
  photos: readonly Record<string, unknown>[];
  captures: readonly Record<string, unknown>[];
  event: Record<string, unknown> | null;
};

export type EventMediaPlan = {
  /** Objects proven to be this celebration's own — de-duplicated. */
  deletes: PlannedDelete[];
  /** Non-empty refs that were not — kept, counted. */
  refused: number;
};

/**
 * Decide every object "Remove for good" may delete for one celebration.
 *
 * ⚠ The tenant for a Papic row is the EVENT BEING DELETED, not the row's own
 * `event_id` column: the rows were read `.eq('event_id', eventId)`, so the two
 * agree, and using the argument means a row that somehow carries another event
 * id cannot widen the scope to that event.
 */
export function planEventMediaDeletes(rows: EventMediaRows): EventMediaPlan {
  const deletes: PlannedDelete[] = [];
  const seen = new Set<string>();
  let refused = 0;

  const consider = (raw: unknown, scope: CleanupScope): void => {
    if (typeof raw !== 'string' || raw.trim().length === 0) return;
    // A bare key with no r2:// prefix cannot be placed in a bucket with any
    // confidence here, and guessing is how a sweep deletes somebody else's
    // object — kept, and counted, exactly as before this file existed.
    if (!raw.trim().startsWith('r2://')) {
      refused += 1;
      return;
    }
    const decision = planCleanupDelete(raw, scope);
    if (!decision.ok) {
      refused += 1;
      return;
    }
    // One key can appear twice (a hero photo also listed in our_photos), and
    // deleting an already-deleted object is a wasted round trip, not an error.
    const id = `${decision.target.bucket}/${decision.target.key}`;
    if (seen.has(id)) return;
    seen.add(id);
    deletes.push(decision.target);
  };

  const photoScope = papicSeatCaptureScope(rows.eventId);
  for (const row of rows.photos) {
    for (const col of PAPIC_KEY_COLUMNS) consider(row[col], photoScope);
  }

  for (const row of rows.captures) {
    const scope = papicVendorCaptureScope(row.vendor_profile_id, rows.eventId);
    for (const col of VENDOR_CAPTURE_KEY_COLUMNS) consider(row[col], scope);
  }

  if (rows.event) {
    const siteScope = eventSiteMediaScope(rows.eventId);
    for (const col of EVENT_KEY_COLUMNS) consider(rows.event[col], siteScope);
    for (const col of EVENT_JSON_COLUMNS) {
      const value = rows.event[col];
      if (!Array.isArray(value)) continue;
      for (const entry of value) {
        if (typeof entry === 'string') consider(entry, siteScope);
        else if (entry && typeof entry === 'object') {
          const o = entry as Record<string, unknown>;
          consider(o.r2_key ?? o.key ?? o.url ?? o.src, siteScope);
        }
      }
    }
  }

  return { deletes, refused };
}

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_R2_BUCKET } from '@/lib/r2-client-ref';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { logQueryError } from '@/lib/supabase/error-detect';
import { posterPhotoRefAllowed } from '@/lib/print-pieces';

/**
 * lib/day-poster-photos.server.ts — 🖼 WHERE THE OUR DAY POSTER'S PHOTOS COME FROM (drawing v4, "Approved 13 Nov":
 * *"Photos may come from Memories, their photographer's delivered set, or the phone gallery."*).
 *
 *   · MEMORIES — the event's Papic frames: the crew's seat cameras (`papic_photos`), the guests' (`papic_guest_captures`)
 *     and a supplier's on-the-day shots (`vendor_papic_captures` — the photographer's Papic set). The same safety rules
 *     Memories applies (`fetchPapicGallery`): clean, not hidden, not expired; a supplier's frames only once NSFW-checked,
 *     never a supplier the couple hid. The tile shows the small web copy; the poster PRINTS the full-size original while
 *     it is kept (`full_res_dropped_at` unset — the 92-day sweep, `runFullResDropSweep`), else the 1280 web copy.
 *   · THE PHONE — the couple's own upload, under `events/<event>/poster/` (`posterPhotoRefAllowed`, the Our Story poster's
 *     shipped rule).
 *
 * ⚠ A SUPPLIER'S DELIVERED GALLERY (`supplier_media` · `event_supplier_files` · the private `setnayan-thread-files`
 * bucket) is NOT offered here. Measured 2026-11-23: no job compresses it — the 92-day sweep touches only the three Papic
 * tables — so the 13 Nov ruling "the photographer's photos follow the same date" is not what ships for that set. That is
 * the owner's call before it becomes a pick source; see the PR's STATUS.
 *
 * ONE reader: the builder lists from it, and the route refuses any ref it does not name (`dayPosterRefAllowed`).
 */

export type DayPosterPick = {
  /** What the record stores and the print draws: the original while kept, else the web copy. */
  ref: string;
  /** A small copy for the builder's tile (signed). Null: could not be signed — the tile says so. */
  thumbUrl: string | null;
  source: 'memories' | 'supplier' | 'upload';
  /** The ref is the full-size original (crisp at wall sizes). */
  full: boolean;
};

export type DayPosterPicks = { picks: DayPosterPick[]; refused: boolean };

const LIMIT = 120;

/** A stored key or ref → `r2://<public bucket>/<key>` (the Papic tables hold either form). */
export function asPublicRef(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  if (s.startsWith('r2://')) return s;
  if (/^https?:/.test(s) || s.includes('..')) return null;
  return `r2://${PUBLIC_R2_BUCKET}/${s.replace(/^\/+/, '')}`;
}

type Row = Record<string, unknown>;

function pickOf(r: Row): { ref: string; thumb: string | null; full: boolean } | null {
  const original = r.full_res_dropped_at ? null : asPublicRef(r.r2_object_key);
  const web = asPublicRef(r.display_r2_key) ?? asPublicRef(r.tile_r2_key);
  const ref = original ?? web;
  if (!ref) return null;
  return { ref, thumb: asPublicRef(r.thumb_r2_key) ?? asPublicRef(r.tile_r2_key) ?? web, full: Boolean(original) };
}

/**
 * Every photo the couple may put on their poster, newest first. `refused` = a read was refused — the builder says
 * "Couldn't read your Memories", never an empty gallery.
 */
export async function readDayPosterPicks(admin: SupabaseClient, eventId: string, opts: { sign?: boolean } = {}): Promise<DayPosterPicks> {
  const now = Date.now();
  const [seat, guest, vendor, hidden] = await Promise.all([
    admin
      .from('papic_photos')
      .select('photo_id, r2_object_key, display_r2_key, tile_r2_key, thumb_r2_key, full_res_dropped_at, photo_type, moderation_state, hidden_at, expires_at, captured_at')
      .eq('event_id', eventId)
      .eq('photo_type', 'photo')
      .eq('moderation_state', 'clean')
      .order('captured_at', { ascending: false })
      .limit(LIMIT),
    admin
      .from('papic_guest_captures')
      .select('capture_id, r2_object_key, display_r2_key, tile_r2_key, thumb_r2_key, full_res_dropped_at, media_type, moderation_state, hidden_at, captured_at')
      .eq('event_id', eventId)
      .eq('media_type', 'photo')
      .eq('moderation_state', 'clean')
      .order('captured_at', { ascending: false })
      .limit(LIMIT),
    admin
      .from('vendor_papic_captures')
      .select('capture_id, vendor_profile_id, r2_object_key, display_r2_key, tile_r2_key, thumb_r2_key, full_res_dropped_at, media_type, hidden_at, nsfw_checked, consent_basis, captured_at')
      .eq('event_id', eventId)
      .eq('media_type', 'photo')
      .eq('nsfw_checked', true)
      .order('captured_at', { ascending: false })
      .limit(LIMIT),
    admin.from('event_vendors').select('linked_vendor_profile_id').eq('event_id', eventId).eq('papic_captures_hidden', true).not('linked_vendor_profile_id', 'is', null),
  ]);
  const refused = Boolean(seat.error || guest.error || vendor.error || hidden.error);
  for (const [site, r] of [['seat', seat], ['guest', guest], ['vendor', vendor], ['hidden', hidden]] as const) {
    if (r.error) logQueryError(`day-poster.picks.${site}`, r.error, { event_id: eventId }, 'graceful_degrade');
  }
  const hiddenShops = new Set(((hidden.data ?? []) as Row[]).map((r) => String(r.linked_vendor_profile_id)));
  const rows: Array<{ r: Row; source: DayPosterPick['source']; at: string }> = [];
  for (const r of (seat.data ?? []) as Row[]) {
    if (r.moderation_state !== 'clean' || r.hidden_at) continue;
    if (r.expires_at && new Date(String(r.expires_at)).getTime() <= now) continue;
    rows.push({ r, source: 'memories', at: String(r.captured_at ?? '') });
  }
  for (const r of (guest.data ?? []) as Row[]) {
    if (r.moderation_state !== 'clean' || r.hidden_at) continue;
    rows.push({ r, source: 'memories', at: String(r.captured_at ?? '') });
  }
  // A supplier's frames: fail CLOSED when the "which suppliers did the couple hide?" read was refused.
  if (!hidden.error) {
    for (const r of (vendor.data ?? []) as Row[]) {
      if (hiddenShops.has(String(r.vendor_profile_id)) || r.nsfw_checked !== true || r.consent_basis === 'pending_dpo_ruling' || r.hidden_at) continue;
      rows.push({ r, source: 'supplier', at: String(r.captured_at ?? '') });
    }
  }
  rows.sort((a, b) => b.at.localeCompare(a.at));
  const built = rows.flatMap(({ r, source }) => {
    const p = pickOf(r);
    return p ? [{ ...p, source }] : [];
  });
  const picks = await Promise.all(
    built.map(async (p) => ({
      ref: p.ref,
      thumbUrl: opts.sign === false || !p.thumb ? null : await displayUrlForStoredAsset(p.thumb, { ttlSeconds: 3600 }).catch(() => null),
      source: p.source,
      full: p.full,
    })),
  );
  return { picks, refused };
}

/**
 * May this ref sit on this event's poster? The couple's own upload for THIS event (the shipped rule), or a photo the
 * one reader above lists for it. Never a ref that only LOOKS like an event's.
 */
export function dayPosterRefAllowed(ref: string, eventId: string, listed: ReadonlySet<string>): boolean {
  if (typeof ref !== 'string' || ref.length > 600 || ref.includes('..')) return false;
  return posterPhotoRefAllowed(ref, eventId) || listed.has(ref);
}

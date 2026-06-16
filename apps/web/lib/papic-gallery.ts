import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { displayUrlForStoredAsset } from '@/lib/uploads';

// The couple's real Papic gallery — both crew (paparazzi) captures and guest
// captures, with presigned thumbnails. Reads under the COUPLE's RLS session
// (papic_photos_couple_full + papic_guest_captures_couple_read), so it runs on
// the auth-bound dashboard page only.
//
// What's filtered OUT: NSFW-blocked (moderation_state), couple-hidden (hidden_at),
// and EXPIRED free-sampler photos (expires_at in the past — the read-time half of
// the 30-day sampler retention). "Untagged-still-delivered" is honoured — a
// missing tag never drops a photo, it just shows as untagged.

export type GalleryTagSource = 'auto_face' | 'qr' | 'manual' | 'untagged';

export type GalleryPhoto = {
  id: string;
  url: string | null;
  kind: 'photo' | 'clip';
  tagged: boolean;
  tagSource: GalleryTagSource;
  capturedAt: string;
};

const GALLERY_LIMIT = 120;

function mapTagSource(source: string | undefined): GalleryTagSource {
  if (!source) return 'untagged';
  if (source === 'auto_face') return 'auto_face';
  if (source === 'manual_pick') return 'manual';
  return 'qr'; // individual_qr | table_qr
}

export async function fetchPapicGallery(
  supabase: SupabaseClient,
  eventId: string,
): Promise<GalleryPhoto[]> {
  const now = Date.now();

  const [seatRes, guestRes] = await Promise.all([
    supabase
      .from('papic_photos')
      .select(
        'photo_id, r2_object_key, poster_r2_key, photo_type, captured_at, moderation_state, hidden_at, expires_at',
      )
      .eq('event_id', eventId)
      .order('captured_at', { ascending: false })
      .limit(GALLERY_LIMIT),
    supabase
      .from('papic_guest_captures')
      .select('capture_id, r2_object_key, captured_at, hidden_at, moderation_state')
      .eq('event_id', eventId)
      .order('captured_at', { ascending: false })
      .limit(GALLERY_LIMIT),
  ]);

  // Graceful-degrade: a missing table/column (pre-migration) → empty, never crash.
  const seatRows = seatRes.error ? [] : (seatRes.data ?? []);
  const guestRows = guestRes.error ? [] : (guestRes.data ?? []);

  const visibleSeat = seatRows.filter(
    (r) =>
      r.moderation_state !== 'nsfw_blocked' &&
      !r.hidden_at &&
      (!r.expires_at || new Date(r.expires_at as string).getTime() > now),
  );
  const visibleGuest = guestRows.filter(
    (r) => r.moderation_state !== 'nsfw_blocked' && !r.hidden_at,
  );

  // Tags — best-effort. If photo_tags isn't couple-readable / absent, every photo
  // simply shows as untagged (still delivered).
  const tagSourceByKey = new Map<string, string>();
  try {
    const { data: tags } = await supabase
      .from('photo_tags')
      .select('source_table, source_id, source')
      .eq('event_id', eventId);
    for (const t of tags ?? []) {
      const key = `${t.source_table as string}:${t.source_id as string}`;
      const existing = tagSourceByKey.get(key);
      // Prefer a QR/manual human tag over an auto_face guess for the dot colour.
      if (!existing || (existing === 'auto_face' && t.source !== 'auto_face')) {
        tagSourceByKey.set(key, t.source as string);
      }
    }
  } catch {
    /* untagged fallback */
  }

  type Pre = Omit<GalleryPhoto, 'url'> & { ref: string | null };

  const seatPhotos: Pre[] = visibleSeat.map((r) => {
    const isClip = r.photo_type === 'clip';
    const tagSrc = tagSourceByKey.get(`papic_photos:${r.photo_id as string}`);
    return {
      id: r.photo_id as string,
      // Clips show their poster frame as the thumbnail; fall back to the object.
      ref:
        (isClip ? (r.poster_r2_key as string | null) : (r.r2_object_key as string | null)) ??
        (r.r2_object_key as string | null),
      kind: isClip ? 'clip' : 'photo',
      tagged: Boolean(tagSrc),
      tagSource: mapTagSource(tagSrc),
      capturedAt: r.captured_at as string,
    };
  });

  const guestPhotos: Pre[] = visibleGuest.map((r) => {
    const tagSrc = tagSourceByKey.get(`papic_guest_captures:${r.capture_id as string}`);
    return {
      id: r.capture_id as string,
      ref: r.r2_object_key as string | null,
      kind: 'photo',
      tagged: Boolean(tagSrc),
      tagSource: mapTagSource(tagSrc),
      capturedAt: r.captured_at as string,
    };
  });

  const merged = [...seatPhotos, ...guestPhotos].sort(
    (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
  );

  return Promise.all(
    merged.map(async ({ ref, ...rest }) => ({
      ...rest,
      url: ref ? await displayUrlForStoredAsset(ref) : null,
    })),
  );
}

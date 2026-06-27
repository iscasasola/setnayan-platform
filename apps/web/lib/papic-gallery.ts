import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { displayUrlForStoredAsset } from '@/lib/uploads';

// The couple's real Papic gallery — both crew (paparazzi) captures and guest
// captures, with presigned thumbnails. Reads under the COUPLE's RLS session
// (papic_photos_couple_full + papic_guest_captures_couple_read), so it runs on
// the auth-bound dashboard page only.
//
// What's filtered OUT: NSFW-blocked (moderation_state), couple-hidden (hidden_at),
// and any photo past its expires_at (a vestigial column — no capture path sets
// it any more, so this filter is a no-op kept for safety).
// "Untagged-still-delivered" is honoured — a
// missing tag never drops a photo, it just shows as untagged.

export type GalleryTagSource = 'auto_face' | 'qr' | 'manual' | 'untagged';

export type GalleryPhoto = {
  id: string;
  url: string | null;
  /** Presigned URL of the actual VIDEO for clips (so the gallery can play it),
   *  null for photos. `url` stays the poster/thumb for the tile either way. */
  playUrl?: string | null;
  kind: 'photo' | 'clip';
  // Which capture table the row lives in. The showcase-approval toggle routes
  // to the matching action: seat clips flip papic_photos, guest clips flip
  // papic_guest_captures. (Photos never carry a showcase gate.)
  source: 'seat' | 'guest';
  tagged: boolean;
  tagSource: GalleryTagSource;
  capturedAt: string;
  // Alaala showcase orb gates (CLIPS only — both seat clips AND guest clips now
  // carry them; photos leave these undefined). `showcaseApproved` is the COUPLE
  // gate the gallery toggle flips; `showcaseConsent` is the GUEST gate. For
  // GUEST clips the guest sets consent at capture time (Option A); for SEAT
  // clips the appearing-guest consent is a separate follow-up. The orb surfaces
  // a clip only when BOTH are true, so the gallery can show the couple whether
  // their approved clip is live or still waiting on consent.
  showcaseApproved?: boolean;
  showcaseConsent?: boolean;
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
        'photo_id, r2_object_key, poster_r2_key, display_r2_key, thumb_r2_key, photo_type, captured_at, moderation_state, hidden_at, expires_at, consent_to_public, couple_approved_for_showcase',
      )
      .eq('event_id', eventId)
      .order('captured_at', { ascending: false })
      .limit(GALLERY_LIMIT),
    supabase
      .from('papic_guest_captures')
      .select(
        'capture_id, r2_object_key, poster_r2_key, display_r2_key, thumb_r2_key, media_type, captured_at, hidden_at, moderation_state, consent_to_public, couple_approved_for_showcase',
      )
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
      .eq('event_id', eventId)
      .is('removed_at', null); // a guest's "not me" tombstone stops colouring the dot
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

  type Pre = Omit<GalleryPhoto, 'url' | 'playUrl'> & {
    ref: string | null;
    videoRef: string | null;
  };

  const seatPhotos: Pre[] = visibleSeat.map((r) => {
    const isClip = r.photo_type === 'clip';
    const tagSrc = tagSourceByKey.get(`papic_photos:${r.photo_id as string}`);
    return {
      id: r.photo_id as string,
      // Prefer the cheap thumb derivative for the tile, then display, then the
      // existing poster (clips) / original (photos). Pre-migration rows have
      // null derivatives and fall back to the original — no breakage.
      ref:
        (r.thumb_r2_key as string | null) ??
        (r.display_r2_key as string | null) ??
        (isClip ? (r.poster_r2_key as string | null) : (r.r2_object_key as string | null)) ??
        (r.r2_object_key as string | null),
      // The playable video lives at r2_object_key for a clip (the tile shows its
      // poster). Photos have no separate video.
      videoRef: isClip ? (r.r2_object_key as string | null) : null,
      kind: isClip ? 'clip' : 'photo',
      source: 'seat',
      tagged: Boolean(tagSrc),
      tagSource: mapTagSource(tagSrc),
      capturedAt: r.captured_at as string,
      // Showcase gates ride only on real clips (the orb plays clips). Coerce to
      // boolean; pre-migration rows (column absent) read undefined → false.
      showcaseApproved: isClip ? Boolean(r.couple_approved_for_showcase) : undefined,
      showcaseConsent: isClip ? Boolean(r.consent_to_public) : undefined,
    };
  });

  const guestPhotos: Pre[] = visibleGuest.map((r) => {
    // Guest captures are photos by default; a guest-RECORDED 5s clip carries
    // media_type='clip' (Option A). Clips show their poster frame as the
    // thumbnail; photos show the object itself. The showcase gates ride on guest
    // clips just like seat clips — the GUEST sets consent at capture time.
    const isClip = (r.media_type as string | undefined) === 'clip';
    const tagSrc = tagSourceByKey.get(`papic_guest_captures:${r.capture_id as string}`);
    return {
      id: r.capture_id as string,
      // Prefer the cheap thumb derivative for the tile, then display, then the
      // existing poster (clips) / original (photos). Pre-migration rows fall
      // back to the original — no breakage.
      ref:
        (r.thumb_r2_key as string | null) ??
        (r.display_r2_key as string | null) ??
        (isClip ? (r.poster_r2_key as string | null) : (r.r2_object_key as string | null)) ??
        (r.r2_object_key as string | null),
      videoRef: isClip ? (r.r2_object_key as string | null) : null,
      kind: isClip ? 'clip' : 'photo',
      source: 'guest',
      tagged: Boolean(tagSrc),
      tagSource: mapTagSource(tagSrc),
      capturedAt: r.captured_at as string,
      showcaseApproved: isClip ? Boolean(r.couple_approved_for_showcase) : undefined,
      showcaseConsent: isClip ? Boolean(r.consent_to_public) : undefined,
    };
  });

  const merged = [...seatPhotos, ...guestPhotos].sort(
    (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
  );

  return Promise.all(
    merged.map(async ({ ref, videoRef, ...rest }) => ({
      ...rest,
      url: ref ? await displayUrlForStoredAsset(ref) : null,
      playUrl: videoRef ? await displayUrlForStoredAsset(videoRef) : null,
    })),
  );
}

import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlsForStoredAssets } from '@/lib/uploads';
import { getGuestLiveGallery } from '@/lib/guest-live-gallery';
import { resolveEffectiveVisibility } from '@/lib/launch-save-the-date';
import { getSwitcherData, type SwitcherEvent } from '@/app/_components/account-switcher/get-switcher-data';

/**
 * Library › Photos & Videos — cross-event album aggregation.
 *
 * One album card per event the user is part of (OWNED + ATTENDED — owner chose
 * "include attended now" 2026-06-22). Each album carries a combined photo+clip
 * count and up to ~4 presigned thumbnail keys for a peek strip.
 *
 * Two read paths, by role:
 *
 *  • OWNED (role 'couple') — read under the user's RLS session (couple policies
 *    on papic_photos + papic_guest_captures), reusing the EXACT visibility filter
 *    from lib/papic-gallery.ts: drop moderation_state='nsfw_blocked', drop
 *    hidden_at, drop any expired rows (expires_at in the past — now vestigial). Clip
 *    thumbnail = poster_r2_key ?? r2_object_key. Both tables counted per event.
 *
 *  • ATTENDED (role 'guest') — RLS does NOT let a guest read those tables, so we
 *    MIRROR lib/guest-live-gallery.ts via the admin client: resolve the user's
 *    guest_id for the event (event_members.guest_id, the bind the join flow
 *    writes), then surface ONLY the photos the user is TAGGED in, gated to
 *    moderation_state='clean' + not hidden (getGuestLiveGallery applies exactly
 *    this). PRIVACY-CRITICAL: an attended album shows only the user's own tagged,
 *    clean photos — never untagged or unmoderated rows.
 *
 * Every per-event fetch is wrapped in try/catch and degrades to count 0 / no
 * thumbnails so a single bad event never throws the Library page.
 */

const THUMBS_PER_ALBUM = 4;
/** Cap rows scanned per owned table — count is approximate beyond this. */
const OWNED_SCAN_LIMIT = 500;

export type Album = {
  event: SwitcherEvent;
  role: 'couple' | 'guest';
  /** Combined photos + clips visible to the user for this event. */
  count: number;
  /** Up to THUMBS_PER_ALBUM presigned thumbnail URLs (newest first). */
  thumbs: { url: string; isClip: boolean }[];
  /**
   * Landing slug — populated ONLY when the event is effectively PUBLIC (a
   * stranger with the link can actually load the page). Anchors the Facebook
   * share link; a private/unlisted event stays null so no dead-link share card
   * is ever offered. See getPhotosAlbums().
   */
  slug: string | null;
};

export type PhotosAlbumsData = {
  albums: Album[];
  /** First album with a public slug — anchors the top "Share to Facebook" card. */
  shareEvent: { displayName: string; slug: string } | null;
};

type ThumbRef = { key: string; isClip: boolean; capturedAt: string };

/** OWNED: count both Papic tables + collect newest thumbnail keys (RLS session). */
async function loadOwnedAlbum(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
): Promise<{ count: number; refs: ThumbRef[] }> {
  const now = Date.now();

  const [seatRes, guestRes] = await Promise.all([
    supabase
      .from('papic_photos')
      .select('r2_object_key, poster_r2_key, display_r2_key, thumb_r2_key, photo_type, captured_at, moderation_state, hidden_at, expires_at')
      .eq('event_id', eventId)
      .order('captured_at', { ascending: false })
      .limit(OWNED_SCAN_LIMIT),
    supabase
      .from('papic_guest_captures')
      .select('r2_object_key, poster_r2_key, display_r2_key, thumb_r2_key, media_type, captured_at, moderation_state, hidden_at')
      .eq('event_id', eventId)
      .order('captured_at', { ascending: false })
      .limit(OWNED_SCAN_LIMIT),
  ]);

  // Graceful-degrade: a missing table/column (pre-migration) → empty, never crash.
  const seatRows = seatRes.error ? [] : seatRes.data ?? [];
  const guestRows = guestRes.error ? [] : guestRes.data ?? [];

  // Same visibility filter as lib/papic-gallery.ts.
  const visibleSeat = seatRows.filter(
    (r) =>
      r.moderation_state !== 'nsfw_blocked' &&
      !r.hidden_at &&
      (!r.expires_at || new Date(r.expires_at as string).getTime() > now),
  );
  const visibleGuest = guestRows.filter(
    (r) => r.moderation_state !== 'nsfw_blocked' && !r.hidden_at,
  );

  // Prefer the cheap thumb derivative for the album strip, then the existing
  // poster (clips) / original (photos). Pre-migration rows fall back — no break.
  const seatRefs: ThumbRef[] = visibleSeat.map((r) => {
    const isClip = r.photo_type === 'clip';
    const key =
      (r.thumb_r2_key as string | null) ??
      (isClip ? (r.poster_r2_key as string | null) : (r.r2_object_key as string | null)) ??
      (r.r2_object_key as string | null);
    return { key: key ?? '', isClip, capturedAt: r.captured_at as string };
  });
  const guestRefs: ThumbRef[] = visibleGuest.map((r) => {
    const isClip = (r.media_type as string | undefined) === 'clip';
    const key =
      (r.thumb_r2_key as string | null) ??
      (isClip ? (r.poster_r2_key as string | null) : (r.r2_object_key as string | null)) ??
      (r.r2_object_key as string | null);
    return { key: key ?? '', isClip, capturedAt: r.captured_at as string };
  });

  const refs = [...seatRefs, ...guestRefs]
    .filter((r) => r.key)
    .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());

  return { count: visibleSeat.length + visibleGuest.length, refs: refs.slice(0, THUMBS_PER_ALBUM) };
}

/**
 * ATTENDED: resolve the user's guest_id for the event, then reuse
 * getGuestLiveGallery — which returns ONLY the user's tagged, clean,
 * non-hidden photos (privacy gate). Returns count + thumb refs (no clips:
 * the guest live read is photos-only by design).
 */
async function loadAttendedAlbum(
  userId: string,
  eventId: string,
): Promise<{ count: number; refs: ThumbRef[] }> {
  const admin = createAdminClient();
  const { data: member } = await admin
    .from('event_members')
    .select('guest_id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();

  const guestId = (member?.guest_id as string | null | undefined) ?? null;
  if (!guestId) return { count: 0, refs: [] };

  const gallery = await getGuestLiveGallery(eventId, guestId, THUMBS_PER_ALBUM);
  if (!gallery) return { count: 0, refs: [] };

  // getGuestLiveGallery already presigns its URLs; surface them directly as
  // legacy_url refs so the shared presign step passes them through unchanged.
  const refs: ThumbRef[] = gallery.photos.map((p) => ({
    key: p.url,
    isClip: false,
    capturedAt: '',
  }));
  return { count: gallery.total, refs };
}

export async function getPhotosAlbums(userId: string): Promise<PhotosAlbumsData> {
  const { events } = await getSwitcherData(userId);

  // Public-landing slugs (for the Facebook share link) — best-effort under the
  // user's RLS session; degrades to no-slug if the column/policy is unavailable.
  // PRIVACY/CORRECTNESS: only an EFFECTIVELY-PUBLIC event contributes a slug. A
  // share link is broadcast to the world, so an unlisted/private (or
  // scheduled-but-not-yet-due) event would hand out a link that lands the
  // recipient on a locked/404 page. resolveEffectiveVisibility is the same
  // gate app/[slug] renders through, so the share card and the page agree.
  const supabase = await createClient();
  const slugByEvent = new Map<string, string>();
  if (events.length > 0) {
    try {
      const { data: slugRows } = await supabase
        .from('events')
        .select('event_id, slug, landing_page_visibility, scheduled_launch_at, std_launched_at')
        .in('event_id', events.map((e) => e.event_id));
      for (const row of slugRows ?? []) {
        const slug = (row.slug as string | null) ?? null;
        if (!slug) continue;
        const effective = resolveEffectiveVisibility({
          landing_page_visibility: row.landing_page_visibility as
            | 'public'
            | 'unlisted'
            | 'private'
            | null,
          scheduled_launch_at: row.scheduled_launch_at as string | null,
          std_launched_at: row.std_launched_at as string | null,
        });
        if (effective === 'public') slugByEvent.set(row.event_id as string, slug);
      }
    } catch {
      /* slug unavailable — share card hides */
    }
  }

  const albums: Album[] = await Promise.all(
    events.map(async (event) => {
      let count = 0;
      let refs: ThumbRef[] = [];
      try {
        const loaded =
          event.role === 'couple'
            ? await loadOwnedAlbum(supabase, event.event_id)
            : await loadAttendedAlbum(userId, event.event_id);
        count = loaded.count;
        refs = loaded.refs;
      } catch {
        // One bad event never breaks the page — degrade to empty album.
        count = 0;
        refs = [];
      }

      let thumbs: { url: string; isClip: boolean }[] = [];
      try {
        const urls = await displayUrlsForStoredAssets(refs.map((r) => r.key));
        thumbs = urls.map((url, i) => ({ url, isClip: refs[i]?.isClip ?? false }));
      } catch {
        thumbs = [];
      }

      return {
        event,
        role: event.role,
        count,
        thumbs,
        slug: slugByEvent.get(event.event_id) ?? null,
      };
    }),
  );

  // Owned first (getSwitcherData already orders is_primary desc, date asc within
  // its events array), then attended — stable-partition preserves that order.
  const owned = albums.filter((a) => a.role === 'couple');
  const attended = albums.filter((a) => a.role === 'guest');
  const ordered = [...owned, ...attended];

  const shareAlbum = ordered.find((a) => a.slug);
  const shareEvent = shareAlbum
    ? { displayName: shareAlbum.event.display_name, slug: shareAlbum.slug as string }
    : null;

  return { albums: ordered, shareEvent };
}

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { papicCaptureCost } from '@/lib/papic-cameras';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { resolvePlayRef } from '@/lib/papic-display-ref';

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
  /**
   * OUTBOUND "save to phone" URL for a PHOTO — the same-origin `save-photo` route
   * that streams the FULL-RES original run through an on-the-fly EXIF/GPS strip
   * (owner 2026-07-16 "save stays full-resolution"; RA 10173 · CLAUDE.md "geo
   * stripped on outbound shares"). The route NEVER hands out the raw geo-bearing
   * original. Null for clips (their video save is the deferred ffmpeg case).
   * Distinct from `url`, which is the low-res tile thumbnail for on-screen display
   * (an <img> never leaks EXIF to a recipient; a saved/shared file does).
   */
  saveUrl?: string | null;
  kind: 'photo' | 'clip';
  /**
   * Is this capture's ORIGINAL still kept at full resolution?
   *
   * TRUE by default — "if nothing is picked, pick all" (owner 2026-08-10). The
   * database stores the PICK (opt-in, owner 2026-08-10), so absent means NOT
   * preserved; this reads it as
   * the positive the screen actually talks in.
   *
   * ⚠ Already-replaced originals read FALSE and cannot be turned back on: the
   * file is gone. The tile must say so rather than offer a toggle that lies.
   */
  preserved?: boolean;
  /** The original has ALREADY been replaced by its compressed copy — nothing to keep. */
  alreadyCompressed?: boolean;
  // Which capture table the row lives in. The showcase-approval toggle routes
  // to the matching action: seat clips flip papic_photos, guest clips flip
  // papic_guest_captures. (Photos never carry a showcase gate.) 'vendor' = a
  // vendor's own documentation capture (photo or clip) compiled into the gallery.
  source: 'seat' | 'guest' | 'vendor';
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

  const [seatRes, guestRes, vendorRes] = await Promise.all([
    supabase
      .from('papic_photos')
      .select(
        'photo_id, r2_object_key, clip_web_r2_key, full_res_dropped_at, poster_r2_key, display_r2_key, thumb_r2_key, photo_type, captured_at, moderation_state, hidden_at, expires_at, consent_to_public, couple_approved_for_showcase, preserved_at',
      )
      .eq('event_id', eventId)
      .order('captured_at', { ascending: false })
      .limit(GALLERY_LIMIT),
    supabase
      .from('papic_guest_captures')
      .select(
        'capture_id, r2_object_key, clip_web_r2_key, full_res_dropped_at, poster_r2_key, display_r2_key, thumb_r2_key, media_type, captured_at, hidden_at, moderation_state, consent_to_public, couple_approved_for_showcase, preserved_at',
      )
      .eq('event_id', eventId)
      .order('captured_at', { ascending: false })
      .limit(GALLERY_LIMIT),
    // Vendor documentation captures (owner 2026-07-22 "compiles on the event
    // gallery") — photos AND clips (a clip tiles on its poster_r2_key). Nothing
    // surfaces until the WHOLE LANE is DPO-approved (the admin 'vendor_papic_capture'
    // control is default-inactive, so no capture exists until then); once live, the
    // vendor_papic_captures_member_read RLS policy scopes the couple to NSFW-checked,
    // non-hidden rows of their own event.
    supabase
      .from('vendor_papic_captures')
      .select('capture_id, vendor_profile_id, r2_object_key, poster_r2_key, media_type, captured_at, hidden_at, nsfw_checked, consent_basis')
      .eq('event_id', eventId)
      .order('captured_at', { ascending: false })
      .limit(GALLERY_LIMIT),
  ]);

  // Which suppliers has the couple taken out of their own gallery? One read,
  // hidden-only, so a couple with no exclusions costs nothing.
  //
  // 🪤 ON ERROR THIS HIDES NOTHING, deliberately. The opposite — treating a
  // failed read as "hide everything" — would blank a couple's gallery because a
  // query stumbled. This flag only ever REMOVES, so failing to apply it shows
  // too much rather than too little, and the couple can see that and retry.
  // A privacy flag that could EXPOSE something would need the other direction.
  const { data: hiddenVendorRows } = await supabase
    .from('event_vendors')
    .select('linked_vendor_profile_id')
    .eq('event_id', eventId)
    .eq('papic_captures_hidden', true)
    .not('linked_vendor_profile_id', 'is', null);
  const hiddenVendorIds = new Set(
    (hiddenVendorRows ?? [])
      .map((r) => (r as { linked_vendor_profile_id: string | null }).linked_vendor_profile_id)
      .filter((v): v is string => typeof v === 'string'),
  );

  // Graceful-degrade: a missing table/column (pre-migration) → empty, never crash.
  const seatRows = seatRes.error ? [] : (seatRes.data ?? []);
  const guestRows = guestRes.error ? [] : (guestRes.data ?? []);
  const vendorRows = vendorRes.error ? [] : (vendorRes.data ?? []);

  const visibleSeat = seatRows.filter(
    (r) =>
      r.moderation_state !== 'nsfw_blocked' &&
      !r.hidden_at &&
      (!r.expires_at || new Date(r.expires_at as string).getTime() > now),
  );
  const visibleGuest = guestRows.filter(
    (r) => r.moderation_state !== 'nsfw_blocked' && !r.hidden_at,
  );
  // Defense-in-depth over the RLS policy: NSFW-checked, non-hidden vendor captures
  // only. (consent_basis <> pending is a backstop — the capture route stamps
  // 'event_consent', so nothing is pending on the live path; the real gate is the
  // whole-lane DPO control that governs whether captures exist at all.)
  const visibleVendor = vendorRows.filter(
    (r) =>
      // The couple said "not this supplier". Checked FIRST so the intent is
      // legible: everything below is a safety rule, this one is their choice.
      !hiddenVendorIds.has((r as { vendor_profile_id?: string }).vendor_profile_id ?? '') &&
      r.nsfw_checked === true &&
      r.consent_basis !== 'pending_dpo_ruling' &&
      !r.hidden_at &&
      // A clip needs its poster to tile — never surface a posterless clip (which
      // would render a blank tile). Photos have no poster requirement.
      (r.media_type !== 'clip' || r.poster_r2_key),
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

  type Pre = Omit<GalleryPhoto, 'url' | 'playUrl' | 'saveUrl'> & {
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
      // The playable video for a clip resolves through resolvePlayRef (clip_web
      // web copy preferred, drop-safe) — never the raw key directly; the tile
      // shows its poster. Photos have no separate video.
      videoRef: isClip
        ? resolvePlayRef({
            photo_type: 'clip',
            r2_object_key: r.r2_object_key as string | null,
            clip_web_r2_key: r.clip_web_r2_key as string | null,
            full_res_dropped_at: r.full_res_dropped_at as string | null,
          })
        : null,
      kind: isClip ? 'clip' : 'photo',
      // "If nothing is picked, pick all" — the column stores only the DECLINE,
      // ⚠ OPT-IN: the column records what the couple CHOSE to keep, so absent
      // means NOT preserved. An original already replaced by its compressed
      // copy is not preserved and cannot become so again — the file is gone.
      preserved: !!r.preserved_at && !r.full_res_dropped_at,
      alreadyCompressed: Boolean(r.full_res_dropped_at),
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
      videoRef: isClip
        ? resolvePlayRef({
            media_type: 'clip',
            r2_object_key: r.r2_object_key as string | null,
            clip_web_r2_key: r.clip_web_r2_key as string | null,
            full_res_dropped_at: r.full_res_dropped_at as string | null,
          })
        : null,
      kind: isClip ? 'clip' : 'photo',
      preserved: !!r.preserved_at && !r.full_res_dropped_at,
      alreadyCompressed: Boolean(r.full_res_dropped_at),
      source: 'guest',
      tagged: Boolean(tagSrc),
      tagSource: mapTagSource(tagSrc),
      capturedAt: r.captured_at as string,
      showcaseApproved: isClip ? Boolean(r.couple_approved_for_showcase) : undefined,
      showcaseConsent: isClip ? Boolean(r.consent_to_public) : undefined,
    };
  });

  // Vendor documentation (photos + clips). No web derivatives, but the original
  // carries no geo (stripped at capture) so it's safe for the couple's own gallery.
  // A clip tiles on its poster_r2_key and plays from the original; a photo shows
  // the original directly. (Vendor captures have no showcase gate — that orb is
  // guest/couple content; the grid's ShowcaseToggle already excludes source=vendor.)
  const vendorPhotos: Pre[] = visibleVendor.map((r) => {
    const isClip = (r.media_type as string | undefined) === 'clip';
    return {
      id: r.capture_id as string,
      ref: isClip
        ? (r.poster_r2_key as string | null)
        : (r.r2_object_key as string | null),
      videoRef: isClip ? (r.r2_object_key as string | null) : null,
      kind: isClip ? ('clip' as const) : ('photo' as const),
      source: 'vendor' as const,
      tagged: false,
      tagSource: 'untagged' as GalleryTagSource,
      capturedAt: r.captured_at as string,
      showcaseApproved: undefined,
      showcaseConsent: undefined,
    };
  });

  const merged = [...seatPhotos, ...guestPhotos, ...vendorPhotos].sort(
    (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
  );

  return Promise.all(
    merged.map(async ({ ref, videoRef, ...rest }) => ({
      ...rest,
      url: ref ? await displayUrlForStoredAsset(ref) : null,
      playUrl: videoRef ? await displayUrlForStoredAsset(videoRef) : null,
      // Full-res, geo-stripped save via the same-origin route (photos only;
      // clips save through the video path). The route re-checks couple auth +
      // event scope, so the id/src in the URL confer no access on their own.
      // Vendor captures have no full-res save route yet (the save-photo route
      // only handles seat/guest); the tile view still works.
      saveUrl:
        rest.kind === 'photo' && rest.source !== 'vendor'
          ? `/dashboard/${eventId}/studio/papic/save-photo?id=${encodeURIComponent(
              rest.id,
            )}&src=${rest.source}`
          : null,
    })),
  );
}

// ── TEASER-scoped read (creator "Adventure Chapter" owned-music teaser) ──────

/** One geo-stripped, consent-cleared teaser frame — id + a presigned display URL. */
export type TeaserFrame = { id: string; url: string };

/** Teaser frame pull default cap (a small montage; the plan builder slices lower). */
const TEASER_FRAME_LIMIT = 24;

/**
 * PUBLIC-surface Papic frame set for the creator owned-music TEASER — deliberately
 * SEPARATE from fetchPapicGallery (the couple's auth-bound dashboard gallery). The
 * teaser is a shareable, Setnayan-hosted clip, so this read mirrors the couple-RECAP
 * path's public gates EXACTLY (app/[slug]/_components/editorial/data.ts):
 *
 *   • SEAT captures (papic_photos) — excluded when moderation-withheld
 *     (nsfw_blocked / consent_withheld / faceblock_withheld) or couple-hidden.
 *     'unscreened' fails OPEN, same as the recap's photo/gallery reads.
 *   • GUEST captures (papic_guest_captures) — the DOUBLE consent gate the Alaala
 *     public showcase enforces: consent_to_public = TRUE (the guest opted in) AND
 *     couple_approved_for_showcase = TRUE (the couple picked it) AND not hidden.
 *     This table carries NO NSFW moderation_state — the two gates ARE its public
 *     gate, so an unconsented / unapproved guest shot can NEVER reach the teaser.
 *
 * GEO (RA 10173 · CLAUDE.md "geo stripped on outbound shares"): a frame's `url` is
 * ALWAYS a metadata-stripped display/thumb derivative — NEVER the geo-bearing
 * r2_object_key original. A frame with no such derivative is SKIPPED (no
 * fall-through to the original), so the teaser can only ever ship geo-free bytes.
 *
 * Photos only (the teaser is a photo montage). Runs under the caller's RLS-bound
 * client — same discipline as fetchPapicGallery — so a creator can only pull from
 * a gallery they actually have access to. Never throws: any read error degrades to
 * [] (the plan builder then renders canRender:false gracefully).
 */
export async function fetchTeaserFrames(
  supabase: SupabaseClient,
  eventId: string,
  limit = TEASER_FRAME_LIMIT,
): Promise<TeaserFrame[]> {
  const [seatRes, guestRes] = await Promise.all([
    supabase
      .from('papic_photos')
      .select('photo_id, display_r2_key, thumb_r2_key, captured_at, moderation_state, hidden_at')
      .eq('event_id', eventId)
      .eq('photo_type', 'photo')
      .is('hidden_at', null)
      .not('moderation_state', 'in', '("nsfw_blocked","consent_withheld","faceblock_withheld")')
      .order('captured_at', { ascending: false })
      .limit(limit),
    supabase
      .from('papic_guest_captures')
      .select('capture_id, display_r2_key, thumb_r2_key, captured_at')
      .eq('event_id', eventId)
      .eq('media_type', 'photo')
      // Double consent gate — mirrors the recap's guest-capture public read.
      .eq('consent_to_public', true)
      .eq('couple_approved_for_showcase', true)
      .is('hidden_at', null)
      .order('captured_at', { ascending: false })
      .limit(limit),
  ]);

  // Graceful-degrade: a missing table/column (pre-migration) → drop that source.
  const seatRows = seatRes.error ? [] : (seatRes.data ?? []);
  const guestRows = guestRes.error ? [] : (guestRes.data ?? []);

  type Pre = { id: string; ref: string | null; capturedAt: string };
  const pre: Pre[] = [
    ...seatRows.map((r) => ({
      id: r.photo_id as string,
      // DISPLAY/THUMB derivative ONLY — never r2_object_key (the geo-bearing
      // original). A null ref (no derivative yet) drops the frame below.
      ref: (r.display_r2_key as string | null) ?? (r.thumb_r2_key as string | null) ?? null,
      capturedAt: r.captured_at as string,
    })),
    ...guestRows.map((r) => ({
      id: r.capture_id as string,
      ref: (r.display_r2_key as string | null) ?? (r.thumb_r2_key as string | null) ?? null,
      capturedAt: r.captured_at as string,
    })),
  ]
    .filter((p): p is Pre & { ref: string } => Boolean(p.ref))
    .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())
    .slice(0, limit);

  const frames = await Promise.all(
    pre.map(async (p) => ({
      id: p.id,
      url: await displayUrlForStoredAsset(p.ref as string),
    })),
  );
  return frames.filter((f): f is TeaserFrame => Boolean(f.url));
}

/**
 * ⚠ HOW MANY CAPTURES ARE BEING KEPT SHARP — counted over the WHOLE event.
 *
 * 🚨 THE DEFECT THIS EXISTS TO FIX. The preservation meter was computed from the
 * gallery array, and `fetchPapicGallery` caps each source at GALLERY_LIMIT (120).
 * At a real wedding — thousands of captures — "412 of 240 kept" and every
 * percentage built on it are simply wrong, and wrong in the direction that looks
 * plausible. A number a couple cannot check is worse than no number.
 *
 * ⚠ VENDOR CAPTURES ARE EXCLUDED FROM BOTH HALVES. They belong to the supplier,
 * are never preservable by the couple, and counting them inflates the
 * denominator so the couple appears to be keeping less of their own event than
 * they are.
 *
 * ⚠ ALREADY-COMPRESSED CAPTURES ARE EXCLUDED TOO. Once the full-resolution
 * original has been replaced there is nothing left to keep, so counting it as
 * "not kept" would invite a couple to act on a choice that no longer exists.
 *
 * Returns null on ANY read failure — the caller then shows nothing rather than a
 * confident zero. Zero reads as "you are keeping none of your photos", which is
 * exactly the alarming thing to say when the truth is "we could not count".
 */
export type PreservationTotals = {
  /** Captures the couple has CHOSEN to keep at full resolution. Starts at 0. */
  kept: number;
  /** Captures not chosen — under opt-in this starts as every one of them. */
  released: number;
  /** kept + released — the couple's own captures that still have an original. */
  total: number;
  /**
   * ⚠ WHAT THE KEPT CAPTURES ARE WORTH IN PAPIC CREDITS — the unit preservation
   * is PRICED in (owner 2026-08-10: ₱500/year per 5,000 credits' worth).
   *
   * 🔑 A COUNT OF ITEMS IS NOT A BILL. One 10-second video costs EIGHT credits
   * and one photo costs one, so "412 kept" says nothing about what a couple
   * owes. Weighted here, from the same constants the capture path charges with.
   */
  keptCredits: number;
};

export async function fetchPreservationTotals(
  supabase: SupabaseClient,
  eventId: string,
): Promise<PreservationTotals | null> {
  if (!eventId) return null;

  // ⚠ COUNTED PER MEDIA KIND, because the two cost different amounts. The
  // column differs between the two tables (`photo_type` vs `media_type`) and the
  // value for a video differs too — a single shared literal here would silently
  // count one table's clips as photos.
  const countOf = async (
    table: 'papic_photos' | 'papic_guest_captures',
    picked: boolean,
    clipsOnly: boolean | null,
  ): Promise<number | null> => {
    const kindCol = table === 'papic_photos' ? 'photo_type' : 'media_type';
    let q = supabase
      .from(table)
      .select('event_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .is('full_res_dropped_at', null);
    q = picked ? q.not('preserved_at', 'is', null) : q.is('preserved_at', null);
    if (clipsOnly === true) q = q.eq(kindCol, 'clip');
    if (clipsOnly === false) q = q.neq(kindCol, 'clip');
    const { count, error } = await q;
    // A rejected query resolves with `{ error }` and a null count — it never
    // throws. Treating that as 0 is how a failed read becomes a confident lie.
    return error ? null : (count ?? 0);
  };

  const [seatKeptPhotos, seatKeptClips, guestKeptPhotos, guestKeptClips, seatUnpicked, guestUnpicked] =
    await Promise.all([
      countOf('papic_photos', true, false),
      countOf('papic_photos', true, true),
      countOf('papic_guest_captures', true, false),
      countOf('papic_guest_captures', true, true),
      countOf('papic_photos', false, null),
      countOf('papic_guest_captures', false, null),
    ]);

  const parts = [seatKeptPhotos, seatKeptClips, guestKeptPhotos, guestKeptClips, seatUnpicked, guestUnpicked];
  if (parts.some((n) => n === null)) return null;

  const keptPhotos = seatKeptPhotos! + guestKeptPhotos!;
  const keptClips = seatKeptClips! + guestKeptClips!;
  const kept = keptPhotos + keptClips;
  // ⚠ OPT-IN: this is what the couple has NOT chosen, which starts as everything.
  const released = seatUnpicked! + guestUnpicked!;

  return {
    kept,
    released,
    total: kept + released,
    // Derived from the capture path's own constants — never a re-typed 8.
    keptCredits:
      keptPhotos * papicCaptureCost('photo') + keptClips * papicCaptureCost('clip'),
  };
}

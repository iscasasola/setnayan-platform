/**
 * lib/guest-live-gallery.ts — the per-guest LIVE tagged-photo read for the
 * day-of page ("photos of you, so far").
 *
 * Owner 2026-06-12: "the gallery must be on the on-the-day part." This is the
 * personalized half of that pair (the shared half is the Live Wall mirror):
 * while the wedding runs, a cookie-session guest sees the photos THEY are
 * tagged in arriving through the day — the live form of the post-event
 * "your photos" delivery, powered by the same photo_tags pipeline.
 *
 * SAFETY: admin-client reads are scoped by the caller's verified guest
 * session (the page resolves guest_id from the signed cookie); only
 * `moderation_state = 'clean'` captures are shown (NSFW screen passed,
 * FaceBlock not withheld — same allowlist posture as the wall), and clips
 * are excluded (photo_type = 'photo'); the Living Moments strip owns clip
 * playback. Presigned 1h GET URLs; thumbnails only, capped small — this
 * renders on a venue-WiFi page.
 *
 * ── THE RETURN CONTRACT (and it is load-bearing) ────────────────────────────
 *   `{ photos, total }` — the read SUCCEEDED. `photos` may be empty; an empty
 *                         result is a real answer and the commonest one early
 *                         in a day.
 *   `null`              — the read FAILED. Only that. Nothing else returns it.
 *
 * The caller RENDERS DIFFERENT WORDS for the two (`_components/site-body.tsx`:
 * *"We couldn't load your photos just now"* vs *"No one has tagged you yet"*),
 * so collapsing them puts a false accusation in front of a guest.
 *
 * ⚠ THIS COMMENT USED TO BE FALSE, AND THE FALSE VERSION SURVIVED A GUARD
 * WRITTEN TO CATCH EXACTLY IT. A 2026-07 fix deleted a late
 * `if (photos.length === 0) return null` and wrote *"null means, and only
 * means, that the read failed"* — while `if (!tags || tags.length === 0)
 * return null` sat 118 lines ABOVE it, untouched. `three-states.test.ts`
 * asserted the absence of the ONE DELETED SPELLING, so it passed over the
 * surviving twin. 🔑 **A guard that matches a STRING does not watch the ACT** —
 * the assertions there now match any early return on an empty tag list.
 *
 * The consequence was live and user-facing: **every guest who had not been
 * tagged yet — the normal state of everyone before the photographers work
 * through the album — was told the page had failed to load their photos.** The
 * reassurance branch written for them was unreachable.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { resolveCapturerNames } from '@/lib/capture-credit';

const URL_TTL_SECONDS = 60 * 60;

export type GuestLivePhoto = {
  id: string;
  /** Which capture table `id` points at — lets the guest drop a wrong auto-tag. */
  sourceTable: 'papic_photos' | 'papic_guest_captures';
  url: string;
  /**
   * When the photo was SHOT — not when it was tagged. Drives the gallery's
   * chapters (lib/papic-chapters.ts). Null when the row has no timestamp, which
   * lands the photo under "Everything else" rather than losing it.
   *
   * ⚠ Deliberately the capture time and not `photo_tags.created_at`: a guest
   * tagged into a five-month-old planning photo today belongs in the chapter
   * where the photo was TAKEN, not in this week's.
   */
  capturedAt: string | null;
  /**
   * WHO TOOK IT — the name this photograph is credited to, or null.
   *
   * Gallery archetype § 2: *"Credit is a feature."* On a guest's own page it is
   * also the answer to the question they actually have — *who got this shot of
   * me?* — which until now the page could not answer at all.
   *
   * 🔒 A guest who has asked not to be shown (`faceblock_enabled`) is never
   * named here, matching the rule the wall already applies to caption authors.
   * ⚠ Null is the common case today: the person spine is nameless in production.
   *
   * ⚠ REQUIRED-AND-NULLABLE, not optional. Optional would let a future caller
   * build a photo that never answers the question at all, and `undefined` reads
   * the same as "no credit" while meaning "nobody decided". Null is a decision.
   */
  capturedBy: string | null;
};

export type GuestLiveGallery = {
  photos: GuestLivePhoto[];
  /** Total clean tagged captures (may exceed photos.length). */
  total: number;
};

export async function getGuestLiveGallery(
  eventId: string,
  guestId: string,
  limit = 8,
  opts: {
    /**
     * Which derivative to serve.
     *
     * `'thumb'` (DEFAULT, unchanged) — long-edge 320 q50. Correct for the
     * day-of page's dense 3-across grid on venue WiFi, which is what this
     * function was written for.
     *
     * `'display'` — the WALL size: `tile_r2_key` (long-edge 640 q55) when the
     * row has one, else `display_r2_key` (1280 q60) for rows captured before
     * 2026-08-13. For surfaces whose tiles are big
     * enough that a 320px source visibly upscales (the Alaala wall renders
     * 105–192 CSS px squares = 310–383 device px, and `object-cover` on a
     * square scales a landscape thumb by its 240px HEIGHT). Costs bytes; ask
     * for it only where somebody is meant to look at the picture.
     */
    prefer?: 'thumb' | 'display';
  } = {},
): Promise<GuestLiveGallery | null> {
  try {
    const admin = createAdminClient();
    const { data: tags, error: tagsError } = await admin
      .from('photo_tags')
      .select('source_table, source_id, created_at')
      .eq('event_id', eventId)
      .eq('guest_id', guestId)
      .is('removed_at', null) // a "not me" tombstone drops the photo from this guest
      .order('created_at', { ascending: false })
      .limit(60);
    // A REFUSED QUERY IS NOT A THROWN ERROR. PostgREST answers a phantom
    // column, a stale enum or a missing grant with `{ data: null, error }` and
    // never throws, so `.error` is the ONLY way this failure is visible here.
    if (tagsError) return null;
    // Nobody has tagged this guest yet. That is a SUCCESSFUL read of an empty
    // set, and the page has words for it — do not hand it the failure value.
    if (!tags || tags.length === 0) return { photos: [], total: 0 };

    const photoIds = tags
      .filter((t) => t.source_table === 'papic_photos')
      .map((t) => t.source_id as string);
    const captureIds = tags
      .filter((t) => t.source_table === 'papic_guest_captures')
      .map((t) => t.source_id as string);

    const [photosRes, capturesRes] = await Promise.all([
      photoIds.length
        ? admin
            .from('papic_photos')
            .select('photo_id, paparazzi_seat_id, captured_by_person_id, r2_object_key, thumb_r2_key, tile_r2_key, display_r2_key, captured_at')
            .in('photo_id', photoIds)
            .eq('moderation_state', 'clean')
            .eq('photo_type', 'photo')
            .is('hidden_at', null)
        : Promise.resolve({
            data: [] as {
              photo_id: string;
              paparazzi_seat_id?: string | null;
              captured_by_person_id?: string | null;
              r2_object_key: string;
              thumb_r2_key: string | null;
              display_r2_key: string | null;
              captured_at: string | null;
            }[],
          }),
      captureIds.length
        ? admin
            .from('papic_guest_captures')
            .select('capture_id, guest_id, captured_by_person_id, r2_object_key, thumb_r2_key, tile_r2_key, display_r2_key, captured_at')
            .in('capture_id', captureIds)
            .eq('moderation_state', 'clean')
            // Guest CLIPS (media_type='clip') are excluded — this gallery is
            // PHOTO-only (see module header); the Living Moments strip owns clip
            // playback. A clip's r2_object_key is an MP4, which would render as a
            // broken thumbnail in the photo grid. Mirrors the photo_type='photo'
            // filter on the papic_photos query above.
            .eq('media_type', 'photo')
            .is('hidden_at', null)
        : Promise.resolve({
            data: [] as {
              capture_id: string;
              guest_id?: string | null;
              captured_by_person_id?: string | null;
              r2_object_key: string;
              thumb_r2_key: string | null;
              display_r2_key: string | null;
              captured_at: string | null;
            }[],
          }),
    ]);

    // Same rule one level down: a refused media read comes back with `data`
    // null and no throw, which would render as "you have no photos" over rows
    // that exist. The tag feed already proved there are photos to find.
    if ('error' in photosRes && photosRes.error) return null;
    if ('error' in capturesRes && capturesRes.error) return null;

    // Re-order by the tag feed (newest tag first), then presign the cap. Serve the
    // cheap web copy (thumb → display) — lighter for a venue-WiFi thumbnail grid,
    // drop-safe (the web copy is what survives the 3-month original drop), AND the
    // privacy-correct choice: this URL is BOTH the <img> src and the "open full
    // size to save" href (an OUTBOUND path), so it must NEVER be the geo-bearing
    // original (RA 10173 · CLAUDE.md "geo stripped on outbound shares"). Both
    // derivatives are sharp-built with all EXIF/GPS dropped. A row with neither
    // derivative yet (capture still processing) is filtered out below rather than
    // served raw — it reappears once its web copy renders (seconds later).
    const preferDisplay = opts.prefer === 'display';
    const webRef = (r: {
      r2_object_key: string;
      thumb_r2_key: string | null;
      tile_r2_key?: string | null;
      display_r2_key: string | null;
    }): string | undefined =>
      (preferDisplay
        ? // tile first — the size a wall renders; display is the fallback for
          // rows captured before the tile derivative existed.
          (r.tile_r2_key ?? r.display_r2_key ?? r.thumb_r2_key)
        : (r.thumb_r2_key ?? r.display_r2_key)) ?? undefined;
    const keyById = new Map<string, string>();
    // Capture time rides alongside the key so the chapters below read the moment
    // the photo was SHOT, not the moment somebody tagged this guest into it.
    const shotAtById = new Map<string, string | null>();
    for (const p of photosRes.data ?? []) {
      const k = webRef(p);
      if (k) {
        keyById.set(p.photo_id, k);
        shotAtById.set(p.photo_id, (p.captured_at as string | null) ?? null);
      }
    }
    for (const c of capturesRes.data ?? []) {
      const k = webRef(c);
      if (k) {
        keyById.set(c.capture_id, k);
        shotAtById.set(c.capture_id, (c.captured_at as string | null) ?? null);
      }
    }

    // ── WHO TOOK EACH ONE ────────────────────────────────────────────────
    // Resolved once, from the ids on the rows this read already returned. See
    // lib/capture-credit.ts for why the name lookup is service-role and why that
    // widens nothing.
    const seatIdsForCredit = new Set<string>();
    const personIdsForCredit = new Set<string>();
    const guestIdsForCredit = new Set<string>();
    const creditKeyById = new Map<string, { person?: string | null; seat?: string | null; guest?: string | null }>();
    for (const p of photosRes.data ?? []) {
      const person = (p as { captured_by_person_id?: string | null }).captured_by_person_id ?? null;
      const seat = (p as { paparazzi_seat_id?: string | null }).paparazzi_seat_id ?? null;
      if (person) personIdsForCredit.add(person);
      if (seat) seatIdsForCredit.add(seat);
      creditKeyById.set(p.photo_id, { person, seat });
    }
    for (const c of capturesRes.data ?? []) {
      const person = (c as { captured_by_person_id?: string | null }).captured_by_person_id ?? null;
      const shooter = (c as { guest_id?: string | null }).guest_id ?? null;
      if (person) personIdsForCredit.add(person);
      if (shooter) guestIdsForCredit.add(shooter);
      creditKeyById.set(c.capture_id, { person, guest: shooter });
    }

    const seatRows = seatIdsForCredit.size
      ? ((
          await admin
            .from('paparazzi_seats')
            .select('seat_id, claimer_user_id, guest_id')
            .eq('event_id', eventId)
            .in('seat_id', [...seatIdsForCredit])
        ).data ?? [])
      : [];
    const seatById = new Map(
      (seatRows as { seat_id: string; claimer_user_id: string | null; guest_id: string | null }[]).map(
        (r) => [r.seat_id, r],
      ),
    );
    for (const r of seatById.values()) if (r.guest_id) guestIdsForCredit.add(r.guest_id);

    const credits = await resolveCapturerNames(eventId, {
      personIds: personIdsForCredit,
      guestIds: guestIdsForCredit,
      userIds: [...seatById.values()].map((r) => r.claimer_user_id),
    });

    const creditFor = (id: string): string | null => {
      const k = creditKeyById.get(id);
      if (!k) return null;
      // 🔒 Asked not to be shown ⇒ not named, whichever id we hold them by.
      if (k.person && credits.hidden.has(k.person)) return null;
      if (k.guest && credits.hidden.has(k.guest)) return null;
      if (k.person && credits.byPerson.has(k.person)) return credits.byPerson.get(k.person) ?? null;
      if (k.guest && credits.byGuest.has(k.guest)) return credits.byGuest.get(k.guest) ?? null;
      const seat = k.seat ? seatById.get(k.seat) : undefined;
      if (seat?.guest_id) {
        if (credits.hidden.has(seat.guest_id)) return null;
        if (credits.byGuest.has(seat.guest_id)) return credits.byGuest.get(seat.guest_id) ?? null;
      }
      if (seat?.claimer_user_id && credits.byUser.has(seat.claimer_user_id)) {
        return credits.byUser.get(seat.claimer_user_id) ?? null;
      }
      return null;
    };

    const ordered = tags
      .map((t) => ({
        id: t.source_id as string,
        sourceTable: t.source_table as GuestLivePhoto['sourceTable'],
        key: keyById.get(t.source_id as string),
      }))
      .filter((x): x is { id: string; sourceTable: GuestLivePhoto['sourceTable']; key: string } =>
        Boolean(x.key),
      );

    const top = ordered.slice(0, limit);
    const photos = (
      await Promise.all(
        top.map(async ({ id, sourceTable, key }) => {
          const url = await displayUrlForStoredAsset(key, { ttlSeconds: URL_TTL_SECONDS });
          return url
            ? {
                id,
                sourceTable,
                url,
                capturedAt: shotAtById.get(id) ?? null,
                capturedBy: creditFor(id),
              }
            : null;
        }),
      )
    ).filter((p): p is GuestLivePhoto => Boolean(p));

    // Every success path ends here, empty or not. See the return contract in
    // the module header — `null` is now reachable ONLY from the three failure
    // checks above and the catch below.
    return { photos, total: ordered.length };
  } catch {
    return null; // gallery trouble must never break the wedding page
  }
}

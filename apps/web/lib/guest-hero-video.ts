/**
 * SEC-6 (scope hole D16) — the OTHER couple-uploaded video on the guest page.
 *
 * `events.landing_page_hero_video_r2_key` is the "Living Hero" boomerang: a
 * couple-uploaded clip that plays full-bleed behind the monogram on the public
 * wedding site, the editorial site, and the /realstories showcase. It is
 * host-writable (correctly — the couple picks it), it is resolved by the same
 * `displayUrlForStoredAsset` the Save-the-Date video used to be, and **nothing
 * screens it**. No poster, no verdict, no gate.
 *
 * So while it is served, "the NSFW filter is on by default and CANNOT be
 * disabled" is not true of the guest page, however airtight `std_media` is. It
 * is the same defect SEC-6 was filed against, one column over.
 *
 * ── WHY THIS FILE IS A SWITCH AND NOT A SCREEN ──────────────────────────────
 * Screening it properly needs a classifiable still that is provably the video's
 * own frame. The living-hero flow does upload a freeze still, but the
 * site-chrome editor writes the video key with no still at all, and the still
 * lives in a separate host-writable column with no derivation proof — so
 * "screen the still" would rebuild, in a second place, the exact weakness the
 * Save-the-Date poster already has. That work belongs to the platform-wide
 * nsfw-screen sweep, together with the unscreened hero PHOTO beside it.
 *
 * Until then the bar applies as written: media that cannot be proven screened
 * does not reach a guest page. The switch below is CLOSED, the hero still shows
 * in its place (that is the documented fallback — the still is already the
 * video's poster), and the couple's own dashboard preview is untouched.
 *
 * PROD IMPACT AT MERGE: zero rows. Verified read-only on 2026-07-26 —
 * `SELECT count(*) FROM events WHERE landing_page_hero_video_r2_key IS NOT NULL`
 * is 0. Nothing that is live today stops playing.
 *
 * ── HOW TO OPEN IT AGAIN ────────────────────────────────────────────────────
 * Flip the constant only once the hero video has, like `std_media`:
 *   1. a screening verdict in a host-UNWRITABLE column,
 *   2. bound to the exact bytes, and
 *   3. served from a SEALED copy the couple cannot re-PUT (lib/std-video-gate).
 * A code constant, not an env var, on purpose: opening this is a review-worthy
 * change with a checklist, not an operator toggle someone can flip at 2am.
 */

/**
 * Whether the unscreened Living-Hero boomerang may play on PUBLIC guest
 * surfaces. CLOSED until hero video is screened + sealed (see file header).
 */
export const GUEST_HERO_VIDEO_PLAYBACK = false;

/**
 * Gate a stored hero-video ref on its way to a public surface.
 *
 * Returns the ref unchanged when playback is open, and `null` while it is
 * closed, so every public call site is a one-line wrap and `grep` finds all of
 * them. Non-public surfaces (the couple's own editors) must NOT call this — the
 * couple is allowed to see their own upload.
 */
export function heroVideoRefForGuests(
  ref: string | null | undefined,
): string | null {
  if (!GUEST_HERO_VIDEO_PLAYBACK) return null;
  return typeof ref === 'string' && ref.trim().length > 0 ? ref : null;
}

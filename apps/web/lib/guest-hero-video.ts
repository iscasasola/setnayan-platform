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

/**
 * 🎞 A SCENE'S CLIP — a scene BACKGROUND snippet, or a clip in a template
 * scene's picture slot — PLAYS FOR GUESTS (owner 2026-09-29, DECISION_LOG
 * "OWNER ANSWERS — NINE PENDING DECISIONS", answer 2, verbatim *"make it
 * move"*: the owner accepts that an unscreened couple video reaches guests as a
 * scene background; the report / take-down path stays).
 *
 * 🎞 THE MAIN BACKGROUND ("behind every scene") MEETS THIS SWITCH TOO (audit
 * 2026-10-02, Batch F1 item 4: the couple's clip played for the host in the
 * Maker while every guest saw its still). It is the ground behind every scene,
 * the same couple clip the owner said to "make move" — so `mainGroundLayerFor`
 * gates it with `sceneClipRefForGuests`, whether it is the couple's own clip or
 * the hero's clip the Main background follows by default.
 *
 * It is a KILL SWITCH and it is ON: production gets exactly this value (it is a
 * code constant, never an env var). Closing it puts every scene clip AND the
 * Main background back on their stills in one line.
 *
 * Cost, measured rather than guessed: a clip is ≤ 15 s and is compressed in the
 * couple's browser before upload (`FileUpload` → `compressVideo`, 1080p
 * ≈ 1.9 Mbps, no sound for a background — DECISION_LOG 2026-09-25), so ≈ 3–4 MB;
 * it is served by a presigned URL straight from R2 (`displayUrlForStoredAsset`),
 * which bills no egress and never passes through Vercel. On the guest's side
 * the shipped loop (`SceneClip`) shows the still first, plays muted + inline
 * only while on screen and in front, and never plays under reduced motion or
 * Save-Data.
 *
 * ⚠ THIS IS NOT `GUEST_HERO_VIDEO_PLAYBACK`. The hero's own clip on the
 * masthead, the editorial site and /realstories stay behind that closed
 * switch — /realstories shows a couple to STRANGERS, which "make it move"
 * (about guests) did not cover; the masthead draws the still for the host too,
 * so it is not a host/guest gap.
 */
export const GUEST_SCENE_CLIP_PLAYBACK = true;

/**
 * Gate a scene clip ref on its way to a guest render. `open` defaults to the
 * constant above; tests pass `false` to hold the closed path (the still).
 */
export function sceneClipRefForGuests(
  ref: string | null | undefined,
  open: boolean = GUEST_SCENE_CLIP_PLAYBACK,
): string | null {
  if (!open) return null;
  return typeof ref === 'string' && ref.trim().length > 0 ? ref : null;
}

/**
 * 🖼 THE COVER SCENE'S OWN CLIP PLAYS FOR GUESTS ON THE EVENT'S OWN PAGE (owner 2026-10-16, on cale-ice, verbatim:
 * *"Yes — let a cover video (15 s or less, muted) play for guests on the event's own page. Keep it as a still on
 * public pages strangers see (Real Stories)."*).
 *
 * Its OWN switch — not `GUEST_HERO_VIDEO_PLAYBACK` (the hero boomerang on the masthead, the editorial site and
 * /realstories, which stays CLOSED) and not `GUEST_SCENE_CLIP_PLAYBACK` (a scene's clip). It governs exactly one
 * thing: a `{ kind: 'snippet' }` Cover Scene background (`HubSectionCanvas.ground` of the hero row) — whether the
 * sanitiser keeps it (`sanitizeHubCanvas`) and whether the guest page's cover layer plays it
 * (`app/[slug]/_lib/cover-scene-layer.ts`). Nothing a stranger sees reads `canvas.ground`: /realstories and the
 * editorial site draw the hero photo and the hero video column, which this switch never writes.
 *
 * The clip is the couple's own, ≤ 15 s (`MAKER_MAX_CLIP_SECONDS`, refused before upload and trimmed by the encode),
 * compressed silent in their browser (`videoCompressProfile="maker"` + `videoSilent`), and drawn by the shipped
 * `SceneClip` (still first, muted · inline · loops, never under reduced motion or Save-Data).
 *
 * A code constant, never an env var. Closing it: every cover clip is dropped by the sanitiser (the cover falls back
 * to The theme's own) AND the Cover Scene's Upload refuses a video before a byte is sent — never "Uploaded" for a
 * clip that would then show nothing (the 2026-10-16 bug, held by `lib/the-cover-takes-a-video.test.ts`).
 */
export const GUEST_COVER_CLIP_PLAYBACK = true;

/** Gate the Cover Scene's clip ref on its way to the guest page. `open` defaults to the switch above. */
export function coverClipRefForGuests(
  ref: string | null | undefined,
  open: boolean = GUEST_COVER_CLIP_PLAYBACK,
): string | null {
  if (!open) return null;
  return typeof ref === 'string' && ref.trim().length > 0 ? ref : null;
}

/**
 * The Main background's gate for a GUEST — the scene-clip switch, one argument,
 * so it can be handed to `resolveMainGround` as its `guestClipGate`. (Passing
 * `sceneClipRefForGuests` itself would let a caller's second argument close or
 * open it by accident.)
 */
export function mainGroundClipRefForGuests(ref: string): string | null {
  return sceneClipRefForGuests(ref);
}

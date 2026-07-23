/**
 * Public-surface media visibility gate for Papic captures.
 *
 * SECURITY (fail-CLOSED): a capture may appear on a PUBLIC couple page only when
 * its `moderation_state` is EXACTLY 'clean' — the sole value that means "the NSFW
 * screen ran AND passed" (lib/nsfw-screen.ts writes 'clean' | 'nsfw_blocked' over
 * the 'unscreened' default; the couple un-block action also writes 'clean'). Every
 * other value is EXCLUDED, including:
 *   • 'unscreened'  — never screened (e.g. a clip whose poster-frame extraction
 *                     failed makes screenCapture() return early → the row stays
 *                     'unscreened' forever). Auto-playing this on a public page is
 *                     unscreened-UGC exposure. MUST fail closed.
 *   • 'nsfw_blocked' — screen ran and REJECTED it.
 *   • 'consent_withheld' / 'faceblock_withheld' — RA-10173 withdrawal/opt-out
 *     states. These are in the CHECK constraint value-set (migration
 *     20261104000959) but are NOT written by any code path today; a fail-closed
 *     allowlist means that IF a future writer sets them, they are already excluded
 *     — unlike the previous fail-OPEN blocklist (`.not(... in (nsfw_blocked,
 *     consent_withheld, faceblock_withheld))`), which let 'unscreened' through and
 *     did nothing for values no path wrote.
 *   • NULL / undefined / any unknown string — unknown ⇒ excluded.
 *
 * This mirrors the already-canonical allowlist used by lib/guest-live-gallery.ts
 * and lib/life-story-moment-graph.ts (`.eq('moderation_state','clean')`).
 *
 * Applies to the papic_photos and papic_guest_captures capture tables, whose
 * moderation_state share the same value-set.
 */

/** The ONLY moderation_state value safe to surface on a public page. */
export const PUBLIC_SAFE_MODERATION_STATE = 'clean' as const;

/**
 * True iff `state` means "screened & clean" — i.e. exactly 'clean'. Fail-closed:
 * NULL, undefined, 'unscreened', 'nsfw_blocked', a withdrawal state, or any other
 * value returns false.
 */
export function isPublicSafeModerationState(state: unknown): boolean {
  return state === PUBLIC_SAFE_MODERATION_STATE;
}

/**
 * Defense-in-depth client-side gate: keep only rows whose `moderation_state` is
 * public-safe. Pair it with the server-side
 * `.eq('moderation_state', PUBLIC_SAFE_MODERATION_STATE)` filter so a future edit
 * that loosens the query still cannot leak unscreened/withdrawn media.
 */
export function filterPublicSafeRows<T extends { moderation_state?: unknown }>(
  rows: readonly T[],
): T[] {
  return rows.filter((r) => isPublicSafeModerationState(r.moderation_state));
}

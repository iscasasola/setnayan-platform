/**
 * live-wall-read-state.ts — three states, because `null` was doing the work of
 * two of them.
 *
 * ── The defect (register LAU-33) ────────────────────────────────────────────
 * `app/[slug]/_lib/loaders.ts` builds the day-of live photo wall inside a
 * `try`, and its failure path was:
 *
 *     } catch { liveWall = null; }
 *
 * `null` ALSO means "this couple does not own LIVE_WALL" and "the couple turned
 * the guest mirror off". So a refused read, an RLS denial, a statement timeout
 * or schema drift rendered **byte-identically to a deliberate off-state**: the
 * section simply was not there. The error was not even bound, so there was not
 * even a log line.
 *
 * 🔑 THE PRECEDENT THIS FOLLOWS, and its rule 2 is the one that bites:
 * `lib/guests-read-is-honest.test.ts` (couple side, 2026-08-19) and
 * `app/vendor-dashboard/reads-are-honest.test.ts` (supplier side, 2026-08-18).
 * **A LOG LINE NEVER CHANGED A PIXEL — the measurement has to reach the RENDER.**
 *
 * ── Why a separate flag and not a richer `liveWall` ─────────────────────────
 * Because every existing reader treats `liveWall` as truthy-or-absent, including
 * `publicAlbumHref`, which points "Photos" at the inline wall when it is present
 * and at the album door when it is not. Widening that value would change where
 * a button goes on a page nobody asked us to change. A sibling boolean leaves
 * every current reader exactly as it was.
 *
 * ── What this is NOT ────────────────────────────────────────────────────────
 * ⚠ It does not make the wall appear. A failed read is still a failed read and
 * the guest still has no photos. It stops the failure IMPERSONATING a setting,
 * so a couple whose wall has broken is told, instead of quietly concluding the
 * feature is off and never asking.
 */

/** What the day-of page should do about the live photo wall. */
export type LiveWallReadState =
  /** Tiles resolved — render the wall. */
  | 'show'
  /** Not the day, not owned, or the couple turned the mirror off. Render nothing. */
  | 'off'
  /** We tried and could not read it. Say so — never silently render nothing. */
  | 'unreadable';

export type LiveWallReadInput = {
  /** True only when the celebration is in its live window. */
  isLive: boolean;
  /** The couple's own setting + LIVE_WALL ownership, already resolved. */
  mirrorOn: boolean;
  /** Tiles came back. */
  hasData: boolean;
  /** The read was attempted and threw or was refused. */
  unreadable: boolean;
};

/**
 * 🔒 ORDER MATTERS, and this is the whole decision.
 *
 * `off` is checked BEFORE `unreadable` on purpose: when the mirror is off we
 * never attempted a read, so there is nothing to have failed, and announcing a
 * problem there would be a false alarm on the most common path.
 *
 * `unreadable` is checked BEFORE `hasData` for the opposite reason: a read that
 * failed cannot be trusted to have produced complete tiles, and half a wall
 * presented as the whole wall is the same lie in a smaller costume.
 */
export function liveWallReadState(input: LiveWallReadInput): LiveWallReadState {
  if (!input.isLive || !input.mirrorOn) return 'off';
  if (input.unreadable) return 'unreadable';
  return input.hasData ? 'show' : 'off';
}

/**
 * What a guest is told when the wall cannot be read. Deliberately short, blames
 * nobody, and does not promise a retry we do not schedule — the block polls
 * every 25s while the tab is visible, so "in a moment" is true.
 */
export const LIVE_WALL_UNREADABLE_LINE =
  'The photo wall is having trouble loading right now. It should appear in a moment.';

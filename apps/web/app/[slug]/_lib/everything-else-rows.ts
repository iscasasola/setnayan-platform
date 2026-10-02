/**
 * "EVERYTHING ELSE" — the row list for the guest overflow sheet (board 6,
 * Arrival S6): the one quiet "Everything else" line under the invitation, and
 * the doors that have NO other home on the page.
 *
 * ── THE RULE THIS FILE EXISTS TO ENFORCE (S6 brief) ─────────────────────────
 * A row that is not available must not render as a dead door: it is either a
 * live link, or it is not returned at all. Never a link to a destination that
 * will refuse the visitor.
 *
 * ── ✂ ONE PLACE PER DOOR (owner 2026-10-03, on the live hub: "the places of
 * the different information is still not fixed. too many buttons. too much
 * going on") ─────────────────────────────────────────────────────────────────
 * Seven rows lived here; five of them were a SECOND door to something the page
 * already offered, or a row that opened nothing at all:
 *
 *   · "Camera, selfie cam and challenges" — the bar's Camera slot (and before
 *     the day only a greyed row carrying the date);
 *   · "Watch the livestream" — The Day's Live page draws the player (and before
 *     the day only a greyed row);
 *   · "Find my table" — the guest's Welcome already carries their seat line,
 *     and a stranger with a key gets "Find your seat"; this row also skipped
 *     the page's key gate (`insideAllowed`), offering /find-seat to anyone;
 *   · "Your keepsake reel · After" — a greyed row that opened nothing;
 *   · "Print this invitation" — the Post Event page's own "Print the
 *     keepsake" at its foot;
 *   · "Share with family" — the page footer's Share (`PublicPageActions`).
 *
 * What stays is what has no other home: the 3D room (its card left the
 * doorway strip — one place) and the published keepsake album.
 *
 * ── WHY THIS DUPLICATES NO GATE ──────────────────────────────────────────────
 * Every value this module reads is one `site-body.tsx` has ALREADY resolved for
 * its own rendering (`doorways.venueWalk`, `recapBody`, the album door). This
 * file adds no new question to the database.
 */

export type EverythingElseGroup = 'on-the-day' | 'anytime';

export type EverythingElseRow = {
  key: string;
  label: string;
  group: EverythingElseGroup;
  /** A real destination — every row is a link (a row that opens nothing is
   *  not returned at all). */
  href: string;
};

export type EverythingElseInput = {
  /** `doorways.venueWalk` — null unless the seating surface is enabled AND
   *  published (the ONE seat rule, lib/guests-may-see-seats.ts). */
  venueWalkHref: string | null;
  /**
   * The album door, ALREADY RESOLVED by `resolveAlbumDoor` (album-door.server.ts)
   * and handed in. This module must never build `/recap` itself: the guest tree
   * has exactly one place that decides where the album lives, and a second one
   * here would answer differently the day that decision changes. Pinned by
   * `the-album-door-is-one-decision.test.ts`.
   */
  keepsakeHref: string | null;
  /** `plan.body === 'editorial'` — the post-event editorial has been composed. */
  recapBodyReady: boolean;
  /** Did the recap actually produce photos (`recapHasPhotos`)? A ready-but-
   *  empty recap has nothing to open yet, so no row. */
  recapHasPhotos: boolean;
};

/**
 * Resolve the row list, in display order. A caller with zero rows renders no
 * trigger at all — there is nothing behind the door.
 */
export function resolveEverythingElseRows(input: EverythingElseInput): EverythingElseRow[] {
  const rows: EverythingElseRow[] = [];

  // 🪑 The 3D room opens on the ONE seat rule (lib/guests-may-see-seats.ts, via
  // `venueWalkHref` ← doorway facts' `seatingPublished`): on the event's day, or
  // earlier only if the couple chose "Show guests their seats early".
  if (input.venueWalkHref) {
    rows.push({ key: 'venue-walk', label: 'Walk the room in 3D', group: 'anytime', href: input.venueWalkHref });
  }

  if (input.recapBodyReady && input.recapHasPhotos && input.keepsakeHref) {
    rows.push({ key: 'keepsake', label: 'Your keepsake reel', group: 'anytime', href: input.keepsakeHref });
  }

  return rows;
}

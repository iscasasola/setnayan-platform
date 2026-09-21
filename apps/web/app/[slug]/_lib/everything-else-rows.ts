/**
 * "EVERYTHING ELSE" — the row list for the guest overflow sheet (board 6,
 * Arrival S6). About two dozen guest-facing doors exist on this event site —
 * song requests, the money-gift page, the 3D room walk, table lookup, the
 * camera, the post-event recap, print, share — and most of them have no home
 * on the invitation. This is the one place that decides which of them a given
 * visitor may be shown right now.
 *
 * ── THE RULE THIS FILE EXISTS TO ENFORCE (S6 brief) ─────────────────────────
 * A row that is not available must not render as a dead door: it is either a
 * live link, an inert row carrying a date ("opens 18 December"), or it is not
 * returned at all. Never a link to a destination that will refuse the visitor.
 *
 * ── WHY THIS DUPLICATES NO GATE ──────────────────────────────────────────────
 * Every boolean this module reads is a value `site-body.tsx` has ALREADY
 * resolved for its own rendering (`hostCameraOpen`, `doorways.venueWalk`,
 * `plan.liveMediaVisible`, `recapBody`, `resolveEffectiveVisibility`). This
 * file adds no new question to the database — it only re-groups answers that
 * already exist, the same way `resolveGuestDoorways` re-groups `seatingPublished`
 * for the 3D-room card instead of asking Postgres a second time.
 */

export type EverythingElseGroup = 'on-the-day' | 'anytime';

export type EverythingElseRow = {
  key: string;
  label: string;
  group: EverythingElseGroup;
  /** A real destination → the row is a link. Absent → `action` supplies the
   *  behaviour instead (e.g. the native share sheet), and at least one of
   *  `href`/`action` is always present — never neither. */
  href?: string;
  action?: 'share';
  /** Shown at the trailing edge of the row instead of a chevron, e.g. the
   *  formatted event date pre-event, or the literal word "After". Absent on
   *  a live link — that's what the chevron already says. */
  badge?: string;
};

export type EverythingElseInput = {
  slug: string;
  viewerKind: 'anonymous' | 'guest' | 'couple' | 'vendor';
  isLive: boolean;
  /** Long-form event date, pre-formatted by the caller (`formatEventDate`) —
   *  this module makes no date-formatting decision of its own. Empty string
   *  when the couple hasn't set one. */
  eventDateLabel: string;

  /** Has the couple turned the guest camera on for this event at all
   *  (`hostCameraOpen` — a standing feature switch, not day-gated)? */
  cameraFeatureOn: boolean;

  /** Is a livestream configured AND visible to this viewer
   *  (`plan.liveMediaVisible && Boolean(watchLive)`)? */
  broadcastConfigured: boolean;

  /** `doorways.venueWalk` — null unless the seating surface is enabled AND
   *  published. Reused verbatim for both the 3D-room row and table lookup:
   *  both read the same floor plan. */
  venueWalkHref: string | null;

  /** `plan.body === 'editorial'` — the post-event editorial has been composed.
   *  Gates both the recap ("keepsake reel") and print, which mirrors the
   *  editorial's own visibility + phase gate. */
  /**
   * The album door, ALREADY RESOLVED by `resolveAlbumDoor` (album-door.server.ts)
   * and handed in. This module must never build `/recap` itself: the guest tree
   * has exactly one place that decides where the album lives, and a second one
   * here would answer differently the day that decision changes. Pinned by
   * `the-album-door-is-one-decision.test.ts`.
   */
  keepsakeHref: string | null;
  recapBodyReady: boolean;
  /** Did the recap actually produce photos (`recapHasPhotos`)? A ready-but-
   *  empty recap is still worth a badge, not yet a link. */
  recapHasPhotos: boolean;

  /** `resolveEffectiveVisibility(event) === 'public'` — the same signal
   *  `PublicPageActions` already gates its own Share control on. */
  canShare: boolean;
};

const AFTER_BADGE = 'After';

/**
 * Resolve the row list. Returns rows already split into the two boards-6
 * groups ("on the day" first, "anytime" after) in display order; a caller
 * with zero rows should render no trigger at all — there is nothing behind
 * the door.
 */
export function resolveEverythingElseRows(input: EverythingElseInput): EverythingElseRow[] {
  const base = `/${encodeURIComponent(input.slug)}`;
  const dateBadge = input.eventDateLabel || undefined;
  const rows: EverythingElseRow[] = [];

  // ── ON THE DAY ──────────────────────────────────────────────────────────

  if (input.cameraFeatureOn) {
    rows.push(
      input.isLive
        ? { key: 'camera', label: 'Camera, selfie cam and challenges', group: 'on-the-day', href: `/papic/guest?from=${encodeURIComponent(input.slug)}` }
        : { key: 'camera', label: 'Camera, selfie cam and challenges', group: 'on-the-day', badge: dateBadge },
    );
  }

  if (input.broadcastConfigured) {
    rows.push(
      input.isLive
        ? { key: 'watch', label: 'Watch the livestream', group: 'on-the-day', href: `${base}/hub` }
        : { key: 'watch', label: 'Watch the livestream', group: 'on-the-day', badge: dateBadge },
    );
  }

  // Table lookup shares the seating-published signal with the 3D room, but
  // is NOT day-gated by it — a couple can publish seating weeks ahead, and
  // the moment they do the row must go live rather than wait for `isLive`.
  if (input.venueWalkHref) {
    rows.push({
      key: 'find-my-table',
      label: 'Find my table',
      group: 'on-the-day',
      href: input.viewerKind === 'guest' ? `${base}/find-my-table` : `${base}/find-seat`,
    });
  }

  // ── ANYTIME ─────────────────────────────────────────────────────────────

  if (input.venueWalkHref) {
    rows.push({ key: 'venue-walk', label: 'Walk the room in 3D', group: 'anytime', href: input.venueWalkHref });
  }

  // NOT INCLUDED: "Request a song" (Pakanta). `SongRequestCard` renders
  // in-page inside `guestTree` only, with no anchor id — an anonymous
  // visitor has no card to scroll to at all, and even a signed-in guest has
  // nothing to land on. Wiring a real destination means adding an id in
  // `site-body.tsx`, which is outside this slice's one-mount-line fence.
  // Flagged in the S6 handback rather than shipped as a dead link.

  if (input.recapBodyReady) {
    rows.push(
      input.recapHasPhotos && input.keepsakeHref
        ? { key: 'keepsake', label: 'Your keepsake reel', group: 'anytime', href: input.keepsakeHref }
        : { key: 'keepsake', label: 'Your keepsake reel', group: 'anytime', badge: AFTER_BADGE },
    );
    // /print mirrors the editorial's own visibility + phase gate — never
    // offered before `recapBodyReady`, or an early visitor hits the same
    // "blocked until the event is past" wall the route enforces itself.
    rows.push({ key: 'print', label: 'Print this invitation', group: 'anytime', href: `${base}/print` });
  } else if (input.eventDateLabel) {
    // Pre-event: say when, rather than simply omitting the row — the couple
    // DID set a date, so "not yet" is an honest, non-dead answer.
    rows.push({ key: 'keepsake', label: 'Your keepsake reel', group: 'anytime', badge: AFTER_BADGE });
  }

  if (input.canShare) {
    rows.push({ key: 'share', label: 'Share with family', group: 'anytime', action: 'share' });
  }

  return rows;
}

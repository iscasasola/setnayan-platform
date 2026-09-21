/**
 * notification-event-id.ts — which wedding is a notification about?
 *
 * `public.notifications` gained an `event_id` in migration
 * `20271238868040_notifications_know_their_event.sql`. Almost none of the ~200
 * `emitNotification` call sites have an event id in hand at the call, but nearly
 * all of them already build an event-scoped `related_url`. So the writer DERIVES
 * the column from that link rather than asking 200 call sites to pass it — one
 * rule, applied once, instead of 200 chances to forget.
 *
 * 🔑 THIS FILE IS PURE, AND THAT IS THE POINT. `notification-emit.ts` is
 * server-only (it builds a service-role client at module scope), so a unit test
 * cannot import it, and a guard that can only GREP the writer proves nothing
 * about what the writer computes. The decision that can be got wrong lives here,
 * where `notification-event-id.test.ts` EXECUTES it — including the two negative
 * cases that matter (`/dashboard/people`, and a uuid with trailing characters).
 *
 * The migration's backfill uses the same rule as a Postgres regex, verified
 * against the same nine cases before it was written. If you change the shape
 * here, the backfill in that migration is the other half.
 */

/**
 * `/dashboard/<event uuid>/…` is the only event-scoped link shape the app emits.
 *
 * Anchored at the start, and the uuid must be followed by a path separator,
 * `?`, `#`, or the end of the string — without that boundary,
 * `/dashboard/<uuid>EXTRA/guests` would match and hand back an id that is not in
 * the URL. `/dashboard/people`, `/dashboard`, and every `/admin/…` link have no
 * uuid in the first segment and correctly yield null.
 */
const EVENT_SCOPED_PATH =
  /^\/dashboard\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#]|$)/i;

/**
 * The event a notification's link points at, or `null` when the link is
 * account-level (`/dashboard/people`), admin-level (`/admin/payments`), absent,
 * or not event-shaped.
 *
 * ⚠ A returned id is a WELL-FORMED uuid, not a PROVEN event. It is whatever the
 * link says, so it can name an event that has since been deleted. The column is
 * a foreign key, so `emitNotification` treats a rejected insert as "drop the
 * event_id, keep the notification" — the notice must reach the person either
 * way. Nothing here should ever be the reason a user is not told something.
 */
export function eventIdFromRelatedUrl(
  relatedUrl: string | null | undefined,
): string | null {
  if (!relatedUrl) return null;
  const id = EVENT_SCOPED_PATH.exec(relatedUrl)?.[1];
  return id ? id.toLowerCase() : null;
}

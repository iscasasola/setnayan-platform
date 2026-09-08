import { redirect } from 'next/navigation';

/**
 * RENAMED TO `/dashboard/[eventId]/story` (design decision 2026-09-07).
 *
 * ─── WHY THIS ROUTE IS KEPT RATHER THAN DELETED ──────────────────────────
 * "Editorial" is retired from CUSTOMER language: the surface is **the story**
 * and the tool is **the Story Maker**. The word survives only as internal
 * vocabulary already baked into table and function names (`event_editorial`,
 * `editorialAllowsEventType`, `EditorialSections`) — renaming those is not
 * part of this change.
 *
 * The route stays because deleting it 404s what still points here: a couple's
 * bookmark, the admin editorial-review notification's `relatedUrl` on every
 * notification ALREADY SENT (those rows are written, not recomputed), and the
 * library tab's deep link. Same move and same honesty as this directory's own
 * parent stub, `website/page.tsx`.
 *
 * ⛔ IT ALSO KEEPS A CONTRACT. `website/page.tsx`'s docblock states "EVERY
 * `/website/<child>` KEEPS ITS ROUTE", and `one-event-hub-door.test.ts` asserts
 * `website/<child>/page.tsx` EXISTS ON DISK for a hand-listed set that includes
 * `editorial`. A `next.config.ts` redirect would delete this directory and fail
 * that guard; a stub satisfies both the guard and the bookmark.
 *
 * ⚠ NO `metadata` HERE, DELIBERATELY — a redirect stub renders nothing, and the
 * name now belongs to the Story Maker at the new path.
 */
export default async function RenamedEditorialRoute({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  redirect(`/dashboard/${eventId}/story`);
}

import { redirect } from 'next/navigation';

/**
 * MERGED INTO THE EVENT HUB CONTROLLER (owner ruling 2026-09-02, verbatim:
 * *"i look at the roles of each. if it is the same then adjust. Like in papic.
 * when they enter an event, the menu of papic description page becomes the
 * control center of papic. i think that should be the same for events hub."*).
 *
 * ─── WHY THIS ROUTE IS KEPT RATHER THAN DELETED ──────────────────────────
 * The roles were measured and they were the same. This page declared
 * `metadata.title = 'Event Hub'` and described itself as "the calm landing that
 * introduces the couple's public site"; the catalog card keyed `landing-page`
 * is ALSO labelled "Event Hub", and the event menu's own row wears that word
 * too. One name, one promise, one role — and, until this change, two doors.
 *
 * `/dashboard/[eventId]/launch` is the survivor because it does the same job
 * with a living miniature instead of prose AND carries the three day-of
 * services the hub never had. Everything this page linked to is on the
 * controller's "set once" strip.
 *
 * The route stays because deleting it 404s what still points here: the Studio
 * hub's Website Pro band, the Papic crew page, the guest-columns surface, the
 * invite step, `/event-page`'s own redirect, and every couple's bookmark. The
 * shape is `website/launch/page.tsx`, the 2026-07-25 retirement stub — same
 * move, same honesty about why the route is kept.
 *
 * ⛔ EVERY `/website/<child>` KEEPS ITS ROUTE. editor · editorial · our-story ·
 * privacy · hero-photo · colors · dress-code · what-to-bring · widgets ·
 * site-chrome · living-hero · photo-moments · our-photos · special-message ·
 * stories. They are the controller's doors, not casualties of this merge.
 *
 * ⚠ NO `metadata` HERE, DELIBERATELY. Exactly one surface may declare the name
 * "Event Hub" now, and it is the controller —
 * `app/dashboard/[eventId]/one-event-hub-door.test.ts` fails if a second one
 * ever re-claims it.
 */
export default async function RetiredWebsiteHubRoute({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  redirect(`/dashboard/${eventId}/launch`);
}

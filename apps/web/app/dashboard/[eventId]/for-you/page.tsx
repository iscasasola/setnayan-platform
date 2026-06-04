import { redirect } from 'next/navigation';

/**
 * /for-you — RETIRED 2026-06-04.
 *
 * The couple's match criteria (the curated date · region · ceremony · venue ·
 * guests · style · budget that Setnayan filters + sorts services by) now live
 * as the "Matching you on" strip at the top of the Services (Vendors) tab —
 * where the couple actually browses services — with "Refine" → the full,
 * editable Personalization page (/details). This standalone page is gone; the
 * route permanently redirects to Services so any lingering link or bookmark
 * resolves to where the personalization moved.
 *
 * (Its home-preview entry point was already removed in the 2026-06-04 couple-
 * home-cockpit refactor, so this page was effectively orphaned.)
 */
export default async function ForYouRedirect({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  redirect(`/dashboard/${eventId}/vendors`);
}

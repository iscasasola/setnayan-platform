import { redirect } from 'next/navigation';

/**
 * RETIRED (Unified Website Editor · PR-2 · owner-locked 2026-07-25).
 *
 * The legacy site-editor is gone: website editing now lives on the ONE unified
 * editor, where the couple edits while watching their real page. This route
 * stays only as a redirect so old links (bookmarks, emails, the lib route
 * builders in routes.ts / add-ons-catalog.ts / customer-menu.ts, and the
 * studio/[addon] phase redirect) keep landing somewhere correct.
 *
 * Its one unique setting — the RSVP spatial backdrop — was ported to
 * `website/editor/actions.ts`; its hero-photo save/clear were byte-dupes of
 * `website/hero-photo/actions.ts` and were deleted with the old actions file.
 */
export default async function RetiredSiteEditorRoute({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  redirect(`/dashboard/${eventId}/website/editor`);
}

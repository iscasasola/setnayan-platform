import { redirect } from 'next/navigation';

export const metadata = { title: 'Wedding website' };

/**
 * /dashboard/[eventId]/website — RETIRED 2026-06-03 (flip to the Reels editor).
 *
 * The wedding-website surface is now the full-screen Reels editor at
 * /site-editor/[eventId], and the "Website" nav doorway (customer-bottom-nav +
 * customer-nav-config) points there directly. This route used to render the
 * journey-scroll hub (PR #704); per the owner's "make the editor the page and
 * remove everything else" directive, the scroll is retired. We redirect here
 * (rather than 404) so existing bookmarks, deep-links, the animated-monogram
 * back-links, and the onboarding prefetch all land on the editor.
 *
 * Slug / URL management moved to the invitation editor
 * (/dashboard/[eventId]/invitation), which hosts the shared SlugField + its
 * updateEventSlug action. The couple-membership guard lives on the editor's
 * own page (/site-editor/[eventId]/page.tsx), so this redirect needs none.
 *
 * Now-unused (safe to delete in a follow-up cleanup PR): this route's former
 * _components/{journey,pro-upgrade-panel,pro-website-panel,copy-button}.tsx and
 * actions.ts (updateEventSlugFromWebsite) — nothing imports them anymore.
 */
export default async function WebsiteRedirect({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  redirect(`/site-editor/${eventId}`);
}

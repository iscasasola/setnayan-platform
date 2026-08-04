import { redirect } from 'next/navigation';

/**
 * MERGED INTO THE UNIFIED EDITOR (owner 2026-07-25 — "rebuild the launch page
 * now and improve it"). The settings-first Launch surface (PR #3661) became the
 * editor's rail + topbar: the go-live/schedule control, the status chips, the
 * free settings and the Website Pro band all live at `website/editor` now, next
 * to the live preview. This route redirects so the sidebar's old target, any
 * bookmark, and the studio deep-links keep working.
 */
export default async function RetiredWebsiteLaunchRoute({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  redirect(`/dashboard/${eventId}/website/editor`);
}

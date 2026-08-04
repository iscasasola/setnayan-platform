import { redirect } from 'next/navigation';

/**
 * ABSORBED INTO THE UNIFIED EDITOR (Unified Website Editor · PR-5).
 *
 * This setting is now edited INLINE in the editor's rail — the couple changes it
 * while watching their real page, which is the whole point of the editor. The
 * route stays as a redirect so bookmarks, older links and any surface still
 * pointing here land on the editor with the right row already open.
 *
 * Its server action (`../what-to-bring/actions.ts`) is UNCHANGED and still the single
 * write path — the editor's panel calls it directly. Only this page shell is
 * retired.
 */
export default async function AbsorbedSettingRoute({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  redirect(`/dashboard/${eventId}/website/editor?open=what-to-bring`);
}

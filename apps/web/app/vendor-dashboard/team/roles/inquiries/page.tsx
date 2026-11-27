import { redirect } from 'next/navigation';

export const metadata = { title: 'Who gets new inquiries · Roles · Supplier' };

/**
 * /vendor-dashboard/team/roles/inquiries — A FORWARD (final check B14, drawing § B14, approved 25 Nov): the section opens
 * IN PLACE inside the Team layer, one level under Roles (`?section=inquiries`), so this address opens it there, carrying
 * where it stood (`branch` · `adjust` · `type`) and a save's word. 🔒 app/vendor-dashboard/team/roles-open-in-place.test.ts
 */
export default async function TeamInquiriesForward({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; adjust?: string; type?: string; saved?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const to = new URLSearchParams();
  for (const k of ['branch', 'adjust', 'type', 'saved', 'error'] as const) if (sp[k]) to.set(k, sp[k]!);
  const rest = to.toString();
  // The address is written out (it equals TEAM_INQUIRIES_HREF, held by the guard) so the root map reads this page as a forward.
  redirect(`/vendor-dashboard/team?section=inquiries${rest ? `&${rest}` : ''}`);
}

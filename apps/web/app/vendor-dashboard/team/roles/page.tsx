import { redirect } from 'next/navigation';
import { TEAM_ROLES_HREF } from '@/lib/team-sections';

export const metadata = { title: 'Roles · Team · Supplier' };

/**
 * /vendor-dashboard/team/roles — A FORWARD (final check B13, drawing § B13, approved 25 Nov): Roles opens IN PLACE inside
 * the Team layer (`?section=roles`), so this address — a bookmark, an old notice — opens Team with Roles open, carrying a
 * save's word (`saved` / `error`). 🔒 app/vendor-dashboard/team/roles-open-in-place.test.ts
 */
export default async function TeamRolesForward({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const sp = await searchParams;
  const to = new URLSearchParams();
  if (sp.saved) to.set('saved', sp.saved);
  if (sp.error) to.set('error', sp.error);
  const rest = to.toString();
  redirect(rest ? `${TEAM_ROLES_HREF}&${rest}` : TEAM_ROLES_HREF);
}

import { redirect } from 'next/navigation';
import { PEOPLE_GROUPS_HREF } from '@/lib/people-views';

/**
 * The old standalone Groups index — it now FORWARDS to People › Groups (owner 2026-10-28: *"an issue on groups is it
 * makes us go back to groups which was not part of people. it did not return to people"*). Groups live inside People;
 * a group's own page (`/dashboard/samahan/<id>`) stays where it is. The "you left" / "archived" note rides along and
 * People says it.
 */
export default async function SamahanIndexForwards({
  searchParams,
}: {
  searchParams: Promise<{ left?: string; archived?: string }>;
}) {
  const sp = await searchParams;
  const note = sp.left === '1' ? '&left=1' : sp.archived === '1' ? '&archived=1' : '';
  redirect(`${PEOPLE_GROUPS_HREF}${note}`);
}

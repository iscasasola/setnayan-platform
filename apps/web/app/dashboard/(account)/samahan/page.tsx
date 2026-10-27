import { redirect } from 'next/navigation';

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
  // Written out (not `PEOPLE_GROUPS_HREF`) so the Ugat screens map reads this page as a forwarding stub; the guard
  // holds the two equal (`lib/groups-return-to-people.test.ts`).
  redirect(`/dashboard/people?view=samahan${note}`);
}

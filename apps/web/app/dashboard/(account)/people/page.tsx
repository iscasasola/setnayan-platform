import { redirect } from 'next/navigation';
import { forwardToHome } from '@/lib/home-segments';

/**
 * /dashboard/people — FORWARDS TO HOME › PEOPLE (owner 11 Nov 2026, "One profile page approve", DECISION_LOG "HOME PAGE v3
 * APPROVED"). People is a section of Home now; its body moved, unchanged, to `_components/people-segment.tsx` and is
 * drawn at `/dashboard?seg=people`. Every parameter comes along (`?view=requests|connected|following|followers|alaga|
 * samahan`, `?person=`, `?error=`, `?saved=`, `?left=`, `?archived=`…), so a bell, an email or a bookmark that still
 * carries the old address opens the same view in its new place. `people/[dependentId]` keeps its own address.
 * 🔒 lib/home-is-the-profile.test.ts
 */
export default async function PeopleForwardsToHome({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  redirect(forwardToHome('people', await searchParams));
}

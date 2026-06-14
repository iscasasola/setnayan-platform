/**
 * /dashboard/[eventId]/more — RETIRED (0021 ADDENDUM · accordion bottom nav ·
 * owner-locked 2026-06-15).
 *
 * The customer bottom nav is now SIX fixed menus with inline accordions — no
 * "More" overflow tab — so this landing's only reason to exist (surfacing the
 * tabs that didn't fit) is gone. Rather than hard-delete the route (a stray
 * prefetch in onboarding-shell.tsx + any bookmarked /more URL would 404), it
 * redirects to the event home. The desktop sidebar + the mobile accordion now
 * reach every surface directly.
 *
 * Kept as a thin server redirect (no client deps) so a direct hit on /more —
 * from a bookmark, a stale link, or the onboarding prefetch — lands somewhere
 * valid instead of erroring.
 */

import { redirect } from 'next/navigation';

export const metadata = { title: 'More · Setnayan' };

type Props = {
  params: Promise<{ eventId: string }>;
};

export default async function CustomerMoreLanding({ params }: Props) {
  const { eventId } = await params;
  redirect(`/dashboard/${eventId}`);
}

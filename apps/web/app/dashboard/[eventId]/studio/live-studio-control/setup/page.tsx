import { notFound, redirect } from 'next/navigation';
import { liveStudioRoamEnabled } from '@/lib/live-studio-roam';
import { liveStudioControlPath } from '@/lib/live-studio-control';

/**
 * ⭐ WAVE 8 · TOMBSTONE REDIRECT — the controller moved out of /dashboard.
 * (owner-locked 2026-07-25 · Live_Studio_Unified_Spec_2026-07-25 § 4g.)
 *
 * The controller is now a chrome-less, full-viewport surface at
 * `/panood/control/[eventId]`. It had to leave this tree: `[eventId]/layout.tsx`
 * mounts the top bar, the bottom nav, the nav FAB and the section sub-nav, and an
 * App Router page cannot opt out of an ancestor layout. See the WAVE 8 block in
 * lib/live-studio-control.ts for the full reasoning (and for why covering the
 * chrome with a `fixed inset-0` layer is a known dead end here).
 *
 * This file exists ONLY so the old URL keeps working. Nothing links here —
 * every doorway resolves through `liveStudioControllerHref()`.
 *
 * Flag-dark exactly as the page it replaces was: with
 * NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED off this 404s, so the redirect cannot
 * become a new way to reach a dark surface.
 */
export const metadata = { title: 'Live Studio controller · Setnayan' };

type Props = { params: Promise<{ eventId: string }> };

export default async function LiveStudioControlSetupRedirect({ params }: Props) {
  if (!liveStudioRoamEnabled()) notFound();
  const { eventId } = await params;
  redirect(liveStudioControlPath(eventId));
}

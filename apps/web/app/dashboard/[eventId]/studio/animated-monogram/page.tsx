import { redirect } from 'next/navigation';

/**
 * /dashboard/[eventId]/studio/animated-monogram — RETIRED to a redirect.
 *
 * Owner 2026-06-25 (informed reversal of 2026-06-21): the paid Animated-Monogram
 * upgrade was MERGED back onto the Monogram Maker (/monogram) — design the mark
 * for free, then activate the draw-on animation on the same screen. This page's
 * owned/unowned buy surfaces moved verbatim into
 * app/dashboard/[eventId]/monogram/animated-monogram-upgrade.tsx. Kept as a
 * redirect so old bookmarks / the lib/routes.ts helper still land on the buy.
 */

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ eventId: string }> };

export default async function AnimatedMonogramRedirect({ params }: Props) {
  const { eventId } = await params;
  redirect(`/dashboard/${eventId}/monogram`);
}

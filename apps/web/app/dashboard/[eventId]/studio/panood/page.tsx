import { redirect } from 'next/navigation';
import { liveStudioRoamEnabled } from '@/lib/live-studio-roam';
import { liveStudioDetailPath } from '@/lib/live-studio-control';

/**
 * ⭐ RETIRED 2026-08-06 — "Live Studio Cast" is not a product any more.
 *
 * This route used to be a full App Store detail page selling the Cast SKU (₱2,500,
 * per day). That SKU has been `is_active = false` in production since 2026-07-26 and
 * has never had a single order — checkout refuses a retired SKU, so the page's own
 * guard had already hidden its buy button and its price table. What was left was a
 * SECOND "Live Studio" page in the couple's Studio, sitting beside the real one
 * (₱2,999 · /studio/live-studio-control · listed on the public pricing page), whose
 * only working control dropped the couple into the legacy Cast setup tree.
 *
 * Two tiles for one product is the whole defect. The catalog tile that points here
 * is not ours to delete, so the DESTINATION is retired instead: both tiles now land
 * on the Live Studio that exists.
 *
 * ── WHY A REDIRECT AND NOT A DELETION ───────────────────────────────────────
 * This path is a live LANDING, not just a card target. `api/oauth/youtube/callback`
 * and `api/oauth/youtube/disconnect` both send the host back here by name, and both
 * are outside this change's ownership. Deleting the route would 404 a host halfway
 * through connecting — or revoking — their own Google account. So the route stays
 * and forwards, including the `youtube_*` query the OAuth routes attach: the page it
 * forwards to renders every one of them.
 *
 * ── FLAG-OFF ────────────────────────────────────────────────────────────────
 * With NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED off, /studio/live-studio-control
 * `notFound()`s, so the honest destination is the free single-camera setup screen —
 * which is exactly what this page's primary CTA did in that state anyway. Retiring
 * the Cast page is correct in BOTH states: the retirement is a fact about the SKU
 * (a database row), not about the flag.
 */
export const metadata = { title: 'Live Studio · Setnayan' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<{
    youtube_connected?: string;
    youtube_disconnected?: string;
    youtube_error?: string;
  }>;
};

/** The `youtube_*` keys the OAuth routes attach when they bounce a host back here. */
const FORWARDED = ['youtube_connected', 'youtube_disconnected', 'youtube_error'] as const;

export default async function LiveStudioCastRetiredPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const sp = searchParams ? await searchParams : {};

  const base = liveStudioRoamEnabled()
    ? liveStudioDetailPath(eventId)
    : `/dashboard/${eventId}/studio/panood/setup`;

  // Rebuilt rather than passed through wholesale: only the three keys we know the
  // OAuth routes send are forwarded, so this can never become a way to smuggle
  // arbitrary query into another surface.
  const query = new URLSearchParams();
  for (const key of FORWARDED) {
    const value = sp[key];
    if (typeof value === 'string' && value.length > 0) query.set(key, value);
  }

  const qs = query.toString();
  redirect(qs ? `${base}?${qs}` : base);
}

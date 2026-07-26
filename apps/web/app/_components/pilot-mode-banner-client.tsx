'use client';

/**
 * Route gate for <PilotModeBanner>. Presentation only — the pilot-mode
 * DECISION stays on the server (see pilot-mode-banner.tsx).
 *
 * WHY THIS FILE EXISTS AT ALL: the banner has to be suppressed on the routes an
 * encoder is capturing, and that needs `usePathname()`, which is client-only.
 * The obvious move — mark the whole banner `'use client'` — would drag
 * `@/lib/sku-catalog` (593 lines / ~19 KB of SKU + pricing data, server-only
 * today) into the client bundle of EVERY route, since the banner mounts from
 * the root layout. <DemoModeBanner> was converted from a server component in
 * the opposite direction for exactly this class of reason (root-layout cost is
 * paid site-wide). So the split is: server reads the env + formats the date,
 * this component decides only whether the current route may paint it.
 *
 * ON SSR AND THE ABSENCE OF A FLASH: `/panood/program/[eventId]` is a dynamic
 * route (auth + DB on every request), so `usePathname()` resolves to the real
 * path during its server render and this returns null in the FIRST HTML — the
 * banner is never in the markup an encoder could capture, not even for a frame.
 * On statically prerendered marketing pages the pathname may be unavailable,
 * which reads as "not a capture route" and the banner renders — the desired
 * outcome there, and the same failure direction <CookieConsentBanner> takes.
 */

import { usePathname } from 'next/navigation';
import { isBroadcastCaptureRoute } from './capture-safe-routes';

export function PilotModeBannerClient({ formatted }: { formatted: string }) {
  const pathname = usePathname();

  // Never paint into a window an encoder is capturing (see capture-safe-routes).
  // This banner sits in NORMAL FLOW above {children} in the root layout, so on
  // the program window it would not merely overlay the picture — it would push
  // the whole program surface down and put a terracotta "Pilot mode" bar into
  // the couple's live broadcast, on a day that cannot be re-run.
  if (isBroadcastCaptureRoute(pathname)) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      className="border-b border-terracotta/20 bg-terracotta/5 px-4 py-2 text-center text-[12px] text-terracotta"
    >
      <span className="font-medium">Pilot mode</span>{' '}
      <span className="text-terracotta/80">
        — every add-on and subscription is free for testing through {formatted}.
      </span>
    </aside>
  );
}

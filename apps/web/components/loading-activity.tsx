'use client';

/**
 * LoadingActivity — the branded route-navigation loader.
 *
 * WHAT IT IS (owner 2026-07-05 — "unify on the brand loader"): the gold-particle
 * Setnayan mark (<SDLoader>) fading in over a page skeleton while a route's
 * server work runs. It is the SAME signature loading moment as the cold-start
 * splash (#sn-init-splash) and the blocking-action overlay (useLoader) — ONE
 * mark, everywhere, per the premium "one signature moment" doctrine.
 *
 * HOW IT WIRES IN: the shared `<Screen>` wrapper in components/skeletons/index.tsx
 * renders <LoadingActivity/> above every route skeleton, so all ~167 route
 * `loading.tsx` files pick this up with no per-file change. A few custom
 * loading.tsx (which don't use <Screen>) render it directly.
 *
 * SEQUENCE: on the first paint of a route transition only the (SSR) skeleton
 * shows — instant page-shaped structure. Once this client island hydrates, the
 * branded overlay fades in (`.sd-overlay`, reused from the blocking loader) and
 * <SDLoader> narrates the section-specific work. On fast (<~200ms) navigations
 * the fade barely starts, so quick loads never flash a heavy loader.
 *
 * REPLACES: the prior interactive "play while you wait" overlay (Tap Burst /
 * Wedding Wisdom / Quick Pick), retired 2026-07-05 in favour of the unified
 * brand loader. Narration copy now lives in sd-loader/loader-steps.ts.
 */

import { useEffect, useState } from 'react';
import { SDLoader } from '@/components/sd-loader/sd-loader';
import { ROUTE_STEPS } from '@/components/sd-loader/loader-steps';

/**
 * Resolve the current URL to a ROUTE_STEPS key. Order matters — more specific
 * segments are tested before their parents (e.g. a vendor workspace is under
 * /vendors/ but gets its own copy). Unknown routes fall back to `route`.
 */
function detectRouteKey(pathname: string): keyof typeof ROUTE_STEPS {
  const p = pathname;
  if (p.startsWith('/admin')) return 'admin';
  if (p.startsWith('/vendor-dashboard')) return 'vendorDashboard';
  if (p.startsWith('/explore')) return 'explore';
  if (p.includes('/workspace')) return 'workspace';
  if (p.includes('/guests')) return 'guests';
  if (p.includes('/vendors')) return 'vendors';
  if (p.includes('/budget')) return 'budget';
  if (p.includes('/schedule')) return 'schedule';
  if (p.includes('/seating')) return 'seating';
  if (p.includes('/messages')) return 'messages';
  if (p.includes('/orders')) return 'orders';
  if (p.includes('/studio')) return 'studio';
  if (p.includes('/site-editor') || p.includes('/website')) return 'website';
  return 'route';
}

export function LoadingActivity() {
  // Gate on mount: during SSR + the first client paint we render nothing, so the
  // route skeleton shows alone (instant structure); the branded overlay fades in
  // only after hydration. Also lets us read the live pathname for narration.
  const [ctx, setCtx] = useState<{ steps: readonly string[]; hint: string } | null>(null);

  useEffect(() => {
    const key = detectRouteKey(window.location.pathname);
    setCtx(ROUTE_STEPS[key] ?? ROUTE_STEPS.route);
  }, []);

  if (!ctx) return null;

  return (
    <div className="sd-overlay" aria-hidden="true">
      <SDLoader steps={ctx.steps} hint={ctx.hint} />
    </div>
  );
}

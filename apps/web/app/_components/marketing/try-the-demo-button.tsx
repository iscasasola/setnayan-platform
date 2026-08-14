'use client';

/**
 * try-the-demo-button.tsx — the handle the demos lost.
 *
 * A product's own public page presses this and the overlay `SiteChrome` has
 * been mounting all along finally opens. See `lib/demo-overlay-bus.ts` for why
 * this is a module bus rather than React context (the only shared ancestor is
 * the root layout, where a provider is forbidden by a measured 200 KB
 * shared-chunk ceiling).
 *
 * 🔑 IT RENDERS NOTHING WHERE THE OVERLAY CANNOT RENDER. "No fake doors" is a
 * locked rule, and this component is the direct descendant of a defect where a
 * button's target was deleted and the button kept looking fine.
 *
 * 🪤 AND IT ASKS THE ROUTE, NOT A RUNTIME COUNTER — measured the hard way.
 * The first cut checked `demoOverlayAvailable()` (the live listener count) in a
 * `requestAnimationFrame` after mount. On `/papic`, with the marketing chrome
 * demonstrably mounted, the button **did not render at all**: the frame fired
 * before `SiteChrome`'s subscription effect, so the count was still 0. That is
 * two failure modes in one — a race whose losing side is silent, and a reliance
 * on module state being a true singleton across two different client chunks
 * (this component ships in the page's chunk, `SiteChrome` in the layout's).
 *
 * `isNavRoute(pathname)` is the SAME predicate `SiteChrome` uses to decide
 * whether to mount at all. One source of truth, evaluated during render, no
 * race, no flash, and no assumption about chunking: if this returns true the
 * chrome is mounting on this route by definition, and if it returns false the
 * button is correctly absent.
 */

import { usePathname } from 'next/navigation';
import { PlayCircle } from 'lucide-react';
import { openDemoOverlay, type DemoOverlayId } from '@/lib/demo-overlay-bus';
import { isNavRoute } from './site-chrome';

export function TryTheDemoButton({
  demo,
  label,
  sublabel,
}: {
  demo: DemoOverlayId;
  /** What pressing it gives you — never the word "Demo" alone. */
  label: string;
  /** One line under it. The honest cost: what the person needs to hand. */
  sublabel?: string;
}) {
  // Called unconditionally, then branched — rules-of-hooks, and it reads as the
  // one question this component asks.
  const pathname = usePathname();
  // The route decides, exactly as it does for the chrome that hosts the overlay.
  if (!isNavRoute(pathname)) return null;

  return (
    <button
      type="button"
      onClick={() => openDemoOverlay(demo)}
      className="group inline-flex items-center gap-3 rounded-full border border-ink/15 bg-white/70 px-5 py-3 text-left transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--sn-gold-600)]"
    >
      <PlayCircle
        aria-hidden
        className="h-6 w-6 shrink-0 text-[color:var(--sn-gold-700)]"
        strokeWidth={1.75}
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {sublabel ? (
          <span className="block text-xs text-ink/55">{sublabel}</span>
        ) : null}
      </span>
    </button>
  );
}

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
 * 🔄 AND THEN THE ROUTE STOPPED BEING THE RIGHT QUESTION (2026-08-15). Asking
 * `isNavRoute` was correct while `SiteChrome` was the only thing that mounted
 * the overlays. The seven product doorways then LEFT `NAV_ROUTES` to wear the
 * shared shell — so that predicate would have hidden this button on the exact
 * seven pages whose job is to offer the demo. It asks the bus now: is anything
 * listening? That is what it always meant, and it survives the host moving
 * again.
 *
 * ⚠ THE rAF IS LOAD-BEARING. Effects run depth-first, and this button sits
 * deep inside the page's `<main>` while its host (`DemoOverlayHost`) is a later
 * sibling — so the button's own effect runs BEFORE the host subscribes.
 * Deferring one frame is what lets the answer be true. Measured, not assumed:
 * the first cut of this component read the count synchronously in an effect and
 * rendered NOTHING on a page where the host was demonstrably mounted.
 */

import { PlayCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  demoOverlayAvailable,
  openDemoOverlay,
  type DemoOverlayId,
} from '@/lib/demo-overlay-bus';

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
  /*
    🔄 IT ASKS THE BUS, NOT THE ROUTE (2026-08-15). `isNavRoute` was the right
    question while `SiteChrome` was the only thing that mounted the overlays —
    and it became WRONG the moment the seven doorways LEFT `NAV_ROUTES` to wear
    the shared shell: the button would have vanished from the seven pages whose
    whole job is to offer the demo. `demoOverlayAvailable()` is the question it
    always meant: is anything listening?

    ⚠ STILL AN EFFECT, NOT A RENDER-TIME READ. The subscription is a client
    side effect, so during SSR and first paint the listener set is legitimately
    empty; reading it during render would hide the button on every server render
    and hydrate it in. One frame after mount is when the answer is true.
  */
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(demoOverlayAvailable()));
    return () => cancelAnimationFrame(id);
  }, []);
  if (!ready) return null;

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

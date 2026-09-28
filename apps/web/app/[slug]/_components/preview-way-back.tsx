'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

/**
 * ↩ "BACK TO THE MAKER" — the one door home from the Maker's "Preview the
 * whole <stage>" (DECISION_LOG 2026-09-28, *"EVERY PREVIEW HAS A WAY BACK TO
 * THE MAKER"*; owner, verbatim: *"no way to get back"*).
 *
 * WHO SEES IT. The server mounts it only with an address from
 * `previewWayBackHref` (`_lib/editor-canvas.ts`), which is null unless this is
 * a VERIFIED host's `?preview=draft` tab — never a guest's page, never the
 * Maker's canvas (`?editor=1`), never a tile or a one-scene page. And it draws
 * NOTHING inside a frame: the Maker's Reveal page frames `?preview=draft` too,
 * and a way back drawn in there would sit inside the Maker it leads to. It
 * decides that after mount, so the server HTML never carries it — no frame
 * ever flashes it, and a print or share-card render never sees it.
 *
 * WHERE IT SITS. Bottom-left, ABOVE the guest's Event Bar, never over it: the
 * bar is `fixed bottom-0 z-30`, 3.5rem plus a `max(0.5rem, safe-area)` strip
 * (`site-menu-bar.tsx`), and above `xl` the bar is a side rail, so the control
 * drops to the corner. Mounted as a sibling of the chapters article, never
 * inside it (a transform there breaks `position: fixed`).
 * z-[65]: over the Save-the-Date film (z-50) and the opening's veil (z-60),
 * which stays on top after it lifts — a host can leave mid-opening — and under
 * the full-screen layers a guest opens (z-90, z-100), which carry their own
 * close. While the RSVP sheet is open (z-50, with its own close) it steps aside.
 *
 * A 44px tap target, and a plain link — the same view goes back to the Maker
 * at the same stage and scene. On a desktop the preview is its own tab, so
 * the Maker opens in that tab.
 */
export function PreviewWayBack({ href }: { href: string }) {
  const [inTopWindow, setInTopWindow] = useState(false);
  useEffect(() => setInTopWindow(isTopWindow(window)), []);
  if (!inTopWindow) return null;
  return <PreviewWayBackLink href={href} />;
}

/** Is this document its own tab — not inside any frame? */
export function isTopWindow(win: { self: unknown; top: unknown }): boolean {
  try {
    return win.self === win.top;
  } catch {
    // A cross-origin parent throws on `window.top` access: that is a frame.
    return false;
  }
}

/** The control itself, once the tab is known to be its own. */
export function PreviewWayBackLink({ href }: { href: string }) {
  return (
    <>
      <style>{PREVIEW_WAY_BACK_CSS}</style>
      <a
        href={href}
        data-preview-way-back=""
        aria-label="Back to the Event Hub Maker"
        className="sn-press fixed z-[65] inline-flex min-h-11 items-center gap-1.5 rounded-full bg-ink/90 py-2 pl-3 pr-4 text-sm font-semibold text-cream shadow-lg backdrop-blur hover:bg-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink print:hidden"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={2.25} />
        Back to the Maker
      </a>
    </>
  );
}

/**
 * Position in one unlayered rule so the safe-area sums read as one sentence:
 * below `xl` it clears the Event Bar (3.5rem + its `max(0.5rem, safe-area)`
 * strip + a 0.75rem gap); from `xl` (the bar is a rail) it sits in the corner.
 * And it steps aside while the RSVP sheet is open.
 */
export const PREVIEW_WAY_BACK_CSS =
  '[data-preview-way-back]{left:calc(0.75rem + env(safe-area-inset-left));bottom:calc(4.25rem + max(0.5rem, env(safe-area-inset-bottom)))}' +
  '@media (min-width:1280px){[data-preview-way-back]{bottom:calc(1rem + env(safe-area-inset-bottom))}}' +
  'body:has(.sn-rsvp-sheet[data-open="1"]) [data-preview-way-back]{display:none}';

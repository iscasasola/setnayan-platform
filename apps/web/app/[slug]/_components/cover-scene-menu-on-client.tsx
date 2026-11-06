'use client';

import { useLayoutEffect } from 'react';

/**
 * 🧭 THE BARS' WAIT, FOR A GUEST WHO ARRIVED BY A CLIENT-SIDE NAVIGATION (owner 2026-10-19 21:45, live cale-ice: both
 * bars over the cover just after the unveil). `CoverSceneMenuWaits` (`cover-scene-menu.tsx`) writes its marker from an
 * inline `<script>`, which runs while a page is PARSED — but React never executes a `dangerouslySetInnerHTML` script it
 * inserts itself, so a guest who came from another Setnayan page (the home feed, the app, a redirect) got no marker and
 * both bars over the cover. This finds that script's own text (`data-cover-menu-script`) and runs it — the door
 * `ensureVeilHold()` (`lib/hub-veil.ts`) opened for the Veil's hold — or, where it already runs (a page loaded whole),
 * asks it to look again. A layout effect: before the first paint of the new page, so the bars never flash in.
 * Draws nothing; any error leaves the page as it was (fail-visible: the bars drawn as always).
 */
export function CoverSceneMenuOnClient() {
  useLayoutEffect(() => {
    runCoverMenuOnClient(document, window);
  }, []);
  return null;
}

/** The effect itself, on the page it is handed (exported so a guard can run it on a page React has just inserted). */
export function runCoverMenuOnClient(doc: Document, win: Window): void {
  try {
    const w = win as Window & { __coverMenuCheck?: () => void };
    if (typeof w.__coverMenuCheck === 'function') {
      w.__coverMenuCheck();
      return;
    }
    const text = doc.querySelector('script[data-cover-menu-script]')?.textContent;
    if (!text) return;
    const s = doc.createElement('script');
    s.textContent = text;
    doc.head.appendChild(s);
    s.remove();
  } catch {
    /* fail-visible */
  }
}

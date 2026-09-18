'use client';

import { useEffect } from 'react';

/**
 * OPEN THE THING THE LAUNCHER NAMES.
 *
 * The supplier's tools mount once above the message stream as CLOSED
 * `<details>` (see `lib/vendor-thread-tools.ts`). A plain `href="#build-quote"`
 * therefore scrolls to a collapsed strip and reads as a control that does
 * nothing — which is what shipping the panels-move-up change on its own would
 * have done to four live controls: the rail's own "Send proposal", and the
 * client brief's Quote / Call / Log-payment deep links
 * (`app/vendor-dashboard/clients/[eventId]/page.tsx`).
 *
 * `revealThreadTool` is the whole fix, and it is deliberately general: it walks
 * UP from the target opening every `<details>` on the way, so it works whether
 * the id belongs to a panel, to a button inside one, or to a plain scroll
 * anchor that was never a disclosure at all.
 */
export function revealThreadTool(id: string | readonly string[]): boolean {
  if (typeof document === 'undefined') return false;
  // An ordered list of candidates: the first one on the page wins. A finer
  // target (a button inside a panel) is not always rendered, and falling back
  // to the panel is the difference between a supplier reaching the answer and
  // pressing a button that does nothing.
  const candidates = typeof id === 'string' ? [id] : id;
  let target: HTMLElement | null = null;
  for (const candidate of candidates) {
    target = document.getElementById(candidate);
    if (target) break;
  }
  if (!target) return false;

  /* ONE TOOL AT A TIME. Six panels open at once is the wall this change exists
     to remove — and a closed tool is invisible now, so a stack of them left
     open is the only way that wall can come back. Everything else closes
     first, EXCEPT an ancestor of the target (closing that would hide the very
     thing being opened). */
  for (const other of document.querySelectorAll<HTMLDetailsElement>('[data-thread-tool]')) {
    if (other !== target && !other.contains(target)) other.open = false;
  }

  // Open the target itself when it IS a disclosure, then every disclosure it
  // sits inside. A button in a closed panel is unreachable until its ancestor
  // opens, and `scrollIntoView` on a hidden element goes nowhere.
  let node: HTMLElement | null = target as HTMLElement;
  while (node) {
    if (node instanceof HTMLDetailsElement) node.open = true;
    node = node.parentElement;
  }

  target.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Land the keyboard where the eye went. A `<details>` gets its own summary —
  // focusing the container would announce the whole panel.
  const focusTarget =
    target instanceof HTMLDetailsElement
      ? target.querySelector<HTMLElement>('summary')
      : target;
  focusTarget?.focus?.({ preventScroll: true });
  return true;
}

/**
 * Mounted once on the thread page. Honours a hash the page was OPENED with (a
 * cross-page deep link, a bookmark, a browser Back) and any later hash change.
 *
 * ⚠ It reveals nothing when there is no hash — opening every tool on arrival
 * would rebuild the wall of panels this change exists to remove.
 */
export function ThreadToolHashReveal() {
  useEffect(() => {
    const run = () => {
      const id = window.location.hash.replace(/^#/, '');
      if (!id) return;
      // The panels are server-rendered, but a deep link can land before React
      // has hydrated the stream above them; one frame is enough and costs
      // nothing when the element is already there.
      if (!revealThreadTool(id)) {
        requestAnimationFrame(() => revealThreadTool(id));
      }
    };
    run();
    window.addEventListener('hashchange', run);
    return () => window.removeEventListener('hashchange', run);
  }, []);
  return null;
}

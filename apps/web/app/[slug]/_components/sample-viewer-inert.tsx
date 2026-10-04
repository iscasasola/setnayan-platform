'use client';

import { useEffect } from 'react';

/**
 * 👁 SEE AS — THE SAMPLE GUEST TOUCHES NOTHING (PR-10, owner 2026-10-04:
 * "Nothing is written — it only changes what the canvas draws").
 *
 * Mounted by `SiteBody` (and over the private door) only while the page is
 * drawn for a See as sample viewer (`sampleViewer`) — in the Maker's canvas or
 * on the host's own Event Hub (the ribbon's Preview ▾). The page it guards is
 * the guest page itself — the real reply button, the real "Save my ticket", the
 * real door — so nothing on it may act:
 *
 *   · EVERY SUBMIT is stopped before React reads it (window, capture phase) —
 *     a reply, a sign-out, an "Ask to join", a server action of any kind;
 *   · EVERY PRESS on a button or a field is stopped from doing its job. Inside a
 *     scene of the canvas the Maker's bridge already turns the tap into "select
 *     this scene" (and stops it there), so a press there only loses its default;
 *     anywhere else it is stopped outright — no default, no handler.
 *   · A LINK: in the canvas, stopped like a button (the canvas never leaves the
 *     page). Off the canvas, a link only moves the host around their own pages —
 *     navigation writes nothing — so it is let through, and so are the guest's
 *     tab bar (it switches tabs, nothing else) and the host's own ribbon with its
 *     Preview ▾ list, which are how the host looks around and switches back.
 *
 * The server holds the same line on its own: the sample guest's id matches no
 * row (`SIMULATED_GUEST_ID`), it has no guest session, and the reply action
 * refuses it by id. `see-as-never-writes.test.ts` keeps all three.
 */
export const SAMPLE_PRESSABLE = 'a[href], button, input, select, textarea, label, summary, [role="button"], [role="link"], [role="option"]';

/** The host's own controls and the guest's tab bar — they look around, they never act. */
export const SAMPLE_FREE_OFF_CANVAS = '[data-owner-ribbon], [role="listbox"], nav[aria-label="Site sections"]';

/** Every submit: stopped, before React or the browser acts on it. */
export function stopSampleSubmit(e: Pick<Event, 'preventDefault' | 'stopImmediatePropagation'>) {
  e.preventDefault();
  e.stopImmediatePropagation();
}

/** A press on anything that does something: no default; outside a scene, no handler either. */
export function stopSamplePress(
  e: Pick<Event, 'target' | 'preventDefault' | 'stopImmediatePropagation'>,
  canvas: boolean,
) {
  const t = e.target as Element | null;
  const hit = t?.closest?.(SAMPLE_PRESSABLE);
  if (!t || !hit) return;
  if (!canvas && (t.closest(SAMPLE_FREE_OFF_CANVAS) || hit.matches('a[href]'))) return;
  e.preventDefault();
  if (!t.closest('[data-setnayan-editor-bound="1"]')) e.stopImmediatePropagation();
}

export function SampleViewerInert({ canvas }: { canvas: boolean }) {
  useEffect(() => {
    const press = (e: Event) => stopSamplePress(e, canvas);
    window.addEventListener('submit', stopSampleSubmit, true);
    window.addEventListener('click', press, true);
    return () => {
      window.removeEventListener('submit', stopSampleSubmit, true);
      window.removeEventListener('click', press, true);
    };
  }, [canvas]);
  return <span hidden data-sample-viewer-inert="" />;
}

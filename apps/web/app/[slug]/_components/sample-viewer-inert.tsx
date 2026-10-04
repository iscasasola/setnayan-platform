'use client';

import { useEffect } from 'react';

/**
 * 👁 SEE AS — THE SAMPLE GUEST TOUCHES NOTHING (PR-10, owner 2026-10-04:
 * "Nothing is written — it only changes what the canvas draws").
 *
 * Mounted by `SiteBody` only while the Maker's canvas draws a See as state
 * (`sampleViewer`). The page it guards is the guest page itself — the real
 * reply button, the real "Save my ticket", the real door — so a tap on any of
 * them must do nothing at all:
 *
 *   · EVERY SUBMIT is stopped before React reads it (window, capture phase) —
 *     a reply, a sign-out, an "Ask to join", a server action of any kind;
 *   · EVERY PRESS on a link, a button or a field is stopped from doing its job.
 *     Inside a scene the Maker's bridge already turns the tap into "select this
 *     scene" (and stops it there), so a press there only loses its default here;
 *     anywhere else it is stopped outright — no navigation, no handler.
 *
 * The server holds the same line on its own: the sample guest's id matches no
 * row (`SIMULATED_GUEST_ID`), it has no guest session, and the reply action
 * refuses it by id. `see-as-never-writes.test.ts` keeps all three.
 */
export const SAMPLE_PRESSABLE = 'a[href], button, input, select, textarea, label, summary, [role="button"], [role="link"]';

/** Every submit: stopped, before React or the browser acts on it. */
export function stopSampleSubmit(e: Pick<Event, 'preventDefault' | 'stopImmediatePropagation'>) {
  e.preventDefault();
  e.stopImmediatePropagation();
}

/** A press on anything that does something: no default; outside a scene, no handler either. */
export function stopSamplePress(e: Pick<Event, 'target' | 'preventDefault' | 'stopImmediatePropagation'>) {
  const t = e.target as Element | null;
  if (!t?.closest?.(SAMPLE_PRESSABLE)) return;
  e.preventDefault();
  if (!t.closest('[data-setnayan-editor-bound="1"]')) e.stopImmediatePropagation();
}

export function SampleViewerInert() {
  useEffect(() => {
    window.addEventListener('submit', stopSampleSubmit, true);
    window.addEventListener('click', stopSamplePress, true);
    return () => {
      window.removeEventListener('submit', stopSampleSubmit, true);
      window.removeEventListener('click', stopSamplePress, true);
    };
  }, []);
  return <span hidden data-sample-viewer-inert="" />;
}

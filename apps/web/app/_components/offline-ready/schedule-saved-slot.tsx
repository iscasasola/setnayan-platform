'use client';

import { useMemo } from 'react';
import { createPortal } from 'react-dom';

import { useHydrated } from '@/lib/use-hydrated';

import { ScheduleSavedMark } from './schedule-saved-mark';

/**
 * 📅 THE HOSTS' / COORDINATOR'S SCHEDULE WEARS ITS SAVED MARK FROM THE ROUTE'S LAYOUT — never from the page.
 *
 * WHY NOT FROM THE PAGE: the Event Hub Maker draws `schedule/page.tsx` whole (`launch/page.tsx` imports it), and Next
 * puts every client module a route's server files import into that route's first load — so a mark imported by the page
 * rode in the Maker's first load (3.6KB gz over `scripts/check-maker-js-budget.mjs`), where it is never drawn. Loading
 * it with `import()` instead made one more chunk loadable on demand, one more entry in webpack's runtime that EVERY page
 * loads (`scripts/check-bundle-size.mjs`, which main holds to a few bytes). The route's own `layout.tsx` is the one file
 * the Maker never imports: it mounts this, and nothing reaches the Maker or the shared bundle.
 *
 * HOW: the page draws an empty slot on the server (`SCHEDULE_COPY_SLOT`) carrying the copy's facts as attributes —
 * `data-sn-copy-version` (the worker reads that one out of the kept HTML), the viewer, the event key, the address and
 * the event's dates. This finds the slot and draws the ONE saved mark (`ScheduleSavedMark`) into it. No slot (the
 * Maker's `?maker=1`, a read that failed) = nothing drawn, nothing saved.
 */
export const SCHEDULE_COPY_SLOT = 'data-schedule-copy';

type SlotFacts = {
  el: HTMLElement;
  viewer: string;
  eventKey: string;
  path: string;
  version: string;
  eventDate: string | null;
  eventEndDate: string | null;
};

/** Read once hydrated (`useHydrated` — the server and the hydration pass both draw nothing, so they match). */
function readSlot(): SlotFacts | null {
  const el = document.querySelector<HTMLElement>(`[${SCHEDULE_COPY_SLOT}]`);
  const d = el?.dataset;
  if (!el || !d?.snCopyVersion || !d.snCopyViewer || !d.snCopyEvent || !d.snCopyPath) return null;
  return {
    el,
    viewer: d.snCopyViewer,
    eventKey: d.snCopyEvent,
    path: d.snCopyPath,
    version: d.snCopyVersion,
    eventDate: d.snCopyDay || null,
    eventEndDate: d.snCopyDayEnd || null,
  };
}

export function ScheduleSavedSlot() {
  const hydrated = useHydrated();
  const slot = useMemo(() => (hydrated ? readSlot() : null), [hydrated]);
  if (!slot) return null;
  return createPortal(
    <ScheduleSavedMark
      viewer={slot.viewer}
      eventKey={slot.eventKey}
      eventDate={slot.eventDate}
      eventEndDate={slot.eventEndDate}
      path={slot.path}
      version={slot.version}
    />,
    slot.el,
  );
}

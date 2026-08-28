import type { DayOfModuleId } from '@/lib/vendor-dayof-modules';

/**
 * WHERE EACH DAY-OF MODULE'S TOOL ACTUALLY LIVES.
 *
 * ── WHY IT IS A SHARED MODULE AND NOT A LOCAL FUNCTION ──────────────────────
 * It was a `moduleHref()` inside the launched floor console
 * (`app/vendor-dashboard/on-the-day/live/[eventId]/page.tsx`). The supplier's
 * desk on the celebration's own page needs the same answer, and a second copy
 * of a route table is how two surfaces come to promise different destinations
 * for one tool. Moved here verbatim — same switch, same `null`s, same reasons —
 * so both read ONE map.
 *
 * `null` is never "no tool". It means the tool is rendered INLINE on the floor
 * console rather than living at an address of its own, so a caller that wants
 * links must DROP those ids rather than invent a destination for them. A tile
 * that promises a scanner and delivers a client record is the defect this
 * function's own comment already records once.
 */
export function dayOfModuleHref(id: DayOfModuleId, eventId: string): string | null {
  switch (id) {
    case 'shot_list':
    case 'run_of_show':
    case 'pax_headcount':
    case 'delivery_handover':
    case 'issues_log':
      return `/vendor-dashboard/on-the-day`;
    case 'production_sheet':
      return `/vendor-dashboard/clients/${eventId}/production-sheet`;
    case 'setlist':
      return `/vendor-dashboard/repertoire`;
    case 'qr_scanner':
      // null, NOT a link: the seat scanner is a panel on the floor console
      // (SeatScanner inside FloorCommand), not a destination. It used to point
      // at the generic client page, which has no scanner — a tile that promised
      // a scan and delivered a client record.
      return null;
    case 'review_qr':
    case 'live_reviews':
      return null; // rendered inline on the floor console
    case 'vendor_papic':
      // Counsel-gated: callers filter it out unless the capability is live
      // (isVendorPapicCaptureEnabled); the page itself also fail-closes.
      return `/vendor-dashboard/on-the-day/live/${eventId}/papic`;
    case 'guest_delivery':
      return null; // counsel-gated — not launched here yet
  }
}

/** The floor console's own picker — the one destination five modules share. */
export const DAY_OF_CONSOLE_HREF = '/vendor-dashboard/on-the-day';

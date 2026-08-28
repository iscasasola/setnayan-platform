'use client';

import { Briefcase } from 'lucide-react';

import { STD_FILM_EXIT_EVENT } from './save-the-date-film';

/**
 * SUPPLIER RIBBON — a supplier never sits through a film to get to work.
 *
 * ── THE DEFECT IT CLOSES ────────────────────────────────────────────────────
 * More than 90 days out — which is nearly every booking for most of its life —
 * the celebration's page opens as the Save-the-Date film: `fixed inset-0
 * z-[50]`, with the reveal veil above it at z-[60]. The supplier's strip renders
 * in ordinary document flow underneath both, so a booked photographer who signs
 * in to check the address gets a wedding film and no visible way to their own
 * call sheet. The binding design names exactly this and puts the door above it:
 * *"a ribbon there sits above everything, including the save-the-date film that
 * today paints the supplier's only strip out of sight for months."*
 *
 * ── PORTED, NOT INVENTED — TWICE ────────────────────────────────────────────
 * 1. **The chrome is the host's.** `owner-ribbon.tsx` is the same idea for the
 *    host on the same page, and its docblock already worked out the hard part:
 *    `sticky top-0 z-[90]` *"clears the Save-the-Date stack (film z-50/70,
 *    reveal z-60, touch glow z-80) so a host previewing ?phase=save_the_date can
 *    still click their way back out."* Same stack, same answer, same materials.
 * 2. **The way out of the film is the film's own.** The button dispatches
 *    `STD_FILM_EXIT_EVENT` — the event `StdFilmHandoff` already listens for, and
 *    which `reveal-overlay.tsx` also listens for so the veil retires with the
 *    film. Nothing new is dismissed, nothing is unmounted by hand, and the
 *    visitor's "Watch our film" return still works afterwards. The film is a
 *    PAID product; it is lifted, never spent.
 *
 * ── WHY IT CARRIES ALMOST NOTHING ───────────────────────────────────────────
 * 🔒 Everything on it comes from the `VendorCapability` the server already
 * proved, plus the countdown the desk model already resolved under the
 * supplier's own session. It discloses nothing a second gate would have to
 * authorise, which is deliberate: a second mount point for event content is a
 * second gate to forget.
 *
 * It mounts ONLY in the Save-the-Date phase. On every other day the desk is
 * already the first thing on the page for a supplier, and a ribbon one
 * scroll-inch above it would be chrome repeating what it sits on.
 */

/** The desk's own anchor, so the ribbon can put a supplier in front of it. */
export const SUPPLIER_DESK_ANCHOR = 'your-desk';

export function SupplierRibbon({
  businessName,
  when,
  hasDesk,
}: {
  businessName: string;
  /** "43 days to go" · the date · null when neither could be resolved. */
  when: string | null;
  /** Whether the strip below is the desk or the plain link out — the button
   *  must not promise a desk that could not be built. */
  hasDesk: boolean;
}) {
  return (
    <aside
      aria-label="Your booking"
      className="sticky top-0 z-[90] mb-8 border border-ink/10 bg-paper-deep/95 px-4 py-2.5 backdrop-blur"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink/70">
          Your booking
        </p>
        <p className="min-w-0 text-xs text-ink/75">
          <strong className="font-semibold text-ink">{businessName}</strong>
          {when ? ` · ${when}` : null}
        </p>
        <button
          type="button"
          onClick={() => {
            // Retire the film AND the veil with it — one event, both listeners
            // already shipped. Harmless on a page with neither.
            window.dispatchEvent(new CustomEvent(STD_FILM_EXIT_EVENT));
            // Next frame: the film unmounts on this event, and scrolling before
            // it does lands on a position that is about to change.
            requestAnimationFrame(() => {
              document
                .getElementById(SUPPLIER_DESK_ANCHOR)
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-3 py-1 text-xs font-medium text-ink/75 hover:border-terracotta hover:text-terracotta-700"
        >
          <Briefcase aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          {hasDesk ? 'Open your desk' : 'Your tools for this event'}
        </button>
      </div>
    </aside>
  );
}

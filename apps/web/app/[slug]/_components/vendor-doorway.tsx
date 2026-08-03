import Link from 'next/link';
import { Briefcase, ArrowRight } from 'lucide-react';
import type { VendorCapability } from '../_lib/site-identity';

/**
 * VendorDoorway — the strip a booked supplier sees on their client's own
 * wedding page, pointing at their tools for THIS event.
 *
 * ── THE GAP IT CLOSES ───────────────────────────────────────────────────────
 * Until now the couple's link treated a booked photographer, band or emcee as
 * a stranger. Their run of show, their cues and their call time all exist —
 * in their own workspace — and nothing on the wedding site pointed at any of
 * it, so a supplier had to be sent a separate long address out of band. The
 * project's own wayfinding rule calls a shipped surface with no doorway a
 * defect; this is that defect, for the whole supplier side.
 *
 * ── A DOOR, NOT A ROOM ──────────────────────────────────────────────────────
 * It LINKS OUT rather than rendering anything. A supplier works many weddings;
 * their week, their invoices and their other clients do not belong inside one
 * couple's page. So the strip is deliberately a single line and a link — the
 * couple's site stays the couple's.
 *
 * ── WHY IT IS SAFE ──────────────────────────────────────────────────────────
 * It renders ONLY from a `VendorCapability`, which is produced solely by
 * `resolveVendorCapability` after the database confirmed this auth user owns a
 * vendor profile the couple booked on THIS event. A compile-time assertion in
 * site-identity.ts proves neither identity tier can carry those keys, so no
 * visitor can smuggle one in through the body tree. There is no client input
 * on this path.
 *
 * It also carries NOTHING about the event — the couple's own page is already
 * on screen — so the strip cannot become a second, unaudited leak of event
 * data to a supplier.
 */
export function VendorDoorway({ capability }: { capability: VendorCapability }) {
  return (
    <aside
      className="mx-auto mt-6 w-full max-w-3xl px-4"
      aria-label="Your supplier tools for this event"
    >
      <Link
        href={`/vendor-dashboard/clients/${capability.vendorEventId}`}
        className="group flex items-center gap-3 rounded-2xl border border-link/25 bg-link/[0.04] px-4 py-3 transition-colors hover:border-link/45"
      >
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-link/10 text-link">
          <Briefcase aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-xs font-bold uppercase tracking-[0.14em] text-link">
            You are booked here
          </span>
          <span className="block truncate text-sm text-ink/75">
            Open your tools for this event as{' '}
            <strong className="font-semibold text-ink">{capability.businessName}</strong>
          </span>
        </span>
        <ArrowRight
          aria-hidden
          className="h-4 w-4 shrink-0 text-link transition-transform group-hover:translate-x-0.5"
          strokeWidth={2}
        />
      </Link>
    </aside>
  );
}

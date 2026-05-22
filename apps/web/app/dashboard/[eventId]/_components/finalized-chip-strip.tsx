import Link from 'next/link';
import { BookmarkCheck } from 'lucide-react';
import { VENDOR_CATEGORY_LABEL, type VendorCategory } from '@/lib/vendors';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';

// V1 pilot Home v2 — owner directive 2026-05-22.
// Quiet strip of locked-in vendors. Sits BELOW BudgetCountdownHeader and
// ABOVE PlanningGroups so the host sees their commitments at a glance
// before scrolling into the 12-card planning grid.
//
// "Finalized" = status is at-or-past 'contracted' (per
// CONFIRMED_VENDOR_STATUSES in lib/events.ts). Considering / Shortlisted
// don't surface here — that's the planning grid's job, not the locked
// strip.
//
// Empty-state collapse (owner directive 2026-05-22, second pass): when
// nothing is locked yet, this section renders nothing — the "Nothing
// locked yet — start with your reception venue" hint moved to a subtitle
// on the Today's-one-thing hero card (handled separately). Returning
// null here keeps the section above the planning grid quiet until the
// host actually has commitments to show.

type FinalizedVendor = {
  vendor_id: string;
  vendor_name: string;
  category: VendorCategory;
  status: string | null;
};

type Props = {
  eventId: string;
  vendors: ReadonlyArray<FinalizedVendor>;
};

const CONFIRMED_SET = new Set<string>(CONFIRMED_VENDOR_STATUSES as readonly string[]);

export function FinalizedChipStrip({ eventId, vendors }: Props) {
  const locked = vendors.filter((v) => v.status !== null && CONFIRMED_SET.has(v.status));
  const count = locked.length;

  // Empty-state collapse: nothing locked yet → render nothing. The
  // "start with your reception venue" prompt lives on the Today's-one-
  // thing hero card instead (shipped separately). Returning null here
  // keeps the section quiet so the host's eye flows straight from
  // StageStrip into the 12-card planning grid below.
  if (count === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="finalized-chip-strip-heading"
      className="space-y-3"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="finalized-chip-strip-heading"
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55"
        >
          {`✓ Finalized · ${count} locked`}
        </h2>
      </div>

      <ul className="flex flex-wrap gap-2 sm:gap-3">
        {locked.map((v) => {
          const categoryLabel = VENDOR_CATEGORY_LABEL[v.category] ?? 'Vendor';
          return (
            <li key={v.vendor_id}>
              <Link
                href={`/dashboard/${eventId}/vendors`}
                className="group inline-flex items-center gap-2 rounded-lg border border-terracotta/30 bg-cream px-3 py-2 transition-colors hover:border-terracotta/60 hover:bg-terracotta/5"
              >
                <BookmarkCheck
                  aria-hidden
                  className="h-4 w-4 shrink-0 text-terracotta"
                  strokeWidth={1.75}
                />
                <span className="flex flex-col">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55 group-hover:text-ink/75">
                    {categoryLabel}
                  </span>
                  <span className="text-sm font-medium text-ink">{v.vendor_name}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

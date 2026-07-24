import { BadgeCheck } from 'lucide-react';
import { formatMedianPhp } from '@/lib/verified-median';

/**
 * Verified "typical price" card (PUBLIC couple-facing vendor page).
 *
 * Shows the vendor's OWN verified median — the price their real locked bookings
 * settle at — as a single "typically around ₱X" signal. NOT an exact quote: the
 * figure is the rounded band (roundToTypicalBand), and the couple is told to
 * request a real quote.
 *
 * COMPETITION-LAW guard (load-bearing): this renders the vendor's OWN median
 * only. It carries NO cross-vendor comparison and NO "below/above market"
 * language — it never labels this vendor cheap or expensive relative to peers.
 * The copy is strictly self-referential.
 *
 * Only rendered when: the flag is on, the median is established (≥ min sample),
 * AND the vendor has not chosen to hide prices publicly — all gated by the page.
 */
export function VerifiedPriceCard({
  typicalPricePhp,
  sampleN,
}: {
  typicalPricePhp: number;
  sampleN: number;
}) {
  return (
    <section className="space-y-3 border-b border-ink/10 py-8">
      <div className="flex items-center gap-2">
        <BadgeCheck className="h-5 w-5 text-success-700" strokeWidth={2} aria-hidden />
        <h2 className="text-lg font-semibold tracking-[-0.01em]">Typical price</h2>
      </div>
      <div className="rounded-xl border border-ink/10 bg-ink/[0.02] px-5 py-4">
        <p className="text-3xl font-semibold text-ink">
          Typically around {formatMedianPhp(typicalPricePhp)}
        </p>
        <p className="mt-1.5 text-sm text-ink/60">
          Based on {sampleN} confirmed booking{sampleN === 1 ? '' : 's'} with this
          vendor. A guide, not a quote — your final price depends on your date,
          guest count, and package. Send an inquiry for an exact figure.
        </p>
      </div>
    </section>
  );
}

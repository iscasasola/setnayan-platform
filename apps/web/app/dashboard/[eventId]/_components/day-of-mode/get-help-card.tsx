import Link from 'next/link';
import { LifeBuoy, ArrowRight } from 'lucide-react';

/**
 * Get-help card (Event Lifecycle Menu · day-of grid). The escalation FLOOR: if
 * a vendor no-shows or the couple needs a hand on the day, this routes to
 * help/support so it always does something. PR5 adds the same-day nearby-vendor
 * shortlist above this escalation (gated on a vendor `same_day_available` opt-in).
 */
export function GetHelpCard() {
  return (
    <article className="space-y-3 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
      <header className="flex items-center justify-between">
        <p className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">
          <LifeBuoy aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Get help
        </p>
      </header>

      <h3 className="text-base font-semibold tracking-tight text-ink">Something not right?</h3>
      <p className="text-sm text-ink/55">
        If a vendor is a no-show or you need a hand on the day, reach your coordinator or the
        Setnayan team — we will help you sort it.
      </p>

      <Link
        href="/help"
        className="inline-flex items-center gap-1.5 rounded-full bg-terracotta/10 px-3 py-1.5 text-xs font-medium text-terracotta-700 transition-colors hover:bg-terracotta/20"
      >
        Get help
        <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
      </Link>
    </article>
  );
}

import Link from 'next/link';
import { Wallet, Receipt, CheckCircle2, ArrowRight } from 'lucide-react';
import { getSampleEvent, getSampleEventId } from '@/app/tour/_lib/sample-event';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchBudgetSnapshot, formatPhp } from '@/lib/budget';
import { VENDOR_CATEGORY_LABEL } from '@/lib/vendors';
import type { PlannerLeafInput } from '@/lib/budget-allocation-data';
import { DEFAULT_ALLOCATION_CONFIG } from '@/lib/budget-allocation';
import { TourVendorItemization } from './_components/tour-vendor-itemization';
import { TourBudgetPlanner } from './_components/tour-budget-planner';

/**
 * STOP 4 — "Money, handled."
 *
 * A SERVER component. It resolves the sample event via the pinned resolver
 * (never from params/searchParams), reads the budget snapshot through the
 * service-role admin client, and renders:
 *   1. The headline Target / Committed / Left summary.
 *   2. Per-vendor itemization (read-only fork of VendorItemizationCard — no
 *      add/delete/log-payment forms, no .ics export, no direct-pay/orders).
 *   3. The interactive allocation planner — a client-only fork of
 *      BudgetAllocationPlanner that keeps the PURE client engine (drag the
 *      tilts, totals recompute locally) but drops the snapshot save action.
 *
 * READ-ONLY: imports no server actions; never writes. Display-safe fields
 * only — no contact, qr, meal, payment-method, or order reads.
 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'The budget · Maria & Jose · Setnayan',
  description:
    'See how a couple tracks every peso on Setnayan — committed vs. paid per vendor, plus a live budget planner you can nudge yourself. No sign-up, nothing saved.',
  alternates: { canonical: '/tour/budget' },
  openGraph: {
    title: 'The budget · Maria & Jose · Setnayan',
    description: 'Every peso tracked, every deadline in view — explore a real wedding budget.',
    url: '/tour/budget',
    type: 'website',
  },
};

export default async function TourBudgetPage() {
  const ev = await getSampleEvent();
  const id = await getSampleEventId();
  const admin = createAdminClient();
  const snapshot = await fetchBudgetSnapshot(admin, id);

  const bride = ev.bride_name ?? 'Maria';
  const groom = ev.groom_name ?? 'Jose';
  const { vendors, totals } = snapshot;

  // Derive planner leaves from the couple's ACTUAL booked vendors. We group
  // their itemized totals by category and feed each as a `benchmarkPhp` —
  // honest real money, never invented market data (so the planner's
  // confidence chips read "rough estimate", exactly as designed). One leaf
  // per category present in the booked plan.
  const byCategory = new Map<string, number>();
  for (const v of vendors) {
    const prev = byCategory.get(v.vendor.category) ?? 0;
    byCategory.set(v.vendor.category, prev + v.itemizedTotal);
  }
  const plannerLeaves: PlannerLeafInput[] = Array.from(byCategory.entries())
    .filter(([, amount]) => amount > 0)
    .map(([category, amount]) => ({
      canonicalService: category,
      label: VENDOR_CATEGORY_LABEL[category as keyof typeof VENDOR_CATEGORY_LABEL] ?? category,
      benchmarkPhp: Math.round(amount),
      // A modest band around the benchmark so the shopping range reads sensibly.
      p25Php: Math.round(amount * 0.85),
      p75Php: Math.round(amount * 1.15),
    }));

  // The planner's "total budget" is the sum of what the couple has committed —
  // their real plan total. Falls back to a sensible figure if the seed is empty.
  const plannerBudget = totals.budget > 0 ? Math.round(totals.budget) : null;

  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-20 pt-12 sm:pt-16">
      <header className="mx-auto max-w-2xl text-center">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#8C6932]">Stop 04 · The budget</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight tracking-tight text-[#1E2229] sm:text-5xl">
          Money, handled
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-[#5F5E5A] sm:text-lg">
          Every peso {bride} & {groom} commit is tracked against what they&rsquo;ve paid — vendor by vendor, line by
          line. And before they book anyone, a live planner suggests where each peso should go.
        </p>
      </header>

      {/* Headline summary — Target / Committed / Left. */}
      <section
        aria-label="Budget summary"
        className="mx-auto mt-12 grid max-w-3xl gap-3 sm:grid-cols-3"
      >
        <SummaryStat
          label="Committed"
          value={formatPhp(totals.budget)}
          hint="across every booked vendor"
          tone="gold"
        />
        <SummaryStat
          label="Paid so far"
          value={formatPhp(totals.paid)}
          hint="logged against vendors"
          tone="mulberry"
        />
        <SummaryStat
          label="Left to pay"
          value={formatPhp(totals.remaining)}
          hint={
            totals.upcomingDueCount > 0
              ? `${formatPhp(totals.upcomingDueAmount)} due in 30 days`
              : 'nothing due in 30 days'
          }
          tone="ink"
        />
      </section>

      {/* Per-vendor itemization. */}
      <section className="mx-auto mt-16 max-w-3xl">
        <div className="flex items-center gap-2">
          <Receipt aria-hidden className="h-4 w-4 text-[#8C6932]" strokeWidth={1.75} />
          <h2 className="font-serif text-2xl text-[#1E2229]">Vendor by vendor</h2>
        </div>
        <p className="mt-2 text-sm text-[#5F5E5A]">
          Each vendor shows the agreed total, what&rsquo;s been paid, and every line item — so nothing slips through.
        </p>

        {vendors.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-[#1E2229]/15 bg-white/50 p-8 text-center text-sm text-[#5F5E5A]">
            This sample wedding has no booked vendors yet.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {vendors.map((summary) => (
              <TourVendorItemization key={summary.vendor.vendor_id} summary={summary} />
            ))}
          </div>
        )}
      </section>

      {/* Interactive allocation planner — the client-only moment. */}
      <section className="mx-auto mt-16 max-w-3xl">
        <div className="flex items-center gap-2">
          <Wallet aria-hidden className="h-4 w-4 text-[#8C6932]" strokeWidth={1.75} />
          <h2 className="font-serif text-2xl text-[#1E2229]">Try the budget planner</h2>
        </div>
        <p className="mt-2 text-sm text-[#5F5E5A]">
          Tap any service to splurge, save, or set your own number — the split and your cushion recompute instantly.
          It&rsquo;s a guide, never a rule. Nothing here is saved; reload to start fresh.
        </p>

        <div className="mt-6">
          <TourBudgetPlanner
            budgetPhp={plannerBudget}
            leaves={plannerLeaves}
            config={DEFAULT_ALLOCATION_CONFIG}
          />
        </div>
      </section>

      {/* Forward nav + conversion. */}
      <nav className="mx-auto mt-16 flex max-w-3xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <Link
          href="/tour"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#5F5E5A] transition-colors hover:text-[#1E2229]"
        >
          <ArrowRight aria-hidden className="h-4 w-4 rotate-180" strokeWidth={1.75} />
          Back to all stops
        </Link>
        <Link
          href="/tour/gallery"
          className="inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-full bg-[#5C2542] px-6 py-3 text-sm font-semibold text-[#FBFBFA] transition-opacity hover:opacity-90"
        >
          Next: the gallery
          <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </Link>
      </nav>

      <section className="mx-auto mt-14 max-w-2xl rounded-3xl border border-[#C5A059]/40 bg-[#FBF6EA] px-6 py-10 text-center">
        <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#5C2542]/10">
          <CheckCircle2 aria-hidden className="h-5 w-5 text-[#5C2542]" strokeWidth={1.75} />
        </div>
        <h2 className="mt-4 font-serif text-2xl text-[#1E2229] sm:text-3xl">Plan your own budget, free</h2>
        <p className="mx-auto mt-3 max-w-lg text-base text-[#5F5E5A]">
          Track every peso, every deadline, every vendor — in one place. Set na &rsquo;yan.
        </p>
        <Link
          href="/onboarding/wedding?from=tour"
          className="mt-5 inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#5C2542] px-7 py-3 text-sm font-semibold text-[#FBFBFA] transition-opacity hover:opacity-90"
        >
          Start planning &middot; free
        </Link>
      </section>
    </main>
  );
}

function SummaryStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: 'gold' | 'mulberry' | 'ink';
}) {
  const valueColor =
    tone === 'gold' ? 'text-[#8C6932]' : tone === 'mulberry' ? 'text-[#5C2542]' : 'text-[#1E2229]';
  return (
    <div className="rounded-2xl border border-[#C5A059]/30 bg-[#FBF8F1] p-5 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#8C6932]">{label}</p>
      <p className={`mt-2 font-serif text-3xl tracking-tight ${valueColor}`}>{value}</p>
      <p className="mt-1.5 text-xs text-[#5F5E5A]">{hint}</p>
    </div>
  );
}

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CalendarDays, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { DetailsForm } from './_components/details-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Wedding details' };

/**
 * Wedding details · /dashboard/[eventId]/details
 *
 * The edit surface for the couple's GOVERNANCE-FREE curated match criteria —
 * region, style/feel, budget — the ones the Home "Personalized" block shows.
 * CLAUDE.md 2026-06-02 "do both" · step 1: "couples can correct/refine what
 * we match on."
 *
 * Date / ceremony / venue / guest-count are NOT raw-edited here — they carry
 * the booked-vendor change-flow governance (iteration 0021 §10/§11/§12 + the
 * setEventCeremonyType / updateEventDate vendor-confirmed gates). The wedding
 * date deep-links to its governed editor (/date-selection); ceremony keeps its
 * existing governed chip on the dashboard.
 *
 * Guard mirrors /for-you (getUser → redirect; maybeSingle → notFound).
 * Reachable via the "Edit details" link on the Personalized block (Home +
 * /for-you) and the More tab.
 */
export default async function DetailsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select(
      'event_id, display_name, region, mood_feel_key, estimated_budget_centavos',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  if (eventError) throw new Error(eventError.message);
  if (!event) notFound();

  const base = `/dashboard/${eventId}`;
  const budgetCentavos =
    (event as { estimated_budget_centavos?: number | null }).estimated_budget_centavos ?? null;
  const initialBudgetPesos =
    budgetCentavos != null && budgetCentavos > 0
      ? String(Math.round(budgetCentavos / 100))
      : '';

  return (
    <section className="space-y-5">
      <header className="space-y-1.5">
        <p
          className="font-mono text-[10px] uppercase tracking-[0.22em]"
          style={{ color: 'var(--m-orange-2)' }}
        >
          Wedding details
        </p>
        <h1
          className="m-display-tight text-2xl uppercase sm:text-3xl"
          style={{ letterSpacing: '-0.005em', color: 'var(--m-ink)' }}
        >
          What we match on
        </h1>
        <p className="text-sm text-ink/60">
          Refine these anytime — they tune the vendors we surface for you.
        </p>
      </header>

      <div className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-5">
        <DetailsForm
          eventId={eventId}
          initialRegion={(event as { region?: string | null }).region ?? ''}
          initialFeel={(event as { mood_feel_key?: string | null }).mood_feel_key ?? ''}
          initialBudgetPesos={initialBudgetPesos}
        />
      </div>

      {/* Wedding date keeps its own governed editor (vendor-confirmed gate +
          change-flow). Deep-link rather than raw-edit it here. */}
      <Link
        href={`${base}/date-selection`}
        className="flex items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-paper px-4 py-3 transition-colors hover:bg-cream"
      >
        <span className="flex items-center gap-2.5">
          <CalendarDays aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
          <span className="text-sm text-ink/80">Edit your wedding date</span>
        </span>
        <ArrowRight aria-hidden className="h-4 w-4 text-ink/40" strokeWidth={1.75} />
      </Link>
    </section>
  );
}

'use client';

/**
 * Candidate Date Picker — shows the top 3 onboarding date candidates side-by-side,
 * each with 5 pro signals so the couple can commit without a second round of
 * research. No cons shown — the framing is "here's why each date works",
 * with an honest shortlist-availability signal for the only real constraint.
 *
 * Rendered by date-selection/page.tsx when:
 *   - events.event_date IS NULL (no date locked yet)
 *   - events.date_candidates has ≥1 entry
 */

import { ArrowRight, CalendarCheck2, Users, Wallet, Sparkles, ShoppingBag, Clock } from 'lucide-react';
import { lockEventDate } from '../actions';

export type CandidateInsight = {
  dateKey: string;
  label: string;         // "Sep 12, 2027"
  dow: string;           // "Saturday"
  fullLabel: string;     // "Saturday, September 12, 2027"
  isBest: boolean;

  /** Pro 1 — how many shortlisted vendors are free (or have no conflict on file). */
  shortlist: {
    total: number;
    available: number;        // 'open' from schedule matrix
    confirmNeeded: number;    // 'unknown' — off-platform, confirm manually
    booked: number;           // 'booked' — calendar block covers this date
  };

  /** Pro 2 — couple's stated budget + shortlist price span. */
  budget: {
    eventBudgetCentavos: number | null;  // events.estimated_budget_centavos
    shortlistLoCentavos: number;         // cheapest option across shortlisted categories
    shortlistHiCentavos: number;         // priciest option across shortlisted categories
  };

  /** Pro 3 — date-perspective insight (pure computation, no DB). */
  datePerspective: {
    dowNote: string;     // "Saturday · most popular day for Philippine weddings"
    seasonNote: string;  // "Cool dry season · ideal for outdoor receptions"
    monthNote: string;   // "Off-peak month · more vendor availability"
  };

  /** Pro 4 — marketplace vendor service categories available on this date. */
  marketplace: {
    availableCategories: number;
    totalCategories: number;
  };

  /** Pro 5 — months from today to the date + comfort rating. */
  prep: {
    monthsFromNow: number;
    status: 'very_generous' | 'generous' | 'comfortable' | 'tight' | 'very_tight';
    label: string;  // "Plenty of time · 18 months to plan"
  };
};

function phpFormat(centavos: number): string {
  if (centavos <= 0) return '—';
  const php = centavos / 100;
  if (php >= 1_000_000) return `₱${(php / 1_000_000).toFixed(1)}M`;
  if (php >= 1_000) return `₱${(php / 1_000).toFixed(0)}K`;
  return `₱${php.toLocaleString()}`;
}

const PREP_COLOURS: Record<CandidateInsight['prep']['status'], string> = {
  very_generous: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  generous: 'bg-green-50 text-green-700 border-green-200',
  comfortable: 'bg-sky-50 text-sky-700 border-sky-200',
  tight: 'bg-amber-50 text-amber-700 border-amber-200',
  very_tight: 'bg-red-50 text-red-700 border-red-200',
};

function ProRow({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <li className="flex items-start gap-3 py-2">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
        <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-ink/50">
          {label}
        </span>
        <span className="block text-sm font-semibold text-ink leading-snug">{value}</span>
        {sub ? <span className="block text-xs text-ink/55 mt-0.5">{sub}</span> : null}
      </span>
    </li>
  );
}

function CandidateCard({ c, eventId }: { c: CandidateInsight; eventId: string }) {
  // Pro 1 — vendor shortlist
  const shortlistValue = (() => {
    if (c.shortlist.total === 0) return 'No vendors shortlisted yet';
    const free = c.shortlist.available + c.shortlist.confirmNeeded;
    if (c.shortlist.booked === 0) return `All ${c.shortlist.total} shortlisted vendors free`;
    if (free === c.shortlist.total) return `All ${c.shortlist.total} available`;
    return `${free} of ${c.shortlist.total} vendors available`;
  })();
  const shortlistSub = (() => {
    if (c.shortlist.confirmNeeded > 0 && c.shortlist.booked > 0)
      return `${c.shortlist.confirmNeeded} to confirm · ${c.shortlist.booked} booked on this date`;
    if (c.shortlist.confirmNeeded > 0)
      return `${c.shortlist.confirmNeeded} off-platform · confirm directly`;
    if (c.shortlist.booked > 0) return `${c.shortlist.booked} vendor${c.shortlist.booked === 1 ? '' : 's'} booked elsewhere`;
    return undefined;
  })();

  // Pro 2 — budget
  const budgetValue = (() => {
    if (c.budget.eventBudgetCentavos && c.budget.eventBudgetCentavos > 0) {
      return `${phpFormat(c.budget.eventBudgetCentavos)} budget`;
    }
    if (c.budget.shortlistHiCentavos > 0) {
      const lo = phpFormat(c.budget.shortlistLoCentavos);
      const hi = phpFormat(c.budget.shortlistHiCentavos);
      return lo === hi ? lo : `${lo} – ${hi}`;
    }
    return 'Add vendors to see estimate';
  })();
  const budgetSub = (() => {
    if (c.budget.eventBudgetCentavos && c.budget.shortlistHiCentavos > 0) {
      const lo = phpFormat(c.budget.shortlistLoCentavos);
      const hi = phpFormat(c.budget.shortlistHiCentavos);
      const range = lo === hi ? lo : `${lo}–${hi}`;
      return `Shortlist estimate: ${range}`;
    }
    return undefined;
  })();

  // Pro 4 — marketplace
  const mktValue =
    c.marketplace.totalCategories > 0
      ? `${c.marketplace.availableCategories} of ${c.marketplace.totalCategories} categories bookable`
      : 'Marketplace available';
  const mktSub =
    c.marketplace.availableCategories === c.marketplace.totalCategories
      ? 'Full coverage · Setnayan can help across every category'
      : `${c.marketplace.totalCategories - c.marketplace.availableCategories} categor${c.marketplace.totalCategories - c.marketplace.availableCategories === 1 ? 'y is' : 'ies are'} fully booked — check early`;

  return (
    <li
      className={`relative flex flex-col overflow-hidden rounded-2xl border transition-shadow hover:shadow-md ${
        c.isBest
          ? 'border-terracotta/40 bg-terracotta/[0.04] shadow-sm'
          : 'border-ink/10 bg-cream'
      }`}
    >
      {/* Header */}
      <div className={`px-5 pt-5 pb-4 ${c.isBest ? 'border-b border-terracotta/20' : 'border-b border-ink/[0.07]'}`}>
        {c.isBest ? (
          <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-terracotta/15 px-2.5 py-0.5 text-[11px] font-medium text-terracotta-700">
            <Sparkles aria-hidden className="h-3 w-3" strokeWidth={2} />
            Best match
          </span>
        ) : null}
        <p className="text-2xl font-semibold tracking-tight text-ink">{c.label}</p>
        <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/50">
          {c.dow}
        </p>
      </div>

      {/* 5 pro signals */}
      <ul className="flex-1 divide-y divide-ink/[0.06] px-5">
        <ProRow
          icon={Users}
          label="Your vendors"
          value={shortlistValue}
          sub={shortlistSub}
        />
        <ProRow
          icon={Wallet}
          label="Your budget"
          value={budgetValue}
          sub={budgetSub}
        />
        <ProRow
          icon={CalendarCheck2}
          label="Why this date"
          value={c.datePerspective.dowNote}
          sub={`${c.datePerspective.seasonNote} · ${c.datePerspective.monthNote}`}
        />
        <ProRow
          icon={ShoppingBag}
          label="Services available"
          value={mktValue}
          sub={mktSub}
        />
        <ProRow
          icon={Clock}
          label="Time to prepare"
          value={c.prep.label}
          sub={undefined}
        />
      </ul>

      {/* Prep status badge + CTA */}
      <div className="px-5 pb-5 pt-4">
        <span
          className={`mb-3 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${PREP_COLOURS[c.prep.status]}`}
        >
          {c.prep.monthsFromNow > 0
            ? `${c.prep.monthsFromNow} month${c.prep.monthsFromNow === 1 ? '' : 's'} away`
            : 'This month'}
        </span>

        <form action={lockEventDate}>
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="event_date" value={c.dateKey} />
          <input type="hidden" name="precision" value="day" />
          <button
            type="submit"
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              c.isBest
                ? 'bg-terracotta text-cream hover:bg-terracotta-700 focus:ring-terracotta'
                : 'bg-ink/[0.07] text-ink hover:bg-ink/[0.12] focus:ring-ink/30'
            }`}
          >
            Lock in {c.label}
            <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </button>
        </form>
      </div>
    </li>
  );
}

type Props = {
  eventId: string;
  candidates: CandidateInsight[];
  displayName: string;
};

export function CandidateDatePicker({ eventId, candidates, displayName }: Props) {
  if (candidates.length === 0) return null;

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
          Pick your wedding date
        </p>
        <h1 className="font-display text-3xl italic leading-tight text-ink sm:text-4xl">
          {displayName} — here are your best dates
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Based on the dates you had in mind, your shortlisted vendors, and the Setnayan
          marketplace, here's how each date stacks up. Only pros shown — these all work.
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {candidates.map((c) => (
          <CandidateCard key={c.dateKey} c={c} eventId={eventId} />
        ))}
      </ul>

      <p className="text-center text-sm text-ink/50 sm:text-left">
        Not seeing the right date?{' '}
        <a
          href={`/dashboard/${eventId}/date-selection?path=direct`}
          className="font-medium text-terracotta-700 underline underline-offset-2"
        >
          Pick a different date
        </a>{' '}
        or{' '}
        <a
          href={`/dashboard/${eventId}/date-selection?path=guided`}
          className="font-medium text-terracotta-700 underline underline-offset-2"
        >
          get a meaningful suggestion
        </a>
        .
      </p>
    </section>
  );
}

'use client';

/**
 * Candidate Date Picker — shows the couple's top onboarding date candidates
 * side-by-side, compared on differentiating signals so they can commit without
 * a second round of research. The framing is pros-only ("here is why each date
 * works"), with an honest shortlist-availability signal for the one real
 * constraint.
 *
 * Efficiency features (so the comparison is genuinely scannable):
 *   - "Our pick" banner — one synthesized sentence on why the top date wins.
 *   - Winner pills — per-dimension "best" markers (Most vendors free · Most time
 *     to plan · Most meaningful · Most services) so the trade-off pops.
 *   - Pin a must-have vendor — re-ranks client-side so only dates that keep that
 *     vendor float to the front (ported from the Find-your-date matrix).
 *   - Ranked order — best-first, recomputed when a vendor is pinned.
 *
 * Rendered by date-selection/page.tsx when events.event_date IS NULL and
 * events.date_candidates has at least one entry.
 */

import { useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarCheck2,
  Users,
  Wallet,
  Sparkles,
  ShoppingBag,
  Clock,
  Heart,
  PartyPopper,
  Star,
} from 'lucide-react';
import { lockEventDate } from '../actions';

export type CandidateVendor = {
  key: string;
  name: string;
  category: string | null;
  categoryLabel: string;
  state: 'open' | 'booked' | 'unknown';
};

export type CandidateInsight = {
  dateKey: string;
  label: string; // "Sep 12, 2027"
  dow: string; // "Saturday"
  fullLabel: string; // "Saturday, September 12, 2027"

  /** Pro 1 — shortlisted-vendor availability on this date. */
  shortlist: {
    total: number;
    available: number; // 'open'
    confirmNeeded: number; // 'unknown' — off-platform, confirm manually
    booked: number; // 'booked' — calendar block covers this date
  };
  /** Per-vendor states — powers the client-side pin re-rank. */
  vendors: CandidateVendor[];

  /** Pro 2 — couple's stated budget + shortlist price span (date-independent). */
  budget: {
    eventBudgetCentavos: number | null;
    shortlistLoCentavos: number;
    shortlistHiCentavos: number;
  };

  /** Pro 3a — personal resonance from the auspicious engine (anniversary, etc). */
  meaningful: string[];
  /** Pro 3b — cultural / numerology / astrology "why this date" reasons. */
  why: string[];
  seasonNote: string;
  monthNote: string;

  /** Pro 4 — long-weekend guest-travel note (null when nothing notable). */
  holiday: string | null;

  /** Pro 5 — marketplace vendor service categories available on this date. */
  marketplace: { availableCategories: number; totalCategories: number };

  /** Pro 6 — months to the date + comfort rating. */
  prep: {
    monthsFromNow: number;
    status: 'very_generous' | 'generous' | 'comfortable' | 'tight' | 'very_tight';
    label: string;
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

type WinnerKey = 'vendors' | 'prep' | 'meaningful' | 'services';

/**
 * Compute the unique winner dateKey per dimension across the *current* (possibly
 * pin-filtered) set. Ties → no winner (a pill on every card would not help the
 * comparison). Returns a map dateKey → list of dimension labels it wins.
 */
function computeWinners(cards: CandidateInsight[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  if (cards.length < 2) return out;

  const award = (key: WinnerKey, label: string, value: (c: CandidateInsight) => number) => {
    let best = -Infinity;
    let bestKeys: string[] = [];
    for (const c of cards) {
      const v = value(c);
      if (v > best) {
        best = v;
        bestKeys = [c.dateKey];
      } else if (v === best) {
        bestKeys.push(c.dateKey);
      }
    }
    // Only award when there is a single, meaningfully-positive winner.
    if (bestKeys.length === 1 && best > 0) {
      const dk = bestKeys[0]!;
      const arr = out.get(dk) ?? [];
      arr.push(label);
      out.set(dk, arr);
    }
  };

  award('vendors', 'Most vendors free', (c) => c.shortlist.available);
  award('services', 'Most services', (c) => c.marketplace.availableCategories);
  award('meaningful', 'Most meaningful', (c) => c.meaningful.length);
  award('prep', 'Most time to plan', (c) => c.prep.monthsFromNow);
  return out;
}

/** Overall score for ranking. Vendor availability dominates, then meaningful,
 *  then marketplace coverage, then prep time, then earliest. */
function score(c: CandidateInsight): number {
  return (
    c.shortlist.available * 1_000_000 +
    c.meaningful.length * 100_000 +
    c.marketplace.availableCategories * 100 +
    c.prep.monthsFromNow
  );
}

/** Does the pinned vendor stay available (open / off-platform) on this date? */
function keepsPinned(c: CandidateInsight, pinnedKey: string | null): boolean {
  if (!pinnedKey) return true;
  const v = c.vendors.find((x) => x.key === pinnedKey);
  if (!v) return true; // not on this grid → not blocking
  return v.state === 'open' || v.state === 'unknown';
}

/** Build the "Our pick" sentence for the top card. */
function recommendationSentence(top: CandidateInsight, winners: string[]): string {
  const parts: string[] = [];
  if (top.shortlist.total > 0) {
    if (top.shortlist.booked === 0) {
      parts.push(
        top.shortlist.total === 1
          ? 'keeps your shortlisted vendor'
          : `keeps all ${top.shortlist.total} of your shortlisted vendors`,
      );
    } else {
      parts.push(`keeps ${top.shortlist.available} of your ${top.shortlist.total} vendors free`);
    }
  }
  if (top.meaningful.length > 0) {
    parts.push(top.meaningful[0]!.toLowerCase());
  }
  if (winners.includes('Most time to plan')) {
    parts.push(`gives you the most time to plan (${top.prep.monthsFromNow} months)`);
  } else if (top.holiday) {
    parts.push('lands on a long weekend for easier guest travel');
  } else if (winners.includes('Most services')) {
    parts.push('opens the widest range of vendors to book');
  }
  if (parts.length === 0) return `${top.label} is a strong, well-balanced choice.`;
  // Join with commas + "and".
  const joined =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `We would pick ${top.label} — it ${joined}.`;
}

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
        <span className="block text-sm font-semibold leading-snug text-ink">{value}</span>
        {sub ? <span className="mt-0.5 block text-xs text-ink/55">{sub}</span> : null}
      </span>
    </li>
  );
}

function CandidateCard({
  c,
  eventId,
  isBest,
  winners,
}: {
  c: CandidateInsight;
  eventId: string;
  isBest: boolean;
  winners: string[];
}) {
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
    if (c.shortlist.booked > 0)
      return `${c.shortlist.booked} vendor${c.shortlist.booked === 1 ? '' : 's'} booked elsewhere`;
    return undefined;
  })();

  // Pro 2 — budget
  const budgetValue = (() => {
    if (c.budget.eventBudgetCentavos && c.budget.eventBudgetCentavos > 0)
      return `${phpFormat(c.budget.eventBudgetCentavos)} budget`;
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

  // Pro 5 — marketplace
  const mktValue =
    c.marketplace.totalCategories > 0
      ? `${c.marketplace.availableCategories} of ${c.marketplace.totalCategories} categories bookable`
      : 'Marketplace available';
  const remaining = c.marketplace.totalCategories - c.marketplace.availableCategories;
  const mktSub =
    c.marketplace.totalCategories > 0 && remaining === 0
      ? 'Full coverage · Setnayan can help across every category'
      : remaining > 0
        ? `${remaining} categor${remaining === 1 ? 'y is' : 'ies are'} fully booked — check early`
        : undefined;

  return (
    <li
      className={`relative flex flex-col overflow-hidden rounded-2xl border transition-shadow hover:shadow-md ${
        isBest ? 'border-terracotta/40 bg-terracotta/[0.04] shadow-sm' : 'border-ink/10 bg-cream'
      }`}
    >
      {/* Header */}
      <div
        className={`px-5 pb-4 pt-5 ${isBest ? 'border-b border-terracotta/20' : 'border-b border-ink/[0.07]'}`}
      >
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {isBest ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-terracotta px-2.5 py-0.5 text-[11px] font-semibold text-cream">
              <Star aria-hidden className="h-3 w-3 fill-cream" strokeWidth={2} />
              Our pick
            </span>
          ) : null}
          {winners.map((w) => (
            <span
              key={w}
              className="inline-flex items-center gap-1 rounded-full bg-terracotta/12 px-2 py-0.5 text-[10px] font-medium text-terracotta-700"
            >
              <Sparkles aria-hidden className="h-2.5 w-2.5" strokeWidth={2} />
              {w}
            </span>
          ))}
        </div>
        <p className="text-2xl font-semibold tracking-tight text-ink">{c.label}</p>
        <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/50">
          {c.dow}
        </p>
      </div>

      {/* Signals */}
      <ul className="flex-1 divide-y divide-ink/[0.06] px-5">
        <ProRow icon={Users} label="Your vendors" value={shortlistValue} sub={shortlistSub} />
        {c.meaningful.length > 0 ? (
          <ProRow
            icon={Heart}
            label="Meaningful"
            value={c.meaningful[0]!}
            sub={c.meaningful[1]}
          />
        ) : null}
        <ProRow
          icon={CalendarCheck2}
          label="Why this date"
          value={c.why[0] ?? c.seasonNote}
          sub={c.why[1] ?? c.monthNote}
        />
        {c.holiday ? (
          <ProRow icon={PartyPopper} label="Guest travel" value={c.holiday} />
        ) : null}
        <ProRow icon={Wallet} label="Your budget" value={budgetValue} sub={budgetSub} />
        <ProRow icon={ShoppingBag} label="Services available" value={mktValue} sub={mktSub} />
        <ProRow icon={Clock} label="Time to prepare" value={c.prep.label} />
      </ul>

      {/* Prep badge + CTA */}
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
              isBest
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
  /** The candidate list was narrowed because a locked vendor isn't free on
   *  every date the couple was considering. */
  narrowedByLocks?: boolean;
  /** A locked vendor conflicts with EVERY candidate date — nothing survives the
   *  intersection, so we show the full list with a warning. */
  lockConflict?: boolean;
};

export function CandidateDatePicker({
  eventId,
  candidates,
  displayName,
  narrowedByLocks = false,
  lockConflict = false,
}: Props) {
  const [pinned, setPinned] = useState<string | null>(null);

  // Distinct pinnable vendors (on-platform only — off-platform can't be checked).
  const pinOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: { key: string; name: string; label: string }[] = [];
    for (const v of candidates[0]?.vendors ?? []) {
      if (v.state === 'unknown' || seen.has(v.key)) continue;
      seen.add(v.key);
      out.push({ key: v.key, name: v.name, label: v.categoryLabel });
    }
    return out;
  }, [candidates]);

  // Rank: pinned-kept first, then overall score.
  const ranked = useMemo(() => {
    return [...candidates].sort((a, b) => {
      const ap = keepsPinned(a, pinned) ? 1 : 0;
      const bp = keepsPinned(b, pinned) ? 1 : 0;
      return bp - ap || score(b) - score(a) || a.dateKey.localeCompare(b.dateKey);
    });
  }, [candidates, pinned]);

  const winners = useMemo(() => computeWinners(ranked), [ranked]);
  const top = ranked[0];
  const topKeepsPinned = top ? keepsPinned(top, pinned) : true;

  if (candidates.length === 0) return null;

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
          Pick your wedding date
        </p>
        <h1 className="font-display text-3xl italic leading-tight text-ink sm:text-4xl">
          {displayName} — here are your best dates
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Based on the dates you had in mind, your shortlisted vendors, and the Setnayan
          marketplace, here is how each date compares. Only pros shown — these all work.
        </p>
      </header>

      {narrowedByLocks && !lockConflict ? (
        <p className="flex items-start gap-2 rounded-xl border border-ink/10 bg-ink/[0.03] px-3.5 py-2.5 text-xs text-ink/65">
          <CalendarCheck2 aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-terracotta" strokeWidth={2} />
          <span>
            We narrowed these to the dates your locked vendors are still free on. Lock more
            vendors and your date may settle on its own.
          </span>
        </p>
      ) : null}
      {lockConflict ? (
        <p className="flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
          <CalendarCheck2 aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <span>
            Heads up — one of your locked vendors isn&apos;t free on any of these dates. Showing
            all your candidates; you may need to switch that vendor or pick a different date.
          </span>
        </p>
      ) : null}

      {/* Our pick banner */}
      {top ? (
        <div className="flex items-start gap-3 rounded-2xl border border-terracotta/30 bg-terracotta/[0.06] px-5 py-4">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-terracotta text-cream">
            <Star aria-hidden className="h-4 w-4 fill-cream" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-terracotta-700">
              {pinned && topKeepsPinned ? 'Our pick · keeps your must-have' : 'Our pick'}
            </p>
            <p className="mt-0.5 text-sm font-medium text-ink/85">
              {recommendationSentence(top, winners.get(top.dateKey) ?? [])}
            </p>
          </div>
        </div>
      ) : null}

      {/* Pin a must-have */}
      {pinOptions.length > 0 ? (
        <div className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">
            Pin a must-have vendor
          </p>
          <div className="flex flex-wrap gap-2">
            {pinOptions.map((o) => {
              const active = pinned === o.key;
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setPinned(active ? null : o.key)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                    active
                      ? 'border-terracotta bg-terracotta/10 text-terracotta-700'
                      : 'border-ink/15 bg-cream text-ink/70 hover:border-terracotta/40'
                  }`}
                >
                  <Star
                    aria-hidden
                    className={`h-3.5 w-3.5 ${active ? 'fill-terracotta text-terracotta' : 'text-ink/40'}`}
                    strokeWidth={2}
                  />
                  {o.name}
                </button>
              );
            })}
          </div>
          {pinned ? (
            <p className="text-xs text-ink/55">
              Dates that keep your pinned vendor free are listed first.{' '}
              <button
                type="button"
                onClick={() => setPinned(null)}
                className="font-medium text-terracotta-700 underline"
              >
                Clear
              </button>
            </p>
          ) : null}
        </div>
      ) : null}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ranked.map((c, i) => (
          <CandidateCard
            key={c.dateKey}
            c={c}
            eventId={eventId}
            isBest={i === 0 && (!pinned || topKeepsPinned)}
            winners={winners.get(c.dateKey) ?? []}
          />
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

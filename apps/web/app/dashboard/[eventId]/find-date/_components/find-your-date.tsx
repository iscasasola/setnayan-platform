'use client';

/**
 * "Find your date" — couple-facing Schedule Matrix view.
 *
 * Renders the two rollups from Schedule_Matrix_and_Date_Finder_2026-06-02.md §5:
 *   View 1 — candidate dates ranked by how well they merge the couple's vendors
 *            (must-haves covered → top picks kept).
 *   View 2 — tap a date → "who works together here" (the per-category combo).
 * Folded into one scannable list: each ranked date expands to reveal its combo.
 *
 * Pin a non-negotiable vendor → the dates re-rank client-side so only dates
 * that keep that vendor float to the top.
 *
 * Honesty (RA-10173-clean, per the lock): a vendor with no calendar data reads
 * as "no conflict on file — confirm", never "confirmed free". Off-platform
 * picks (no marketplace id) can't be checked at all. We never assert more than
 * the calendar actually tells us.
 */
import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  CalendarSearch,
  Check,
  X,
  HelpCircle,
  Star,
  ChevronDown,
  ArrowRight,
} from 'lucide-react';
import type { MatrixDate, ScheduleMatrix } from '@/lib/schedule-matrix';
import { formatCount } from '@/lib/format-number';

type Props = {
  eventId: string;
  matrix: ScheduleMatrix;
  /**
   * 🧩 OPENED IN PLACE — Details › Date › "Help me choose" (owner 2026-09-29,
   * DECISION_LOG "THE DATE FINDER LIVES IN STEP 2 …": *"no link-out"*). The
   * same ranking and the same cards; what changes is where it opens:
   *   · no page heading (Details already names the item);
   *   · every date card carries "Use this date" (`onUse`), which hands the day
   *     to the date's own governed save beside it;
   *   · the two "go to Pick your date" links become a month picker in place
   *     (`onMonth`), saved through the same `updateEventDate`;
   *   · no shortlist does not stop it — the month's Saturdays still show.
   * Omitted, the page draws exactly as it did.
   */
  embedded?: { onUse: (dateKey: string) => void; onMonth: (month: string) => void; monthError?: string | null; pending?: boolean };
};

/** "Choose a month" — the in-place stand-in for the old date-selection link. */
function MonthPick({ onMonth, prompt, error, pending }: { onMonth: (month: string) => void; prompt: string; error?: string | null; pending?: boolean }) {
  const [month, setMonth] = useState('');
  const min = new Date().toISOString().slice(0, 7);
  return (
    <div className="space-y-2 pt-1" data-find-date-month="">
      <p className="text-sm text-ink/70">{prompt}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input type="month" min={min} value={month} onChange={(e) => setMonth(e.target.value)} aria-label="The month you are considering" className="min-h-11 rounded-xl border border-ink/15 bg-paper px-3 py-2 text-[16px] text-ink" />
        <button
          type="button"
          disabled={!month || pending}
          onClick={() => onMonth(month)}
          className="inline-flex min-h-11 items-center rounded-xl bg-mulberry px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Compare its Saturdays'}
        </button>
      </div>
      {error ? <p role="alert" className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}

function Shell({ children, embedded = false }: { children: ReactNode; embedded?: boolean }) {
  if (embedded) {
    return (
      <section className="space-y-4" data-find-date-embedded="">
        <p className="text-sm text-ink/65">
          We check the days you&apos;re considering against the suppliers you picked, and show which day keeps the
          most of them — and who works together on each.
        </p>
        {children}
      </section>
    );
  }
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
          <CalendarSearch aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Find your date</h1>
        <p className="max-w-prose text-base text-ink/65">
          We check the dates you&apos;re considering against your shortlisted vendors, so you can
          pick the date that keeps the most of them — and see who works together on each.
        </p>
      </header>
      {children}
    </section>
  );
}

/** Does the pinned vendor stay available on this date? (open or off-platform). */
function dateKeepsPinned(date: MatrixDate, pinnedKey: string | null): boolean {
  if (!pinnedKey) return true;
  for (const cat of date.categories) {
    for (const v of cat.vendors) {
      if (v.key === pinnedKey) return v.state === 'open' || v.state === 'unknown';
    }
  }
  // Pinned vendor isn't on this date's grid at all → treat as not-blocking.
  return true;
}

function rankWithPin(dates: MatrixDate[], pinnedKey: string | null): MatrixDate[] {
  const ranked = [...dates].sort((a, b) => {
    const ap = dateKeepsPinned(a, pinnedKey) ? 1 : 0;
    const bp = dateKeepsPinned(b, pinnedKey) ? 1 : 0;
    return (
      bp - ap ||
      b.coveredCount - a.coveredCount ||
      b.topPicksKept - a.topPicksKept ||
      a.dateKey.localeCompare(b.dateKey)
    );
  });
  return ranked.map((d, i) => ({ ...d, isBest: i === 0 && d.totalCategories > 0 }));
}

function coverageHeadline(date: MatrixDate): string {
  // Only reachable in place (Details): with no suppliers picked there is nothing to count.
  if (date.totalCategories === 0) return 'No suppliers to check yet';
  const swaps = date.coveredCount - date.topPicksKept;
  if (date.coveredCount === date.totalCategories) {
    if (date.topPicksKept === date.totalCategories) {
      return `All ${formatCount(date.totalCategories)} categories covered · keeps every top pick`;
    }
    return `All ${formatCount(date.totalCategories)} covered · ${swaps} swap${swaps === 1 ? '' : 's'}`;
  }
  return `${formatCount(date.coveredCount)} of ${formatCount(date.totalCategories)} categories covered`;
}

function comboSummary(date: MatrixDate): string {
  const swaps = date.coveredCount - date.topPicksKept;
  const missing = date.totalCategories - date.coveredCount;
  if (missing > 0) {
    return `${missing} categor${missing === 1 ? 'y has' : 'ies have'} no free option on this date.`;
  }
  if (swaps === 0) return 'This date works — your full team is free.';
  return `This date works — ${swaps} swap${swaps === 1 ? '' : 's'} to assemble your full team.`;
}

function CategoryLine({ cat }: { cat: MatrixDate['categories'][number] }) {
  const top = cat.vendors[0];
  if (!cat.covered) {
    return (
      <li className="flex items-start gap-2 py-1.5 text-sm">
        <X aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-red-500" strokeWidth={2} />
        <span>
          <span className="font-medium text-ink/85">{cat.label}</span>
          <span className="text-ink/55"> — no free option on this date</span>
        </span>
      </li>
    );
  }
  // Covered + top pick kept.
  if (cat.topPickKept) {
    const unknown = top?.state === 'unknown';
    return (
      <li className="flex items-start gap-2 py-1.5 text-sm">
        {unknown ? (
          <HelpCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink/45" strokeWidth={2} />
        ) : (
          <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-success-600" strokeWidth={2.25} />
        )}
        <span>
          <span className="font-medium text-ink/85">{cat.label}</span>
          <span className="text-ink/55"> — {top?.name}</span>
          {unknown ? (
            <span className="text-ink/45"> · no conflict on file, confirm</span>
          ) : (
            <span className="text-success-700"> · free</span>
          )}
        </span>
      </li>
    );
  }
  // Covered via a swap — top busy, a backup is free.
  const firstFree = cat.vendors.find((v) => v.state === 'open' || v.state === 'unknown');
  const swapUnknown = firstFree?.state === 'unknown';
  return (
    <li className="flex items-start gap-2 py-1.5 text-sm">
      <ArrowRight aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
      <span>
        <span className="font-medium text-ink/85">{cat.label}</span>
        <span className="text-ink/55"> — </span>
        <span className="text-ink/55 line-through">{top?.name}</span>
        <span className="text-red-600"> booked</span>
        <span className="text-ink/55"> → {firstFree?.name}</span>
        {swapUnknown ? (
          <span className="text-ink/45"> · confirm</span>
        ) : (
          <span className="text-success-700"> · free</span>
        )}
      </span>
    </li>
  );
}

function DateCard({
  date,
  expanded,
  onToggle,
  onUse,
}: {
  date: MatrixDate;
  expanded: boolean;
  onToggle: () => void;
  onUse?: (dateKey: string) => void;
}) {
  return (
    <li className="overflow-hidden rounded-xl border border-ink/10 bg-cream">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-ink/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold tracking-tight">{date.label}</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/45">
              {date.dow}
            </span>
            {date.isBest ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-terracotta/15 px-2 py-0.5 text-[11px] font-medium text-terracotta-700">
                <Star aria-hidden className="h-3 w-3" strokeWidth={2.25} />
                Best match
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-sm text-ink/60">{coverageHeadline(date)}</p>
        </div>
        <ChevronDown
          aria-hidden
          className={`h-5 w-5 shrink-0 text-ink/40 transition-transform ${expanded ? 'rotate-180' : ''}`}
          strokeWidth={2}
        />
      </button>
      {expanded ? (
        <div className="border-t border-ink/10 px-4 py-3">
          <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">
            Who works together on {date.label}
          </p>
          <ul className="divide-y divide-ink/[0.06]">
            {date.categories.map((cat) => (
              <CategoryLine key={cat.category} cat={cat} />
            ))}
          </ul>
          <p className="mt-2.5 text-sm font-medium text-ink/75">{comboSummary(date)}</p>
        </div>
      ) : null}
      {onUse ? (
        <div className="border-t border-ink/10 px-4 py-2.5">
          <button
            type="button"
            onClick={() => onUse(date.dateKey)}
            data-find-date-use={date.dateKey}
            className="inline-flex min-h-11 items-center rounded-xl bg-mulberry px-4 text-sm font-medium text-white"
          >
            Use {date.label}
          </button>
        </div>
      ) : null}
    </li>
  );
}

export function FindYourDate({ eventId, matrix, embedded }: Props) {
  const base = `/dashboard/${eventId}`;

  if (embedded) {
    if (!matrix.hasDate) {
      return (
        <Shell embedded>
          <MonthPick
            onMonth={embedded.onMonth}
            error={embedded.monthError}
            pending={embedded.pending}
            prompt="Which month are you considering? We'll compare its Saturdays."
          />
        </Shell>
      );
    }
    return <FindYourDateBody matrix={matrix} base={base} embedded={embedded} />;
  }

  if (!matrix.hasDate) {
    return (
      <Shell>
        <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-8 text-center">
          <p className="text-sm text-ink/65">
            Set the dates you&apos;re considering first — then we&apos;ll find which one keeps the
            most of your vendors free.
          </p>
          <Link
            href={`${base}/date-selection`}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-mulberry px-4 py-2.5 text-sm font-medium text-cream transition hover:opacity-90"
          >
            Set your wedding date
            <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      </Shell>
    );
  }

  if (!matrix.hasShortlist) {
    return (
      <Shell>
        <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-8 text-center">
          <p className="text-sm text-ink/65">
            Shortlist a few vendors first — then we&apos;ll check their calendars against your
            dates and recommend the date that keeps the most of them.
          </p>
          <Link
            href={`${base}/vendors`}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-mulberry px-4 py-2.5 text-sm font-medium text-cream transition hover:opacity-90"
          >
            Shortlist vendors
            <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      </Shell>
    );
  }

  return <FindYourDateBody matrix={matrix} base={base} />;
}

function FindYourDateBody({ matrix, base, embedded }: { matrix: ScheduleMatrix; base: string; embedded?: Props['embedded'] }) {
  const [pinned, setPinned] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(matrix.dates[0]?.dateKey ?? null);

  const dates = useMemo(
    () => (matrix.exactDate ? matrix.dates : rankWithPin(matrix.dates, pinned)),
    [matrix.dates, matrix.exactDate, pinned],
  );

  // Flat unique vendor list (key + name + category label) for the pin selector.
  const pinOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: { key: string; name: string; label: string }[] = [];
    for (const cat of matrix.dates[0]?.categories ?? []) {
      for (const v of cat.vendors) {
        if (v.state === 'unknown' || seen.has(v.key)) continue;
        seen.add(v.key);
        out.push({ key: v.key, name: v.name, label: cat.label });
      }
    }
    return out;
  }, [matrix.dates]);

  return (
    <Shell embedded={Boolean(embedded)}>
      {embedded && !matrix.hasShortlist ? (
        <p className="rounded-md border border-ink/10 bg-cream px-3 py-2 text-xs text-ink/55">
          You haven&apos;t picked any suppliers yet, so every day below is open.
        </p>
      ) : null}
      {matrix.offPlatformCount > 0 ? (
        <p className="rounded-md border border-ink/10 bg-cream px-3 py-2 text-xs text-ink/55">
          {formatCount(matrix.offPlatformCount)} of your vendors {matrix.offPlatformCount === 1 ? 'is' : 'are'}{' '}
          off-platform — we can&apos;t see their calendar, so they show as &ldquo;confirm
          directly.&rdquo;
        </p>
      ) : null}

      {!matrix.exactDate && pinOptions.length > 0 ? (
        <div className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">
            Pin a must-have
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

      <div className="space-y-3">
        {!matrix.exactDate ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">
            Your dates — ranked by how well they merge your vendors
          </p>
        ) : (
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">
            Your date
          </p>
        )}
        <ul className="space-y-3">
          {dates.map((d) => (
            <DateCard
              key={d.dateKey}
              date={d}
              expanded={openKey === d.dateKey}
              onToggle={() => setOpenKey(openKey === d.dateKey ? null : d.dateKey)}
              onUse={embedded?.onUse}
            />
          ))}
        </ul>
      </div>

      {embedded ? (
        matrix.exactDate ? (
          <MonthPick
            onMonth={embedded.onMonth}
            error={embedded.monthError}
            pending={embedded.pending}
            prompt="Considering other days? Choose a month to compare its Saturdays — your date becomes that month until you pick a day."
          />
        ) : null
      ) : matrix.exactDate ? (
        <p className="text-sm text-ink/55">
          Considering other dates?{' '}
          <Link href={`${base}/date-selection`} className="font-medium text-terracotta-700 underline">
            Set a month or a date range
          </Link>{' '}
          to compare which date merges your vendors best.
        </p>
      ) : (
        <p className="text-sm text-ink/55">
          Found the date?{' '}
          <Link href={`${base}/date-selection`} className="font-medium text-terracotta-700 underline">
            Lock it in your date settings
          </Link>
          .
        </p>
      )}
    </Shell>
  );
}

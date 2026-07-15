'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ArrowRight, CalendarHeart, Sparkles } from 'lucide-react';

/**
 * Serializable view of one "Your year" moment — the strings are precomputed on
 * the server (Asia/Manila) so the client never re-derives dates or timezones.
 */
export type YearMomentView = {
  key: string;
  isWedding: boolean;
  label: string;
  dateLabel: string;
  countdownLabel: string;
  isMilestone: boolean;
  /** Dashboard target when the moment belongs to an event; null = no navigation. */
  eventId: string | null;
};

/**
 * "Your year" list — shows the first few moments and expands the rest INLINE,
 * and carries a "See the year →" door to the full /dashboard/year calendar
 * (which also holds the holidays the home strip omits). The 2026-07-13 de-link
 * (home no longer navigates to /dashboard/year) is superseded by the owner's
 * 2026-07-15 "nothing orphaned" directive — the full Year view was left with no
 * in-app doorway, so the see-all row restores it. Moments tied to an event
 * still deep-link into that event's dashboard (an allowed jump); undated/derived
 * moments render as plain, non-navigating rows.
 */
export function YearMomentsList({
  moments,
  initial = 3,
}: {
  moments: YearMomentView[];
  initial?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? moments : moments.slice(0, initial);
  const hiddenCount = moments.length - initial;

  return (
    <div>
      <ul className="space-y-2.5">
        {shown.map((m) => (
          <li key={m.key}>
            <MomentRow moment={m} />
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {hiddenCount > 0 ? (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            aria-expanded={showAll}
            className="inline-flex items-center gap-1 text-xs font-medium text-gold-deep transition-colors hover:text-ink"
          >
            {showAll ? 'Show less' : `Show ${hiddenCount} more`}
            <ChevronDown
              aria-hidden
              className={`h-3.5 w-3.5 transition-transform duration-200 ${
                showAll ? 'rotate-180' : ''
              }`}
            />
          </button>
        ) : null}
        {/* Door to the full Year calendar (holidays + every moment). */}
        <Link
          href="/dashboard/year"
          className="inline-flex items-center gap-1 text-xs font-medium text-gold-deep transition-colors hover:text-ink"
        >
          See the year
          <ArrowRight aria-hidden className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function MomentRow({ moment: m }: { moment: YearMomentView }) {
  const Icon = m.isWedding ? Sparkles : CalendarHeart;
  const shell = [
    'flex items-center gap-3.5 rounded-xl border px-4 py-3',
    m.isMilestone
      ? 'border-gold/40 bg-gold/[0.06]'
      : 'border-ink/10 bg-ink/[0.015]',
  ].join(' ');
  const inner = (
    <>
      <span
        className={[
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          m.isMilestone ? 'bg-gold/15 text-gold-deep' : 'bg-ink/[0.06] text-ink/55',
        ].join(' ')}
      >
        <Icon aria-hidden className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{m.label}</p>
        <p className="truncate text-xs text-ink/50">{m.dateLabel}</p>
      </div>
      <span
        className={[
          'shrink-0 whitespace-nowrap text-xs font-medium',
          m.isMilestone ? 'text-gold-deep' : 'text-ink/45',
        ].join(' ')}
      >
        {m.countdownLabel}
      </span>
    </>
  );

  // An event moment deep-links into that event's dashboard (allowed jump);
  // a derived/undated moment is a plain non-navigating row.
  return m.eventId ? (
    <Link
      href={`/dashboard/${m.eventId}`}
      className={`${shell} sn-press transition-colors ${
        m.isMilestone ? 'hover:bg-gold/[0.1]' : 'hover:bg-ink/[0.04]'
      }`}
    >
      {inner}
    </Link>
  ) : (
    <div className={shell}>{inner}</div>
  );
}

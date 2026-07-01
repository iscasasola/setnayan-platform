'use client';

import { useState, type ReactNode } from 'react';
import { MomentumCard, type MomentumWindow, type MomentumMode } from './momentum-card';
import { MomentumWindowToggle } from './momentum-window-toggle';
import { buildPerformanceHref } from './perf-links';

/**
 * The shared filter row (Daily/Monthly/Annual + service scope) plus everything
 * it drives — the Momentum card AND (Pro+) the windowed "Your business" section
 * (ROI + booking funnel + by-source). These are the only cards on My
 * Performance whose numbers change with these two controls; everything else is
 * shop-level / market / forward-looking and sits above this row untouched.
 *
 * The Daily/Monthly/Annual toggle is pure client state: all three windows are
 * pre-rendered server-side and passed in, so switching swaps them INSTANTLY with
 * no refetch and no Apply button. The service selector re-fetches on navigation
 * (which re-renders the pre-rendered windows for the new scope).
 */
export function PerformanceControls({
  initialMode,
  isFull,
  serviceId,
  day,
  month,
  year,
  monthlySeries,
  dailySeries,
  scopeLabel,
  nullExcludedYear,
  nullExcludedMonth,
  nullExcludedDay,
  serviceSelector,
  windowedSection = null,
}: {
  initialMode: MomentumMode;
  isFull: boolean;
  serviceId: string | null;
  day?: MomentumWindow;
  month: MomentumWindow;
  year: MomentumWindow;
  monthlySeries: MomentumCardMonthlySeries;
  dailySeries: MomentumCardDailySeries;
  scopeLabel: string | null;
  nullExcludedYear: number | null;
  nullExcludedMonth: number | null;
  nullExcludedDay: number | null;
  /** Server-rendered <ServiceScopeSelector/> (or null when <2 active services). */
  serviceSelector: ReactNode;
  /** Pre-rendered ROI+funnel+by-source per window (Pro+), swapped by the toggle.
   *  null on Solo — the page shows an upsell in its place instead. */
  windowedSection?: { day: ReactNode; month: ReactNode; year: ReactNode } | null;
}) {
  const [mode, setMode] = useState<MomentumMode>(initialMode);

  const handleSelect = (value: MomentumMode) => {
    setMode(value);
    if (typeof window !== 'undefined') {
      window.history.replaceState(
        null,
        '',
        buildPerformanceHref({ service: serviceId, momentum: value }),
      );
    }
  };

  const nullServiceExcluded =
    mode === 'year' ? nullExcludedYear : mode === 'month' ? nullExcludedMonth : nullExcludedDay;

  const activeWindowed = windowedSection
    ? mode === 'year'
      ? windowedSection.year
      : mode === 'month'
        ? windowedSection.month
        : windowedSection.day
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MomentumWindowToggle mode={mode} isFull={isFull} onSelect={handleSelect} />
        {serviceSelector}
      </div>

      <MomentumCard
        mode={mode}
        variant={isFull ? 'full' : 'basic'}
        day={day}
        month={month}
        year={year}
        monthlySeries={monthlySeries}
        dailySeries={dailySeries}
        scopeLabel={scopeLabel}
        nullServiceExcluded={nullServiceExcluded}
      />

      {activeWindowed}
    </div>
  );
}

// Re-typed here to avoid importing the concrete row types into this file just
// for a prop signature — MomentumCard already types these internally.
type MomentumCardMonthlySeries = Parameters<typeof MomentumCard>[0]['monthlySeries'];
type MomentumCardDailySeries = Parameters<typeof MomentumCard>[0]['dailySeries'];

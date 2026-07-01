'use client';

import { useState, type ReactNode } from 'react';
import { MomentumCard, type MomentumWindow, type MomentumMode } from './momentum-card';
import { MomentumWindowToggle } from './momentum-window-toggle';
import { buildPerformanceHref } from './perf-links';

/**
 * The shared filter row (Daily/Monthly/Annual + service scope) plus the
 * Momentum card it drives — the only content on My Performance whose numbers
 * actually change with these two controls. Everything else on the page is
 * shop-level and sits above this row untouched by either filter.
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
    </div>
  );
}

// Re-typed here to avoid importing the concrete row types into this file just
// for a prop signature — MomentumCard already types these internally.
type MomentumCardMonthlySeries = Parameters<typeof MomentumCard>[0]['monthlySeries'];
type MomentumCardDailySeries = Parameters<typeof MomentumCard>[0]['dailySeries'];

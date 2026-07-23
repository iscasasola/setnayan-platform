'use client';

/**
 * Milestones repeater for the Our Story editor — the couple's own timeline
 * beats (LoveMilestone: year · optional month/day · title). Rows submit as
 * index-aligned ms_year / ms_month / ms_day / ms_title arrays; the server
 * action drops incomplete rows and auto-sorts chronologically, so no manual
 * reorder control is needed (the canonical "auto-sorted" behavior).
 */
import { useState } from 'react';
import { Plus, X } from 'lucide-react';

export type MilestoneRow = { year: string; month?: string; day?: string; title: string };

const inputCls =
  'rounded-lg border border-ink/15 bg-cream px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none';

export function MilestonesField({ initial }: { initial: MilestoneRow[] }) {
  const [rows, setRows] = useState<MilestoneRow[]>(initial.length ? initial : [{ year: '', title: '' }]);

  function patch(i: number, key: keyof MilestoneRow, value: string) {
    setRows((r) => r.map((row, j) => (j === i ? { ...row, [key]: value } : row)));
  }

  return (
    <div className="space-y-3">
      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <input
            name="ms_year"
            value={row.year}
            onChange={(e) => patch(i, 'year', e.target.value)}
            placeholder="2022"
            inputMode="numeric"
            maxLength={4}
            aria-label={`Milestone ${i + 1} year`}
            className={`${inputCls} w-20`}
          />
          <input
            name="ms_month"
            value={row.month ?? ''}
            onChange={(e) => patch(i, 'month', e.target.value)}
            placeholder="MM"
            inputMode="numeric"
            maxLength={2}
            aria-label={`Milestone ${i + 1} month (optional)`}
            className={`${inputCls} w-16`}
          />
          <input
            name="ms_day"
            value={row.day ?? ''}
            onChange={(e) => patch(i, 'day', e.target.value)}
            placeholder="DD"
            inputMode="numeric"
            maxLength={2}
            aria-label={`Milestone ${i + 1} day (optional)`}
            className={`${inputCls} w-16`}
          />
          <input
            name="ms_title"
            value={row.title}
            onChange={(e) => patch(i, 'title', e.target.value)}
            placeholder="Our first trip together…"
            maxLength={120}
            aria-label={`Milestone ${i + 1} title`}
            className={`${inputCls} min-w-0 flex-1`}
          />
          <button
            type="button"
            onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
            aria-label={`Remove milestone ${i + 1}`}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink/10 text-ink/50 transition hover:border-red-300 hover:text-red-600"
          >
            <X aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows((r) => [...r, { year: '', title: '' }])}
        className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3.5 py-2 text-sm font-medium text-ink/70 transition hover:border-terracotta hover:text-terracotta"
      >
        <Plus aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Add a moment
      </button>
      <p className="text-xs text-ink/45">
        A moment needs a year and a few words — month and day are optional. Your timeline
        sorts itself by date.
      </p>
    </div>
  );
}

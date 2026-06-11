'use client';

/**
 * BuildPinModeControl — Phase 3a of the Pin constraint solver
 * (`Budget_Build_Pin_Solver_Plan_2026-06-09.md` §4).
 *
 * A "What's fixed?" segmented control at the top of the Build tab. The couple
 * declares which dimension LEADS the solve; the others read from it:
 *   - Budget (default) — today's behavior: Compute fits services into the
 *     pinned budget. No engine change.
 *   - Services — the picked set is fixed; the budget becomes a derived
 *     readout ("this plan needs ₱X–₱Y" = the model's range span) with a
 *     find-your-date bridge (`/find-date` — reused, never forked).
 *   - Date — the day is fixed; availability context + the find-date bridge.
 *     Pricing stays the typical (median) figure until date-aware pricing
 *     (Phase 3b) ships — the copy says so, never implying date-flex pricing.
 *
 * No engine work, no migration: the mode is client state persisted per event
 * in localStorage (cross-device persistence is an open owner decision — plan
 * §9.4) and stamped onto saved Compare snapshots as the forward-compat
 * optional `PlanBuildSnapshot.pinMode` (JSONB, no schema change).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarRange, ListChecks, Wallet } from 'lucide-react';

export type BuildPinModeValue = 'budget' | 'services' | 'date';

const STORAGE_KEY = (eventId: string) => `setnayan:build-pin-mode:${eventId}`;

/** Safe on the server (returns the default) and in storage-blocked browsers. */
export function readPinMode(eventId: string): BuildPinModeValue {
  if (typeof window === 'undefined') return 'budget';
  try {
    const v = window.localStorage.getItem(STORAGE_KEY(eventId));
    return v === 'services' || v === 'date' ? v : 'budget';
  } catch {
    return 'budget';
  }
}

export function storePinMode(eventId: string, mode: BuildPinModeValue) {
  try {
    window.localStorage.setItem(STORAGE_KEY(eventId), mode);
  } catch {
    // Storage unavailable (private mode) — the mode just won't survive reload.
  }
}

const peso = (php: number) => `₱${Math.round(php).toLocaleString('en-PH')}`;

const MODES: { key: BuildPinModeValue; label: string; icon: typeof Wallet }[] = [
  { key: 'budget', label: 'Budget', icon: Wallet },
  { key: 'services', label: 'Services', icon: ListChecks },
  { key: 'date', label: 'Date', icon: CalendarRange },
];

export function BuildPinModeControl({
  eventId,
  budgetPhp,
  dateIso,
  dateLabel,
  rangeLoPhp,
  rangeHiPhp,
}: {
  eventId: string;
  /** Pinned budget (events.estimated_budget_centavos → PHP), null = flagged. */
  budgetPhp: number | null;
  /** Pinned wedding date (events.event_date), null = flagged. */
  dateIso: string | null;
  dateLabel: string | null;
  /** The plan's cheapest→priciest span (model.rangeLo/HiCentavos → PHP). */
  rangeLoPhp: number;
  rangeHiPhp: number;
}) {
  const [mode, setMode] = useState<BuildPinModeValue>('budget');

  // Hydrate from localStorage after mount — the server always renders the
  // 'budget' default, so reading lazily avoids an SSR markup mismatch.
  useEffect(() => {
    setMode(readPinMode(eventId));
  }, [eventId]);

  function pick(next: BuildPinModeValue) {
    setMode(next);
    storePinMode(eventId, next);
  }

  const hasRange = rangeHiPhp > 0;
  const needsText =
    rangeLoPhp === rangeHiPhp ? peso(rangeHiPhp) : `${peso(rangeLoPhp)}–${peso(rangeHiPhp)}`;
  const findDateHref = `/dashboard/${eventId}/find-date`;

  return (
    <section className="rounded-2xl border border-ink/10 bg-cream p-4">
      <div className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink/50">
        What’s fixed?
      </div>
      <p className="mb-3 text-xs text-ink/55">
        Choose what leads — Setnayan solves the rest around it.
      </p>

      <div className="grid grid-cols-3 gap-1 rounded-xl border border-ink/10 bg-paper p-1" role="tablist" aria-label="Pin mode">
        {MODES.map(({ key, label, icon: Icon }) => {
          const on = mode === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => pick(key)}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                on ? 'bg-mulberry text-paper' : 'text-ink/60 hover:bg-ink/[0.04]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden />
              {label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 rounded-xl border border-ink/8 bg-paper px-3 py-2.5">
        {mode === 'budget' && (
          <p className="text-sm text-ink/75">
            <span className="font-semibold text-ink">Your budget leads.</span>{' '}
            {budgetPhp != null
              ? `Compute fits your flagged categories into ${peso(budgetPhp)}.`
              : 'Pin a budget in the anchors below so Compute knows the ceiling.'}
          </p>
        )}

        {mode === 'services' && (
          <div className="space-y-2">
            <p className="text-sm text-ink/75">
              <span className="font-semibold text-ink">Your services lead.</span>{' '}
              {hasRange
                ? `This plan needs ${needsText} — the budget reads from your picks now.`
                : 'Add services to your plan and the budget will read from them.'}
            </p>
            <FindDateLink href={findDateHref} label="Find the date your whole team can do" />
          </div>
        )}

        {mode === 'date' && (
          <div className="space-y-2">
            <p className="text-sm text-ink/75">
              <span className="font-semibold text-ink">Your date leads.</span>{' '}
              {dateIso && dateLabel
                ? `Everything plans around ${dateLabel}.`
                : 'Pin your wedding date in the anchors below to fix the day.'}
            </p>
            <p className="text-xs text-ink/55">
              Prices shown stay typical for now — they don’t flex by date yet.
            </p>
            <FindDateLink href={findDateHref} label="See which dates fit your vendors" />
          </div>
        )}
      </div>
    </section>
  );
}

function FindDateLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-lg border border-mulberry/40 bg-mulberry/5 px-3 py-1.5 text-xs font-semibold text-mulberry hover:bg-mulberry/10"
    >
      {label}
      <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden />
    </Link>
  );
}

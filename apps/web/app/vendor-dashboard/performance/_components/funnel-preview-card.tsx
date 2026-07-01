'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Filter, ArrowRight, ChevronDown } from 'lucide-react';
import type { FunnelStep } from '@/lib/vendor-funnel';

/**
 * Inline funnel preview for My Performance — the four-stage
 * views → inquiries → quotes → booked bar cascade, each bar scaled to the top
 * stage (profile views) so the drop-off is visible at a glance. Links through
 * to the full /vendor-dashboard/funnel surface for the sliced breakdown.
 *
 * Each row expands on tap to show a one-line explainer of what the stage
 * counts; tapping again collapses it. Data comes from the shared
 * fetchVendorFunnelTotals() + buildFunnelSteps() so this preview and the full
 * page never disagree on what "booked" means.
 */

function conv(part: number, whole: number): string | null {
  if (whole <= 0) return null;
  return `${Math.round((part / whole) * 100)}%`;
}

const STAGE_HINT: Record<string, string> = {
  'Profile views': 'How many times couples opened your profile.',
  Inquiries: 'Couples who reached out to ask about your services.',
  'Quotes sent': 'Inquiries you replied to with a price or package.',
  Booked: 'Quotes couples confirmed and booked.',
};

export function FunnelPreviewCard({
  steps,
  windowLabel,
}: {
  steps: FunnelStep[];
  windowLabel: string;
}) {
  const top = steps[0]?.count ?? 0;
  const hasData = top > 0;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(label: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--m-ink)' }}>
          Where bookings come from
          <span
            className="ml-2 font-mono text-[11px] uppercase tracking-[0.15em]"
            style={{ color: 'var(--m-slate-3)' }}
          >
            {windowLabel}
          </span>
        </h2>
        <Link
          href="/vendor-dashboard/funnel"
          className="group inline-flex items-center gap-1 text-sm font-medium"
          style={{ color: 'var(--m-orange-2)' }}
        >
          Details
          <ArrowRight
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
            strokeWidth={1.75}
            aria-hidden
          />
        </Link>
      </div>

      <div className="rounded-lg border bg-white p-5" style={{ borderColor: 'var(--m-line)' }}>
        {!hasData ? (
          <div className="flex items-center gap-3 py-2" style={{ color: 'var(--m-slate)' }}>
            <Filter className="h-5 w-5" strokeWidth={1.5} aria-hidden style={{ color: 'var(--m-slate-4)' }} />
            <p className="text-sm">No profile views {windowLabel} yet — your funnel fills in as couples find you.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {steps.map((s, i) => {
              const widthPct = Math.max((s.count / top) * 100, s.count > 0 ? 4 : 0);
              // Step-to-step conversion (this stage ÷ the stage above it).
              const prev = i > 0 ? (steps[i - 1]?.count ?? null) : null;
              const rate = prev != null ? conv(s.count, prev) : null;
              const isOpen = expanded.has(s.label);
              return (
                <li key={s.label}>
                  <button
                    type="button"
                    onClick={() => toggle(s.label)}
                    aria-expanded={isOpen}
                    className="block w-full text-left"
                  >
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="flex items-center gap-1 text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                        {s.label}
                        <ChevronDown
                          aria-hidden
                          className={`h-3.5 w-3.5 text-[var(--m-slate-3)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                          strokeWidth={1.75}
                        />
                      </span>
                      <span className="flex items-baseline gap-2">
                        {rate && (
                          <span className="font-mono text-[11px]" style={{ color: 'var(--m-orange-2)' }}>
                            {rate}
                          </span>
                        )}
                        <span className="font-mono text-sm tabular-nums" style={{ color: 'var(--m-ink)' }}>
                          {s.count.toLocaleString('en-PH')}
                        </span>
                      </span>
                    </div>
                    <div
                      className="h-2.5 w-full overflow-hidden rounded-full"
                      style={{ background: 'color-mix(in srgb, var(--m-ink) 5%, transparent)' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${widthPct}%`, background: 'var(--m-orange)' }}
                      />
                    </div>
                  </button>
                  {isOpen ? (
                    <p className="mt-1.5 text-xs leading-snug" style={{ color: 'var(--m-slate-3)' }}>
                      {STAGE_HINT[s.label]}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

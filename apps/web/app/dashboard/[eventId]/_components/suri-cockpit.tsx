import Link from 'next/link';
import {
  Sparkles,
  ArrowRight,
  ListChecks,
  CalendarClock,
  CheckCircle2,
} from 'lucide-react';
import type { CockpitModel } from '@/lib/setnayan-ai-cockpit';

/**
 * SuriCockpit — the Setnayan-AI DECISION COCKPIT on the couple Overview
 * (item R4, owner-approved taxonomy 2026-07-09). Renders ONLY behind the
 * dormant `cockpitEnabled()` flag; with the flag OFF the Overview is
 * byte-identical to R3's status board.
 *
 * Three beats, all fed from the pure `buildCockpitModel` derivation (no new
 * queries — every number comes from data the Overview already loaded):
 *   1. Suri briefing — a single human summary line.
 *   2. Decisions — open choices that BLOCK progress and need the couple.
 *   3. What's next — time-ordered upcoming deadlines/nudges.
 *
 * Pure presentation — a server component (Link + inline SVG icons, no client
 * JS). Wine/champagne palette, matching the OverviewAtAGlance glance-strip it
 * sits beside.
 */
export function SuriCockpit({ model }: { model: CockpitModel }) {
  const { briefing, decisions, upcoming } = model;

  return (
    <section
      aria-labelledby="suri-cockpit-heading"
      className="space-y-3"
    >
      {/* Suri briefing hero — the one-line "what now?" summary. */}
      <div className="m-card overflow-hidden">
        <div className="flex items-start gap-3 border-l-4 border-mulberry px-4 py-4">
          <span
            aria-hidden
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mulberry/10 text-mulberry"
          >
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <h2
                id="suri-cockpit-heading"
                className="m-serif text-lg leading-none text-ink"
              >
                Suri briefing
              </h2>
              <span className="rounded-full bg-mulberry/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-mulberry">
                Setnayan AI
              </span>
            </div>
            <p className="text-sm leading-snug text-ink/75">
              {briefing.sentence}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Decisions rail — choices that block progress. */}
        <div className="m-card space-y-3 px-4 py-4">
          <div className="flex items-center gap-2">
            <ListChecks aria-hidden className="h-4 w-4 text-mulberry" />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/60">
              Decisions
            </h3>
            {decisions.length > 0 ? (
              <span className="ml-auto rounded-full bg-mulberry/10 px-2 py-0.5 text-[11px] font-semibold text-mulberry">
                {decisions.length}
              </span>
            ) : null}
          </div>

          {decisions.length === 0 ? (
            <p className="flex items-center gap-2 py-2 text-sm text-ink/55">
              <CheckCircle2 aria-hidden className="h-4 w-4 text-mulberry/70" />
              Nothing needs a decision right now.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {decisions.map((d) => (
                <li key={d.id}>
                  <Link
                    href={d.href}
                    className="m-card-lift group flex items-center gap-3 rounded-lg border border-ink/10 px-3 py-2.5 transition-colors hover:border-mulberry/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {d.label}
                      </p>
                      <p className="truncate text-xs text-ink/55">{d.detail}</p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-mulberry">
                      {d.ctaLabel}
                      <ArrowRight
                        aria-hidden
                        className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* What's next rail — time-ordered upcoming deadlines. */}
        <div className="m-card space-y-3 px-4 py-4">
          <div className="flex items-center gap-2">
            <CalendarClock aria-hidden className="h-4 w-4 text-mulberry" />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/60">
              What&rsquo;s next
            </h3>
          </div>

          {upcoming.length === 0 ? (
            <p className="py-2 text-sm text-ink/55">
              No upcoming deadlines yet. Set your date to start the countdown.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {upcoming.slice(0, 5).map((u) => {
                const overdue = u.daysOut !== null && u.daysOut < 0;
                const row = (
                  <div className="flex items-center gap-3 rounded-lg border border-ink/10 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {u.label}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-xs font-medium ${
                        overdue ? 'text-terracotta' : 'text-ink/60'
                      }`}
                    >
                      {u.when}
                    </span>
                  </div>
                );
                return (
                  <li key={u.id}>
                    {u.href ? (
                      <Link
                        href={u.href}
                        className="m-card-lift block transition-colors hover:border-mulberry/40"
                      >
                        {row}
                      </Link>
                    ) : (
                      row
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

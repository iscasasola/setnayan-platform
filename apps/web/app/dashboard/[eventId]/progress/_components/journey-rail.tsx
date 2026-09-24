'use client';

import { useState } from 'react';
import { RAIL_STOP_PX, railHeadPercent, stageMarkFor } from '@/lib/stage-mark';
import type { ProgressStage, ProgressStageKey } from '@/lib/progress-stages';

/**
 * JourneyRail — the "Read your progress" scrubber on the Decisions & Progress
 * page. Six stage buttons on a horizontally scrollable rail; clicking (or
 * ← / → while the rail has focus) opens that stage's Done / Still-to-do panel.
 *
 * Client component because the selected stage is local UI state — every stage's
 * content arrives pre-derived from the server (lib/progress-stages), so no
 * fetches happen here. Completed items carry the "Set na 'yan ✓" chip; the
 * per-stage AI note renders only when the viewer's Setnayan AI is active.
 */
export function JourneyRail({
  stages,
  currentKey,
  aiActive,
}: {
  stages: ProgressStage[];
  currentKey: ProgressStageKey;
  aiActive: boolean;
}) {
  const currentIdx = Math.max(
    0,
    stages.findIndex((s) => s.key === currentKey),
  );
  const [activeIdx, setActiveIdx] = useState(currentIdx);
  const active = stages[activeIdx];

  const step = (delta: number) => {
    setActiveIdx((i) => (i + delta + stages.length) % stages.length);
  };

  // Defensive — stages always carries the six canonical entries, but an empty
  // array must not crash the client render.
  if (!active) return null;

  return (
    <div className="space-y-3">
      {/*
          ── TREATMENT B · ONE RAIL, SIX STOPS (owner-picked 2026-09-23) ───────
          Replaces six 46px nodes that each carried their own "% complete". His
          reason, relayed: A repeats the same number twice, C hides how far along
          they are overall. B shows the whole journey and states ONE number.

          The number lives on the CURRENT stop and nowhere else — by construction
          here, and asserted by mounting the component and counting what renders,
          because the previous duplicate lived in two different expressions and a
          source grep could not tell them apart.

          The head's position is `railHeadPercent` in lib/stage-mark.ts, a stated
          rule rather than a value lifted from a mock: (index + pct/100) / gaps.

          ⚠ A STOP'S DOT REFLECTS THAT STAGE'S OWN COMPLETION, NOT ITS POSITION
          RELATIVE TO THE CURRENT ONE. The approved mock drew every earlier stop
          as "done", including one sitting at 8% — that would tell a couple a
          phase was finished when it is not, which is the same class of defect
          this rail has just been cleaned of. Behind-ness is conveyed by the
          fill reaching past the stop; completion is conveyed by the dot.
      */}
      <div
        role="tablist"
        aria-label="Planning stages"
        className="pt-4"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            step(1);
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            step(-1);
          }
        }}
      >
        {/* the one rail */}
        <div
          className="relative mx-1 h-1.5 rounded-full"
          style={{ background: 'rgba(30,26,18,.10)' }}
        >
          <div
            data-railfill
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${railHeadPercent(currentIdx, stages[currentIdx]?.pct ?? 0, stages.length)}%`,
              background: 'var(--sn-gold-500)',
            }}
          />
          <span
            data-railhead
            aria-hidden
            className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-[3px] bg-white"
            style={{
              left: `${railHeadPercent(currentIdx, stages[currentIdx]?.pct ?? 0, stages.length)}%`,
              marginLeft: -7,
              borderColor: 'var(--sn-gold-600)',
            }}
          />
        </div>

        {/* six stops */}
        <div className="mt-2.5 flex items-start justify-between gap-1">
          {stages.map((s, i) => {
            const selected = i === activeIdx;
            const isCurrent = s.key === currentKey;
            const mark = stageMarkFor(s.pct);
            const dotPx = isCurrent ? RAIL_STOP_PX.current : RAIL_STOP_PX[mark.kind];
            const gold = mark.kind === 'not-started' ? null : 'var(--sn-gold-500)';
            return (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-label={`${s.label}, ${s.pct}% complete`}
                onClick={() => setActiveIdx(i)}
                className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta"
              >
                <span
                  data-stagemark={mark.kind}
                  data-markpx={dotPx}
                  aria-hidden
                  className={`block rounded-full ${mark.kind === 'not-started' ? 'border-2' : ''}`}
                  style={{
                    width: dotPx,
                    height: dotPx,
                    ...(gold
                      ? { background: gold }
                      : { borderColor: 'rgba(30,26,18,.22)' }),
                    ...(isCurrent
                      ? { boxShadow: '0 0 0 3px rgba(169,131,75,.22)' }
                      : {}),
                  }}
                />
                <span
                  className={`block truncate text-[11.5px] leading-tight ${
                    isCurrent ? 'font-bold text-ink' : 'font-medium text-ink/55'
                  }`}
                >
                  {s.label}
                </span>
                {/* 🔑 THE ONE NUMBER. Only the current stop states a figure — the
                    whole point of this treatment. A second one anywhere is the
                    defect that was just removed, so the guard counts renders. */}
                {/*
                    `aria-hidden` because the BUTTON already carries the figure in
                    its aria-label, for every stop — a screen reader gets all six
                    numbers (it cannot see the bar), while the screen shows one.
                    Without this the current stop announces its percentage twice,
                    which is the duplicate this treatment exists to remove wearing
                    an accessibility costume.
                */}
                {isCurrent ? (
                  <span
                    aria-hidden
                    className="block font-mono text-[11px] font-bold text-gold-800"
                  >
                    {s.pct}% complete
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel" className="sn-tile">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/*
              🔑 THE NUMBER HAS ONE HOME, AND IT IS THE RAIL. This heading used to
              repeat `{active.pct}% complete` while the rail above already printed
              that same stage's figure in its own tab — six stages producing SEVEN
              labels, and the duplicated one was the stage the eye is on. Neither
              was conditional, so they were always both on screen. A screen that
              states one fact in two places is a screen that can start disagreeing
              with itself; the rail keeps the number because that is where all six
              are comparable, and the panel keeps the name.
          */}
          <h3 className="text-xl font-extrabold tracking-[-0.015em] text-ink">
            {active.label}
          </h3>
          <div className="flex gap-1.5">
            <button
              type="button"
              aria-label="Previous stage"
              onClick={() => step(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-ink/15 text-ink/60 transition-colors hover:border-warn-500 hover:text-warn-600"
            >
              ←
            </button>
            <button
              type="button"
              aria-label="Next stage"
              onClick={() => step(1)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-ink/15 text-ink/60 transition-colors hover:border-warn-500 hover:text-warn-600"
            >
              →
            </button>
          </div>
        </div>

        <div className="mt-3.5 grid gap-x-7 gap-y-2 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.12em] text-success-600 dark:text-success-300">
              Done
            </div>
            {active.done.length > 0 ? (
              active.done.map((item) => (
                <div
                  key={item.label}
                  className="flex items-start gap-2.5 border-t border-ink/5 py-2 text-[13.5px] text-ink/70"
                >
                  <span className="mt-0.5 flex h-[17px] w-[17px] flex-none items-center justify-center rounded-full bg-success-100 text-[10.5px] text-success-700 dark:bg-success-900/40 dark:text-success-300">
                    ✓
                  </span>
                  <span className="min-w-0">
                    <b className="font-medium text-ink">{item.label}</b>
                    {item.detail ? <span> — {item.detail}</span> : null}
                  </span>
                  <span className="ml-auto whitespace-nowrap pl-2 text-[10.5px] font-semibold text-success-600 dark:text-success-300">
                    Set na &rsquo;yan ✓
                  </span>
                </div>
              ))
            ) : (
              <div className="border-t border-ink/5 py-2 text-[13.5px] text-ink/50">
                Nothing yet — this stage is ahead of you.
              </div>
            )}
          </div>
          <div>
            <div className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.12em] text-warn-600 dark:text-warn-300">
              Still to do
            </div>
            {active.todo.length > 0 ? (
              active.todo.map((item) => (
                <div
                  key={item.label}
                  className="flex items-start gap-2.5 border-t border-ink/5 py-2 text-[13.5px] text-ink/70"
                >
                  <span className="mt-0.5 flex h-[17px] w-[17px] flex-none items-center justify-center rounded-full bg-warn-100 text-[10.5px] text-warn-700 dark:bg-warn-900/40 dark:text-warn-300">
                    •
                  </span>
                  <span className="min-w-0">
                    <b className="font-medium text-ink">{item.label}</b>
                    {item.detail ? <span> — {item.detail}</span> : null}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex items-start gap-2.5 border-t border-ink/5 py-2 text-[13.5px] text-ink/50">
                <span className="mt-0.5 flex h-[17px] w-[17px] flex-none items-center justify-center rounded-full bg-success-100 text-[10.5px] text-success-700 dark:bg-success-900/40 dark:text-success-300">
                  ✓
                </span>
                All done here.
              </div>
            )}
          </div>
        </div>

        {aiActive && active.aiNote ? (
          <div
            className="mt-4 flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-[13.5px] text-ink"
            style={{ background: 'var(--sn-gold-100)', border: '1px solid var(--sn-gold-300)' }}
          >
            <span aria-hidden className="mt-0.5 flex-none" style={{ color: 'var(--sn-gold-600)' }}>
              ✦
            </span>
            <span>{active.aiNote}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

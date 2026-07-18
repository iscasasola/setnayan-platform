'use client';

import { useState } from 'react';
import { ProgressRing } from '@/app/_components/progress-ring';
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
      <div
        role="tablist"
        aria-label="Planning stages"
        className="-mx-1 flex overflow-x-auto px-1 pb-1 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
        {stages.map((s, i) => {
          const selected = i === activeIdx;
          const reached = s.pct > 0;
          const isCurrent = s.key === currentKey;
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveIdx(i)}
              className="relative min-w-[96px] flex-1 px-1 pb-2 text-center focus-visible:outline-none"
            >
              {/* Connector line between dots. */}
              {i > 0 ? (
                <span
                  aria-hidden
                  className="absolute left-[-50%] top-[23px] h-0.5 w-full"
                  style={{ background: reached ? 'rgba(169,131,75,.4)' : 'rgba(30,26,18,.1)' }}
                />
              ) : null}
              {isCurrent ? (
                <span
                  className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[9.5px] font-bold uppercase tracking-[0.12em]"
                  style={{ color: 'var(--sn-gold-700)' }}
                >
                  You are here
                </span>
              ) : null}
              <span
                className={`relative z-[2] mx-auto flex h-[46px] w-[46px] items-center justify-center rounded-full border-2 bg-white/70 transition-transform ${
                  selected ? 'scale-110' : ''
                }`}
                style={{
                  borderColor: selected || isCurrent ? 'var(--sn-gold-500)' : 'rgba(30,26,18,.15)',
                  // "You are here" gold ripple — the ONE sanctioned pulse on
                  // this rail (rollout plan § 3.1: current stage only). The
                  // global reduced-motion freeze snaps it to a single instant
                  // run; sn-ring is box-shadow-only so the node never scales.
                  ...(isCurrent ? { animation: 'sn-ring 2.6s infinite' } : {}),
                }}
              >
                {s.pct >= 100 ? (
                  <span className="text-sm font-bold" style={{ color: 'var(--sn-success)' }}>
                    ✓
                  </span>
                ) : (
                  <ProgressRing pct={s.pct} size={34} stroke={4} color="var(--sn-gold-500)" />
                )}
              </span>
              <span className="mt-2 block text-[13px] font-semibold text-ink">
                {s.label}
              </span>
              <span className="block font-mono text-[11px] text-ink/45">
                {s.pct}% complete
              </span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="sn-tile">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-extrabold tracking-[-0.015em] text-ink">
            {active.label}
            <span className="ml-2.5 font-mono text-xs font-medium text-ink/45">
              {active.pct}% complete
            </span>
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

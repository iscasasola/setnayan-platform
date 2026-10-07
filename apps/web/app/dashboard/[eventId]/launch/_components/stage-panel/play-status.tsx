'use client';

import { createPortal } from 'react-dom';

/**
 * ▶ WHAT IS PLAYING — Build in · Action · Build out, the one now in bold, and any phase the picked part has none
 * of named ("Build out: none"), so a blank never reads as a fault (owner 2026-10-07: "i cannot see the build out
 * and action"). Drawn over the page while it plays (`stage-tools.tsx`); loaded the first time ▶ is pressed.
 */
export function StagePlayStatus({ phase, skipped }: { phase: string; skipped: readonly string[] }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      data-stage-play-status={phase}
      role="status"
      className="pointer-events-none fixed inset-x-4 z-[95] mx-auto max-w-[360px] rounded-xl bg-[rgba(44,42,41,.88)] px-3 py-2 text-center text-[12px] leading-snug text-white lg:hidden"
      style={{ bottom: 'calc(var(--maker-lt-h, 62px) + 12px)' }}
    >
      <span className="block">
        {(
          [
            ['in', 'Build in'],
            ['act', 'Action'],
            ['out', 'Build out'],
          ] as const
        ).map(([k, w], i) => (
          <span key={k} className={phase === k ? 'font-bold text-white' : 'text-white/60'}>
            {i ? ' · ' : ''}
            {w}
          </span>
        ))}
      </span>
      {skipped.map((x) => (
        <span key={x} className="block text-white/75" data-stage-play-skipped="">
          {x}
        </span>
      ))}
    </div>,
    document.body,
  );
}

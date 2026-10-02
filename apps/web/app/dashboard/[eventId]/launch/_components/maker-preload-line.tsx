'use client';

import { useEffect, useState } from 'react';
import { appPreloader, preloadFraction, type PreloadProgress } from '@/lib/app-preload';
import { MAKER_TOOLS } from './maker-tools';

/**
 * ➖ THE MAKER'S TOOLS, DOWNLOADING — A THIN LINE UNDER THE TOP BAR.
 *
 * Owner, 2026-10-02 (DECISION_LOG "THE MAKER'S TOOL PRELOAD SHOWS AS A THIN
 * LINE UNDER THE TOP BAR"): *"can we show the download progress?"* → *"yes"*.
 * While the Maker preloads its tools (`maker-tools.tsx`), a hairline along the
 * foot of its top bar fills 0 → 100% and fades out once EVERY tool is ready.
 * No words, no percentage, nothing to tap (`pointer-events-none`,
 * `aria-hidden`), never in the way. Not drawn at all when the preload is
 * skipped (Save-Data), and a preload that ends short (a tool failed) fades out
 * without filling — the line never claims a tool it does not have. With reduced
 * motion it simply appears and disappears.
 */

/** Hand every Maker tool to the one queue, first in line; return its progress (null = nothing to show). */
export function useMakerPreload(enabled: boolean): PreloadProgress | null {
  const [progress, setProgress] = useState<PreloadProgress | null>(null);
  useEffect(() => {
    if (!enabled) return;
    return appPreloader().preload(MAKER_TOOLS, { first: true, onProgress: setProgress });
  }, [enabled]);
  return progress;
}

export function MakerPreloadLine({ progress }: { progress: PreloadProgress | null }) {
  const [gone, setGone] = useState(false);
  /* Already complete on arrival (the host's other pages preloaded the tools):
     nothing is downloading, so no line at all. */
  const [sawLoading, setSawLoading] = useState(false);
  const finished = progress?.finished ?? false;
  useEffect(() => {
    if (progress && !progress.finished) setSawLoading(true);
  }, [progress]);
  useEffect(() => {
    if (!finished) return;
    // Let the last stretch fill (and fade) before the line leaves the page.
    const t = window.setTimeout(() => setGone(true), 900);
    return () => window.clearTimeout(t);
  }, [finished]);
  if (!progress || gone || (finished && !sawLoading)) return null;
  const f = preloadFraction(progress);
  return (
    <div
      aria-hidden
      data-maker-preload={finished ? (f === 1 ? 'done' : 'short') : 'loading'}
      data-maker-preload-fraction={f.toFixed(3)}
      className={`pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden transition-opacity delay-300 duration-500 motion-reduce:transition-none ${finished ? 'opacity-0' : 'opacity-100'}`}
    >
      <div
        className="h-full w-full origin-left bg-ink/35 transition-transform duration-300 ease-out motion-reduce:transition-none"
        style={{ transform: `scaleX(${f})` }}
      />
    </div>
  );
}

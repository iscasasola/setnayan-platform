'use client';

import { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { deriveDayOfClock, formatDuration } from '@/lib/vendor-dayof-countdown';
import type { RunOfShowBlock } from '@/lib/run-of-show';

/**
 * The launched console's live clock — phone-first, glare-legible. Ticks every
 * 30s off the couple's run-of-show (honest: labelled as the couple's program,
 * degrading to a T-band elapsed when there's no timeline; never a fabricated
 * vendor service countdown). Requests a Screen Wake Lock so the floor phone
 * doesn't sleep during the event, releasing it on unmount / tab-hide.
 */
export function FloorClock({ blocks }: { blocks: RunOfShowBlock[] }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Screen Wake Lock — best-effort; unsupported browsers just no-op.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let released = false;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinel> };
    };
    async function acquire() {
      try {
        if (nav.wakeLock && document.visibilityState === 'visible') {
          lock = await nav.wakeLock.request('screen');
        }
      } catch {
        /* wake lock denied — non-fatal */
      }
    }
    void acquire();
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !released) void acquire();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => {});
    };
  }, []);

  const clock = deriveDayOfClock(blocks, new Date());

  return (
    <div className="flex items-center gap-3">
      <CalendarClock aria-hidden className="h-6 w-6 shrink-0" style={{ color: 'var(--m-gold, #d9b45b)' }} strokeWidth={1.5} />
      <div className="min-w-0">
        {clock.mode === 'program' ? (
          clock.allDone ? (
            <p className="text-base font-semibold" style={{ color: 'var(--m-paper)' }}>
              The program has wrapped
            </p>
          ) : clock.minutesToNext != null && clock.nextLabel ? (
            <>
              <p className="font-mono text-xl font-bold" style={{ color: 'var(--m-paper)' }}>
                {clock.minutesToNext <= 0 ? 'Now' : `in ${formatDuration(clock.minutesToNext)}`}
                <span className="ml-2 text-sm font-medium" style={{ color: 'rgba(251,251,250,0.7)' }}>
                  {clock.nextLabel}
                </span>
              </p>
              {clock.hoursLeftInProgram != null ? (
                <p className="mt-0.5 text-xs" style={{ color: 'rgba(251,251,250,0.55)' }}>
                  ~{clock.hoursLeftInProgram}h left in the couple’s program
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-base font-semibold" style={{ color: 'var(--m-paper)' }}>
              {clock.hoursLeftInProgram != null
                ? `~${clock.hoursLeftInProgram}h left in the couple’s program`
                : 'Following the couple’s program'}
            </p>
          )
        ) : (
          <p className="text-base font-semibold" style={{ color: 'var(--m-paper)' }}>
            Event day · running for {formatDuration(clock.minutesElapsed)}
          </p>
        )}
      </div>
    </div>
  );
}

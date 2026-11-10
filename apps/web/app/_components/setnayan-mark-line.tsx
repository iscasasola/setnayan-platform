import type { CSSProperties } from 'react';
import { SETNAYAN_QUIET_WORDS, SETNAYAN_WATERMARK_WORDS, type SetnayanMark } from '@/lib/setnayan-mark-by-plan';

/**
 * 🏷 THE ONE SETNAYAN LINE ON A COUPLE'S PAGE — by the event's plan (DECISION_LOG 2026-11-04; Build 6 Lane L;
 * the plan is read by `eventSetnayanMark`, lib/setnayan-mark-by-plan.server.ts):
 *   · `watermark` (Free)  — "Powered by Setnayan · setnayan.com", exactly as every footer printed it;
 *   · `quiet` (Event Plus) — ONE small "Made with Setnayan": the same size, fainter, no address;
 *   · `none` (Event Pro)   — nothing at all.
 * Every footer of the Event Hub, its seat / find-my-table / recap pages and the kit's closing band draws its line HERE,
 * so no page can print the watermark on an event whose plan took it off (`lib/setnayan-mark-by-plan.test.ts`).
 *
 * Server-safe (no hooks): the server pages and the client shell both render it.
 */
export function SetnayanMarkLine({ mark, className, style }: { mark: SetnayanMark; className?: string; style?: CSSProperties }) {
  if (mark === 'none') return null;
  if (mark === 'quiet') {
    return (
      <p className={className} style={{ ...style, opacity: 0.6, letterSpacing: '0.04em' }} data-setnayan-mark="quiet">
        {SETNAYAN_QUIET_WORDS}
      </p>
    );
  }
  return (
    <p className={className} style={style} data-setnayan-mark="watermark">
      {SETNAYAN_WATERMARK_WORDS}
    </p>
  );
}

/** The mark from the old boolean, for a caller that has not been handed the plan's mark. */
export function markOrLegacy(mark: SetnayanMark | null | undefined, hideWatermark: boolean): SetnayanMark {
  return mark ?? (hideWatermark ? 'none' : 'watermark');
}

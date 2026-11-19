'use client';

import type { CSSProperties } from 'react';
import { usePrefersReducedMotion } from '@/lib/use-responsive';

/**
 * ⭕ UPLOAD — THE ONE RING (MOTION_STANDARD_2026-11-18 § 4 #25; drawing `motion_standard_2026-11-18_fable.html` Part H
 * "Upload"; owner 18 Nov "Add all 10").
 *
 * "A ring fills as the file goes up, then turns into ✓." The ring FOLLOWS the real progress — it has no curve and no
 * speed of its own (two half rings turned by `rotate`); when the upload is done, ✓ pops in Quick on Spring
 * (`.sn-m-done`). "It never sits at 0% looking dead": at 0 the track still shows, and a caller that has no number yet
 * passes `pct={null}` and gets the track alone — never a fake figure.
 *
 * Reduced motion: the ring fills in quarter steps; ✓ appears at once.
 * The look is `.sn-m-upring*` in globals.css. 🔒 lib/the-moments-move-by-the-standard.test.ts
 */

/** The two half rings' turns for a progress: the right half fills 0 → 50 %, then the left 50 → 100 %. */
export function uploadRingTurns(pct: number | null, stepped = false): { a: number; b: number } {
  let p = pct == null || !Number.isFinite(pct) ? 0 : Math.max(0, Math.min(100, pct));
  if (stepped) p = Math.floor(p / 25) * 25;
  return { a: (Math.min(p, 50) / 50) * 180, b: (Math.max(p - 50, 0) / 50) * 180 };
}

export function UploadRing({
  pct,
  done = false,
  size = 36,
  stroke = 4,
  showPct = false,
  className,
  label,
}: {
  /** 0–100, the upload's real progress. `null` = not known yet: the track alone. */
  pct: number | null;
  /** The file is up: ✓. */
  done?: boolean;
  /** Outer diameter, px. */
  size?: number;
  stroke?: number;
  /** Draw the figure inside the ring while it fills. */
  showPct?: boolean;
  className?: string;
  /** Read out for a screen reader ("Uploading Venue contract.pdf"). */
  label?: string;
}) {
  const stepped = usePrefersReducedMotion();
  const { a, b } = uploadRingTurns(done ? 100 : pct, stepped);
  const shown = pct == null ? null : Math.round(Math.max(0, Math.min(100, pct)));
  return (
    <span
      className={`sn-m-upring${className ? ` ${className}` : ''}`}
      role="progressbar"
      aria-label={label ?? 'Uploading'}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={done ? 100 : (shown ?? undefined)}
      data-upload-ring={done ? 'done' : shown == null ? 'waiting' : shown}
      style={{ '--ur': `${size}px`, '--ur-w': `${stroke}px`, '--ur-a': `${a}deg`, '--ur-b': `${b}deg` } as CSSProperties}
    >
      <span className="sn-m-upring-half" data-half="r">
        <i />
      </span>
      <span className="sn-m-upring-half" data-half="l">
        <i />
      </span>
      {done ? (
        <span className="sn-m-upring-done sn-m-done" aria-hidden style={{ fontSize: Math.round(size * 0.45) }}>
          ✓
        </span>
      ) : showPct && shown != null ? (
        <span className="sn-m-upring-label" aria-hidden>
          {shown}%
        </span>
      ) : null}
    </span>
  );
}

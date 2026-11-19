'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { playsOnce, type CelebrateMoment, type MomentScope } from '@/lib/moment-once';

/**
 * 🎉 CELEBRATE — THE ONE GOLD BURST (MOTION_STANDARD_2026-11-18 § 4 #23; drawing
 * `motion_standard_2026-11-18_fable.html` Part H "Celebrate"; owner 18 Nov "Add all 10", 19 Nov "animations build the
 * rest").
 *
 * About 12 foil pieces fly out of the middle and fade over ~900 ms on Settle while the badge pops in Quick on Spring.
 * ONCE: `playsOnce(moment, onceKey)` — never twice in a visit (or, with `scope="ever"`, never twice on this device).
 * The second time the badge simply stands there, still. Reduced motion: a still gold ring, no pieces.
 *
 * USED FOR payment received and a badge earned (and the end of a tour). 🚫 NOT a booking — "booking confirmed" is the
 * signature moment The Tie; `CelebrateMoment` has no `booking`, and 🔒 lib/the-moments-move-by-the-standard.test.ts
 * keeps it that way.
 *
 * The motion is CSS only (`.sn-m-cele*` in globals.css): transform + opacity, tokens only, pieces rest at opacity 0.
 * `children` is what stands in the middle (a badge's art, a ✓); with none, the gold ✓ disc of the drawing.
 */

/** The drawing's twelve pieces — where each lands (px from the middle) and how far it turns. Fixed, never random, so
 *  a re-render never reshuffles them. Every third is the small round one. */
export const CELEBRATE_PIECES: ReadonlyArray<{ bx: number; by: number; br: number; alt?: true }> = [
  { bx: 57, by: 9, br: -120 },
  { bx: 52, by: 37, br: -73 },
  { bx: 26, by: 62, br: -26, alt: true },
  { bx: -12, by: 45, br: 21 },
  { bx: -46, by: 42, br: 68 },
  { bx: -78, by: 21, br: 115, alt: true },
  { bx: -57, by: -9, br: 162 },
  { bx: -52, by: -37, br: 209 },
  { bx: -26, by: -62, br: -104, alt: true },
  { bx: 12, by: -45, br: -57 },
  { bx: 46, by: -42, br: -10 },
  { bx: 78, by: -21, br: 37, alt: true },
];

export function Celebrate({
  moment,
  onceKey,
  scope = 'visit',
  children,
  className,
  label,
}: {
  /** What is being celebrated. A booking is not in the list: it has The Tie. */
  moment: CelebrateMoment;
  /** What makes this one moment — an order reference, a badge id. The burst plays once per (moment, key). */
  onceKey: string;
  scope?: MomentScope;
  /** What stands in the middle. Default: the drawing's gold ✓ disc. */
  children?: ReactNode;
  className?: string;
  /** Read out once when it plays ("Payment received"). */
  label?: string;
}) {
  // Decided after mount: the server (and the first client drawing) never bursts, so hydration agrees and a page that
  // is only being read back from the cache stays still.
  const [burst, setBurst] = useState(false);
  useEffect(() => {
    if (playsOnce(moment, onceKey, scope)) setBurst(true);
  }, [moment, onceKey, scope]);

  return (
    <span className={`sn-m-cele${className ? ` ${className}` : ''}`} data-celebrate={moment} data-celebrate-played={burst ? '' : undefined}>
      {burst ? (
        <span className="sn-m-cele-burst" aria-hidden>
          {CELEBRATE_PIECES.map((p, n) => (
            <i
              key={n}
              className="sn-m-cele-piece"
              data-alt={p.alt ? '' : undefined}
              style={{ '--bx': `${p.bx}px`, '--by': `${p.by}px`, '--br': `${p.br}deg` } as CSSProperties}
            />
          ))}
          <i className="sn-m-cele-ring" />
        </span>
      ) : null}
      <span className={`sn-m-cele-mid${burst ? ' sn-m-cele-pop' : ''}`}>
        {children ?? (
          <span className="sn-m-cele-badge" aria-hidden>
            ✓
          </span>
        )}
      </span>
      {burst && label ? (
        <span className="sr-only" role="status">
          {label}
        </span>
      ) : null}
    </span>
  );
}

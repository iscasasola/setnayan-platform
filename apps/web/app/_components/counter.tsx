'use client';

import { useEffect, useRef } from 'react';
import { Minus, Plus } from 'lucide-react';

/**
 * COUNTER — a small number, one up or one down (`INTERACTION_RULES.md` § 9, kind 17 "Counter and slider"; the approved
 * gallery `prototypes/control_templates_2026-10-08.html` § 17, whose demo row is "Seats at this table"; drawn in place in
 * `prototypes/maker_prints_seat_counter_2026-10-13.html`, owner "approved" 2026-10-13). Its sibling, the slider, is
 * `slider.tsx`.
 *
 *   · ONE white pill, 44 px high, a hairline round it: − · the number · +;
 *   · each sign is a 44 px round target in the app's accent (`text-sn-accent`), and GREY when it cannot be pressed —
 *     the caller says when (the seat plan: − when every chair left is taken, + when every chair is out). A grey sign is
 *     a real `disabled` button with a name that says why ("Every chair left is taken");
 *   · the number TICKS on a change (out up, in from below — the gallery's `tick`, a share of the family's one speed);
 *     still under "reduce motion";
 *   · figures of one width (`tabular-nums`), so the pill never changes size as it counts.
 *
 * The press (the dip and the pulse) is the house's `sn-press`. No colour is written here but the accent and the ink;
 * no request. The number it shows is the caller's — a counter never keeps a value of its own.
 * Guard: `lib/the-counter-is-one-drawing.test.ts`.
 */

/** The tick: out upward, in from below. ~0.27 s (the gallery's 90 ms × the family's 3.04). */
const TICK_MS = 270;

export function Counter({
  value,
  onLess,
  onMore,
  lessDisabled = false,
  moreDisabled = false,
  lessLabel = 'One less',
  moreLabel = 'One more',
  label,
  data,
}: {
  value: number;
  onLess: () => void;
  onMore: () => void;
  lessDisabled?: boolean;
  moreDisabled?: boolean;
  /** The − button's name — say WHY when it is grey. */
  lessLabel?: string;
  /** The + button's name — say WHY when it is grey. */
  moreLabel?: string;
  /** What the number counts, for a screen reader ("Seats at this table"). */
  label: string;
  /** `data-counter="<data>"`. */
  data?: string;
}) {
  const num = useRef<HTMLElement>(null);
  const was = useRef(value);
  useEffect(() => {
    if (was.current === value) return;
    was.current = value;
    const el = num.current;
    if (!el?.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.animate(
      [
        { transform: 'translateY(0)', opacity: 1 },
        { transform: 'translateY(-6px)', opacity: 0, offset: 0.4 },
        { transform: 'translateY(6px)', opacity: 0, offset: 0.41 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: TICK_MS, easing: 'cubic-bezier(.2,.8,.2,1)' },
    );
  }, [value]);
  const sign =
    'sn-press inline-flex h-11 min-h-11 w-11 flex-none items-center justify-center rounded-full text-sn-accent disabled:cursor-not-allowed disabled:text-ink/20';
  return (
    <span role="group" aria-label={label} data-counter={data ?? ''} className="inline-flex h-11 flex-none items-center rounded-full border border-ink/15 bg-white dark:bg-cream">
      <button type="button" data-counter-less="" aria-label={lessLabel} disabled={lessDisabled} onClick={onLess} className={sign}>
        <Minus aria-hidden className="h-5 w-5" strokeWidth={2.2} />
      </button>
      <b ref={num} data-counter-value={value} aria-live="polite" className="inline-block min-w-[34px] text-center text-[16px] font-semibold tabular-nums text-ink">
        {value}
      </b>
      <button type="button" data-counter-more="" aria-label={moreLabel} disabled={moreDisabled} onClick={onMore} className={sign}>
        <Plus aria-hidden className="h-5 w-5" strokeWidth={2.2} />
      </button>
    </span>
  );
}

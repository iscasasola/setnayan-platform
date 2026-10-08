'use client';

import type { ReactNode } from 'react';
import { PILL_ON_CLASS } from './pill-selector';

/**
 * CHIPS — choose SEVERAL from a few (`INTERACTION_RULES.md` § 9, kind 11 "Ticks, chips, badges"; approved gallery
 * `prototypes/control_templates_2026-10-08.html` § 11).
 *
 * Owner, 2026-10-08: *"consistent size? or adaptive?"* → one height, a minimum width, the width follows the word, and
 * a chip NEVER changes size when chosen · *"we want the whole app to be adaptive to the same feel"*.
 *
 *   · ONE LOOK, TWO STATES: chosen = the app's accent with the ink that reads on it (the pill selector's own "on",
 *     `PILL_ON_CLASS`); not chosen = grey words on white with a hairline. No third colour, no icon that comes and
 *     goes — so a chip is exactly as wide chosen as not.
 *   · 40 px tall, never narrower than 84 px, the word on one line; the finger's target is 44 px (the chip's own
 *     height plus 2 px above and below).
 *   · each chip is a toggle button (`aria-pressed`) in a named group — several may be on at once. ONE of several is
 *     a Dropdown, two named things a Pill selector, on / off a Switch: never chips.
 *   · the press is the family's (`sn-press`); the fill changes at the control speed, still under "reduce motion".
 *
 * Neutral: it knows no screen and keeps no state — the screen says what is chosen and hears a toggle. No accent
 * colour is written here (`lib/the-accent-is-one-token.test.ts`).
 */

/** One chip's shape — the same chosen or not. */
export const CHIP_CLASS =
  "sn-press relative inline-flex h-10 min-h-10 min-w-[84px] flex-none items-center justify-center whitespace-nowrap rounded-full border px-[18px] text-[14px] font-semibold transition-colors duration-sn-control ease-sn after:absolute after:inset-x-0 after:-inset-y-0.5 after:content-[''] motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-40";
/** Chosen: the accent, and the ink that reads on it. */
export const CHIP_ON_CLASS = `border-sn-accent ${PILL_ON_CLASS}`;
/** Not chosen: grey words on white. */
export const CHIP_OFF_CLASS = 'border-ink/15 bg-white text-ink/55';

export function chipClass(on: boolean): string {
  return `${CHIP_CLASS} ${on ? CHIP_ON_CLASS : CHIP_OFF_CLASS}`;
}

export type ChipOption<K extends string> = {
  key: K;
  /** One or two words. */
  label: ReactNode;
  /** The chip's name for a screen reader, when the label is not its words. */
  ariaLabel?: string;
  disabled?: boolean;
  /** `data-testid` on the chip. */
  testId?: string;
};

export function Chips<K extends string>({
  label,
  options,
  value,
  onToggle,
  data,
  className = '',
}: {
  /** The group's name, for a screen reader ("RSVP asks"). */
  label: string;
  options: readonly ChipOption<K>[];
  /** The chips chosen now. */
  value: readonly K[];
  /** A chip was pressed: its key, and whether it is chosen now. */
  onToggle: (key: K, next: boolean) => void;
  /** `data-chips="<data>"`. */
  data?: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} data-chips={data ?? ''} className={`flex flex-wrap gap-2 ${className}`}>
      {options.map((o) => {
        const on = value.includes(o.key);
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={on}
            aria-label={o.ariaLabel}
            disabled={o.disabled}
            data-chip={o.key}
            data-testid={o.testId}
            onClick={() => onToggle(o.key, !on)}
            className={chipClass(on)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

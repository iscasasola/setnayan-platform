'use client';

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { CHIP_PHONE_ROW_PX, chipColumns, chipWidthFor, guessLabelPx } from '@/lib/chips-grid';
import { tellTheForm } from '@/lib/tell-the-form';
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
 *   · AN EVEN GRID (owner 2026-10-08, on six chips that hugged their words into a ragged edge: *"make RSVP ask
 *     buttons even"*): every chip of a set is the SAME width and the same height, the columns fill the row edge to
 *     edge with equal gaps. All on one line where the row is wide enough for that; otherwise three across where
 *     three of the widest fit (a computer), else what a 375-px phone gets — two when the longest word does not fit
 *     three across (`lib/chips-grid.ts`). A word is never shrunk, cut or wrapped. A set that must hug its words asks for it (`even={false}`); even is the default.
 *   · 40 px tall, never narrower than 84 px, the word on one line; the finger's target is 44 px (the chip's own
 *     height plus 2 px above and below).
 *   · each chip is a toggle button (`aria-pressed`) in a named group — several may be on at once. ONE of several is
 *     a Dropdown, two named things a Pill selector, on / off a Switch: never chips.
 *   · the press is the family's (`sn-press`); the fill changes at the control speed, still under "reduce motion".
 *
 * Neutral: it knows no screen and keeps no state about WHAT is chosen — the screen says so and hears a toggle (the
 * only thing it remembers is what it measured: its widest word and its row). No accent colour is written here
 * (`lib/the-accent-is-one-token.test.ts`).
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
  even = true,
  data,
  className = '',
  fieldName,
}: {
  /**
   * Inside a `<form>`: the name each chip POSTS under — one visually-hidden checkbox per chip, present (`on`) when the chip is
   * chosen and ABSENT when not (several may post: multi-valued). A tap tells the form (`tellTheForm`); an Undo's `click()` on a
   * checkbox drives its chip. Absent = posts nothing. (See `lib/tell-the-form.ts`.)
   */
  fieldName?: (key: K) => string;
  /** The even grid (default). False: each chip hugs its word and the set wraps — only for a set that asks. */
  even?: boolean;
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
  const group = useRef<HTMLDivElement>(null);
  /* 📮 Only a PERSON's tap tells the form: the tap names the chip, the next commit tells the form about it and spends the flag. */
  const boxes = useRef(new Map<K, HTMLInputElement>());
  const tapped = useRef<K | null>(null);
  const chosen = value.join('\u0001');
  useEffect(() => {
    if (tapped.current === null) return;
    const box = boxes.current.get(tapped.current);
    tapped.current = null;
    tellTheForm(box);
  }, [chosen]);
  /* What the browser measured: the widest word's chip, and the row. Until then (the server's render, the first
     paint) the words are guessed from their letters and the row is a phone's — the same answer on both sides. */
  const [measured, setMeasured] = useState<{ widest: number; row: number } | null>(null);
  const words = options.map((o) => (typeof o.label === 'string' ? o.label : '')).join('\u0001');
  useLayoutEffect(() => {
    const el = group.current;
    if (!even || !el) return;
    const measure = () => {
      let label = 0;
      el.querySelectorAll<HTMLElement>('[data-chip-label]').forEach((w) => {
        label = Math.max(label, w.getBoundingClientRect().width);
      });
      const next = { widest: chipWidthFor(label), row: el.clientWidth };
      if (!(next.row > 0)) return;
      setMeasured((was) => (was && was.widest === next.widest && was.row === next.row ? was : next));
    };
    measure();
    /* The row changes width (a turned phone, a resized window), and the words change width when their font lands. */
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    watch?.observe(el);
    void document.fonts?.ready.then(measure);
    return () => watch?.disconnect();
  }, [even, words]);
  const widest = measured?.widest ?? chipWidthFor(Math.max(0, ...options.map((o) => (typeof o.label === 'string' ? guessLabelPx(o.label) : 0))));
  const columns = even ? chipColumns({ count: options.length, widest, row: measured?.row ?? CHIP_PHONE_ROW_PX }) : null;
  return (
    <div
      ref={group}
      role="group"
      aria-label={label}
      data-chips={data ?? ''}
      data-chips-columns={columns ?? undefined}
      style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
      className={`${columns ? 'grid' : 'flex flex-wrap'} gap-2 ${className}`}
    >
      {options.map((o) => {
        const on = value.includes(o.key);
        return (
          <Fragment key={o.key}>
          <button
            type="button"
            aria-pressed={on}
            aria-label={o.ariaLabel}
            disabled={o.disabled}
            data-chip={o.key}
            data-testid={o.testId}
            onClickCapture={() => {
              tapped.current = fieldName ? o.key : null;
            }}
            onClick={() => onToggle(o.key, !on)}
            /* In the grid a chip is its column's width — the same as every other chip of the set. */
            className={`${chipClass(on)}${columns ? ' w-full' : ''}`}
          >
            <span data-chip-label="" className="whitespace-nowrap">
              {o.label}
            </span>
          </button>
          {fieldName ? (
            <input
              ref={(el) => {
                if (el) boxes.current.set(o.key, el);
                else boxes.current.delete(o.key);
              }}
              type="checkbox"
              name={fieldName(o.key)}
              checked={on}
              disabled={o.disabled}
              onChange={() => onToggle(o.key, !on)}
              tabIndex={-1}
              aria-hidden
              className="sr-only"
              data-chip-post={o.key}
            />
          ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}

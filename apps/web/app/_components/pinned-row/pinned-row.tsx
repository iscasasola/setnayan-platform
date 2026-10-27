'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { PickMenu, type PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { formatCount } from '@/lib/format-number';
import pr from './pinned-row.module.css';

/**
 * pinned-row.tsx — 📌 THE APP'S ONE PINNED ROW, as a component (owner 2026-10-27, DECISION_LOG "THE PINNED ROW IS THE
 * APP-WIDE TEMPLATE"; first mounted on People 2026-10-28, "People and Groups approved"; part 2 — Events, Memories and
 * Discover — mounts the SAME component, never a copy).
 *
 * ONE 44-px line, left → right, that never wraps (one line at 390):
 *   · `picker`  — the page's EXISTING view picker, the shared `PickMenu`, shown as "<Name> ▾";
 *   · `doors`   — the page's live counts as FILTER DOORS (`aria-pressed` while filtering); `note` is said in their place
 *                 when there is nothing to count or the read was refused (never a 0 over a refusal);
 *   · `action`  — the page's ONE action, a link (`href`) or a button (`onTap`);
 *   · `gear`    — the menu's ⚙ at the right end: the caller mounts its `<MenuSettingsButton menu="…">` and passes it here,
 *                 so the ⚙ guard (`every-menu-has-one-settings-button.test.ts`) still counts one literal site per menu.
 *
 * Put it inside the page's sticky block. The row is the same box at rest and pinned, so nothing under it jumps; once
 * the page runs under it a hairline fades in (`data-stuck`, opacity only, none under reduced motion). The row is
 * marked `data-first-row` (the ⚙'s spot) and `data-pinned-row`. 🔒 lib/the-pinned-row-is-one-row.test.ts
 */

export type PinnedDoor = {
  key: string;
  n: number;
  word: string;
  /** The brand colour — the count that waits on you. */
  hot?: boolean;
  /** Filtering to this door right now. */
  on: boolean;
  onTap: () => void;
};

export type PinnedPicker = {
  /** What the control is, for a screen reader. */
  label: string;
  /** The picked option's KEY (never a label). */
  value: string;
  /** The face — "People", "Groups", "Events". */
  buttonText: string;
  options: readonly PickOption[];
  onPick: (key: string) => void;
};

export type PinnedAction = {
  label: string;
  icon?: LucideIcon;
  ariaLabel?: string;
  /** A walk/guard mark — `data-pinned-action="<mark>"`. */
  mark: string;
  /** Opens a sheet or dialog (a button). */
  dialog?: boolean;
} & ({ href: string; onTap?: never } | { onTap: () => void; href?: never });

export function PinnedRow({
  picker,
  doors,
  note = null,
  action,
  gear,
  doorsTour,
  data,
}: {
  picker: PinnedPicker;
  doors: readonly PinnedDoor[];
  note?: string | null;
  action: PinnedAction;
  /** The menu's `<MenuSettingsButton>` — mounted by the caller. */
  gear: ReactNode;
  /** 🔦 A spotlight anchor on the doors (`data-tour`). */
  doorsTour?: string;
  /** Extra marks on the row (`data-people-pin="people"`). */
  data?: Readonly<Record<`data-${string}`, string>>;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  // Stuck = the nearest sticky/fixed ancestor sits at its pinned top. One passive listener, read once per frame.
  useEffect(() => {
    const row = rowRef.current;
    let block: HTMLElement | null = row?.parentElement ?? null;
    while (block && !/^(sticky|fixed)$/.test(getComputedStyle(block).position)) block = block.parentElement;
    if (!block) return;
    const el = block;
    let raf = 0;
    const read = () => {
      raf = 0;
      const top = parseFloat(getComputedStyle(el).top) || 0;
      setStuck(window.scrollY > 0 && el.getBoundingClientRect().top <= top + 0.5);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const Icon = action.icon;
  const face = (
    <>
      {Icon ? <Icon aria-hidden className="h-4 w-4" strokeWidth={2.4} /> : null}
      {action.label}
    </>
  );

  return (
    <div ref={rowRef} className={pr.pin} data-pinned-row="" data-first-row="" data-stuck={stuck ? '' : undefined} {...data}>
      <span data-pick="" className={pr.pinPick} data-pinned-pick="">
        <PickMenu
          label={picker.label}
          value={picker.value}
          buttonText={picker.buttonText}
          options={picker.options}
          compact
          dataAttr="data-pinned-picker"
          onPick={picker.onPick}
        />
      </span>
      <span className={pr.pinDoors} data-pinned-doors="" data-tour={doorsTour}>
        {note ? (
          <span className={pr.pinNote} role="status" data-pinned-note="">
            {note}
          </span>
        ) : (
          doors.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={d.onTap}
              aria-pressed={d.on}
              className={`${pr.pinDoor} ${d.hot ? pr.hot : ''}`}
              data-pinned-door={d.key}
            >
              <b>{formatCount(d.n)}</b>
              {d.word}
            </button>
          ))
        )}
      </span>
      <span className={pr.pinSpace} aria-hidden />
      {action.href !== undefined ? (
        <Link href={action.href} className={pr.pinAct} data-pinned-action={action.mark} aria-label={action.ariaLabel}>
          {face}
        </Link>
      ) : (
        <button
          type="button"
          className={pr.pinAct}
          onClick={action.onTap}
          data-pinned-action={action.mark}
          aria-label={action.ariaLabel}
          aria-haspopup={action.dialog ? 'dialog' : undefined}
        >
          {face}
        </button>
      )}
      {gear}
    </div>
  );
}

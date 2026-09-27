'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { pickRuns, placePickList, type PickListPlacement } from './pick-menu-place';

/**
 * ONE COMPACT PICKER — "Home ▾", "● Invitation ▾", "Pages ▾".
 *
 * Owner, 2026-09-27, on the navigator's tab row (it wrapped to 140px tall in a
 * 168px column): *"this should be a tap to show option to pick or a drop
 * down."* And on the toolbar's stage row (clipped at laptop widths): *"we can
 * also convert this to a drop down/tap to show options for smaller screens?"*
 *
 * A button showing the current choice; a tap lists the options; picking one
 * calls `onPick` — the SAME action the full row's buttons run, so the two can
 * never mean different things. The list is placed against the VIEWPORT (the
 * toolbar and the navigator both scroll, and an overflow container would clip
 * a list that hangs below it — `ComingNext`'s rule). Esc and a tap outside
 * close it; arrow keys move through the options.
 *
 * 🪤 THE LIST IS PORTALLED TO `document.body` (measured live 2026-09-27): the
 * element sheet is `.sn-glass-bare`, and an ancestor with `backdrop-filter`
 * (or `transform` / `filter`) becomes the containing block for `position:
 * fixed` — the Font list was drawn at the viewport top PLUS the sheet's own
 * top, wholly below a phone screen. From `body` no ancestor can do that. Where
 * it opens (below, or above when there is no room) is `placePickList`,
 * executed by `pick-menu-place.test.ts`. The faces still resolve: every
 * `--font-*` variable is declared on `<html>` (app/layout.tsx). `z-[95]`
 * clears the Maker overlay (`fixed inset-0 z-[80]`) and its scene picker
 * (z-[90]/z-[91]), and stays under toasts (z-[100]).
 */
export type PickOption = {
  key: string;
  label: string;
  /** The terracotta "live today" dot, beside the label. */
  dot?: boolean;
  /** Listed but not pickable, with its reason (a tab that opens its own page). */
  disabledNote?: string;
  /** Draw the option IN a face (the font dropdown — each font in its own face). */
  fontFamily?: string;
  /** A labelled group heading ("Stages", "Pages"); consecutive options with the
   *  same group share one heading. Omitted = no heading (every other picker). */
  group?: string;
};

export function PickMenu({
  label,
  value,
  options,
  onPick,
  dataAttr,
  className = '',
}: {
  /** What the control is, for a screen reader ("This stage's menu"). */
  label: string;
  /** The option shown on the button. */
  value: string | null;
  options: readonly PickOption[];
  onPick: (key: string) => void;
  /** A data-attribute name stamped on the button, for tests and the tour. */
  dataAttr?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<PickListPlacement | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const current = options.find((o) => o.key === value) ?? null;

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const next = placePickList({
      button: r,
      // The list's FULL height — `scrollHeight` ignores the maxHeight cap, so a
      // re-measure never feeds the cap back into itself.
      listHeight: listRef.current?.scrollHeight ?? 0,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    });
    setAt((prev) =>
      prev &&
      prev.top === next.top &&
      prev.left === next.left &&
      prev.minWidth === next.minWidth &&
      prev.maxHeight === next.maxHeight
        ? prev
        : next,
    );
  };

  // Placed BEFORE paint, twice: first from the button alone (the list is not
  // mounted yet), then with the list's real height, which may flip it above
  // the button. `place` keeps the same object when nothing moved, so this
  // settles after one extra pass.
  // …and focus moves into the list the first time it is actually mounted (on a
  // first open the list only exists after the placement pass, so a focus call
  // in the `[open]` effect below found nothing — measured in the browser).
  const focusedOnOpen = useRef(false);
  useLayoutEffect(() => {
    if (!open) {
      focusedOnOpen.current = false;
      return;
    }
    place();
    if (!focusedOnOpen.current && listRef.current) {
      focusedOnOpen.current = true;
      // The CURRENT option first — a selector list would return whichever comes
      // first in the document, i.e. always the top option.
      (
        listRef.current.querySelector<HTMLButtonElement>('button[aria-selected="true"]:not([disabled])') ??
        listRef.current.querySelector<HTMLButtonElement>('button:not([disabled])')
      )?.focus();
    }
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!btnRef.current?.contains(e.target as Node) && !listRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    const onMove = () => place();
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open]);

  const move = (dir: 1 | -1) => {
    const items = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(i + dir + items.length) % items.length]?.focus();
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={`${label}: ${current?.label ?? 'choose'}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        {...(dataAttr ? { [dataAttr]: '' } : {})}
        onClick={() => setOpen((o) => !o)}
        className={`sn-press inline-flex min-h-10 min-w-0 max-w-full items-center gap-1.5 whitespace-nowrap rounded-full bg-white/70 px-3 text-[13px] font-semibold text-ink transition-colors duration-300 ease-in-out hover:bg-white ${className}`}
      >
        {current?.dot ? <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta" /> : null}
        <span className="min-w-0 truncate" style={current?.fontFamily ? { fontFamily: current.fontFamily } : undefined}>
          {current?.label ?? label}
        </span>
        <ChevronDown aria-hidden className={`h-3.5 w-3.5 shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} strokeWidth={2} />
      </button>
      {open && at
        ? createPortal(
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={label}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  move(1);
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  move(-1);
                }
              }}
              style={{ position: 'fixed', top: at.top, left: at.left, minWidth: at.minWidth, maxHeight: at.maxHeight }}
              data-pick-side={at.side}
              className="sn-glass-bare z-[95] overflow-y-auto overscroll-contain rounded-2xl p-1.5 shadow-[0_18px_40px_-18px_rgba(30,26,18,.45)]"
            >
              {pickRuns(options).map((run, ri) =>
                run.group === null ? (
                  run.options.map(renderOption)
                ) : (
                  /* A labelled GROUP (owner 2026-09-27, the compact Maker bar:
                     "combine them in 1 dropdown" — Stages and Pages in one
                     list). The heading is not an option: no button, so the
                     arrow keys and the first-focus query pass over it; the
                     group is announced by its aria-label, the visible word is
                     aria-hidden. */
                  <li
                    key={`group:${run.group}`}
                    role="group"
                    aria-label={run.group}
                    data-pick-group={run.group}
                    className={ri > 0 ? 'mt-1 border-t border-ink/10 pt-1' : ''}
                  >
                    <p aria-hidden className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/50">
                      {run.group}
                    </p>
                    <ul role="none">{run.options.map(renderOption)}</ul>
                  </li>
                ),
              )}
            </ul>,
            document.body,
          )
        : null}
    </>
  );

  function renderOption(o: PickOption) {
    return (
      <li key={o.key} role="none">
        <button
          type="button"
          role="option"
          aria-selected={o.key === value}
          disabled={Boolean(o.disabledNote)}
          data-pick-option={o.key}
          onClick={() => {
            setOpen(false);
            onPick(o.key);
          }}
          className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-[14px] transition-colors duration-300 ease-in-out disabled:cursor-default disabled:text-ink/40 ${
            o.key === value ? 'bg-ink text-cream' : 'text-ink hover:bg-ink/5'
          }`}
        >
          {o.dot ? <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta" /> : null}
          <span className="font-semibold" style={o.fontFamily ? { fontFamily: o.fontFamily } : undefined}>
            {o.label}
          </span>
          {o.dot ? <span className="text-[12px] font-medium opacity-70">· live today</span> : null}
          {o.disabledNote ? <span className="text-[12px] font-medium">· {o.disabledNote}</span> : null}
        </button>
      </li>
    );
  }
}

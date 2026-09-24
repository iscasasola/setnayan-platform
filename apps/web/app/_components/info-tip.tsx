'use client';

/**
 * <InfoTip> — THE ONE `(i)`. Secondary text lives behind it (design brief
 * 2026-09-24 §2: "hide all secondary details … inside clean, interactive info
 * icons"). Read build-sessions/DESIGN-FOUNDATION.md before using it.
 *
 * 🔑 IT RENDERS ITS OWN LABEL, AND THE LABEL IS REQUIRED. A lone circle was
 * retired on 2026-08-21 (the PageMasthead ruling) and the owner re-affirmed it
 * on 2026-09-24: an `(i)` sits beside a visible label. Making the label a
 * required prop that this component prints is what makes a lone circle
 * impossible to write, instead of merely discouraged.
 *
 *     <InfoTip label="Budget">What counts toward the total.</InfoTip>
 *     <InfoTip label="Your inspirations" labelAs="h2" labelClassName="…">…</InfoTip>
 *
 * Generalised from the mood board's `InfoButton` (2026-09-03), whose docblock
 * said it would be extracted once a second surface needed it. That file is
 * gone; the mood board renders this one.
 *
 * Behaviour (the decisions are `info-tip-state.ts`, executed by its test):
 * hover opens for a mouse, a tap/click pins, Esc and an outside press close.
 * The popover is borderless glass (`.sn-tip` + `.sn-glass-bare`) — the owner's
 * "glass layers drop their hairline". The trigger keeps its round hairline: it
 * is a control, and controls keep their radius (owner, 2026-09-24).
 *
 * Only put here what a person does NOT need before acting. Costs, dates,
 * balances, errors and consequences stay on the page.
 */

import { useEffect, useId, useReducer, useRef, type ReactNode } from 'react';
import { TIP_CLOSED, tipReducer } from './info-tip-state';

type LabelTag = 'span' | 'p' | 'h2' | 'h3' | 'h4';

export type InfoTipProps = {
  /** The VISIBLE label the `(i)` sits beside. Printed by this component. */
  label: string;
  /** What the popover says. Short — a sentence or two, never a manual. */
  children: ReactNode;
  /** Element the label renders as. A heading makes the label the section title. */
  labelAs?: LabelTag;
  labelClassName?: string;
  /** `id` for the label element — so a region can be `aria-labelledby` it. */
  labelId?: string;
  /** Accessible name of the `(i)` button. Defaults to `About <label>`. */
  ariaLabel?: string;
  /** Which edge the popover hangs from. `start` near a left edge, `end` near a right one. */
  align?: 'center' | 'start' | 'end';
  className?: string;
};

export function InfoTip({
  label,
  children,
  labelAs = 'span',
  labelClassName,
  labelId,
  ariaLabel,
  align = 'center',
  className,
}: InfoTipProps) {
  const [state, dispatch] = useReducer(tipReducer, TIP_CLOSED);
  const rootRef = useRef<HTMLElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const tipId = useId();

  useEffect(() => {
    if (!state.open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current?.contains(e.target as Node)) return;
      dispatch({ type: 'outside' });
    }
    // Escape peels ONE layer. `useModalA11y` listens on `document` in the
    // capture phase and stops the event, so a tip inside a modal or sheet would
    // never hear it and the whole panel would close instead. Listening on
    // `window` in capture runs first; an open tip takes the keystroke.
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      dispatch({ type: 'escape' });
      btnRef.current?.focus();
    }
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [state.open]);

  // A block label (heading or paragraph) needs a block wrapper — a <span>
  // around an <h2> or a <p> is invalid HTML.
  const block = labelAs !== 'span';
  const Wrapper = block ? 'div' : 'span';
  const Label = labelAs;

  return (
    <Wrapper
      ref={rootRef as never}
      className={`relative ${block ? 'flex' : 'inline-flex'} items-center gap-1.5${className ? ` ${className}` : ''}`}
      onPointerEnter={(e) => dispatch({ type: 'pointerenter', pointerType: e.pointerType })}
      onPointerLeave={(e) => dispatch({ type: 'pointerleave', pointerType: e.pointerType })}
    >
      <Label id={labelId} className={labelClassName}>
        {label}
      </Label>
      <button
        ref={btnRef}
        type="button"
        aria-label={ariaLabel ?? `About ${label}`}
        aria-expanded={state.open}
        aria-describedby={tipId}
        onClick={() => dispatch({ type: 'click' })}
        onFocus={() => dispatch({ type: 'focus' })}
        onBlur={() => dispatch({ type: 'blur' })}
        className="sn-press inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-ink/25 text-[10px] font-semibold leading-none text-ink/55 transition-all duration-sn-control ease-sn hover:border-terracotta hover:text-terracotta aria-expanded:border-terracotta aria-expanded:text-terracotta"
      >
        <span aria-hidden="true">i</span>
      </button>
      <span
        id={tipId}
        role="tooltip"
        className="sn-tip"
        data-open={state.open ? 'true' : 'false'}
        data-align={align}
      >
        <span className="sn-tip-body sn-glass-bare block">{children}</span>
      </span>
    </Wrapper>
  );
}

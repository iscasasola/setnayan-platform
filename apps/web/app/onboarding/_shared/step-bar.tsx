'use client';

/**
 * step-bar.tsx — THE ONE BOTTOM BAR every onboarding flow's step frame draws (Build 5 Lane P, slice 5).
 *
 * Owner, 10 Nov ~18:50, verbatim: *"On the onboarding the rule or uniform buttons and design templates is not
 * followed yet."* HOUSE_TEMPLATES T32 (the step frame's bottom bar: Back, Skip, the main verb filled terracotta) and
 * T19 (the shared `ActionButton` only; buttons in one row — `useFitRow` shrinks the secondaries, never the main verb).
 *
 * The wedding shell drew its bar with the house parts first (slice 4); the generic flow, the Get-together form and
 * the open-shop wizard each drew their own hand-styled `<button>` row. This is the wedding bar lifted out, so every
 * flow's Back · Skip · main verb is the SAME three ActionButtons in the SAME order. The flow keeps its own wrapper
 * (the wedding's `.bottom`, the generic glass row) — the row inside is this.
 *
 * ⏳ ONE PRESS, ONE STEP (walk 13 Nov 2026, F-W2-03 — the same misfire as /open-shop's F-W1-04). A double tap on the
 * main verb ran its onClick twice before the screen re-rendered, so the wedding sign-up jumped from step 1 straight
 * to step 3, skipping "Name your wedding". The main verb now takes ONE press per step: the first is drawn pressed at
 * once (`data-busy`, the house `.ab[data-busy]` look) and every further press is ignored until the flow moves on
 * (`stepKey` changes) or, if the press did not move it (a refusal), `PRESS_HOLD_MS` passes.
 *
 * The header's ‹ / ✕ ring is NOT here: it stays each flow's `btn-ring` (first-screen-can-cancel.test.ts pins it).
 */

import { useEffect, useRef, useState, type ComponentType, type SVGProps } from 'react';
import { ArrowRight, ChevronLeft, ChevronsRight } from 'lucide-react';
import { ActionButton, useFitRow } from '@/components/action-button';

type Icon = ComponentType<SVGProps<SVGSVGElement> & { strokeWidth?: number | string }>;

export type StepBarMain = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Submit a form instead of calling onClick alone (the open-shop steps are forms). */
  type?: 'button' | 'submit';
  form?: string;
  icon?: Icon;
  'data-testid'?: string;
};

/** How long a press holds the main verb when the step did not change (a refusal) — then it can be pressed again. */
export const PRESS_HOLD_MS = 700;

export type StepBarSide = {
  onClick: () => void;
  disabled?: boolean;
  /** Keep its place but draw nothing (the generic flow's step 0: the slot holds so Continue never jumps). */
  hidden?: boolean;
  label?: string;
  'data-testid'?: string;
};

export function StepBar({
  back,
  skip,
  main,
  wide = false,
  className = '',
  stepKey,
}: {
  /** The screen the bar sits on. A change releases the one-press hold at once (see above). */
  stepKey?: string | number;
  back?: StepBarSide;
  skip?: StepBarSide;
  /** Absent → no main verb on this step (a screen that draws its own, like the wedding summary). */
  main?: StepBarMain | null;
  /** The main verb fills the bar (the wedding); otherwise it sits at the right, Back at the left. */
  wide?: boolean;
  className?: string;
}) {
  const row = useRef<HTMLDivElement>(null);
  useFitRow(row);
  const held = useRef(false);
  const [pressed, setPressed] = useState(false);
  const timer = useRef<number | null>(null);
  const release = () => {
    held.current = false;
    setPressed(false);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };
  // The flow moved on: the next screen's main verb is pressable at once.
  useEffect(() => {
    release();
  }, [stepKey]);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);
  return (
    <div ref={row} data-step-bar="" className={`flex w-full items-center gap-3 ${wide ? '' : 'justify-between'} ${className}`.trim()}>
      {back ? (
        <ActionButton
          tone="neutral"
          quiet
          icon={ChevronLeft}
          label={back.label ?? 'Back'}
          onClick={back.onClick}
          disabled={back.disabled}
          className={back.hidden ? 'invisible' : undefined}
          data-testid={back['data-testid']}
        />
      ) : null}
      {skip ? (
        <ActionButton
          tone="neutral"
          quiet
          icon={ChevronsRight}
          label={skip.label ?? 'Skip'}
          onClick={skip.onClick}
          disabled={skip.disabled}
          className={skip.hidden ? 'invisible' : wide ? undefined : 'ml-auto'}
          data-testid={skip['data-testid']}
        />
      ) : null}
      {main ? (
        <ActionButton
          tone="brand"
          main
          icon={main.icon ?? ArrowRight}
          label={main.label}
          type={main.type}
          form={main.form}
          className={wide ? 'w-full flex-1 justify-center' : 'justify-center'}
          data-testid={main['data-testid']}
          data-busy={pressed ? '' : undefined}
          onClick={(e) => {
            // A second press before the flow moved: ignored (and a form is not submitted twice).
            if (held.current) {
              e.preventDefault();
              return;
            }
            held.current = true;
            setPressed(true);
            timer.current = window.setTimeout(release, PRESS_HOLD_MS);
            main.onClick();
          }}
          disabled={main.disabled}
        />
      ) : null}
    </div>
  );
}

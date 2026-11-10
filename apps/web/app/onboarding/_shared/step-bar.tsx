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
 * The header's ‹ / ✕ ring is NOT here: it stays each flow's `btn-ring` (first-screen-can-cancel.test.ts pins it).
 */

import { useRef, type ComponentType, type SVGProps } from 'react';
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
}: {
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
          onClick={main.onClick}
          disabled={main.disabled}
        />
      ) : null}
    </div>
  );
}

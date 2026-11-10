'use client';

/**
 * step-field.tsx — THE SHARED STEP PARTS every onboarding step draws its fields with (Build 5 Lane P).
 *
 * ⚖ Owner 10 Nov (DECISION_LOG "ONBOARDING: ONE TEMPLATE, THE EVENT NAME, AND EVERY REQUIRED PART"),
 * verbatim: *"Also noticed an inconsistent design template on the onboarding. Like the text of the
 * names."* · HOUSE_TEMPLATES T32 (the onboarding step frame, open-shop v21) · the approved prototype
 * `prototypes/onboarding_every_step_2026-11-10/index.html` § "The template":
 *   · every field is LABELLED ABOVE (14 px / 500), a small muted word for "optional";
 *   · the shared input is 48 px, radius 12, 14 px inner padding — the text never touches the edge —
 *     16 px text; prefilled text is plain ink, a placeholder is muted;
 *   · every set of choices is ONE full-width dropdown with a chevron (`StepPick`, the house PickMenu
 *     wearing the input's box) — "Not decided yet" is a choice INSIDE it, never a third control;
 *   · two things of one kind stack, every control the width of the column;
 *   · Enter commits a field and moves to the next one; on the last field Enter is Continue.
 *
 * ONE place for these parts: a step that writes its own `<input className=…>` or its own label style is
 * the drift the owner saw (the wedding names were "a different text style and sit against the box
 * edge"). `app/onboarding/the-steps-wear-one-template.test.ts` fails when a migrated step does.
 */

import { forwardRef, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { pickArrowClass } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-place';
import type { PickMenuProps } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-types';

/** The box every onboarding input and dropdown wears: 48 px, radius 12, 14 px inner padding, 16 px text. */
export const STEP_BOX_CLASS =
  'flex h-12 w-full min-w-0 items-center gap-2 rounded-xl border border-ink/15 bg-paper px-[14px] text-base text-ink transition-colors duration-sn-control ease-sn dark:border-ink/20 dark:bg-raised';

/** The input itself: the box, a muted placeholder, the accent ring on focus. */
export const STEP_INPUT_CLASS = `${STEP_BOX_CLASS} placeholder:text-ink/40 outline-none focus:border-sn-accent focus:ring-1 focus:ring-sn-accent`;

/** One labelled field: the label above (with an optional muted word), the control, one hint under it. */
export function StepField({
  label,
  small,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  /** A muted word beside the label — "optional". */
  small?: string;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-[5px]" data-step-field>
      <label htmlFor={htmlFor} className="flex items-center gap-1.5 text-sm font-medium text-ink">
        {label}
        {small ? <small className="text-sm font-normal text-ink/50">{small}</small> : null}
      </label>
      {children}
      {hint ? <div className="text-[12.5px] text-ink/50">{hint}</div> : null}
    </div>
  );
}

/** A group caption over a set of fields ("Groom · you", "Bride") — mono, muted, the prototype's `.grp`. */
export function StepGroup({ children }: { children: ReactNode }) {
  return (
    <p className="pt-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink/55" data-step-group>
      {children}
    </p>
  );
}

/**
 * Enter commits the field and moves to the NEXT field of the step; on the last one it presses the step's
 * Continue (the first enabled `[data-step-continue]`, else the shell's `.btn-primary`). Shift+Enter is
 * left alone (a long text's new line). Exported so a test pins it.
 */
export function enterMovesOn(e: KeyboardEvent<HTMLInputElement>): void {
  if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
  const here = e.currentTarget;
  const scope = here.closest('[data-setup-card]') ?? here.form ?? document.body;
  const fields = Array.from(scope.querySelectorAll<HTMLInputElement>('input[data-step-input]:not([disabled])'));
  const next = fields[fields.indexOf(here) + 1];
  e.preventDefault();
  if (next) {
    next.focus();
    return;
  }
  here.blur();
  const go =
    document.querySelector<HTMLButtonElement>('[data-step-continue]:not([disabled])') ??
    document.querySelector<HTMLButtonElement>('.screen.active ~ * .btn-primary:not([disabled]), .btn-primary:not([disabled])');
  go?.click();
}

/** The shared input. Every prop of a plain `<input>`; the class and Enter-moves-on come from here. */
export const StepInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function StepInput(
  { className = '', onKeyDown, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      {...props}
      data-step-input=""
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (!e.defaultPrevented) enterMovesOn(e);
      }}
      className={`${STEP_INPUT_CLASS} ${className}`}
    />
  );
});

/**
 * The one full-width dropdown: the house PickMenu (its list, its sheet on a phone, its keys) wearing the
 * input's box — never a text pill of its own width. A muted word while nothing is picked.
 */
export function StepPick(props: Omit<PickMenuProps, 'trigger' | 'className' | 'compact'> & { placeholder?: string }) {
  const { placeholder = 'Pick one', ...menu } = props;
  const current = menu.options.find((o) => o.key === menu.value) ?? null;
  return (
    <PickMenu
      {...menu}
      className={`${STEP_BOX_CLASS} sn-press-ring justify-between text-left hover:border-ink/30`}
      trigger={
        <>
          <span className={`min-w-0 truncate ${current ? '' : 'text-ink/40'}`}>
            {current ? current.label : placeholder}
            {current?.hint ? <span className="font-normal text-ink/50"> · {current.hint}</span> : null}
          </span>
          <ChevronDown aria-hidden className={pickArrowClass(false)} strokeWidth={2} />
        </>
      }
    />
  );
}

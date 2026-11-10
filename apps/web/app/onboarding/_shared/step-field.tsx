'use client';

/**
 * step-field.tsx — THE SHARED STEP PARTS every onboarding step draws its fields with (Build 5 Lane P).
 *
 * ⚖ Owner 10 Nov (DECISION_LOG "ONBOARDING: ONE TEMPLATE, THE EVENT NAME, AND EVERY REQUIRED PART"),
 * verbatim: *"Also noticed an inconsistent design template on the onboarding. Like the text of the
 * names."* · HOUSE_TEMPLATES T32 (the onboarding step frame, open-shop v21) · the approved prototype
 * `prototypes/onboarding_every_step_2026-11-10/index.html` § "The template":
 *   · every field is LABELLED ABOVE (14 px / 500), a small muted word for "optional";
 *   · a typed answer is the ONE Field template — `TypedRow boxed` (`app/_components/form-row.tsx`): its name
 *     above, a 48 px box, radius 12, 14 px inner padding — the text never touches the edge — 16 px text, ONE ✕
 *     inside while typing, Enter keeps it. There is no second input here (lint:field-template);
 *   · every set of choices is ONE full-width dropdown with a chevron (`StepPick`, the house PickMenu
 *     wearing the input's box) — "Not decided yet" is a choice INSIDE it, never a third control;
 *   · two things of one kind stack, every control the width of the column;
 *   · Tab (and a phone's "next") goes on to the next row inside the step's `StepRows` (TypedRow's own tab scope).
 *
 * ONE place for these parts: a step that writes its own `<input className=…>` or its own label style is
 * the drift the owner saw (the wedding names were "a different text style and sit against the box
 * edge"). `app/onboarding/the-steps-wear-one-template.test.ts` fails when a migrated step does.
 */

import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { pickArrowClass } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-place';
import type { PickMenuProps } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-types';
import { FORM_TAB_SCOPE, FormRows } from '@/app/_components/form-row';

/** The dropdown's box (StepPick's trigger <button>): the same 48 px, radius 12, 14 px padding, 16 px text as `TypedRow boxed`. */
export const STEP_BOX_CLASS =
  'flex h-12 w-full min-w-0 items-center gap-2 rounded-xl border border-ink/15 bg-white px-[14px] text-base text-ink transition-colors duration-sn-control ease-sn dark:border-ink/20 dark:bg-raised'; // no-card-ok: the class of StepPick's dropdown trigger <button> (PickMenu draws it) — a pressable control, not a container

/**
 * The typed rows of a step: the house `FormRows` (one field open at a time) inside the tab scope, so Tab and a
 * phone's "next" go from one `TypedRow boxed` to the next.
 */
export function StepRows({ children, attrs }: { children: ReactNode; attrs?: Readonly<Record<`data-${string}`, string>> }) {
  return (
    <div {...{ [FORM_TAB_SCOPE]: '' }}>
      <FormRows attrs={attrs}>{children}</FormRows>
    </div>
  );
}

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

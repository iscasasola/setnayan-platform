'use client';

/**
 * A PickMenu row that cannot be picked yet: its SHORT LABEL on one line, greyed, at the height of every other row —
 * and its reason behind the shared ⓘ at the row's right edge (owner 2026-10-31, on Find's ⇅: *"Yes, tidy it"* — the
 * house rule "title + one short line visible, the rest in the ⓘ", owner 2026-10-23).
 *
 * The row is NOT a button (and carries no `aria-disabled`, which would disable the ⓘ inside it for assistive tech),
 * so neither a tap on it nor a tap on its ⓘ picks it; the ⓘ — "About <label>" — only opens the reason. The ⓘ is
 * a child of the open list (`OneOpenScope` with the list's own one-open id), so opening it never closes the menu it
 * sits in. Lives in its own module so `pick-menu.tsx` stays at the size that inlines (`pick-menu-stays-inline.test.ts`).
 *
 * Guard: `lib/a-greyed-choice-keeps-its-reason-in-the-info-tip.test.ts`.
 */
import { InfoTip } from '@/app/_components/info-tip';
import { OneOpenScope } from '@/lib/one-open';
import type { PickOption } from './pick-menu-types';

export function PickOffRow({ o, oo }: { o: PickOption; oo: string }) {
  return (
    <li role="none">
      <div
        data-pick-option={o.key}
        data-pick-off=""
        className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-[14px] text-ink/40"
      >
        {o.icon ? (
          <span aria-hidden className="inline-flex shrink-0">
            {o.icon}
          </span>
        ) : null}
        <OneOpenScope id={oo}>
          <InfoTip label={o.label} labelClassName="min-w-0 flex-1 font-semibold" className="min-w-0 flex-1" align="start">
            {o.disabledNote}
          </InfoTip>
        </OneOpenScope>
      </div>
    </li>
  );
}

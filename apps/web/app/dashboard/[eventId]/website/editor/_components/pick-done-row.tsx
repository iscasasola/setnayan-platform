'use client';

/**
 * The row that closes a MULTI-select `PickMenu` — kept out of `pick-menu.tsx`, which must stay small enough to be inlined
 * in every route (`lib/the-dropdown-wears-the-accent.test.ts`).
 *
 *   · default — the row as it always was: the note, then "Done ✓" in ink;
 *   · `button` — ✓ THE DONE THAT CLOSES THE LIST IS A GREEN BUTTON (approved makers-match § 1, 2026-11-07: green appears
 *     only on the Done that closes the dropdown): the shipped ActionButton `tone="ok"` "Done", then the note as a hint.
 */
import { Check } from 'lucide-react';
import { ActionButton } from '@/components/action-button';

export function PickDoneRow({ note, button, onDone }: { note?: string; button: boolean; onDone: () => void }) {
  const words = note ?? 'Tick as many as apply.';
  if (button) {
    return (
      <li role="none" data-pick-done-row="" className="mt-1 flex items-center gap-2.5 border-t border-ink/10 px-1 pb-0.5 pt-2">
        <ActionButton tone="ok" icon={Check} label="Done" data-testid="pick-done" onClick={onDone} />
        <span className="text-[12.5px] text-ink/75">{words}</span>
      </li>
    );
  }
  return (
    <li role="none" className="mt-1 border-t border-ink/10 pt-1">
      <button
        type="button"
        data-pick-done=""
        onClick={onDone}
        className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-[13px] text-ink/75 hover:bg-ink/5"
      >
        <span>{words}</span>
        <span className="font-semibold text-ink">Done ✓</span>
      </button>
    </li>
  );
}

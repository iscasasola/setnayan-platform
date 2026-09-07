'use client';

/**
 * publish-gate-submit.tsx — the editor's "Save changes" button, taught the
 * publish gate.
 *
 * ── WHY THIS EXISTS (owner, 2026-09-07, watching it fail) ───────────────────
 * *"the exclusive perk is blank. this means, we should not have the save
 * changes be available for save."*
 *
 * The card said **REQUIRED TO PUBLISH** and *"Cannot be blank if you want to
 * publish (activate) this service"*, and then offered an enabled Save that
 * could only fail. The database trigger `enforce_service_publish_gate` refused
 * it with a precise, written-for-a-human sentence — *"A Setnayan Exclusive
 * perk is required to publish this service."* — and the supplier saw
 * **"there was an error."**
 *
 * 🔑 THE MESSAGE EXISTED AT EVERY LAYER EXCEPT THE ONE THE VENDOR WAS LOOKING
 * AT. The trigger wrote it, `PUBLISH_REFUSAL_MESSAGE` mirrors it, the wizard
 * already coaches with `PUBLISH_COACH_MESSAGE` — and this editor, which
 * renders the very field in question, imported none of it.
 *
 * ── WHAT IT DOES, AND WHAT IT DELIBERATELY DOES NOT ─────────────────────────
 * The gate judges PUBLISHING, not saving. A draft with no price and no perk is
 * legitimate and must stay saveable — that is the trigger's own first branch
 * (`IF NEW.is_active IS NOT TRUE THEN RETURN NEW`). So this blocks ONLY when
 * the row is already live: exactly the case where the write would be refused.
 *
 * It reads the sibling fields out of the enclosing <form> rather than lifting
 * them into React state, because the editor is a SERVER component and the
 * fields are uncontrolled `defaultValue` inputs. Converting them would mean
 * rewriting the whole panel to make one button honest.
 *
 * The requirement list and its copy come from `lib/service-publish-gate` —
 * the same module the wizard and the server action use, so this button cannot
 * disagree with the trigger about what is missing or what to call it.
 */

import { useEffect, useRef, useState } from 'react';
import {
  PUBLISH_COACH_MESSAGE,
  exclusiveIsSet,
  priceIsSet,
  unmetPublishRequirements,
  type PublishRequirement,
} from '@/lib/service-publish-gate';
import { SubmitButton } from '@/app/_components/submit-button';

export function PublishGateSubmit({
  isActive,
  className,
  children,
}: {
  /** The row's CURRENT `is_active`. False ⇒ a draft ⇒ never blocked. */
  isActive: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [unmet, setUnmet] = useState<PublishRequirement[]>([]);

  useEffect(() => {
    if (!isActive) return;
    const form = wrapRef.current?.closest('form');
    if (!form) return;

    const read = () => {
      const price = (form.elements.namedItem('starting_price_php') as HTMLInputElement | null)?.value;
      const perk = (form.elements.namedItem('exclusive_perk_text') as HTMLInputElement | null)?.value;
      // `priceIsSet` takes a number; an empty box and a non-numeric box are both
      // "no price". NaN must not read as a set price.
      const n = price === undefined || price.trim() === '' ? null : Number(price);
      setUnmet(
        unmetPublishRequirements({
          hasPrice: priceIsSet(Number.isFinite(n as number) ? (n as number) : null),
          hasExclusive: exclusiveIsSet(perk ?? null),
        }),
      );
    };

    read();
    form.addEventListener('input', read);
    return () => form.removeEventListener('input', read);
  }, [isActive]);

  const blocked = isActive && unmet.length > 0;

  return (
    <div ref={wrapRef} className="flex flex-col items-end gap-1.5">
      {blocked ? (
        <p
          className="text-right text-xs"
          style={{ color: 'var(--m-orange-2)' }}
          role="status"
        >
          {unmet.map((r) => PUBLISH_COACH_MESSAGE[r]).join(' ')}
        </p>
      ) : null}
      <SubmitButton className={className} pendingLabel="Saving…" disabled={blocked}>
        {children}
      </SubmitButton>
    </div>
  );
}

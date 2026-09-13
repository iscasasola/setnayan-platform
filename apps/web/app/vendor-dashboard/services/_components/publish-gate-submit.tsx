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
 *
 * ⚖ H2 (2026-09-11) — THE COVER AND "WHAT'S INCLUDED" ARE FLAGS HERE, NOT
 * BLOCKS. They became publish requirements after cards were already live, and
 * a card already live is judged only on its price (`unmetForALiveCard`) — the
 * trigger and `save_vendor_service` draw the same line. So this button stays
 * enabled for a live card missing either, and says so above it
 * (`liveCardHealthFlags`): the card is never taken down and never locked, and
 * its shop is told what a couple is not seeing.
 */

import { useEffect, useRef, useState } from 'react';
import {
  PUBLISH_COACH_MESSAGE,
  coverIsSet,
  inclusionsAreSet,
  priceIsSet,
  unmetForALiveCard,
  type PublishRequirement,
} from '@/lib/service-publish-gate';
import { liveCardHealthFlags, type CardHealthFinding } from '@/lib/card-health';
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
  const [flags, setFlags] = useState<CardHealthFinding[]>([]);

  useEffect(() => {
    if (!isActive) return;
    const form = wrapRef.current?.closest('form');
    if (!form) return;

    const read = () => {
      const price = (form.elements.namedItem('starting_price_php') as HTMLInputElement | null)?.value;
      // `priceIsSet` takes a number; an empty box and a non-numeric box are both
      // "no price". NaN must not read as a set price.
      const n = price === undefined || price.trim() === '' ? null : Number(price);
      const data = new FormData(form);
      const facts = {
        hasPrice: priceIsSet(Number.isFinite(n as number) ? (n as number) : null),
        hasCover: coverIsSet(String(data.get('primary_photo_r2_key') ?? '')),
        hasInclusions: inclusionsAreSet(data.getAll('inclusion_label').map((v) => String(v))),
      };
      setUnmet(unmetForALiveCard(facts));
      setFlags(liveCardHealthFlags(facts));
    };

    read();
    form.addEventListener('input', read);
    // A photo upload or an added inclusion row changes the form without an
    // `input` event on a text box — `change` catches the hidden fields.
    form.addEventListener('change', read);
    return () => {
      form.removeEventListener('input', read);
      form.removeEventListener('change', read);
    };
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
      {isActive && flags.length > 0 ? (
        <ul
          data-testid="live-card-flags"
          className="space-y-0.5 text-right text-xs"
          style={{ color: 'var(--m-slate-2)' }}
          role="status"
        >
          {flags.map((f) => (
            <li key={f.code}>{f.message}</li>
          ))}
        </ul>
      ) : null}
      <SubmitButton className={className} pendingLabel="Saving…" disabled={blocked}>
        {children}
      </SubmitButton>
    </div>
  );
}

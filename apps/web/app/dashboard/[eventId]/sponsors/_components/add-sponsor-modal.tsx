'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { StayForm } from '@/app/_components/stay-form';
import { Sheet } from '@/app/_components/sheet';
import { ActionButton, actionButtonClass } from '@/components/action-button';
import type {
  SponsorSide,
  SponsorTier,
} from '@/lib/event-sponsors';

type Props = {
  eventId: string;
  /** Tier slot being filled. Pre-filled into the hidden field. */
  sponsorTier: SponsorTier;
  /** Side slot is fixed when the host clicks "Add ninong" or "Add ninang";
   *  free-pick when the host opens a generic Add (cord/veil/coin/candle). */
  side: SponsorSide;
  /** Pair index for principal sponsors. NULL for secondary tiers. */
  pairIndex: number | null;
  /** Display string for the trigger button. */
  triggerLabel: string;
  /** Form action — the addSponsor server action. */
  formAction: (formData: FormData) => Promise<void>;
};

/**
 * Add-sponsor modal. Triggered by the "Add ninong / ninang / cord sponsor /
 * etc." buttons inside each tier section.
 *
 * The form submits via a server-action `<form action={…}>`. SubmitButton
 * hooks `useFormStatus` so the host can't double-click during the insert.
 */
export function AddSponsorModal({
  eventId,
  sponsorTier,
  side,
  pairIndex,
  triggerLabel,
  formAction,
}: Props) {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);


  // Auto-focus the first input when opening.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      dialogRef.current?.querySelector<HTMLInputElement>('input[name="full_name"]')?.focus();
    }, 30);
    return () => window.clearTimeout(t);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-ink/30 bg-cream/60 px-3 py-2.5 text-sm font-medium text-ink/70 transition-colors hover:border-terracotta/50 hover:bg-terracotta/5 hover:text-terracotta-700-700"
      >
        <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        {triggerLabel}
      </button>

      {open ? (
        /* 📐 DESIGN TEMPLATE (14 Nov 2026, rule 9): the house Sheet — handle, title, ✕, Esc and Back. */
        <Sheet open onClose={() => setOpen(false)} labelledById={headingId} rise>
          <div ref={dialogRef}>
            <header className="flex items-start justify-between gap-3 px-5 pb-2 pt-4 pr-14">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">
                  {sponsorTier === 'principal'
                    ? `Pair ${pairIndex ?? '—'} · ${side === 'groom' ? "groom's side" : side === 'bride' ? "bride's side" : 'neutral'}`
                    : 'Secondary sponsor'}
                </p>
                <h2 id={headingId} className="text-[17px] font-semibold text-ink">
                  Add {triggerLabel.toLowerCase().replace(/^add /, '')}
                </h2>
              </div>
            </header>

            <StayForm door="sponsors.addSponsor" action={formAction} onSaved={() => setOpen(false)} className="space-y-4 px-5 py-4">
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="sponsor_tier" value={sponsorTier} />
              <input type="hidden" name="side" value={side} />
              {pairIndex !== null ? (
                <input type="hidden" name="pair_index" value={String(pairIndex)} />
              ) : null}

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">
                  Full name
                </span>
                <input
                  autoComplete="off"
                  type="text"
                  name="full_name"
                  required
                  maxLength={200}
                  placeholder="Marcel Reyes-Santos"
                  className="input-field"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">
                  Relationship (optional)
                </span>
                <input
                  type="text"
                  name="relationship_note"
                  maxLength={200}
                  placeholder="Tito Mike (Mom's brother)"
                  className="input-field"
                />
                <span className="text-xs text-ink/70">
                  Helps you remember who&apos;s who when reviewing later.
                </span>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">
                  Email (optional)
                </span>
                <input
                  autoComplete="off"
                  type="email"
                  name="email"
                  maxLength={200}
                  placeholder="marcel@example.com"
                  className="input-field"
                />
                <span className="text-xs text-ink/70">
                  Not required, but useful when sending the invitation.
                </span>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">
                  Phone (optional)
                </span>
                <input
                  autoComplete="off"
                  type="tel"
                  name="phone"
                  maxLength={40}
                  placeholder="+63 917 123 4567"
                  className="input-field"
                />
              </label>

              <div className="grid auto-cols-fr grid-flow-col gap-2 pt-2">
                <ActionButton tone="neutral" icon={X} label="Cancel" onClick={() => setOpen(false)} />
                <SubmitButton
                  className={actionButtonClass('brand', { main: true })}
                  pendingLabel="Saving…"
                >
                  Save sponsor
                </SubmitButton>
              </div>
            </StayForm>
          </div>
        </Sheet>
      ) : null}
    </>
  );
}

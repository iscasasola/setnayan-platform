'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
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
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

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
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-ink/30 bg-cream/60 px-3 py-2.5 text-sm font-medium text-ink/65 transition-colors hover:border-terracotta/50 hover:bg-terracotta/5 hover:text-terracotta-700"
      >
        <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        {triggerLabel}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={headingId}
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-3 sm:items-center sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-ink/10 bg-cream shadow-2xl"
          >
            <header className="flex items-start justify-between gap-3 border-b border-ink/10 bg-cream/80 px-5 py-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
                  {sponsorTier === 'principal'
                    ? `Pair ${pairIndex ?? '—'} · ${side === 'groom' ? "groom's side" : side === 'bride' ? "bride's side" : 'neutral'}`
                    : 'Secondary sponsor'}
                </p>
                <h2 id={headingId} className="font-display text-2xl italic text-ink">
                  Add {triggerLabel.toLowerCase().replace(/^add /, '')}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-md p-1 text-ink/50 hover:bg-ink/5 hover:text-ink"
              >
                <X aria-hidden className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </header>

            <form action={formAction} className="space-y-4 px-5 py-4">
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="sponsor_tier" value={sponsorTier} />
              <input type="hidden" name="side" value={side} />
              {pairIndex !== null ? (
                <input type="hidden" name="pair_index" value={String(pairIndex)} />
              ) : null}

              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                  Full name
                </span>
                <input
                  type="text"
                  name="full_name"
                  required
                  maxLength={200}
                  placeholder="Marcel Reyes-Santos"
                  className="input-field"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                  Relationship (optional)
                </span>
                <input
                  type="text"
                  name="relationship_note"
                  maxLength={200}
                  placeholder="Tito Mike (Mom's brother)"
                  className="input-field"
                />
                <span className="text-xs text-ink/55">
                  Helps you remember who&apos;s who when reviewing later.
                </span>
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                  Email (optional)
                </span>
                <input
                  type="email"
                  name="email"
                  maxLength={200}
                  placeholder="marcel@example.com"
                  className="input-field"
                />
                <span className="text-xs text-ink/55">
                  Not required, but useful when sending the invitation.
                </span>
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                  Phone (optional)
                </span>
                <input
                  type="tel"
                  name="phone"
                  maxLength={40}
                  placeholder="+63 917 123 4567"
                  className="input-field"
                />
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-ink/70 hover:bg-ink/5"
                >
                  Cancel
                </button>
                <SubmitButton
                  className="button-primary h-10 px-5 text-sm"
                  pendingLabel="Saving…"
                >
                  Save sponsor
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

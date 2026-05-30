'use client';

/**
 * Dynamic `custom_<canonical>` card · spawned from AddACategoryCard picks.
 *
 * Each `custom_<canonical>` wizard task (created by `getBaseSequenceForTier`
 * in lib/wizard.ts when an Add A Category pick exists) renders this card.
 * The card is intentionally lightweight in V1 · the host gets two clear
 * next-step paths:
 *
 *   (a) [Browse <Category> vendors] · deep-link into /vendors with the
 *       canonical pre-selected · the marketplace's existing folder + search
 *       infrastructure handles the rest.
 *   (b) [Mark this done] · stamps wizard_state.custom_<canonical>.completed_at
 *       so the resolver advances to the next custom pick (or back to the
 *       baseline Done state when all custom picks are settled).
 *
 * Why not VendorPickGridCard: VendorPickGridCard needs pre-fetched
 * recommendations + a search context · threading that per-canonical
 * through the wizard-hero dispatcher would require a server-side
 * recommendations fetch for every spawned custom task on every dashboard
 * render, materially blowing up the round-trip count. The marketplace
 * deep-link path is the V1-acceptable trade-off · V1.x can swap to the
 * full inline-pick experience.
 */

import { useState, useTransition } from 'react';
import { ChevronRight, CheckCircle2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { markTaskDone } from '../../wizard-actions';

type Props = {
  eventId: string;
  canonical: string;
  displayName: string;
};

export function CustomCategoryPickCard({
  eventId,
  canonical,
  displayName,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleMarkDone() {
    setErrorMessage(null);
    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('task_id', `custom_${canonical}`);
    startTransition(async () => {
      try {
        await markTaskDone(formData);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Couldn't mark this done. Try again.";
        setErrorMessage(message);
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-terracotta/25 bg-terracotta/5 p-3 text-sm leading-relaxed text-ink/80 sm:p-4">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles
            aria-hidden
            className="h-3.5 w-3.5 text-terracotta"
            strokeWidth={2}
          />
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
            Your addition
          </p>
        </div>
        <p>
          You added <strong className="font-medium text-ink">{displayName}</strong>{' '}
          to your plan. Browse vendors when you&apos;re ready — your
          marketplace already filters to matches that fit your wedding.
          Mark this done anytime, even before you lock a vendor.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/vendors?folder=&q=${encodeURIComponent(displayName)}`}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-ink/15 bg-white px-5 py-3 text-sm font-semibold text-ink transition-colors hover:border-terracotta/40 hover:bg-terracotta/5 focus:outline-none focus:ring-2 focus:ring-terracotta/30"
        >
          Browse {displayName} vendors
          <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2} />
        </Link>
        <button
          type="button"
          onClick={handleMarkDone}
          disabled={isPending}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-mulberry px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-700 focus:outline-none focus:ring-2 focus:ring-mulberry focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
        >
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={2} />
          {isPending ? 'Saving…' : 'Mark this done'}
        </button>
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

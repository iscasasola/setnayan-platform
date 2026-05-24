'use client';

/**
 * Card 31 Finalize Catering Count · WAVE 2 · iteration 0016 Concierge
 * Active Wizard.
 *
 * DATA_INPUT card · the host confirms the final headcount for the
 * caterer's headcount lock T-14d. Reads the current RSVP-accepted
 * count from the parent server component (the page.tsx already pulls
 * guest stats for the dashboard header) and surfaces:
 *
 *   - The current count of attending guests
 *   - A +10% cushion suggestion (rounded UP · partial guests don't
 *     happen but partial chairs lead to short-set surprises)
 *   - A single [Lock count at N] CTA · OR [Lock count with cushion at M]
 *
 * The host picks one of the two locked values · the action stamps
 * wizard_state.finalize_catering_count.meta.final_count + the chosen
 * cushion mode (none / cushion_10pct) so a future iteration can wire
 * this into the caterer's per-event headcount field without re-asking.
 *
 * NO LINK out · the locked count is informational + the caterer
 * coordination still happens via the chat thread in iteration 0019.
 * A future iteration may surface this number on the caterer's
 * per-event workspace under iteration 0006.
 *
 * Per the WIZARD_TASKS task 31 brand-voice copy: "Caterers buy
 * ingredients 14 days out. Confirm your final headcount with the
 * kitchen team so the food matches the room." The card surfaces the
 * cushion suggestion as a friendly nudge · not a hard recommendation ·
 * the host stays in control.
 */

import { useState, useTransition } from 'react';
import { Users, CheckCircle2 } from 'lucide-react';
import { markTaskDone } from '../../wizard-actions';

type Props = {
  eventId: string;
  /** Number of guests whose rsvp_status === 'attending' on the event.
   *  Counted by the parent server component (page.tsx pulls guest
   *  stats anyway · we pass the already-computed `attending` field
   *  through). NULL or 0 = no RSVPs accepted yet · the card renders a
   *  polite empty state with copy that nudges the host to finalize
   *  Card 29 RSVP first. */
  rsvpAttendingCount: number;
  /** Total guest count (regardless of RSVP status). Used to anchor the
   *  "X of Y" copy when the attending count is below total. */
  rsvpTotalCount: number;
};

/** Compute the +10% cushion · always rounded UP because partial guests
 *  don't happen but partial chair-purchases lead to short-set
 *  surprises. */
function computeCushion(count: number): number {
  if (count <= 0) return 0;
  return Math.ceil(count * 1.1);
}

export function FinalizeCateringCountCard({
  eventId,
  rsvpAttendingCount,
  rsvpTotalCount,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Empty state · no attending RSVPs yet. The wizard sequence puts
  // Card 29 Finalize RSVP before Card 31 · this is a defensive
  // surface in case the host got here via direct state manipulation
  // OR the wizard resolver fires before the RSVP card has been
  // completed for some other reason.
  if (rsvpAttendingCount <= 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">No RSVPs accepted yet.</p>
          <p className="mt-1 text-amber-800/85">
            {rsvpTotalCount > 0
              ? `You have ${rsvpTotalCount} guest${rsvpTotalCount === 1 ? '' : 's'} on the list. Nudge the non-responders and confirm the final list before locking the catering count.`
              : 'Build your guest list and collect RSVPs first — the catering count flows from there.'}
          </p>
        </div>
        <p className="text-xs text-ink/55">
          Come back to this card once your RSVPs are in. The caterer needs
          the locked headcount about two weeks before the wedding.
        </p>
      </div>
    );
  }

  const cushion = computeCushion(rsvpAttendingCount);
  const cushionDelta = cushion - rsvpAttendingCount;

  function handleLock(finalCount: number, mode: 'none' | 'cushion_10pct') {
    setErrorMessage(null);
    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('task_id', 'finalize_catering_count');
    formData.set('meta_final_count', String(finalCount));
    formData.set('meta_rsvp_attending', String(rsvpAttendingCount));
    formData.set('meta_cushion_mode', mode);

    startTransition(async () => {
      try {
        await markTaskDone(formData);
        // WizardHero re-renders via revalidatePath · next focus card
        // transitions in-place.
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Couldn't lock the count. Try again.";
        setErrorMessage(message);
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Count summary · the load-bearing number + how it was derived. */}
      <div className="rounded-xl border border-ink/10 bg-white/60 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Users
            aria-hidden
            className="h-4 w-4 text-terracotta"
            strokeWidth={2}
          />
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            Your final count
          </p>
        </div>
        <p className="mt-3 font-display text-4xl italic leading-none text-ink sm:text-5xl">
          {rsvpAttendingCount}
          <span className="ml-2 font-sans text-base not-italic text-ink/55 sm:text-lg">
            guest{rsvpAttendingCount === 1 ? '' : 's'}
          </span>
        </p>
        <p className="mt-3 text-xs leading-relaxed text-ink/65">
          {rsvpAttendingCount} of {rsvpTotalCount} on your guest list have
          confirmed they&apos;re attending. Lock this number to send to your
          caterer.
        </p>
      </div>

      {/* Cushion suggestion · friendly nudge, not a hard recommendation.
          The buffer copy explains WHY the suggestion exists (plus-ones
          + late confirmations) so the host can make an informed call
          rather than guessing. */}
      {cushionDelta > 0 ? (
        <div className="rounded-xl border border-terracotta/30 bg-terracotta/5 p-4">
          <p className="text-sm leading-relaxed text-ink/80">
            Some couples add a <strong>10% buffer</strong> for plus-ones or
            late confirmations — that would make your number{' '}
            <strong>{cushion}</strong> (an extra {cushionDelta} cover
            {cushionDelta === 1 ? '' : 's'}). Your caterer will appreciate
            the heads-up either way.
          </p>
        </div>
      ) : null}

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {errorMessage}
        </p>
      ) : null}

      {/* Two CTAs · lock at exact count OR lock at cushioned count.
          The cushion CTA only renders when the +10% would actually
          add at least one guest (otherwise the two buttons would say
          the same number and look broken). */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => handleLock(rsvpAttendingCount, 'none')}
          disabled={isPending}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-terracotta px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-terracotta-700 focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
        >
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={2} />
          {isPending ? 'Saving…' : `Lock count at ${rsvpAttendingCount}`}
        </button>
        {cushionDelta > 0 ? (
          <button
            type="button"
            onClick={() => handleLock(cushion, 'cushion_10pct')}
            disabled={isPending}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-terracotta/40 bg-white px-4 py-2 text-sm font-medium text-terracotta transition-colors hover:bg-terracotta/5 focus:outline-none focus:ring-2 focus:ring-terracotta/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Lock count with cushion at {cushion}
          </button>
        ) : null}
      </div>

      <p className="text-xs leading-relaxed text-ink/55">
        Once locked, share this number with your caterer through your
        existing chat thread. The wizard moves on to your honeymoon plan
        next.
      </p>
    </div>
  );
}

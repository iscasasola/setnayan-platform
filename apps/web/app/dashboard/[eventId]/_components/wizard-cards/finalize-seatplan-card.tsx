'use client';

/**
 * WAVE 2 · Card 30 Finalize Seatplan · summary + mark-done.
 *
 * Iteration 0016 · CLAUDE.md Sixth 2026-05-23 row (V1 SCOPE EXPANSION).
 * Pure-confirmation pattern · the actual seating chart editor lives at
 * /dashboard/[eventId]/seating but this card does NOT link there per
 * the WAVE 2 hard constraint (NO LINKS). The card surfaces the
 * read-only summary computed by the parent server component and offers
 * ONE [Mark seatplan finalized] CTA.
 *
 * Pre-event default state: most couples open this card with 0 of N
 * guests seated — the wizard surfaces it inside the Final Month phase
 * (Phase 6 of the canonical 38-task sequence), so realistically only
 * couples 2-3 weeks out from their wedding will see the assigned count
 * climb. Brand-voice copy explains the typical PH timing ("most couples
 * finalize seating 2-3 weeks before the wedding — once your RSVPs are
 * firm").
 *
 * Per [[feedback_setnayan_no_dev_text_post_launch]] the copy reads as
 * polite editorial Filipino · no engineering jargon · no "TODO:
 * seating page is at /seating".
 *
 * The card NEVER blocks — even with 0 of 0 guests seated the host can
 * still click [Mark seatplan finalized]. The wizard is a planning
 * surface, not an event tracker. Audit context (assigned + total) gets
 * stashed in wizard_state.finalize_seatplan so a future surface can
 * surface "you finalized at 0/250 — review your seating" if needed.
 */

import { useState, useTransition } from 'react';
import { CheckCircle2, Users } from 'lucide-react';
import { completeFinalizeSeatplanTask } from '../../wizard-actions';

type Props = {
  eventId: string;
  /** Number of guests with seat assignments in event_seat_assignments.
   *  Computed by the parent server component via fetchAssignments. */
  assignedCount: number;
  /** Number of guests with rsvp_status='attending' on the event ·
   *  computed by the parent server component via fetchGuestsByEvent. */
  totalRsvpAccepted: number;
  /** Total guest count regardless of RSVP status · used for the
   *  "of N invited" framing when no RSVPs are in yet. */
  totalGuests: number;
  /** Number of tables placed in event_tables · used to gate the
   *  encouragement copy when the host hasn't built a chart yet. */
  tableCount: number;
};

export function FinalizeSeatplanCard({
  eventId,
  assignedCount,
  totalRsvpAccepted,
  totalGuests,
  tableCount,
}: Props) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Decide which framing to surface based on where the host is in
  // their seating workflow. Three honest states:
  //   - No tables built yet → encourage building chart first
  //   - Tables built but 0-1 RSVPs → encourage waiting for RSVPs
  //   - Tables built + RSVPs in → show the assigned/total ratio
  const denominator =
    totalRsvpAccepted > 0 ? totalRsvpAccepted : totalGuests;
  const denominatorLabel =
    totalRsvpAccepted > 0 ? 'RSVP-accepted guests' : 'invited guests';

  const showEncouragement = tableCount === 0 || totalRsvpAccepted === 0;

  function handleSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setErrorMessage(null);

    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('assigned_count', String(assignedCount));
    formData.set('total_rsvp_count', String(totalRsvpAccepted));

    startTransition(async () => {
      try {
        await completeFinalizeSeatplanTask(formData);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Couldn't finalize your seat plan. Try again.";
        setErrorMessage(message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Summary card · large numerator/denominator + table count beneath. */}
      <div className="rounded-xl border border-ink/10 bg-cream/60 p-5">
        <div className="flex items-center gap-2 pb-3">
          <Users
            aria-hidden
            className="h-3.5 w-3.5 text-terracotta"
            strokeWidth={2}
          />
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
            Where you stand
          </p>
        </div>
        <p className="font-display text-2xl italic leading-tight text-ink sm:text-3xl">
          {assignedCount} of {denominator} guests seated
        </p>
        <p className="mt-1 text-xs text-ink/55">
          {tableCount} {tableCount === 1 ? 'table' : 'tables'} placed ·{' '}
          {denominatorLabel}
        </p>
      </div>

      {/* Encouragement copy when the host clicks through early. */}
      {showEncouragement ? (
        <div className="rounded-md border border-amber-300/50 bg-amber-50/50 px-3 py-2.5">
          <p className="text-sm leading-relaxed text-ink/75">
            {tableCount === 0 ? (
              <>
                Most couples finalize seating 2–3 weeks before the wedding —
                once your RSVPs are firm. Build your seating chart on the
                Seat Plan surface anytime, then come back here to lock it.
              </>
            ) : (
              <>
                Most couples finalize seating 2–3 weeks before the wedding —
                once your RSVPs are firm. You can come back here anytime to
                lock it in.
              </>
            )}
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

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-mulberry px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-700 focus:outline-none focus:ring-2 focus:ring-mulberry focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            'Saving…'
          ) : (
            <>
              <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={2} />
              Mark seatplan finalized
            </>
          )}
        </button>
      </div>

      <p className="text-xs leading-relaxed text-ink/55">
        Locking now stamps the moment for your stylist and coordinator —
        you can still tweak individual seats after this.
      </p>
    </form>
  );
}

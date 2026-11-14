import Link from 'next/link';
import { ArrowLeft, Lock, MessageSquare, Wallet } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import {
  feeLockCopy,
  VENDOR_FEE_LOCK_TESTID,
  type EventAccessDecision,
  type EventAccessStage,
  type WithheldBriefField,
} from '@/lib/event-access-stage';
import {
  VENDOR_BOOKING_FEES_PATH,
  vendorBookingFeePayPath,
} from '@/lib/vendor-booking-fees';

/**
 * WHAT A LOCKED SCREEN SAYS — never a blank page, never a 404, never a silent
 * empty state.
 *
 * The owner's frame: a locked supplier must always be able to TALK and to PAY.
 * So this panel is not a dead end — it carries the amount, the due date, the
 * pay button, and a link back into the conversation. It is also the ONLY place
 * that tells a supplier a field was WITHHELD rather than empty: every redaction
 * in `redactBriefForStage` is shape-preserving, so without this line a wedding
 * with a withheld timeline renders exactly like a wedding with no timeline.
 *
 * 🔑 THE MEASUREMENT MUST REACH THE RENDER. `withheld` comes straight from the
 * redaction that produced the screen — it is not a second list somebody has to
 * remember to update.
 */
export function EventLockedByFee({
  stage,
  access,
  withheld,
  threadId,
  className,
}: {
  stage: EventAccessStage;
  access: EventAccessDecision;
  withheld: readonly WithheldBriefField[];
  /** The couple's thread, so "talk to them" is one click. */
  threadId?: string | null;
  className?: string;
}) {
  if (stage === 'unlocked') return null;
  const { headline, detail, cta } = feeLockCopy({
    stage,
    owed: access.owed,
    withheld,
    reason: access.reason,
  });
  const payHref = access.owed?.orderId
    ? vendorBookingFeePayPath(access.owed.orderId)
    : VENDOR_BOOKING_FEES_PATH;

  return (
    <section
      data-testid={VENDOR_FEE_LOCK_TESTID}
      className={`rounded-2xl bg-[color:var(--m-paper-2)] p-4 sm:p-5 ${className ?? ''}`}
    >
      <div className="flex items-start gap-3">
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-[17px] font-bold text-ink">{headline}</h2>
          <p className="mt-1 text-[15px] text-ink/70">{detail}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {cta ? (
              <ActionButton tone="brand" main href={payHref} icon={<Wallet className="h-4 w-4" aria-hidden />} label={cta} />
            ) : null}
            {threadId ? (
              <ActionButton
                tone="info"
                href={`/vendor-dashboard/messages/${threadId}`}
                icon={<MessageSquare className="h-4 w-4" aria-hidden />}
                label="Message the couple"
              />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * A WHOLE PAGE that is locked — the six per-event workrooms (mood board, seat
 * plan, production sheet, cocktail, challenge photos, editorial media), the
 * Event Hub console and the per-event Papic desk.
 *
 * 🚨 IT RETURNS A PAGE, NOT A REDIRECT AND NOT A 404. Those surfaces already
 * `redirect()` when the brief refuses, so a locked supplier bounced silently
 * back to the client list would read as "this page is broken" — the exact
 * failure-that-looks-like-something-else class the repo keeps paying for. The
 * supplier is told the amount, the due date and where to pay it, and keeps a
 * way back to the booking (whose money tab and conversation stay open).
 */
export function EventLockedPage({
  eventId,
  gate,
  withheld = [],
  threadId,
  backHref,
  backLabel = 'Back to the booking',
}: {
  eventId: string;
  gate: { stage: EventAccessStage; access: EventAccessDecision };
  withheld?: readonly WithheldBriefField[];
  threadId?: string | null;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href={backHref ?? `/vendor-dashboard/clients/${eventId}`}
        className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm text-ink/70 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {backLabel}
      </Link>
      <EventLockedByFee
        stage={gate.stage}
        access={gate.access}
        withheld={withheld}
        threadId={threadId}
      />
    </section>
  );
}

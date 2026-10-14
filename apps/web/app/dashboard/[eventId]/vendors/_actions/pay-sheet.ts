'use server';

/**
 * loadPaySheet — the ONE request the Booked body's Pay sheet makes when it
 * opens (owner 2026-10-07; corpus `SUPPLIERS_BUILD_PLAN_2026-10-07_fable.md`
 * § PR4 "Pay sheet"; the minimum-request rules of 2026-10-08: nothing is read
 * for a sheet nobody opened, and the page is never re-rendered to open one).
 *
 * It READS, and only what the supplier's workspace already reads for its
 * Payments tab, through the same three helpers:
 *
 *   readBookedMoney                 the next money step (`moneyStep`), the
 *                                   payment history, the deposit's markers and
 *                                   the couple's own receipt (signed there)
 *   readPublishedMethodsForCouple   where the supplier asks to be paid — it
 *                                   proves the couple owns the booking itself
 *   fetchPlanProgressForCouple      the supplier's payment plan, with the
 *                                   couple's payments folded in
 *
 * The mapping onto the payment card's props is the chat thread's own
 * (`messages/[threadId]/page.tsx`, `couplePay`), so the three places a couple
 * can pay from — the workspace, the chat, and this sheet — mount ONE card on
 * ONE reading.
 *
 * Nothing is written here. Recording a payment is the card's own
 * `recordDeposit` / `logScheduledPayment`.
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { readBookedMoney } from '@/lib/booked-money-step.server';
import { readPublishedMethodsForCouple } from '@/lib/vendor-payment-methods.server';
import { fetchPlanProgressForCouple } from '@/lib/vendor-service-payment-schedules.server';
import { firstPaymentSentence, paymentScheduleSource } from '@/lib/accepted-quote-terms';
import type { CoupleFacingMethod } from '@/lib/vendor-payment-methods';
import type { LoadPaySheetResult } from '@/lib/pay-sheet';

export async function loadPaySheet(input: {
  eventId: string;
  /** `event_vendors.vendor_id`. */
  vendorId: string;
  /** The name the row already shows — only echoed into the card's sentences. */
  vendorName: string;
}): Promise<LoadPaySheetResult> {
  const eventId = String(input.eventId ?? '').trim();
  const vendorId = String(input.vendorId ?? '').trim();
  const vendorName = String(input.vendorName ?? '').trim().slice(0, 120) || 'your supplier';
  if (!eventId || !vendorId) return { status: 'error' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'not_signed_in' };

  // The couple's own RLS decides whether this booking is theirs to read: a
  // booking on somebody else's event resolves to no row, never to a leak.
  const [booking, event] = await Promise.all([
    supabase
      .from('event_vendors')
      .select('vendor_id, marketplace_vendor_id')
      .eq('event_id', eventId)
      .eq('vendor_id', vendorId)
      .maybeSingle(),
    supabase.from('events').select('event_date').eq('event_id', eventId).maybeSingle(),
  ]);
  if (booking.error) {
    logQueryError('loadPaySheet.booking', booking.error, { event_id: eventId }, 'graceful_degrade');
    return { status: 'error' };
  }
  if (!booking.data) return { status: 'error' };
  if (event.error) logQueryError('loadPaySheet.eventDate', event.error, { event_id: eventId }, 'graceful_degrade');
  const eventDate = (event.data as { event_date?: string | null } | null)?.event_date ?? null;
  const own = (booking.data as { marketplace_vendor_id: string | null }).marketplace_vendor_id == null;

  const [money, methods, plan] = await Promise.all([
    readBookedMoney(supabase, { eventId, eventVendorId: vendorId, eventDate, viewer: 'couple', otherName: vendorName }),
    readPublishedMethodsForCouple({
      authedClient: supabase,
      adminClient: createAdminClient(),
      eventId,
      eventVendorId: vendorId,
    }).catch(() => ({ state: 'unreadable' as const, methods: [] as CoupleFacingMethod[] })),
    fetchPlanProgressForCouple({ authedClient: supabase, eventId, eventVendorId: vendorId }).catch(
      () => 'unreadable' as const,
    ),
  ]);
  if (money.step.kind === 'not_booked') return { status: 'not_booked' };
  // The booking row could not be read: the card would have nothing true to say.
  if (!money.deposit) return { status: 'error' };

  // ONE schedule per booking — the rule the workspace's Payments tab follows
  // (`paymentScheduleSource`): a real plan wins; an estimated one yields to the
  // quote the couple accepted.
  const scheduleSource =
    plan === 'unreadable'
      ? money.terms && money.terms.schedule.length > 0
        ? ('quote' as const)
        : ('none' as const)
      : paymentScheduleSource({
          planStepCount: plan.steps?.length ?? null,
          planIsEstimate: Boolean(plan.isDefaultSeeded),
          acceptedQuote: money.terms,
        });

  return {
    status: 'ok',
    data: {
      own,
      plan,
      scheduleSource,
      quoteSchedule:
        scheduleSource === 'quote' && money.terms
          ? money.terms.schedule.map((r) => ({ label: r.label, dueText: r.dueText, amountCentavos: r.amountCentavos }))
          : null,
      depositRecordedAt: money.deposit.recordedAt,
      depositAcknowledgedAt: money.deposit.acknowledgedAt,
      depositProofUrl: money.deposit.proofUrl,
      depositDeclinedAt: money.deposit.declinedAt,
      depositDeclineReason: money.deposit.declineReason,
      payMethods: methods.methods,
      payMethodsState: methods.state,
      requestedFirstPaymentCentavos: money.terms?.firstPaymentCentavos ?? null,
      requestedFirstPaymentSentence: firstPaymentSentence(money.terms),
      requestedTermsUnreadable: money.termsUnreadable,
      step: money.step,
      history: money.history,
    },
  };
}

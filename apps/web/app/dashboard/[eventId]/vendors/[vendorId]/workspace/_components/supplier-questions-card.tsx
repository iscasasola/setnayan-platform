import { MessageCircleQuestion } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { createAdminClient } from '@/lib/supabase/admin';
import { readCoupleBookingStandings } from '@/lib/couple-booked-and-settled.server';
import {
  buildQuestionnaire,
  type Questionnaire,
  type QuestionAnswer,
  type VendorQuestion,
} from '@/lib/emcee-questions';
import { formatCount } from '@/lib/format-number';
import { SUPPLIER_QUESTIONS_ANCHOR } from '@/lib/supplier-questions-href';
import { InfoTip } from '@/app/_components/info-tip';
import { SupplierAnswersForm } from './supplier-answers-form';

/**
 * ❓ "{SHOP} ASKS" — the couple answers ONE supplier's questions, in that supplier's room in their event.
 *
 * Owner 2026-11-04, verbatim "Yes, every supplier" (DECISION_LOG "QUESTIONS FOR THE COUPLE — EVERY SUPPLIER, NOT
 * HOSTS ONLY"). The host's questions were answered on the Schedule, inside its "Host / MC" sheet — a host-only place
 * (`schedule/_components/host-questions.tsx`, unchanged). Every supplier's are answered HERE, on the Details tab of
 * `/dashboard/[eventId]/vendors/[vendorId]/workspace`: the one room per supplier the couple already has, labelled
 * with the shop's name, which every trade has and every notice can deep-link (`#supplier-questions`).
 *
 * WHEN IT SHOWS — the supplier asks something AND either:
 *   • the booking is BOOKED and settled (`readCoupleBookingStandings`, the same "no handshake, no access" rule
 *     `findBookedHost` uses — a merely shortlisted supplier's set does not appear on its own), or
 *   • the supplier SENT their set into this event from the chat (`event_question_requests`).
 * Otherwise it renders nothing — no empty panel, no advert.
 *
 * A refused read SAYS so and never draws the form: an unread answer drawn as an empty box would be saved as a clear.
 */
export async function SupplierQuestionsCard({
  supabase,
  eventId,
  eventVendorId,
  vendorProfileId,
  shopName,
}: {
  supabase: SupabaseClient;
  eventId: string;
  eventVendorId: string;
  vendorProfileId: string;
  shopName: string;
}) {
  const [qRes, aRes, askRes] = await Promise.all([
    supabase
      .from('vendor_questions')
      .select('question_id, vendor_profile_id, prompt, hint, is_asked, display_order')
      .eq('vendor_profile_id', vendorProfileId)
      .order('display_order', { ascending: true }),
    supabase
      .from('event_question_answers')
      .select('event_id, question_id, answer, updated_at')
      .eq('event_id', eventId),
    supabase
      .from('event_question_requests')
      .select('sent_at')
      .eq('event_id', eventId)
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle(),
  ]);
  const error = qRes.error ?? aRes.error ?? askRes.error;
  if (error) {
    logQueryError('SupplierQuestionsCard.read', error, { event_id: eventId }, 'graceful_degrade');
    return <SupplierQuestionsUnread shopName={shopName} />;
  }

  const questionnaire = buildQuestionnaire(
    (qRes.data ?? []) as VendorQuestion[],
    (aRes.data ?? []) as QuestionAnswer[],
  );
  if (questionnaire.rows.length === 0) return null;

  const asked = Boolean(askRes.data);
  if (!asked) {
    const standings = await readCoupleBookingStandings(createAdminClient(), [eventVendorId]);
    if (standings.get(eventVendorId)?.standing !== 'booked') return null;
  }

  return (
    <SupplierQuestionsBody
      eventId={eventId}
      eventVendorId={eventVendorId}
      vendorProfileId={vendorProfileId}
      shopName={shopName}
      questionnaire={questionnaire}
    />
  );
}

/** The drawing, from plain props — also what `/dev/questions-lab` renders. */
export function SupplierQuestionsBody({
  eventId,
  eventVendorId,
  vendorProfileId,
  shopName,
  questionnaire,
}: {
  eventId: string;
  eventVendorId: string;
  vendorProfileId: string;
  shopName: string;
  questionnaire: Questionnaire;
}) {
  const remaining = questionnaire.total - questionnaire.answered;
  return (
    <section id={SUPPLIER_QUESTIONS_ANCHOR} className="scroll-mt-4 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-[17px] font-semibold text-ink">
          <MessageCircleQuestion aria-hidden className="h-4 w-4 text-sn-accent" strokeWidth={1.9} />
          {shopName} asks
        </h2>
        <span className="text-[13px] text-ink/60">
          {remaining === 0
            ? 'All answered'
            : `${formatCount(questionnaire.answered)} of ${formatCount(questionnaire.total)} answered`}
        </span>
      </div>
      {/* ⓘ One short line visible; who reads it inside the tip (house rule). */}
      <InfoTip
        label="Things only you can tell them."
        labelAs="p"
        labelClassName="text-[14px] text-ink/70"
        align="start"
      >
        Only the two of you and {shopName} can read these — not your guests, not your other suppliers, not your
        coordinator. Your answers stay with this event.
      </InfoTip>
      <SupplierAnswersForm
        eventId={eventId}
        vendorProfileId={vendorProfileId}
        returnPath={`/dashboard/${eventId}/vendors/${eventVendorId}/workspace`}
        shopName={shopName}
        rows={questionnaire.rows.map(({ question, answer }) => ({
          questionId: question.question_id,
          prompt: question.prompt,
          hint: question.hint,
          answer,
        }))}
      />
    </section>
  );
}

function SupplierQuestionsUnread({ shopName }: { shopName: string }) {
  return (
    <p role="alert" className="rounded-2xl border-t-[3px] border-mulberry/70 bg-mulberry/5 p-4 text-sm text-ink/70">
      <strong className="text-ink">We couldn&rsquo;t load {shopName}&rsquo;s questions.</strong> Anything you already
      answered is safe. Reload in a moment.
    </p>
  );
}

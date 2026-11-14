import Link from 'next/link';
import { MessageCircleQuestion } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  buildQuestionnaire,
  type Questionnaire,
  type QuestionAnswer,
  type VendorQuestion,
} from '@/lib/emcee-questions';
import { ShopCard } from '../../../_components/kit';
import { formatCount } from '@/lib/format-number';

/**
 * WHAT THEY TOLD YOU — the couple's answers to THIS supplier's questions, on that customer's card.
 *
 * Born inside the host's Script tab (DAY-7). ❓ EVERY SUPPLIER since 2026-11-04 (owner, verbatim "Yes, every
 * supplier"; DECISION_LOG "QUESTIONS FOR THE COUPLE — EVERY SUPPLIER, NOT HOSTS ONLY"): the renderer lives here so
 * the Script tab (host) and the Details tab (every other trade) draw the SAME thing, and {@link CoupleAnswers} is the
 * one read for a supplier who has no Script tab.
 *
 * Three honest states: a refused read SAYS so (never an empty "no answers"); no questions yet points them to where
 * they write them; unanswered ones are listed as still open, so they know what to chase.
 *
 * RLS decides what comes back: own questions only, and answers only while booked on the event or after sending the
 * set into it from the chat (`event_question_answers_booked_vendor_select` / `_asked_vendor_select`).
 */
export function TheyToldYou({
  coupleName,
  unread,
  questionnaire,
}: {
  coupleName: string;
  unread: boolean;
  questionnaire: Questionnaire;
}) {
  if (unread) {
    return (
      <p role="alert" className="py-2 text-[15px] text-warn-800">
        <strong className="font-semibold">We couldn&rsquo;t load {coupleName}&rsquo;s answers.</strong>{' '}
        Whatever they told you is still there — reload in a moment.
      </p>
    );
  }
  if (questionnaire.rows.length === 0) {
    return (
      <p className="text-xs text-ink/70">
        Ask {coupleName} what only they can tell you —{' '}
        <Link href="/vendor-dashboard/activities#questions" className="underline">
          write your questions once
        </Link>{' '}
        and every couple you work with answers them.
      </p>
    );
  }
  return (
    <ShopCard pad="none" className="p-3">
      <div id="their-answers" className="flex scroll-mt-4 flex-wrap items-baseline justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.2em] text-gold-dark">
          <MessageCircleQuestion className="h-3.5 w-3.5" aria-hidden />
          What {coupleName} told you
        </p>
        <span className="font-mono text-xs uppercase tracking-[0.16em] text-ink/70">
          {formatCount(questionnaire.answered)} of {formatCount(questionnaire.total)} answered
        </span>
      </div>
      <dl className="mt-2 space-y-2.5">
        {questionnaire.rows.map(({ question, answer }) => (
          <div key={question.question_id}>
            <dt className="text-xs font-semibold text-ink/70">{question.prompt}</dt>
            <dd
              className={
                answer
                  ? 'mt-0.5 whitespace-pre-line text-sm text-ink'
                  : 'mt-0.5 text-xs italic text-ink/70'
              }
            >
              {answer ?? 'Not answered yet.'}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-ink/70">
        Only you and {coupleName} read these. They stay with this event —{' '}
        <Link href="/vendor-dashboard/activities#questions" className="underline">
          your questions
        </Link>{' '}
        carry on to the next.
      </p>
    </ShopCard>
  );
}

/** The two reads, under the CALLER's client — RLS scopes both. */
export async function readCoupleAnswers(
  supabase: SupabaseClient,
  eventId: string,
  vendorProfileId: string,
): Promise<{ unread: boolean; questionnaire: Questionnaire }> {
  const [questionsRes, answersRes] = await Promise.all([
    supabase
      .from('vendor_questions')
      .select('question_id, vendor_profile_id, prompt, hint, is_asked, display_order')
      .eq('vendor_profile_id', vendorProfileId)
      .is('form_id', null),
    supabase
      .from('event_question_answers')
      .select('event_id, question_id, answer, updated_at')
      .eq('event_id', eventId),
  ]);
  const error = questionsRes.error ?? answersRes.error;
  if (error) {
    logQueryError('CoupleAnswers.read', error, { event_id: eventId }, 'graceful_degrade');
  }
  return {
    unread: Boolean(error),
    questionnaire: buildQuestionnaire(
      (questionsRes.data ?? []) as VendorQuestion[],
      (answersRes.data ?? []) as QuestionAnswer[],
    ),
  };
}

/** The customer card's answers section for a supplier with no Script tab (every trade but the host). */
export async function CoupleAnswers({
  supabase,
  eventId,
  vendorProfileId,
  coupleName,
}: {
  supabase: SupabaseClient;
  eventId: string;
  vendorProfileId: string;
  coupleName: string;
}) {
  const { unread, questionnaire } = await readCoupleAnswers(supabase, eventId, vendorProfileId);
  return <TheyToldYou coupleName={coupleName} unread={unread} questionnaire={questionnaire} />;
}

import { Lock, MessageCircleQuestion } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { findBookedHost } from '@/lib/booked-host';
import {
  buildQuestionnaire,
  ANSWER_MAX,
  type QuestionAnswer,
  type VendorQuestion,
} from '@/lib/emcee-questions';
import { saveHostAnswers } from '../question-answers-actions';

/**
 * HOST QUESTIONS — the couple answers what only they can tell their emcee.
 * (Register row DAY-7; spec `Emcee_Script_System_BUILD_SPEC_2026-07-29.md` § 8.)
 *
 * Above all: how to SAY the names. A booked host cannot read the guest list,
 * so the sponsor names he calls up arrive here, spelled the way they sound.
 *
 * RENDERS NOTHING without a booked host who asks something — no empty panel,
 * no advert for a supplier they do not have. Sits directly under the host's
 * segments ({@link EmceePicks}); a refused read SAYS so rather than vanishing.
 *
 * WHO READS THE ANSWERS is stated on screen because it is the whole trust
 * question: the couple and that host — not guests, not other suppliers, not
 * the coordinator (spec § 11 Q4 approval is not built, so no lane exists).
 */
export async function HostQuestions({
  supabase,
  eventId,
  flash,
}: {
  supabase: SupabaseClient;
  eventId: string;
  flash?: string;
}) {
  const lookup = await findBookedHost(supabase, eventId, 'HostQuestions');
  if (lookup.state === 'none') return null;
  if (lookup.state === 'unread') return <HostQuestionsUnread />;
  const host = lookup.host;

  const [qRes, aRes] = await Promise.all([
    supabase
      .from('vendor_questions')
      .select('question_id, vendor_profile_id, prompt, hint, is_asked, display_order')
      .eq('vendor_profile_id', host.vendor_profile_id)
      .order('display_order', { ascending: true }),
    supabase
      .from('event_question_answers')
      .select('event_id, question_id, answer, updated_at')
      .eq('event_id', eventId),
  ]);
  if (qRes.error || aRes.error) {
    // An unread answer rendered as an empty box would be SAVED as a clear on
    // the next submit — so a refusal must never draw the form at all.
    logQueryError(
      'HostQuestions.read',
      qRes.error ?? aRes.error,
      { event_id: eventId },
      'graceful_degrade',
    );
    return <HostQuestionsUnread />;
  }

  const questionnaire = buildQuestionnaire(
    (qRes.data ?? []) as VendorQuestion[],
    (aRes.data ?? []) as QuestionAnswer[],
  );
  if (questionnaire.rows.length === 0) return null;

  const hostName = host.business_name ?? 'Your host';
  const remaining = questionnaire.total - questionnaire.answered;

  return (
    <section id="host-questions" className="sn-row scroll-mt-4 space-y-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 font-mono text-[0.66rem] uppercase tracking-[0.28em] text-ink/70">
          <MessageCircleQuestion aria-hidden className="h-3.5 w-3.5 text-gild" strokeWidth={1.9} />
          {hostName} asks
        </h2>
        <span className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-ink/55">
          {remaining === 0
            ? 'All answered'
            : `${questionnaire.answered} of ${questionnaire.total} answered`}
        </span>
      </div>

      <p className="max-w-prose text-sm leading-relaxed text-ink/70">
        Things only you can tell your host — most of all, how to say the names they will read
        out loud. Spell them the way they sound.
      </p>
      <p className="flex items-start gap-2 text-xs leading-relaxed text-ink/60">
        <Lock aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gild" strokeWidth={1.9} />
        Only the two of you and {hostName} can read these — not your guests, not your other
        suppliers, not your coordinator.
      </p>

      {flash === 'saved' ? (
        <p role="status" className="border border-sage/30 bg-sage/10 px-3 py-2 text-sm text-ink/80">
          Saved — {hostName} can read your answers now.
        </p>
      ) : flash === 'error' ? (
        <p role="alert" className="border border-terracotta-700/40 bg-terracotta-700/5 px-3 py-2 text-sm text-terracotta-700">
          We couldn&rsquo;t save every answer. Nothing you typed before was lost — please try
          again.
        </p>
      ) : null}

      <form action={saveHostAnswers} className="space-y-3">
        <input type="hidden" name="event_id" value={eventId} />
        {questionnaire.rows.map(({ question, answer }) => (
          <label key={question.question_id} className="block space-y-1">
            <span className="block text-sm font-medium text-ink">{question.prompt}</span>
            {question.hint ? (
              <span className="block text-xs leading-relaxed text-ink/55">{question.hint}</span>
            ) : null}
            <textarea
              name={`answer:${question.question_id}`}
              defaultValue={answer ?? ''}
              rows={3}
              maxLength={ANSWER_MAX}
              className="w-full border border-ink/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/40"
            />
          </label>
        ))}
        <button
          type="submit"
          className="bg-ink px-4 py-2.5 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-paper transition-opacity hover:opacity-90"
        >
          Save answers
        </button>
      </form>
    </section>
  );
}

function HostQuestionsUnread() {
  return (
    <p
      role="alert"
      className="rounded-2xl border-t-[3px] border-mulberry/70 bg-mulberry/5 p-4 text-sm text-ink/70"
    >
      <strong className="text-ink">We couldn&rsquo;t load your host&rsquo;s questions.</strong>{' '}
      Anything you already answered is safe. Reload in a moment.
    </p>
  );
}

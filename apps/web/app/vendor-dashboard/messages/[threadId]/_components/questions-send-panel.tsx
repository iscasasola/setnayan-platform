import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { askedQuestions, type VendorQuestion } from '@/lib/emcee-questions';
import { formatCount } from '@/lib/format-number';
import { dayMonth } from '@/lib/format-date';
import { readCoupleAnswers } from '@/app/vendor-dashboard/clients/[eventId]/_components/couple-answers';
import { SendQuestionsButton } from './send-questions-button';

/**
 * ❓ QUESTIONS FOR THE COUPLE — the chat ＋ panel (owner 2026-11-04, verbatim "Yes, every supplier"; prototype
 * `Supplier Four-Tab Dashboard` › ＋ › "Their event · for your service" › Questions for the couple).
 *
 * The supplier's own set (written once, at `/vendor-dashboard/activities#questions`), and the one press that sends
 * it into THIS event. Mounted once in the thread page's tool tray (`toolNodes['questions-for-couple']`), revealed by
 * the ＋ row. Three honest states: a refused read says so; no questions yet says where to write them; otherwise the
 * set, where it stands (not sent · sent on … · N of M answered), and Send.
 */
export async function QuestionsSendPanel({
  supabase,
  threadId,
  eventId,
  vendorProfileId,
  coupleName,
}: {
  supabase: SupabaseClient;
  threadId: string;
  eventId: string;
  vendorProfileId: string;
  coupleName: string;
}) {
  const [questionsRes, askRes, answers] = await Promise.all([
    supabase
      .from('vendor_questions')
      .select('question_id, vendor_profile_id, prompt, hint, is_asked, display_order')
      .eq('vendor_profile_id', vendorProfileId)
      .is('form_id', null),
    supabase
      .from('event_question_requests')
      .select('sent_at')
      .eq('event_id', eventId)
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle(),
    readCoupleAnswers(supabase, eventId, vendorProfileId),
  ]);
  const error = questionsRes.error ?? askRes.error;
  if (error) {
    logQueryError('QuestionsSendPanel.read', error, { event_id: eventId }, 'graceful_degrade');
    return (
      <p role="alert" className="text-sm text-ink/70">
        <strong className="text-ink">We couldn&rsquo;t load your questions.</strong> Nothing was sent or lost —
        reload in a moment.
      </p>
    );
  }
  return (
    <QuestionsSendBody
      threadId={threadId}
      coupleName={coupleName}
      asked={askedQuestions((questionsRes.data ?? []) as VendorQuestion[])}
      sentAt={(askRes.data as { sent_at: string } | null)?.sent_at ?? null}
      answered={answers.unread ? null : answers.questionnaire.answered}
    />
  );
}

/** The drawing, from plain props — also what `/dev/questions-lab` renders. */
export function QuestionsSendBody({
  threadId,
  coupleName,
  asked,
  sentAt,
  answered,
}: {
  threadId: string;
  coupleName: string;
  asked: readonly Pick<VendorQuestion, 'question_id' | 'prompt'>[];
  sentAt: string | null;
  /** null = the answers could not be read; never drawn as "0 answered". */
  answered: number | null;
}) {
  if (asked.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-ink/70">
        You have no questions yet.{' '}
        <Link href="/vendor-dashboard/activities#questions" className="font-semibold text-sn-accent underline-offset-4 hover:underline">
          Write your questions
        </Link>{' '}
        once — then send them to every couple from here.
      </p>
    );
  }
  const status = sentAt
    ? `Sent ${dayMonth(sentAt)}${answered === null ? '' : ` · ${formatCount(answered)} of ${formatCount(asked.length)} answered`}`
    : 'Not sent yet';
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-ink/60">
        {formatCount(asked.length)} question{asked.length === 1 ? '' : 's'} · {status}
      </p>
      <ol className="divide-y divide-ink/10">
        {asked.map((q, i) => (
          <li key={q.question_id} className="flex gap-2 py-2 text-[14px] leading-snug text-ink">
            <span className="w-5 shrink-0 text-ink/45">{i + 1}.</span>
            <span className="min-w-0 flex-1">{q.prompt}</span>
          </li>
        ))}
      </ol>
      <SendQuestionsButton threadId={threadId} coupleName={coupleName} alreadySent={Boolean(sentAt)} />
    </div>
  );
}

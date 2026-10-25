import Link from 'next/link';
import { CheckCircle2, CircleDashed, XCircle } from 'lucide-react';
import { threadDayIsOpen, threadDayWords, type ThreadDayAnswer } from '@/lib/thread-day-answer';
import { dayTitle, daySheetHref } from '@/lib/vendor-dates';
import { SubmitButton } from '@/app/_components/submit-button';
import { AnswerAskButton } from './thread-tools-sheet';

/**
 * THE ANSWER LINE AT THE TOP OF THE CONVERSATION (simpler supplier dashboard step 4; prototype `SCREENS.thread`:
 * the couple's initials · "Sat 12 Dec · Free"). Their date is a door to that day on Dates; the word is the day read off
 * the supplier's OWN schedules (`lib/thread-day-answer.ts`), with its icon and colour (house rule: status = icon +
 * colour + 1–2 words). While their booking ask is open, the one tap that answers it sits on the same line.
 *
 * Server-safe; the thread page and the dev lab (`/dev/supplier-chat-lab`) draw the same line.
 */
export function ThreadAnswerLine({
  initials,
  eventDay,
  todayIso,
  answer,
  askOpen,
}: {
  initials: string;
  /** The couple's date (`YYYY-MM-DD`), or null. */
  eventDay: string | null;
  todayIso: string;
  /** Null = the read could not answer → the date alone, never a guessed "Free". */
  answer: ThreadDayAnswer | null;
  askOpen: boolean;
}) {
  const words = answer ? threadDayWords(answer) : null;
  const Icon = words?.tone === 'ok' ? CheckCircle2 : words?.tone === 'danger' ? XCircle : CircleDashed;
  return (
    <div data-thread-day-answer={answer?.kind ?? 'unknown'} className="flex min-h-[56px] items-center gap-3 border-b border-ink/10 px-3 py-2 sm:px-4">
      <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sn-accent/10 text-[13px] font-semibold text-ink">
        {initials}
      </span>
      <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 text-[15px] text-ink">
        {eventDay ? (
          <Link href={daySheetHref(eventDay)} className="inline-flex min-h-11 items-center font-medium underline-offset-2 hover:underline">
            {dayTitle(todayIso, eventDay)}
          </Link>
        ) : null}
        {words ? (
          <>
            {eventDay ? <span aria-hidden className="text-ink/40">·</span> : null}
            <b
              className={`inline-flex items-center gap-1 font-semibold ${
                words.tone === 'ok' ? 'text-success-700' : words.tone === 'danger' ? 'text-danger-700' : 'text-ink/60'
              }`}
            >
              <Icon aria-hidden className="h-4 w-4" strokeWidth={2} />
              {words.word}
            </b>
          </>
        ) : null}
      </p>
      {askOpen ? <AnswerAskButton /> : null}
    </div>
  );
}

/**
 * QUICK REPLIES (prototype "Yes po, that day is free · Let me check and reply today · Sending our price now"). Each is
 * the shipped send (`sendChatMessage`) as a plain form — it works without JavaScript and lands back in the thread.
 * "Yes po, that day is free" is offered ONLY on a day the answer line calls open: a canned yes over a full day is a
 * promise the lock will refuse.
 */
export function quickRepliesFor(answer: ThreadDayAnswer | null): string[] {
  return [...(threadDayIsOpen(answer) ? ['Yes po, that day is free'] : []), 'Let me check and reply today', 'Sending our price now'];
}

export function QuickReplies({
  threadId,
  replies,
  sendAction,
}: {
  threadId: string;
  replies: readonly string[];
  sendAction: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-0.5" data-quick-replies="">
      {replies.map((q) => (
        <form key={q} action={sendAction} className="shrink-0">
          <input type="hidden" name="thread_id" value={threadId} />
          <input type="hidden" name="body" value={q} />
          <input type="hidden" name="return_to" value={`/vendor-dashboard/messages/${threadId}`} />
          <SubmitButton
            pendingLabel="Sending…"
            className="sn-press inline-flex min-h-11 items-center whitespace-nowrap rounded-full border border-ink/15 bg-ink/[0.04] px-4 text-sm text-ink hover:border-ink/30"
          >
            {q}
          </SubmitButton>
        </form>
      ))}
    </div>
  );
}

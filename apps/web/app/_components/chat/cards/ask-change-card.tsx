'use client';

/**
 * 💬 ASK FOR A CHANGE — the hosts' side never edits a price (Supplier Build 3 · lane C; prototype v8.3 `quoteCard`).
 *
 * Owner, 8 Nov: only the supplier edits; the host and the coordinator get "Ask for a change", which the supplier
 * revises or declines; it is refused while the item is locked. Two parts:
 *   · `AskChangeDoor` — under a live quote card (hosts' side) or a final form: ① What should change? (Quotation ·
 *     Payment plan, the locked ones left out) → ② A short note → Send. A locked item is not offered at all: the door
 *     says "<supplier>'s price is final". The database refuses a locked item and the shop's own team anyway
 *     (`ask_for_a_change`, migration 20271332041210).
 *   · `ChangeAskCard` — drawn under the system line the ask posts. The supplier answers Revise (opens the Change quote
 *     card — the new version IS the revision) or Decline; the hosts see where it stands.
 *
 * ✋ AN ASK STARTS FROM THE PART (owner, ruling 6076). The (+) no longer carries a blank "Ask for a change" row. On the
 * live quote the door IS the quote's lines (`QuoteCardLines` with `onAsk`) and a Payment plan row: tapping one opens
 * the steps already attached to it — only "What should change?" is left to say — and the part travels in the ask
 * (`askNoteWithPart`). Under a sent form the door is attached to that form (`formId`, its title as the part).
 */
import { useCallback, useEffect, useId, useState } from 'react';
import { Check, ChevronRight, MessageCircleQuestion, PencilLine, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { TypedRow } from '@/app/_components/form-row';
import { patchPlus } from '@/lib/chat-plus-store';
import { askForAChange, askNoteWithPart, askPartWords, ASK_SUBJECT_WORD, type AskPart, type AskSubject } from '@/lib/chat-cards';
import { QuoteCardLines, type QuoteCardLine } from '@/app/_components/quote-card-lines';
import { ChatCardShell, ChatStepCard, type ChatCardStep } from '../chat-step-card';
import { answerChangeAskFromChat, askForAChangeFromChat, loadChangeAsks, type ChangeAskRow } from './card-calls';
import { CouldNotLoad, EqualRow, Loading, Problem, type Read } from './card-bits';

export function AskChangeDoor({
  threadId,
  supplierName,
  proposalId = null,
  formId = null,
  formTitle = null,
  lines,
  locks,
  returnPath,
}: {
  threadId: string;
  supplierName: string;
  proposalId?: string | null;
  formId?: string | null;
  /** The sent form's title — the part a form ask carries. */
  formTitle?: string | null;
  /** The live quote's lines: each one is a door to an ask about THAT line (ruling 6076). */
  lines?: readonly QuoteCardLine[];
  /** Which subjects are final now. */
  locks: Partial<Record<AskSubject, boolean>>;
  returnPath: string;
}) {
  const offered: AskSubject[] = (formId ? ['form'] : ['quote', 'plan']).filter((s) => askForAChange({ readerIsSupplier: false, locked: locks[s as AskSubject] === true, supplierName }).show) as AskSubject[];
  const [part, setPart] = useState<AskPart | null>(null);
  const [sent, setSent] = useState(false);
  const quoteOpen = offered.includes('quote');
  const planOpen = offered.includes('plan');
  // The quote's lines are drawn HERE on the hosts' live quote (the stream hands them over instead of drawing them).
  const lineList = lines ? <QuoteCardLines items={lines} onAsk={quoteOpen && !part && !sent ? (name) => setPart({ subject: 'quote', name }) : undefined} /> : null;
  if (offered.length === 0) {
    return (
      <>
        {lineList}
        <p className="mt-2 text-[13px] text-ink/60" data-ask-change="locked">
          {formId ? `${supplierName} made this form final` : `${supplierName}'s price is final`}
        </p>
      </>
    );
  }
  if (sent) {
    return (
      <>
        {lineList}
        <p className="mt-2 text-[13px] text-ink/60" role="status">Asked · waiting for {supplierName}</p>
      </>
    );
  }
  if (part) {
    return (
      <>
        {lineList}
        <AskSteps {...{ threadId, part, proposalId, formId, returnPath }} onClose={() => setPart(null)} onSent={() => setSent(true)} />
      </>
    );
  }
  return (
    <>
      {lineList}
      {formId ? (
        <div className="mt-2 flex" data-ask-change="door">
          <ActionButton tone="info" icon={MessageCircleQuestion} label="Ask for a change" onClick={() => setPart({ subject: 'form', name: formTitle })} />
        </div>
      ) : (
        <>
          {planOpen ? (
            <button
              type="button"
              onClick={() => setPart({ subject: 'plan', name: null })}
              aria-label="Ask for a change: Payment plan"
              className="mt-1 flex min-h-9 w-full items-center justify-between gap-3 border-t border-terracotta/20 text-left text-xs text-ink/70 hover:bg-terracotta/[0.08]"
              data-ask-part="plan"
            >
              <span>{ASK_SUBJECT_WORD.plan}</span>
              <MessageCircleQuestion aria-hidden className="h-3.5 w-3.5 shrink-0 text-mulberry" />
            </button>
          ) : null}
          <p className="mt-1 flex items-center gap-1 text-[12px] text-ink/55" data-ask-change="door">
            <MessageCircleQuestion aria-hidden className="h-3.5 w-3.5 text-mulberry" />
            {quoteOpen ? 'Tap a line or the payment plan to ask for a change' : 'Tap the payment plan to ask for a change'}
            <ChevronRight aria-hidden className="h-3 w-3" />
          </p>
        </>
      )}
    </>
  );
}

function AskSteps({
  threadId,
  part,
  proposalId,
  formId,
  returnPath,
  onClose,
  onSent,
}: {
  threadId: string;
  /** The part this ask started from — already attached, never picked again. */
  part: AskPart;
  proposalId: string | null;
  formId: string | null;
  returnPath: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const id = useId();
  const [note, setNote] = useState('');
  const [step, setStep] = useState(0);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const steps: ChatCardStep[] = [
    {
      title: 'What should change?',
      body: (
        <div className="grid gap-2">
          <p className="text-[13px] text-ink/60" data-ask-part-attached={part.subject}>
            About · {askPartWords(part)}
          </p>
          <TypedRow name="Note" long value={note} empty="Add" placeholder="A short note" maxLength={900} openAsk={1} onType={setNote} onKeep={(v) => setNote(v)} />
          <Problem text={problem} />
        </div>
      ),
      ok: note.trim().length > 0,
    },
  ];
  return (
    <form
      id={id}
      action={async (fd) => {
        setSending(true);
        setProblem(null);
        const r = await askForAChangeFromChat(fd);
        setSending(false);
        if (r.ok) onSent();
        else setProblem(r.message);
      }}
    >
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="subject" value={part.subject} />
      <input type="hidden" name="note" value={askNoteWithPart(part, note)} />
      <input type="hidden" name="proposal_id" value={proposalId ?? ''} />
      <input type="hidden" name="form_id" value={formId ?? ''} />
      <input type="hidden" name="return_to" value={returnPath} />
      <ChatStepCard topic={part.subject === 'form' ? 'forms' : 'quote'} kicker="You · not sent yet" title="Ask for a change" steps={steps} step={step} onStep={setStep} sending={sending} onClose={onClose} submitForm={id} />
    </form>
  );
}

/** Under the "Asked for a change · …" line: where it stands, and the supplier's Revise · Decline. */
export function ChangeAskCard({
  threadId,
  subject,
  askedAt,
  viewer,
  returnPath,
  seed,
}: {
  threadId: string;
  subject: AskSubject;
  /** The line's own `created_at` — the ask was written in the same transaction (same `now()`). */
  askedAt: string;
  viewer: 'vendor' | 'couple';
  returnPath: string;
  seed?: ChangeAskRow | null;
}) {
  const [read, setRead] = useState<Read<ChangeAskRow | null>>(seed !== undefined ? { at: 'ok', data: seed } : { at: 'loading' });
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    setRead({ at: 'loading' });
    void loadChangeAsks(threadId).then((r) => {
      if (!r.ok) return setRead({ at: 'failed' });
      const t = Date.parse(askedAt);
      setRead({ at: 'ok', data: r.asks.find((a) => a.subject === subject && Math.abs(Date.parse(a.askedAt) - t) < 2000) ?? null });
    });
  }, [threadId, askedAt, subject]);
  useEffect(() => {
    if (seed === undefined) load();
  }, [load, seed]);
  if (read.at === 'ok' && !read.data) return null;
  const ask = read.at === 'ok' ? read.data! : null;
  const answer = async (a: 'revised' | 'declined') => {
    if (!ask) return;
    setBusy(true);
    setProblem(null);
    const fd = new FormData();
    fd.set('ask_id', ask.askId);
    fd.set('answer', a);
    fd.set('return_to', returnPath);
    const r = await answerChangeAskFromChat(fd);
    setBusy(false);
    if (!r.ok) return setProblem(r.message);
    setRead({ at: 'ok', data: { ...ask, status: a } });
    if (a === 'revised' && subject !== 'form') patchPlus(threadId, { draft: { kind: 'quote', startedAt: Date.now() } });
  };
  return (
    <ChatCardShell topic={subject === 'form' ? 'forms' : 'quote'} kicker={`Ask · ${ASK_SUBJECT_WORD[subject]}`} title="Ask for a change" tone="auto">
      {read.at === 'loading' ? (
        <Loading />
      ) : read.at === 'failed' ? (
        <CouldNotLoad what="this ask" onRetry={load} />
      ) : (
        <div className="grid gap-2" data-change-ask={ask!.status}>
          <p className="text-[15px] text-ink">&ldquo;{ask!.note}&rdquo;</p>
          {ask!.status === 'open' ? (
            viewer === 'vendor' ? (
              <EqualRow>
                <ActionButton tone="neutral" icon={X} label="Decline" onClick={() => void answer('declined')} waiting={busy} />
                <ActionButton tone="brand" main icon={subject === 'form' ? Check : PencilLine} label="Revise" onClick={() => void answer('revised')} waiting={busy} />
              </EqualRow>
            ) : (
              <p className="text-[14px] text-ink/60">Waiting for the supplier&rsquo;s answer.</p>
            )
          ) : (
            <p className={`text-[14px] font-medium ${ask!.status === 'revised' ? 'text-success-700' : 'text-ink/60'}`}>
              {ask!.status === 'revised' ? 'The supplier is sending a new version' : 'Declined by the supplier'}
            </p>
          )}
          <Problem text={problem} />
        </div>
      )}
    </ChatCardShell>
  );
}

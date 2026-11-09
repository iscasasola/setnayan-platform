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
 */
import { useCallback, useEffect, useId, useState } from 'react';
import { Check, MessageCircleQuestion, PencilLine, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { TypedRow } from '@/app/_components/form-row';
import { patchPlus } from '@/lib/chat-plus-store';
import { askForAChange, ASK_SUBJECT_WORD, type AskSubject } from '@/lib/chat-cards';
import { ChatCardShell, ChatStepCard, type ChatCardStep } from '../chat-step-card';
import { answerChangeAskFromChat, askForAChangeFromChat, loadChangeAsks, type ChangeAskRow } from './card-calls';
import { CouldNotLoad, EqualRow, Loading, Problem, type Read } from './card-bits';

export function AskChangeDoor({
  threadId,
  supplierName,
  proposalId = null,
  formId = null,
  locks,
  returnPath,
}: {
  threadId: string;
  supplierName: string;
  proposalId?: string | null;
  formId?: string | null;
  /** Which subjects are final now. */
  locks: Partial<Record<AskSubject, boolean>>;
  returnPath: string;
}) {
  const offered: AskSubject[] = (formId ? ['form'] : ['quote', 'plan']).filter((s) => askForAChange({ readerIsSupplier: false, locked: locks[s as AskSubject] === true, supplierName }).show) as AskSubject[];
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  if (offered.length === 0) {
    return (
      <p className="mt-2 text-[13px] text-ink/60" data-ask-change="locked">
        {formId ? `${supplierName} made this form final` : `${supplierName}'s price is final`}
      </p>
    );
  }
  if (sent) return <p className="mt-2 text-[13px] text-ink/60" role="status">Asked · waiting for {supplierName}</p>;
  if (!open) {
    return (
      <div className="mt-2 flex" data-ask-change="door">
        <ActionButton tone="info" icon={MessageCircleQuestion} label="Ask for a change" onClick={() => setOpen(true)} />
      </div>
    );
  }
  return <AskSteps {...{ threadId, offered, proposalId, formId, returnPath }} onClose={() => setOpen(false)} onSent={() => setSent(true)} />;
}

function AskSteps({
  threadId,
  offered,
  proposalId,
  formId,
  returnPath,
  onClose,
  onSent,
}: {
  threadId: string;
  offered: AskSubject[];
  proposalId: string | null;
  formId: string | null;
  returnPath: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const id = useId();
  const [subject, setSubject] = useState<AskSubject | null>(offered.length === 1 ? offered[0]! : null);
  const [note, setNote] = useState('');
  const [step, setStep] = useState(offered.length === 1 ? 0 : 0);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const steps: ChatCardStep[] = [];
  if (offered.length > 1) {
    steps.push({
      title: 'What should change?',
      body: (
        <PickMenu label="What should change?" value={subject} options={offered.map((s) => ({ key: s, label: ASK_SUBJECT_WORD[s] }))} onPick={(k) => setSubject(k as AskSubject)} buttonText={subject ? undefined : 'Pick one'} dataAttr="data-ask-subject" />
      ),
      ok: !!subject,
    });
  }
  steps.push({
    title: offered.length > 1 ? 'A short note' : 'What should change?',
    body: (
      <div className="grid gap-2">
        <TypedRow name="Note" long value={note} empty="Add" placeholder="A short note" maxLength={1000} openAsk={1} onType={setNote} onKeep={(v) => setNote(v)} />
        <Problem text={problem} />
      </div>
    ),
    ok: note.trim().length > 0 && !!subject,
  });
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
      <input type="hidden" name="subject" value={subject ?? ''} />
      <input type="hidden" name="note" value={note} />
      <input type="hidden" name="proposal_id" value={proposalId ?? ''} />
      <input type="hidden" name="form_id" value={formId ?? ''} />
      <input type="hidden" name="return_to" value={returnPath} />
      <ChatStepCard topic={subject === 'form' ? 'forms' : 'quote'} kicker="You · not sent yet" title="Ask for a change" steps={steps} step={step} onStep={setStep} sending={sending} onClose={onClose} submitForm={id} />
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

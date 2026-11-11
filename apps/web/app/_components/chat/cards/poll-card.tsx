'use client';

/**
 * 🗳 THE POLL CARD (owner 11 Nov 2026 — DECISION_LOG "… POLLS ARE THEIR OWN CARD" and "CHAT POLLS — ONE PER CHAT";
 * prototype `chat_decisions_polls_2026-11-11/chat-decisions-polls.v1.html` frame C).
 *
 * Draft (`PollStepCard`): Ask it (question ≤ 120) → The choices (2–6, ≤ 60) → Open poll. Posted (`PollCard`, full width —
 * both sides fill it): each choice a pressable row with its count, the voters' names and a bar; one vote each, tap
 * another to move it, tap your own to take it back; Close poll (either side). Closed: the winner ticked, Reopen · Save
 * as decision; a tie turns Save into "Pick the decision" (the tied choices, one dropdown).
 *
 * Every write is lib/chat-polls.ts → its SECURITY DEFINER writer (the reader's own session; no server action).
 * ⚠ THIN ON PURPOSE (2026-11-11): the owner asked Fable to redesign the whole supplier↔client page, decisions and
 * polls included — this draws the approved prototype's card and nothing more. The other side's votes arrive on the
 * next load (no realtime listener here yet — the redesign places it on the thread's channel).
 */
import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import { Check, ListChecks, Lock, Plus, RotateCcw, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { TypedRow } from '@/app/_components/form-row';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { createClient } from '@/lib/supabase/client';
import { patchPlus } from '@/lib/chat-plus-store';
import { ONE_POLL_REASON } from '@/lib/chat-plus';
import {
  POLL_CHOICES_MAX,
  POLL_CHOICES_MIN,
  POLL_CHOICE_MAX,
  POLL_QUESTION_MAX,
  closePoll,
  loadPollForMessage,
  openPoll,
  pollDraftProblem,
  pollLeaders,
  reopenPoll,
  savePollAsDecision,
  tallyPoll,
  votePoll,
  voteForTap,
  type Poll,
} from '@/lib/chat-polls';
import { ChatCardShell, ChatStepCard, type ChatCardStep } from '../chat-step-card';
import { CouldNotLoad, EqualRow, Loading, Problem } from './card-bits';

const OPEN_REFUSAL: Record<string, string> = {
  draft: 'A question and 2 to 6 different choices.',
  one_open: ONE_POLL_REASON,
  contact: 'Phone numbers, emails and outside-app contacts are not allowed in a conversation.',
  not_allowed: 'You are not in this chat.',
  failed: 'Could not open the poll. Try again.',
};

export function PollStepCard({ threadId, onClose, onSent }: { threadId: string; onClose?: () => void; onSent?: () => void }) {
  const formId = useId();
  const [step, setStep] = useState(0);
  const [question, setQuestion] = useState('');
  const [choices, setChoices] = useState<string[]>(['', '']);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const setChoice = (i: number, v: string) => setChoices((prev) => prev.map((c, j) => (j === i ? v : c)));

  const steps: ChatCardStep[] = [
    {
      title: 'Ask it',
      body: (
        <TypedRow name="Question" value={question} empty="Ask it" placeholder="e.g. Where is the ceremony?" maxLength={POLL_QUESTION_MAX} openAsk={1} onType={setQuestion} onKeep={setQuestion} />
      ),
      ok: question.trim().length > 0,
    },
    {
      title: 'The choices',
      body: (
        <div className="grid gap-2" data-poll-choices="">
          {choices.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <TypedRow name={`Choice ${i + 1}`} value={c} empty="Add a choice" maxLength={POLL_CHOICE_MAX} onType={(v) => setChoice(i, v)} onKeep={(v) => setChoice(i, v)} />
              </div>
              {choices.length > POLL_CHOICES_MIN ? (
                <ActionButton tone="neutral" quiet iconOnly icon={X} label={`Remove choice ${i + 1}`} onClick={() => setChoices((p) => p.filter((_, j) => j !== i))} />
              ) : null}
            </div>
          ))}
          {choices.length < POLL_CHOICES_MAX ? (
            <div className="flex">
              <ActionButton tone="neutral" icon={Plus} label="Add a choice" onClick={() => setChoices((p) => [...p, ''])} />
            </div>
          ) : null}
          <Problem text={problem} />
        </div>
      ),
      ok: pollDraftProblem(question, choices) === null,
    },
  ];

  return (
    <form
      id={formId}
      action={async () => {
        setSending(true);
        setProblem(null);
        const r = await openPoll(createClient(), threadId, question, choices);
        setSending(false);
        if (!r.ok) return setProblem(OPEN_REFUSAL[r.reason] ?? OPEN_REFUSAL.failed!);
        patchPlus(threadId, { pollOpen: true });
        // No refresh: the "Poll · …" line arrives on the chat's own channel and draws the posted card.
        onSent?.();
      }}
    >
      <ChatStepCard topic="poll" kicker="You · not sent yet" title="Poll" steps={steps} step={step} onStep={setStep} sendLabel="Open poll" sending={sending} onClose={onClose} submitForm={formId} />
    </form>
  );
}

type Read = { state: 'loading' } | { state: 'failed' } | { state: 'ok'; poll: Poll };

export function PollCard({
  threadId,
  messageId,
  meId,
  nameOf,
}: {
  threadId: string;
  messageId: string;
  meId: string;
  /** The stream's own names for the people in the chat. */
  nameOf: (userId: string) => string;
}) {
  const [read, setRead] = useState<Read>({ state: 'loading' });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    const poll = await loadPollForMessage(createClient(), messageId);
    setRead(poll ? { state: 'ok', poll } : { state: 'failed' });
    if (poll && !poll.closedAt) patchPlus(threadId, { pollOpen: true });
  }, [messageId, threadId]);
  useEffect(() => {
    void load();
  }, [load]);

  if (read.state === 'loading') return <Shell><Loading /></Shell>;
  if (read.state === 'failed') return <Shell><CouldNotLoad what="this poll" onRetry={() => void load()} /></Shell>;
  const poll = read.poll;
  const closed = !!poll.closedAt;
  const rows = tallyPoll(poll, meId);
  const leaders = closed ? pollLeaders(poll) : [];
  const winnerIds = new Set(leaders.length === 1 ? [leaders[0]!.choiceId] : []);

  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true);
    setProblem(null);
    const p = await fn();
    setBusy(false);
    setProblem(p);
    await load();
  };
  const vote = (choiceId: string) =>
    run(async () => {
      const r = await votePoll(createClient(), poll.pollId, voteForTap(poll, meId, choiceId));
      return r === 'ok' || r === 'withdrawn' ? null : r === 'closed' ? 'This poll is closed.' : 'Could not vote. Try again.';
    });
  const close = () =>
    run(async () => {
      const r = await closePoll(createClient(), poll.pollId);
      if (r === 'ok' || r === 'unchanged') {
        patchPlus(threadId, { pollOpen: false });
        return null;
      }
      return 'Could not close the poll. Try again.';
    });
  const reopen = () =>
    run(async () => {
      const r = await reopenPoll(createClient(), poll.pollId);
      if (r === 'ok') patchPlus(threadId, { pollOpen: true });
      return r === 'ok' || r === 'unchanged' ? null : r === 'one_open' ? ONE_POLL_REASON : r === 'saved' ? 'Saved as the decision already.' : 'Could not reopen. Try again.';
    });
  const save = (choiceId: string | null) =>
    run(async () => {
      const r = await savePollAsDecision(createClient(), poll.pollId, choiceId);
      return r.ok ? null : r.reason === 'tie' ? 'It is a tie — pick the decision.' : r.reason === 'already_saved' ? null : 'Could not save it. Try again.';
    });

  return (
    <Shell>
      <div className="grid gap-2" data-poll={poll.pollId} data-poll-closed={closed ? '' : undefined}>
        <p className="text-[17px] font-semibold leading-snug text-ink">{poll.question}</p>
        <ul className="grid gap-1.5">
          {rows.map((r) => {
            const won = winnerIds.has(r.choice.choiceId);
            return (
              <li key={r.choice.choiceId}>
                <button
                  type="button"
                  disabled={closed || busy}
                  aria-pressed={r.mine}
                  onClick={() => void vote(r.choice.choiceId)}
                  data-poll-choice={r.choice.choiceId}
                  className={`sn-press relative grid min-h-[48px] w-full overflow-hidden rounded-xl border px-3 py-2 text-left ${r.mine ? 'border-sn-accent' : won ? 'border-success-600' : 'border-ink/12'}` /* no-card-ok: this IS the <button> — the prototype's pressable poll row (bar · names · count) */}
                >
                  <span aria-hidden className={`absolute inset-y-0 left-0 ${won ? 'bg-success-100' : 'bg-sn-accent/10'}`} style={{ width: `${Math.round(r.share * 100)}%` }} />
                  <span className="relative flex items-center gap-2">
                    {won ? <Check aria-hidden className="h-4 w-4 text-success-700" strokeWidth={2.2} /> : null}
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">{r.choice.label}</span>
                    <span className="text-[14px] tabular-nums text-ink/70">{r.count}</span>
                  </span>
                  {r.voters.length ? (
                    <span className="relative mt-0.5 block truncate text-[13px] text-ink/60">
                      {r.voters.map((v) => (v === meId ? 'You' : nameOf(v))).join(' · ')}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
        <Problem text={problem} />
        {!closed ? (
          <div className="flex">
            <ActionButton tone="neutral" icon={Lock} label="Close poll" onClick={() => void close()} waiting={busy} />
          </div>
        ) : poll.savedDecisionId ? (
          <p className="text-[14px] text-ink/70" data-poll-saved="">Saved as the decision</p>
        ) : (
          <EqualRow>
            <ActionButton tone="neutral" icon={RotateCcw} label="Reopen" onClick={() => void reopen()} waiting={busy} />
            {leaders.length === 1 ? (
              <ActionButton tone="brand" main icon={ListChecks} label="Save as decision" onClick={() => void save(null)} waiting={busy} />
            ) : (
              <PickMenu
                label="Pick the decision"
                value={null}
                options={leaders.map((c) => ({ key: c.choiceId, label: c.label }))}
                onPick={(key) => void save(key)}
                buttonText="Pick the decision"
                dataAttr="data-poll-tie"
              />
            )}
          </EqualRow>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <ChatCardShell topic="poll" kicker="Poll · both of you vote" title="Poll" tone="auto">
      {children}
    </ChatCardShell>
  );
}

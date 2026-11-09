'use client';

/**
 * 📌 DECISION — pin a topic until it is settled (Supplier Build 3 · lane C; prototype v8.3 `STEPS.decision`).
 *
 * Name it, short → Open. Opening goes through lane B's ONE door (`openDecision` → `chat_decision_open()`): the database
 * writes the `chat_decision_topics` row and posts its "Decision opened · …" line, and the topic appears as a pin. Closing
 * and reopening are the pin's own `DecisionToggle` (either side closes, anyone in the chat reopens) — this card never
 * writes a second way to do it.
 *
 * ⚠ NOT BUILT HERE (reported): filing each message under the open topic, and the Details › Decisions list.
 */
import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TypedRow } from '@/app/_components/form-row';
import { ChatStepCard, type ChatCardStep } from '../chat-step-card';
import { openDecisionFromChat } from './card-actions';
import { Problem } from './card-bits';

export function DecisionStepCard({ threadId, onClose, onSent }: { threadId: string; onClose?: () => void; onSent?: () => void }) {
  const formId = useId();
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const steps: ChatCardStep[] = [
    {
      title: 'Name it, short',
      body: (
        <div className="grid gap-2">
          <TypedRow name="Topic" value={topic} empty="Name it" placeholder="e.g. Drone shot at sunset" maxLength={120} openAsk={1} onType={setTopic} onKeep={(v) => setTopic(v)} />
          <p className="text-[13px] text-ink/55">It stays pinned for both of you until one of you closes it.</p>
          <Problem text={problem} />
        </div>
      ),
      ok: topic.trim().length > 0,
    },
  ];

  return (
    <form
      id={formId}
      action={async (fd) => {
        setSending(true);
        setProblem(null);
        const r = await openDecisionFromChat(fd);
        setSending(false);
        if (!r.ok) return setProblem(r.message);
        // one-render: keep (client-write) — the topic is a new pin; re-read so the pin row shows it.
        router.refresh();
        onSent?.();
      }}
    >
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="topic" value={topic.trim()} />
      <ChatStepCard topic="decision" kicker="You · not sent yet" title="Decision" steps={steps} step={0} onStep={() => {}} sendLabel="Open" sending={sending} onClose={onClose} submitForm={formId} />
    </form>
  );
}

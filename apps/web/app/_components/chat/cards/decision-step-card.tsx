'use client';

/**
 * 📌 DECISION — pin a topic until it is settled (Supplier Build 3 · lane C; prototype v8.3 `STEPS.decision`).
 *
 * ① Which topic? (the one open now, to close — or Something new) → ② Name it, short → Open. Opening posts the line
 * "Talking about: <topic> · pinned by <you>" (both sides see it, it stays in the history) and sets the chat's open
 * topic (`patchPlus … talking`, lane B's store the pin reads). Closing posts "<topic> · closed by <you>".
 *
 * ⚠ NOT BUILT HERE (reported): filing each message under the open topic and the Details › Decisions list need a
 * stored topic (no table today); the open topic lives in this tab's chat store and the lines carry the record.
 */
import { useId, useState } from 'react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { TypedRow } from '@/app/_components/form-row';
import { patchPlus, usePlus } from '@/lib/chat-plus-store';
import { ChatStepCard, type ChatCardStep } from '../chat-step-card';
import { decisionLineFromChat } from './card-actions';
import { Problem } from './card-bits';

export function DecisionStepCard({ threadId, onClose, onSent }: { threadId: string; onClose?: () => void; onSent?: () => void }) {
  const formId = useId();
  const { talking } = usePlus(threadId);
  const [step, setStep] = useState(0);
  const [pick, setPick] = useState<'close' | 'new' | null>(talking ? null : 'new');
  const [topic, setTopic] = useState('');
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const closing = pick === 'close' && !!talking;

  const steps: ChatCardStep[] = [];
  if (talking) {
    steps.push({
      title: 'Which topic?',
      body: (
        <PickMenu
          label="Which topic?"
          value={pick}
          options={[
            { key: 'close', label: `Close “${talking.title}”` },
            { key: 'new', label: 'Something new' },
          ]}
          onPick={(k) => setPick(k as 'close' | 'new')}
          buttonText={pick ? undefined : 'Pick one'}
          dataAttr="data-decision-pick"
        />
      ),
      ok: !!pick,
    });
  }
  if (!closing) {
    steps.push({
      title: 'Name it, short',
      body: (
        <div className="grid gap-2">
          <TypedRow name="Topic" value={topic} empty="Name it" placeholder="e.g. Drone shot at sunset" maxLength={120} openAsk={1} onType={setTopic} onKeep={(v) => setTopic(v)} />
          <Problem text={problem} />
        </div>
      ),
      ok: topic.trim().length > 0,
    });
  }
  const name = closing ? talking!.title : topic.trim();

  return (
    <form
      id={formId}
      action={async (fd) => {
        setSending(true);
        setProblem(null);
        const r = await decisionLineFromChat(fd);
        setSending(false);
        if (!r.ok) return setProblem(r.message);
        patchPlus(threadId, { talking: closing ? null : { key: `t${Date.now()}`, title: name } });
        onSent?.();
      }}
    >
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="topic" value={name} />
      <input type="hidden" name="act" value={closing ? 'close' : 'open'} />
      <ChatStepCard
        topic="decision"
        kicker="You · not sent yet"
        title="Decision"
        steps={steps}
        step={Math.min(step, steps.length - 1)}
        onStep={setStep}
        sendLabel={closing ? 'Close' : 'Open'}
        sending={sending}
        onClose={onClose}
        submitForm={formId}
      />
    </form>
  );
}

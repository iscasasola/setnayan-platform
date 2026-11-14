'use client';

/**
 * "Did this answer it?" — Yes / No under an answer (approved Help prototype v5, § 08). Yes is counted for that answer;
 * No is saved so the team can fix it, and offers the two ways forward the prototype draws: Ask another way · Message
 * us. One press, then the line says it was saved — the press never waits on the network (it posts in the background
 * through the Help's own action, `submitHelpMessage` with `intent=answered`).
 */
import { useState, useTransition } from 'react';
import { Check, MessageSquare, RotateCcw, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { submitHelpMessage } from '@/app/help/actions';

export function AnswerFeedback({
  slug,
  words,
  coverage,
  askAgainHref,
  messageHref,
}: {
  slug: string;
  /** The question asked; empty when the answer was opened from a topic. */
  words: string;
  coverage: string;
  askAgainHref: string;
  messageHref: string;
}) {
  const [vote, setVote] = useState<'yes' | 'no' | null>(null);
  const [, start] = useTransition();
  const send = (v: 'yes' | 'no') => {
    setVote(v);
    const fd = new FormData();
    fd.set('intent', 'answered');
    fd.set('vote', v);
    fd.set('slug', slug);
    fd.set('words', words);
    fd.set('coverage', coverage);
    start(() => {
      void submitHelpMessage(fd).catch(() => undefined);
    });
  };
  if (vote === 'yes') {
    return (
      <p role="status" className="mt-3 text-sm text-ink/70" data-help-answered="yes">
        Thanks. Saved.
      </p>
    );
  }
  if (vote === 'no') {
    return (
      <div role="status" className="mt-3" data-help-answered="no">
        <p className="text-sm text-ink/70">Sorry about that. Saved, so we can fix this answer.</p>
        <p className="mt-2 flex flex-wrap gap-2">
          <ActionButton tone="neutral" icon={RotateCcw} label="Ask another way" href={askAgainHref} />
          <ActionButton tone="info" icon={MessageSquare} label="Message us" href={messageHref} />
        </p>
      </div>
    );
  }
  return (
    <div className="mt-3" data-help-feedback="">
      <p className="text-sm text-ink/70">Did this answer it?</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <ActionButton tone="neutral" icon={Check} label="Yes" onClick={() => send('yes')} />
        <ActionButton tone="neutral" icon={X} label="No" onClick={() => send('no')} />
      </div>
    </div>
  );
}

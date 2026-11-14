'use client';

/**
 * connection-answer.tsx — ACCEPT · DECLINE ON THE PAGE OF SOMEBODY WHO ASKED YOU (walk 13 Nov 2026, F-W3-06: a pending
 * person's page said "Waiting to connect" and offered no answer — the only way to answer was People › Requests).
 *
 * The SAME two answers People's Requests row gives (`people-roster-view.tsx` → `RequestRow`), through the SAME shipped
 * actions — `confirmConnection` / `declineConnection` (no new action: the server-action budget is at its ceiling). A
 * request that carries "Partner" asks the one-partner question here too, in the action's own words. After an answer
 * the action's own revalidation re-renders the page (no second refresh — `a-save-renders-once.test.ts`), so "Waiting to
 * connect" becomes "Connected" (or the line goes) from the database, never a guess.
 *
 * Drawn only where the page already knows the request waits on THIS viewer (`ProfileViewer.answerConnectionId`).
 */
import { useState, useTransition } from 'react';
import { Check, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { confirmConnection, declineConnection } from '@/app/dashboard/(account)/people/actions';

export function ConnectionAnswer({ connectionId, name }: { connectionId: string; name: string | null }) {
  const [pending, start] = useTransition();
  const [question, setQuestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const who = name ?? 'them';

  const accept = (replacePartner: boolean) =>
    start(async () => {
      setError(null);
      const res = await confirmConnection(connectionId, { replacePartner });
      if (!res.ok && 'replacePartner' in res) {
        setQuestion(res.replacePartner.question);
        return;
      }
      setQuestion(null);
      if (!res.ok) setError(res.error);
    });
  const decline = () =>
    start(async () => {
      setError(null);
      const res = await declineConnection(connectionId);
      if (!res.ok) setError(res.error);
    });

  return (
    <div className="uprof-answer" data-connection-answer="">
      <p className="uprof-answer-line">{question ?? `${name ?? 'They'} asked to connect with you.`}</p>
      <div className="uprof-answer-acts">
        {question ? (
          <>
            <ActionButton tone="brand" main icon={Check} label="Yes, change it" onClick={() => accept(true)} disabled={pending} />
            <ActionButton tone="neutral" icon={X} label="Keep as is" onClick={() => setQuestion(null)} disabled={pending} />
          </>
        ) : (
          <>
            <ActionButton tone="ok" icon={Check} label="Accept" name={`Accept ${who}`} onClick={() => accept(false)} disabled={pending} />
            <ActionButton tone="neutral" icon={X} label="Decline" name={`Decline ${who}`} onClick={decline} disabled={pending} />
          </>
        )}
      </div>
      {error ? (
        <p className="uprof-answer-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

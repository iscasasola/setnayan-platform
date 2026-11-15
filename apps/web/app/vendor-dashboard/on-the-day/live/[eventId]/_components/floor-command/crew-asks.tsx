'use client';

/**
 * 🗓 THE CREW'S SKIP ASKS, ON THE FLOOR (owner 2026-11-05: a crew Member may ask to skip a part — *"yes they can
 * request"*). One line per open ask — who · which part · when — and Decline · Approve, one tap each, saved in place
 * (the shipped request decision's shape: `request-decision.tsx`). Approve runs the ONE accept path, which skips the part
 * exactly as the floor's own Skip; a locked supplier's part says the lock's line here. The page re-renders from the
 * action's revalidation, so the answered ask leaves the list — never a refresh of our own.
 */
import { useState, useTransition } from 'react';
import { Check, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { crewAskWords, type CrewSkipAsk } from '@/lib/change-the-schedule';
import { guestToast } from '@/app/dashboard/[eventId]/guests/_components/undo-store';
import { floorChangeSchedule } from './actions';

export function CrewAsks({ eventId, asks }: { eventId: string; asks: readonly CrewSkipAsk[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<{ id: string; text: string } | null>(null);
  const [, start] = useTransition();

  if (asks.length === 0) return null;

  const answer = (id: string, accept: boolean) => {
    setBusy(`${id}:${accept ? 'a' : 'd'}`);
    setProblem(null);
    start(async () => {
      const res = await floorChangeSchedule(eventId, { op: 'answer', suggestionId: id, accept }, 'floor');
      setBusy(null);
      if (!res.ok) {
        setProblem({ id, text: res.error ?? 'Nothing changed — try again.' });
        return;
      }
      guestToast.success(res.message ?? (accept ? 'Skipped' : 'Declined'));
    });
  };

  return (
    <section className="space-y-1" data-crew-asks="">
      <h5 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--m-slate-2)]">Your crew asks</h5>
      <ul className="divide-y divide-[color:var(--m-line)]">
        {asks.map((a) => (
          <li key={a.suggestionId} className="min-h-14 py-2.5" data-crew-ask={a.suggestionId}>
            <p className="text-sm leading-snug text-ink">{crewAskWords(a)}</p>
            <div className="mt-2 flex justify-end gap-2">
              <ActionButton
                tone="neutral"
                icon={X}
                label={busy === `${a.suggestionId}:d` ? 'Declining…' : 'Decline'}
                waiting={busy === `${a.suggestionId}:d`}
                disabled={busy !== null && busy !== `${a.suggestionId}:d`}
                onClick={() => answer(a.suggestionId, false)}
              />
              <ActionButton
                tone="ok"
                icon={Check}
                label={busy === `${a.suggestionId}:a` ? 'Skipping…' : 'Approve skip'}
                waiting={busy === `${a.suggestionId}:a`}
                disabled={busy !== null && busy !== `${a.suggestionId}:a`}
                onClick={() => answer(a.suggestionId, true)}
              />
            </div>
            {problem?.id === a.suggestionId ? (
              <p role="alert" className="mt-1.5 text-right text-sm font-semibold text-danger-700">
                {problem.text}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

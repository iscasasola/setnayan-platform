'use client';

/**
 * 🗓 THE CREW'S SKIP ASKS, ON THE FLOOR (owner 2026-11-05: a crew Member may ask to skip a part — *"yes they can
 * request"*). One line per open ask — who · which part · when — and Decline · Approve, one tap each, saved in place
 * (the shipped request decision's shape: `request-decision.tsx`). Approve runs the ONE accept path, which skips the part
 * exactly as the floor's own Skip; a locked supplier's part says the lock's line here. The page re-renders from the
 * action's revalidation, so the answered ask leaves the list — never a refresh of our own.
 */
import { useState, useTransition } from 'react';
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
      <h5 className="text-xs font-semibold uppercase tracking-wide text-ink/55">Your crew asks</h5>
      <ul className="divide-y divide-ink/10">
        {asks.map((a) => (
          <li key={a.suggestionId} className="py-2.5" data-crew-ask={a.suggestionId}>
            <p className="text-[13.5px] leading-snug text-ink">{crewAskWords(a)}</p>
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => answer(a.suggestionId, false)}
                className="h-10 rounded-full px-4 text-[13px] font-semibold text-ink/75 ring-1 ring-inset ring-ink/15 disabled:opacity-60"
              >
                {busy === `${a.suggestionId}:d` ? 'Declining…' : 'Decline'}
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => answer(a.suggestionId, true)}
                className="h-10 rounded-full bg-ink px-4 text-[13px] font-semibold text-cream disabled:opacity-60"
              >
                {busy === `${a.suggestionId}:a` ? 'Skipping…' : 'Approve skip'}
              </button>
            </div>
            {problem?.id === a.suggestionId ? (
              <p role="alert" className="mt-1.5 text-right text-[12.5px] font-semibold text-danger-700">
                {problem.text}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

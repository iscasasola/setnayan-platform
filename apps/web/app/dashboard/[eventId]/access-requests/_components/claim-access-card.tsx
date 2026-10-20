'use client';

/**
 * 🤝 A SUPPLIER WHO JOINED FROM YOUR LINK — the approval card (owner
 * 2026-10-20: *"access to the event is automatic but has an approval. it should
 * proceed to that approval giving access once they sync."*).
 *
 * ONE decision: Approve or Decline. What they open is set by who they are — a
 * coordinator gets the same access as the couple, any other supplier what its
 * category gets (DECISION_LOG 2026-10-07) — so there are no lines to pick.
 * Nothing is open to them until Approve. Drawn wherever the ask is shown
 * (Event Details › Event access, Access requests) from `readClaimAccessAsks`.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { answerAccessRequest } from '../actions';
import { claimAskLine, type ClaimAccessAsk } from '@/lib/claim-access-asks';

export function ClaimAccessCard({ eventId, ask }: { eventId: string; ask: ClaimAccessAsk }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [answering, setAnswering] = useState<'approve' | 'decline' | null>(null);
  const [pending, startTransition] = useTransition();

  function answer(approve: boolean) {
    setError(null);
    setAnswering(approve ? 'approve' : 'decline');
    startTransition(async () => {
      // The one access-answer action; a claim's single line is `access`.
      const res = await answerAccessRequest(eventId, ask.requestId, { access: approve ? 'granted' : 'declined' });
      if (!res.ok) {
        setError(res.error ?? 'Could not send that.');
        setAnswering(null);
        return;
      }
      router.refresh();
    });
  }

  return (
    <li className="py-3" data-claim-ask={ask.requestId}>
      <p className="text-sm font-medium text-ink">{ask.name} joined from your link</p>
      <p className="text-[12px] text-ink/60">
        {ask.categoryLabel} · {claimAskLine(ask)}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => answer(true)}
          disabled={pending}
          className="sn-press inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-ink px-4 text-sm font-medium text-cream transition hover:bg-ink/90 disabled:opacity-50"
          data-claim-approve=""
        >
          {pending && answering === 'approve' ? (
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={1.75} />
          ) : null}
          Approve
        </button>
        <button
          type="button"
          onClick={() => answer(false)}
          disabled={pending}
          className="sn-press inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-ink/15 px-4 text-sm text-ink/75 transition hover:border-ink/35 disabled:opacity-50"
          data-claim-decline=""
        >
          {pending && answering === 'decline' ? (
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={1.75} />
          ) : null}
          Decline
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-terracotta-700">
          {error}
        </p>
      ) : null}
    </li>
  );
}

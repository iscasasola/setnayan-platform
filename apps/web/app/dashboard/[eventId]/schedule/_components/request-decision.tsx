'use client';

import { useState } from 'react';
import { REQUEST_NOT_SENT, requestAnswerOf } from '@/lib/schedule-request-answer';
import { Check, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';

/**
 * 🔁 ONE REQUEST'S DECISION — Decline · Approve (or Noted, for a suggestion in words), SAVED IN PLACE (audit 2026-11-02
 * #15). The press calls the Schedule's one door (`resolveScheduleSuggestion`) and reads its answer: done = the page
 * behind re-renders from the action's revalidation and the request leaves the list, the sheet staying open; refused =
 * said here, under the buttons, and the request stays to try again. Never a redirect, never the error page.
 */
export function RequestDecision({
  eventId,
  suggestionId,
  noteOnly,
  decide,
  acceptLabel,
}: {
  eventId: string;
  suggestionId: string;
  /** A suggestion in words: nothing to approve or decline — Noted says it was read. */
  noteOnly: boolean;
  decide: (fd: FormData) => Promise<unknown>;
  /** 📍 A supplier's Where pick says "OK" (owner 2026-11-04: OK / Change). */
  acceptLabel?: string;
}) {
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const press = async (decision: 'accept' | 'decline') => {
    setBusy(decision);
    setProblem(null);
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('suggestion_id', suggestionId);
    fd.set('decision', decision);
    let raw: unknown;
    try {
      raw = await decide(fd);
    } catch {
      raw = { ok: false, error: REQUEST_NOT_SENT };
    }
    setBusy(null);
    const answer = requestAnswerOf(raw);
    if (!answer.ok) setProblem(answer.error);
  };
  return (
    <div data-request-decision={suggestionId}>
      <div className="flex justify-end gap-2">
        {noteOnly ? null : (
          <ActionButton
            tone="neutral"
            icon={X}
            label={busy === 'decline' ? 'Declining…' : 'Decline'}
            waiting={busy !== null}
            onClick={() => void press('decline')}
          />
        )}
        <ActionButton
          tone="brand"
          main
          icon={Check}
          label={busy === 'accept' ? (noteOnly ? 'Saving…' : 'Approving…') : (acceptLabel ?? (noteOnly ? 'Noted' : 'Approve'))}
          waiting={busy !== null}
          onClick={() => void press('accept')}
        />
      </div>
      {problem ? (
        <p role="alert" className="mt-2 text-right text-[13px] font-semibold text-[rgb(var(--color-danger))]">
          {problem}
        </p>
      ) : null}
    </div>
  );
}

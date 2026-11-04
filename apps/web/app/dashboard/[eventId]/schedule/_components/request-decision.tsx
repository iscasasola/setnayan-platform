'use client';

import { useState } from 'react';
import { REQUEST_NOT_SENT, requestAnswerOf } from '@/lib/schedule-request-answer';

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
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void press('decline')}
            className="h-10 rounded-full px-4 text-[13px] font-semibold text-ink/75 ring-1 ring-inset ring-ink/15 disabled:opacity-60"
          >
            {busy === 'decline' ? 'Declining…' : 'Decline'}
          </button>
        )}
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void press('accept')}
          className="h-10 rounded-full bg-ink px-4 text-[13px] font-semibold text-cream disabled:opacity-60"
        >
          {busy === 'accept' ? (noteOnly ? 'Saving…' : 'Approving…') : (acceptLabel ?? (noteOnly ? 'Noted' : 'Approve'))}
        </button>
      </div>
      {problem ? (
        <p role="alert" className="mt-2 text-right text-[13px] font-semibold text-danger-700">
          {problem}
        </p>
      ) : null}
    </div>
  );
}

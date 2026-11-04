'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { resolveScheduleSuggestion } from '@/app/dashboard/[eventId]/schedule/actions';
import { markNotificationRead } from '@/lib/notification-actions';
import { REQUEST_NOT_SENT, requestAnswerOf } from '@/lib/schedule-request-answer';

/**
 * 📍 OK ON THE NOTICE (owner 2026-11-04, answer 2 on #7260: "OK on the notice itself: yes, as well as in the Requests
 * sheet. It should be the same action in both places"). A supplier picked their chapters; the host OKs it right here.
 *
 * THE SAME ACTION: `resolveScheduleSuggestion` with decision 'accept' — exactly what the Requests sheet's OK posts
 * (`RequestDecision`), so it runs the one accept path (`apply_supplier_where`) and the database's own gate. Decline and
 * Change stay one tap away on the sheet the row itself opens. The notice is marked read in place (no redirect), and the
 * row says what happened; a refusal is said, never drawn as done.
 */
export function WhereNoticeOk({
  notificationId,
  eventId,
  suggestionId,
  onRead,
}: {
  notificationId: string;
  eventId: string;
  suggestionId: string;
  onRead?: (notificationId: string) => void;
}) {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [problem, setProblem] = useState<string | null>(null);

  const ok = async () => {
    setState('busy');
    setProblem(null);
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('suggestion_id', suggestionId);
    fd.set('decision', 'accept');
    let raw: unknown;
    try {
      raw = await resolveScheduleSuggestion(fd);
    } catch {
      raw = { ok: false, error: REQUEST_NOT_SENT };
    }
    const answer = requestAnswerOf(raw);
    if (!answer.ok) {
      setState('idle');
      setProblem(answer.error);
      return;
    }
    setState('done');
    // Read in place — no `return_to`, so it does not leave the page.
    const read = new FormData();
    read.set('notification_id', notificationId);
    void markNotificationRead(read).then(
      () => onRead?.(notificationId),
      () => {},
    );
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 px-3 pb-2.5" data-where-notice-ok={suggestionId}>
      {problem ? (
        <p role="alert" className="mr-auto text-[13px] font-semibold text-danger-700">
          {problem}
        </p>
      ) : null}
      {state === 'done' ? (
        <p role="status" className="text-[13px] font-semibold text-success-900">
          OK’d. The request is answered.
        </p>
      ) : (
        <ActionButton
          tone="brand"
          icon={Check}
          label={state === 'busy' ? 'Saving…' : 'OK'}
          disabled={state === 'busy'}
          onClick={() => void ok()}
          data-testid="where-notice-ok"
        />
      )}
    </div>
  );
}

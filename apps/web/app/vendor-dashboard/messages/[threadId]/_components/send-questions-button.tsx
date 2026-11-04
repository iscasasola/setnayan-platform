'use client';

import { useActionState } from 'react';
import { Check, Send } from 'lucide-react';
import { sendQuestionsToEvent, type SendQuestionsState } from '../questions-actions';

/**
 * The ONE press of the "Questions for the couple" panel — sends the set into this event and says so IN PLACE
 * (a save never resets the screen). The panel's status line above is re-drawn by the action's revalidate.
 */
export function SendQuestionsButton({
  threadId,
  coupleName,
  alreadySent,
}: {
  threadId: string;
  coupleName: string;
  alreadySent: boolean;
}) {
  const [state, action, pending] = useActionState<SendQuestionsState, FormData>(sendQuestionsToEvent, {
    status: 'idle',
  });
  const sent = state.status === 'sent';
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="thread_id" value={threadId} />
      <button
        type="submit"
        disabled={pending}
        className="sn-press inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-sn-accent px-4 text-[15px] font-semibold text-sn-on-accent disabled:opacity-60"
      >
        {sent ? (
          <Check aria-hidden className="h-4 w-4" strokeWidth={2.2} />
        ) : (
          <Send aria-hidden className="h-4 w-4" strokeWidth={2} />
        )}
        {pending
          ? 'Sending…'
          : sent
            ? `Sent to ${coupleName}`
            : alreadySent
              ? 'Send again'
              : `Send to ${coupleName}`}
      </button>
      {state.status === 'error' ? (
        <p role="alert" className="text-[13px] text-terracotta-700">
          {state.message}
        </p>
      ) : sent ? (
        <p role="status" className="text-[13px] text-ink/60">
          They&rsquo;ll find them in their event. Their answers come back to this customer&rsquo;s card.
        </p>
      ) : null}
    </form>
  );
}

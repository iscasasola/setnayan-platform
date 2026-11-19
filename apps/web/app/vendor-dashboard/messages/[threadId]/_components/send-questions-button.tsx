'use client';

import { useActionState } from 'react';
import { Check, Send } from 'lucide-react';
import { sendQuestionsToEvent, type SendQuestionsState } from '../questions-actions';
import { SupplierSubmit } from '@/app/vendor-dashboard/_components/supplier-submit';

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
  const [state, action] = useActionState<SendQuestionsState, FormData>(sendQuestionsToEvent, {
    status: 'idle',
  });
  const sent = state.status === 'sent';
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="thread_id" value={threadId} />
      {/* Rule 3 · the button piece (one pending word, a double tap does nothing). Not `main`: Send is the screen's one. */}
      <SupplierSubmit
        tone="brand"
        overlay={false}
        className="w-full"
        icon={sent ? <Check aria-hidden strokeWidth={2.2} /> : <Send aria-hidden strokeWidth={2} />}
        label={sent ? `Sent to ${coupleName}` : alreadySent ? 'Send again' : `Send to ${coupleName}`}
        pendingLabel="Sending…"
      />
      {state.status === 'error' ? (
        <p role="alert" className="text-[13px]" style={{ color: 'rgb(var(--color-danger))' }}>
          {state.message}
        </p>
      ) : sent ? (
        <p role="status" className="text-[13px] text-[color:var(--m-slate-2)]">
          They&rsquo;ll find them in their event. Their answers come back to this customer&rsquo;s card.
        </p>
      ) : null}
    </form>
  );
}

/**
 * 🚦 THE CHANGE-APPROVAL BLOCKER'S TWO ANSWERS, AS ONE ROW — **Decline | Accept the change**, equal widths (prototype
 * v8.3's blocker row; FINAL RULINGS 2026-11-09 house rule: "Equal-weight choices sit in one row at equal widths").
 *
 * The SAME shipped action the amendment card posts (`respondAmendmentFromChat`, the same hidden fields — thread,
 * amendment, return_to, decision), so what a yes or a no does is unchanged: only a 'proposed' change the reader did NOT
 * raise is resolved, single winner. A counter-offer stays on the card in the chat ("Return to chat").
 *
 * A server component: two plain forms, no state, no new action.
 */
import { Check, X } from 'lucide-react';

import { AskSubmit } from '@/app/_components/ask-submit';
import { respondAmendmentFromChat } from '@/app/_components/negotiation-actions';

const ico = { 'aria-hidden': true, strokeWidth: 1.9 } as const;

export function BlockerChangeRow({ threadId, amendmentId, returnTo }: { threadId: string; amendmentId: string; returnTo: string }) {
  const hidden = (decision: 'accept' | 'decline') => (
    <>
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="amendment_id" value={amendmentId} />
      <input type="hidden" name="return_to" value={returnTo} />
      <input type="hidden" name="decision" value={decision} />
    </>
  );
  return (
    <div className="mt-3 grid grid-cols-2 gap-2" data-blocker-change-row="">
      <form action={respondAmendmentFromChat} className="contents">
        {hidden('decline')}
        <AskSubmit tone="danger" icon={<X {...ico} />} label="Decline" pendingLabel="Sending…" className="w-full" />
      </form>
      <form action={respondAmendmentFromChat} className="contents">
        {hidden('accept')}
        <AskSubmit tone="ok" main icon={<Check {...ico} />} label="Accept the change" pendingLabel="Accepting…" className="w-full" />
      </form>
    </div>
  );
}

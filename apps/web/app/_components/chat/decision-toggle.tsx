'use client';

/**
 * # A DECISION TOPIC'S ONE CONTROL — Close (either side) · Reopen (anyone in the chat) (owner-approved recommendation 1,
 * 9 Nov). A browser RPC (`chat_decision_set_closed`: members of this chat only; it posts "Decision closed · …" /
 * "Decision reopened · …"), then the page re-reads in place. Lane C's Decision card mounts the same control.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, RotateCcw } from 'lucide-react';

import { ActionButton } from '@/components/action-button';
import { createClient } from '@/lib/supabase/client';

export function DecisionToggle({ topicId, closed }: { topicId: string; closed: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [refused, setRefused] = useState(false);
  return (
    <div className="flex items-center gap-2" data-decision-toggle={closed ? 'closed' : 'open'}>
      <ActionButton
        tone={closed ? 'neutral' : 'ok'}
        icon={closed ? <RotateCcw aria-hidden strokeWidth={1.9} /> : <Check aria-hidden strokeWidth={1.9} />}
        label={closed ? 'Reopen' : 'Close · settled'}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setRefused(false);
            const { data, error } = await createClient().rpc('chat_decision_set_closed', { p_topic_id: topicId, p_closed: !closed });
            if (error || (data !== 'ok' && data !== 'unchanged')) {
              setRefused(true);
              return;
            }
            // one-render: keep (client-write) — the close/reopen was an RPC in the browser, no server action rendered; re-read so the pin moves.
            router.refresh();
          })
        }
      />
      {refused ? (
        <span role="alert" className="text-[13px] text-danger-900">
          Couldn&rsquo;t save. Try again.
        </span>
      ) : null}
    </div>
  );
}

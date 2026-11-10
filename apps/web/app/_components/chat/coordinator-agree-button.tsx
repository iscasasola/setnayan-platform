'use client';

/**
 * 🤝 THE HOSTS' ONE-TIME AGREE for a booked coordinator / planner (DECISION_LOG 🤝 2026-11-08) — the blocker's one
 * action when a payment is on record without it. A browser RPC (`host_agree_coordinator_access`: hosts only, writes
 * the consent record and its chat line), then the page re-reads in place.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';

import { ActionButton } from '@/components/action-button';
import { createClient } from '@/lib/supabase/client';

const WORDS: Record<string, string> = {
  not_a_host: 'Only the hosts can agree to this.',
  not_a_coordinator: 'This supplier is not a coordinator or planner.',
  not_booked: 'This supplier is not booked on your event.',
  unauthenticated: 'Sign in again to agree.',
};

export function CoordinatorAgreeButton({ eventId, vendorProfileId }: { eventId: string; vendorProfileId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [refused, setRefused] = useState<string | null>(null);
  return (
    <div className="w-full">
      <ActionButton
        tone="ok"
        main
        icon={<Check aria-hidden strokeWidth={1.9} />}
        label={pending ? 'Agreeing…' : 'I agree'}
        disabled={pending}
        className="!h-11 !min-h-11 w-full"
        onClick={() =>
          start(async () => {
            setRefused(null);
            const { data, error } = await createClient().rpc('host_agree_coordinator_access', {
              p_event_id: eventId,
              p_vendor_profile_id: vendorProfileId,
            });
            if (error || (data !== 'ok' && data !== 'already')) {
              setRefused(WORDS[String(data)] ?? 'Couldn’t record your Agree. Try again in a moment.');
              return;
            }
            // one-render: keep (client-write) — the Agree was recorded by an RPC in the browser, no server action rendered; re-read so the pin clears.
            router.refresh();
          })
        }
      />
      {refused ? (
        <p role="alert" className="mt-2 text-[13px] text-danger-900">
          {refused}
        </p>
      ) : null}
    </div>
  );
}

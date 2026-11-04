'use client';

/**
 * "WAITING LIST" — the button that stands in for Agree on a FULL day (owner 2026-11-04, `lib/day-check.ts`).
 * In place: the action returns its answer (`vendorWaitlistTheAsk`) and this form says it right under the button —
 * the screen never jumps (house rule "a save never resets the screen").
 */
import { useActionState } from 'react';
import { Clock } from 'lucide-react';
import { AskSubmit } from '@/app/_components/ask-submit';
import { waitlistAnswerNotice } from '@/lib/day-check';

type WaitlistAction = (prev: { status: string } | null, formData: FormData) => Promise<{ status: string }>;

export function WaitlistForm({ eventVendorId, returnTo, action }: { eventVendorId: string; returnTo: string; action: WaitlistAction }) {
  const [state, formAction] = useActionState(action, null);
  const notice = waitlistAnswerNotice(state?.status);
  return (
    <form action={formAction} data-day-check-waitlist="">
      <input type="hidden" name="vendor_id" value={eventVendorId} />
      <input type="hidden" name="return_to" value={returnTo} />
      <AskSubmit tone="brand" main icon={<Clock aria-hidden strokeWidth={1.9} />} label="Waiting list" pendingLabel="Adding…" />
      {notice ? (
        <p
          role={notice.tone === 'refused' ? 'alert' : 'status'}
          data-waitlist-answer={notice.tone}
          className={`mt-2 border-l-2 py-1 pl-3 text-sm ${notice.tone === 'refused' ? 'border-danger-500 text-danger-900 dark:text-danger-100' : 'border-mulberry text-ink'}`}
        >
          {notice.text}
        </p>
      ) : null}
    </form>
  );
}

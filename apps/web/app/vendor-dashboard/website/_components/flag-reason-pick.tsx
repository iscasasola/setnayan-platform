'use client';

import { useState } from 'react';
import { Flag } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { REVIEW_FLAG_REASON_LABEL } from '@/lib/reviews';

/**
 * Flag as fake — the reason is ONE PickMenu, never a raw <select> (house rule, guard
 * `lib/every-back-goes-home.test.ts` "no file draws more raw select"). The chosen value posts as the same `reason`
 * field the retired `/reviews` page sent (`<key>: <label>`), so `submitFlagAsFake` is unchanged. Submit stays
 * disabled until a reason is picked — the job the old `<select required>` did.
 */
const OPTIONS = (Object.entries(REVIEW_FLAG_REASON_LABEL) as Array<[string, string]>).map(([key, label]) => ({
  key: `${key}: ${label}`,
  label,
}));

export function FlagReasonPick() {
  const [reason, setReason] = useState('');
  return (
    <>
      <PickMenu
        label="Reason"
        value={reason}
        options={OPTIONS}
        onPick={setReason}
        buttonText={reason ? undefined : 'Select a reason…'}
        dataAttr="data-flag-reason"
        className="w-full !min-h-11 text-xs"
      />
      <input type="hidden" name="reason" value={reason} />
      <p className="text-[10px] text-ink/45">Setnayan HQ will review this within 48 hours. You can only flag a review once.</p>
      <SubmitButton
        disabled={!reason}
        className="inline-flex items-center gap-1.5 rounded-md bg-danger-600 px-3 py-2 text-xs font-medium text-white hover:bg-danger-700 disabled:opacity-60"
        pendingLabel="Flagging…"
      >
        <Flag className="h-3.5 w-3.5" strokeWidth={2} />
        Submit flag
      </SubmitButton>
    </>
  );
}

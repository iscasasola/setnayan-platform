'use client';

import { useState } from 'react';
import { Flag } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { actionButtonClass } from '@/components/action-button';
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
        className="w-full !min-h-11"
      />
      <input type="hidden" name="reason" value={reason} />
      <p className="text-xs text-[color:var(--m-slate-2)]">Setnayan HQ will review this within 48 hours. You can only flag a review once.</p>
      <SubmitButton
        disabled={!reason}
        className={actionButtonClass('danger')}
        pendingLabel="Flagging…"
      >
        <Flag className="h-3.5 w-3.5" strokeWidth={2} />
        Submit flag
      </SubmitButton>
    </>
  );
}

'use client';

/**
 * The three busy frames of final check B19, drawn with the REAL parts: the skeleton (`Sk`), the QR code maker’s upload slot
 * (`UploadSlotControl`), `SubmitButton` (pending) and `ActionButton busy`. Lab only — sample data.
 */
import { Save, Send } from 'lucide-react';
import { Sk } from '@/components/skeletons';
import { ActionButton } from '@/components/action-button';
import { SubmitButton } from '@/app/_components/submit-button';
import { UploadSlotControl, type UploadSlot } from '@/app/vendor-dashboard/invite/_components/locked-qr-generator';

const slot = (over: Partial<UploadSlot>): UploadSlot => ({
  ref: '',
  name: '',
  busy: false,
  err: '',
  onChange: () => undefined,
  retry: () => undefined,
  ...over,
});

export function BusyFrames() {
  return (
    <div className="mx-auto w-full max-w-xl space-y-6 px-4 py-6 sm:px-6" data-lab-busy="">
      <section data-lab-frame="analytics">
        <p className="mb-2 text-sn-sm text-[color:var(--m-slate-2)]">1 · Shop › Analytics while it loads</p>
        {/* The shop page's AnalyticsPlaceholder, as drawn there. */}
        <section aria-busy="true" aria-label="Analytics, loading">
          <div className="flex items-baseline justify-between pb-2 pt-2">
            <span className="sn-eye">Analytics</span>
          </div>
          <Sk className="h-[260px] rounded-2xl" />
        </section>
      </section>
      <section data-lab-frame="upload">
        <p className="text-sn-sm text-[color:var(--m-slate-2)]">2 · A proof photo while it uploads (the QR code maker)</p>
        <UploadSlotControl slot={slot({ busy: true })} accept="image/*" />
        <UploadSlotControl slot={slot({ err: 'Didn’t upload' })} accept="image/*" />
      </section>
      <section data-lab-frame="buttons">
        <p className="text-sn-sm text-[color:var(--m-slate-2)]">3 · A form button while it works</p>
        <form className="mt-3 flex flex-wrap gap-3" onSubmit={(e) => e.preventDefault()}>
          <SubmitButton pending overlay={false} pendingLabel="Saving…" className="button-primary inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm">
            <Save aria-hidden className="h-4 w-4" /> Save
          </SubmitButton>
          <ActionButton tone="brand" main icon={Send} label="Post" busy="Posting…" onClick={() => undefined} />
        </form>
      </section>
    </div>
  );
}

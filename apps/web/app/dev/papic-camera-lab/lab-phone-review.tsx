'use client';

/**
 * 📲 /dev/papic-camera-lab?lane=phone-review — the couple's side of guest upload v2 on fixtures (dev-only, like the
 * rest of this lab): the REAL "When do they show?" picker and the REAL Recap check + publish ask. Their saves POST to
 * /api/papic/phone-uploads, which a walk intercepts — nothing reaches a database.
 */
import { PhoneUploadsHeldPicker } from '@/app/dashboard/[eventId]/studio/papic/_components/phone-uploads-held-picker';
import { GuestPhoneReview, PublishRecapForm } from '@/app/dashboard/[eventId]/studio/papic/recap/_components/guest-phone-review';
import type { WaitingPhoneUpload } from '@/lib/papic-phone-uploads';

const LAB_EVENT = '00000000-0000-4000-8000-0000000000aa';
const tile = (c: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="${c}"/></svg>`)}`;
const WAITING: WaitingPhoneUpload[] = [
  { captureId: '00000000-0000-4000-8000-000000000001', who: 'Ana Reyes', at: '3:40 PM', media: 'photo', durationMs: null, url: tile('#8a5a3c') },
  { captureId: '00000000-0000-4000-8000-000000000002', who: 'Tito Ben', at: '4:30 PM', media: 'photo', durationMs: null, url: tile('#5a6b4a') },
  { captureId: '00000000-0000-4000-8000-000000000003', who: 'Lia Santos', at: '5:22 PM', media: 'photo', durationMs: null, url: tile('#3c5a7a') },
  { captureId: '00000000-0000-4000-8000-000000000004', who: 'Marco D.', at: '7:48 PM', media: 'clip', durationMs: 6000, url: tile('#7a3c5a') },
];

async function noop() {}

export function LabPhoneReview() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 bg-cream px-4 py-8">
      <section className="rounded-2xl bg-surface p-5" data-lab-phone-setting="">
        <h2 className="mb-3 text-base font-semibold text-ink">Photos from guests’ phones</h2>
        <PhoneUploadsHeldPicker eventId={LAB_EVENT} held />
      </section>
      <GuestPhoneReview eventId={LAB_EVENT} waiting={WAITING} />
      <section className="rounded-2xl bg-surface p-5">
        <h2 className="text-base font-semibold text-ink">Your recap is private</h2>
        <PublishRecapForm eventId={LAB_EVENT} action={noop} unchecked={WAITING.length} />
      </section>
    </div>
  );
}

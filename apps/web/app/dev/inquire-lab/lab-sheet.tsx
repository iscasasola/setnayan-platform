'use client';

/**
 * The lab's mount of the REAL Inquire pop-up — only the send is a stand-in (a lab must never write an inquiry), and it
 * shows what it was handed, so the proof says what the shop page would send.
 */
import { useState } from 'react';
import { InquireSheet, type InquireEvent, type InquireService } from '@/app/v/[slug]/_components/inquire-sheet';

export function LabInquireSheet({
  services,
  events,
  signedIn,
}: {
  services: InquireService[];
  events: InquireEvent[];
  signedIn: boolean;
}) {
  const [last, setLast] = useState<string | null>(null);
  return (
    <>
      <InquireSheet
        shop={{ vendorProfileId: 'S89V-LAB0000001', slug: 'setnaprod', name: 'SetnaProd (lab)' }}
        services={services}
        signedIn={signedIn}
        events={events}
        inquirySource="discover"
        referringChapterPublicId={null}
        send={async (input) => {
          setLast(
            JSON.stringify({
              eventId: input.eventId,
              initialServiceId: input.initialServiceId,
              alsoServiceIds: input.alsoServiceIds,
              initialCategoryKey: input.initialCategoryKey,
              general: input.general ?? false,
            }),
          );
          await new Promise((r) => setTimeout(r, 300));
          return { status: 'ok', threadId: 'lab-thread', eventId: input.eventId ?? 'lab-event', isExisting: false };
        }}
      />
      {last ? (
        <pre className="mx-4 mt-4 whitespace-pre-wrap break-all rounded-lg bg-ink/5 p-3 text-[11px] text-ink/70" data-lab-sent={last}>
          Sent (stand-in): {last}
        </pre>
      ) : null}
    </>
  );
}

'use client';

// The one form on BoothEventSection: pick a channel, submit, land on the ONE
// payment page (payPath). Client component only because useActionState needs
// it; the section around it is a server component.
import { useActionState, useState } from 'react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { actionButtonClass } from '@/components/action-button';
import { buyBoothBrandingForEvent, type BoothEventActionState } from '../booth-event-actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { type OpenRail } from '@/lib/payment-channels';
import { PaymentsPausedNote } from '@/app/vendor-dashboard/_components/payments-paused-note';

export function BoothEventBuyForm({
  eventId,
  pricePhp,
  openRails,
}: {
  eventId: string;
  pricePhp: number;
  /** openChannels(settings) — empty = payments paused; the form gives way to
   *  PaymentsPausedNote (the server action refuses the same case). */
  openRails: readonly OpenRail[];
}) {
  const [state, action] = useActionState<BoothEventActionState, FormData>(buyBoothBrandingForEvent, {
    status: 'idle',
  });
  const [channel, setChannel] = useState<string>(openRails[0]?.id ?? '');
  if (openRails.length === 0) return <PaymentsPausedNote className="mt-3" />;
  return (
    <form action={action} className="mt-3 flex flex-wrap items-center gap-2">
      <input type="hidden" name="event_id" value={eventId} />
      {/* Only the rails the owner has left open (lib/payment-channels.ts) — one ▾ picker (design template rule 4). */}
      <input type="hidden" name="channel" value={channel} />
      <PickMenu
        label="Pay with"
        value={channel}
        buttonText={`Pay with · ${openRails.find((r) => r.id === channel)?.label ?? ''}`}
        options={openRails.map((r) => ({ key: r.id, label: r.label }))}
        onPick={setChannel}
        dataAttr="data-booth-event-channel"
      />
      <SubmitButton
        pendingLabel="Starting your order"
        className={actionButtonClass('brand', { main: true, extra: '!h-11 !min-h-11' })}
      >
        Brand my booth here — ₱{pricePhp.toLocaleString('en-PH')}
      </SubmitButton>
      {state.status === 'error' ? (
        <p role="alert" className="basis-full text-[13px] font-semibold text-danger-700">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

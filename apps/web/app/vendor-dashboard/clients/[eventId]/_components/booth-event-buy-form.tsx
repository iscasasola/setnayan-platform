'use client';

// The one form on BoothEventSection: pick a channel, submit, land on the ONE
// payment page (payPath). Client component only because useActionState needs
// it; the section around it is a server component.
import { useActionState } from 'react';
import { buyBoothBrandingForEvent, type BoothEventActionState } from '../booth-event-actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { PAY_CHANNEL_LABEL, type PayChannel } from '@/lib/payment-channels';
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
  openRails: readonly PayChannel[];
}) {
  const [state, action] = useActionState<BoothEventActionState, FormData>(buyBoothBrandingForEvent, {
    status: 'idle',
  });
  if (openRails.length === 0) return <PaymentsPausedNote className="mt-3" />;
  return (
    <form action={action} className="mt-3 flex flex-wrap items-center gap-2">
      <input type="hidden" name="event_id" value={eventId} />
      <label className="sr-only" htmlFor="booth-event-channel">
        Pay with
      </label>
      <select
        id="booth-event-channel"
        name="channel"
        className="h-11 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink"
      >
        {/* Only the rails the owner has left open (lib/payment-channels.ts). */}
        {(['gcash', 'bdo'] as const)
          .filter((r) => openRails.includes(r))
          .map((r) => (
            <option key={r} value={r}>
              {PAY_CHANNEL_LABEL[r]}
            </option>
          ))}
      </select>
      <SubmitButton
        pendingLabel="Starting your order"
        className="inline-flex h-11 items-center rounded-md bg-mulberry px-5 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600"
      >
        Brand my booth here — ₱{pricePhp.toLocaleString('en-PH')}
      </SubmitButton>
      {state.status === 'error' ? (
        <p role="alert" className="basis-full text-xs text-terracotta-700">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

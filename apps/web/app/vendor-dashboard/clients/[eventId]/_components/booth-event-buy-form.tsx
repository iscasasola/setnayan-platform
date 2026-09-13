'use client';

// The one form on BoothEventSection: pick a channel, submit, land on the ONE
// payment page (payPath). Client component only because useActionState needs
// it; the section around it is a server component.
import { useActionState } from 'react';
import { buyBoothBrandingForEvent, type BoothEventActionState } from '../booth-event-actions';
import { SubmitButton } from '@/app/_components/submit-button';

export function BoothEventBuyForm({ eventId, pricePhp }: { eventId: string; pricePhp: number }) {
  const [state, action] = useActionState<BoothEventActionState, FormData>(buyBoothBrandingForEvent, {
    status: 'idle',
  });
  return (
    <form action={action} className="mt-3 flex flex-wrap items-center gap-2">
      <input type="hidden" name="event_id" value={eventId} />
      <label className="sr-only" htmlFor="booth-event-channel">
        Pay with
      </label>
      <select
        id="booth-event-channel"
        name="channel"
        defaultValue="gcash"
        className="h-11 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink"
      >
        <option value="gcash">GCash</option>
        <option value="bdo">BDO</option>
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

'use client';

import { useState, useTransition } from 'react';
import { Check, Plus, AlertCircle } from 'lucide-react';
import { offerServiceInterest, type OfferServiceResult } from '../actions';
import { useSaveLoader } from '@/components/sd-loader';
import { ActionButton } from '@/components/action-button';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';

export type VendorOfferOption = {
  vendorServiceId: string;
  label: string;
};

/**
 * Vendor inverse cross-sell control (owner-locked 2026-06-12) — "Offer another
 * service": the vendor picks one of their own services NOT already on the
 * thread's interest list and records it as source='vendor_offered'.
 *
 * ── WHAT THE COUPLE RECEIVES (owner 2026-09-09) ────────────────────────────
 * THE CARD THIS VENDOR BUILT — cover photograph, showcase clip, price, what is
 * included — posted into the conversation by `offerServiceCore` and drawn by
 * `chat-offered-service-card.tsx` from the same `ServiceCardFace` the vendor
 * sees in their own services list.
 *
 * It used to be a word in the shared "Inquiring about" chip row and nothing
 * else. That row still renders (it is the running list of what the inquiry
 * covers); it is no longer the only thing that happens.
 */
export function VendorOfferService({
  threadId,
  options,
}: {
  threadId: string;
  options: VendorOfferOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState('');
  const save = useSaveLoader();
  const [state, setState] = useState<
    { kind: 'idle' } | { kind: 'done' } | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  if (options.length === 0) return null;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (pending || !selected) return;
        const fd = new FormData();
        fd.set('thread_id', threadId);
        fd.set('vendor_service_id', selected);
        startTransition(async () => {
          const result: OfferServiceResult = await save.run(
            () => offerServiceInterest(fd),
            { steps: ['Sending your offer'], hint: 'Saving' },
          );
          if (result.status === 'ok') {
            setState({ kind: 'done' });
            setSelected('');
            return;
          }
          setState({
            kind: 'error',
            message:
              result.status === 'error'
                ? result.message
                : 'Could not offer that service. Refresh and try again.',
          });
        });
      }}
      // Rule 2 · no card around it: the label, the pick and its button on one line of the panel.
      className="flex flex-wrap items-center gap-2 py-1"
    >
      <span className="text-[13px] font-semibold text-ink">Offer another service</span>
      {/* Rule 4 · a set of choices is ONE PickMenu (never a native select). */}
      <PickMenu
        label="Offer another service"
        value={selected}
        options={[{ key: '', label: 'Pick a service…' }, ...options.map((o) => ({ key: o.vendorServiceId, label: o.label }))]}
        onPick={(key) => {
          if (pending) return;
          setSelected(key);
          if (state.kind !== 'idle') setState({ kind: 'idle' });
        }}
        dataAttr="data-offer-service"
        className="min-w-[10rem] !min-h-11"
      />
      <ActionButton
        type="submit"
        tone="neutral"
        icon={<Plus aria-hidden strokeWidth={2} />}
        label={pending ? 'Sending…' : 'Send card'}
        disabled={pending || !selected}
      />
      {state.kind === 'done' ? (
        <span className="inline-flex items-center gap-1 text-[13px]" style={{ color: 'rgb(var(--color-ok))' }}>
          <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
          Card sent
        </span>
      ) : state.kind === 'error' ? (
        <span role="alert" className="inline-flex items-center gap-1 text-[13px]" style={{ color: 'rgb(var(--color-danger))' }}>
          <AlertCircle aria-hidden className="h-4 w-4" strokeWidth={2} />
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

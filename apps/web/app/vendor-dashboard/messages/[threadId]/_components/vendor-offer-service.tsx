'use client';

import { useState, useTransition } from 'react';
import { Check, Plus, AlertCircle, Loader2 } from 'lucide-react';
import { offerServiceInterest, type OfferServiceResult } from '../actions';

export type VendorOfferOption = {
  vendorServiceId: string;
  label: string;
};

/**
 * Vendor inverse cross-sell control (owner-locked 2026-06-12) — "Offer another
 * service": the vendor picks one of their own services NOT already on the
 * thread's interest list and records it as source='vendor_offered'. The couple
 * then sees it in the shared "Inquiring about" chip row on their thread view.
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
          const result: OfferServiceResult = await offerServiceInterest(fd);
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
      className="flex flex-wrap items-center gap-2 rounded-xl border border-ink/10 bg-cream/40 px-4 py-2.5"
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
        Offer another service
      </span>
      <select
        value={selected}
        onChange={(e) => {
          setSelected(e.target.value);
          if (state.kind !== 'idle') setState({ kind: 'idle' });
        }}
        disabled={pending}
        className="min-w-[10rem] rounded-md border border-ink/15 bg-cream px-2.5 py-1.5 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
      >
        <option value="">Pick a service…</option>
        {options.map((o) => (
          <option key={o.vendorServiceId} value={o.vendorServiceId}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending || !selected}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-ink/20 px-3 text-sm font-medium text-ink transition-colors hover:bg-ink/5 disabled:cursor-default disabled:opacity-60"
      >
        {pending ? (
          <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
        ) : (
          <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        )}
        {pending ? 'Adding…' : 'Add'}
      </button>
      {state.kind === 'done' ? (
        <span className="inline-flex items-center gap-1 text-xs text-success-700">
          <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Offered
        </span>
      ) : state.kind === 'error' ? (
        <span className="inline-flex items-center gap-1 text-xs text-danger-700">
          <AlertCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

'use client';

// One-tap "request a discount / inclusion" suggestion (negotiation Phase 2).
// Renders under the sender's OWN message when the deterministic reader flags a
// discount or inclusion topic. Tapping opens a tiny form → createChangeRequest
// FromChat, which posts the in-thread change-order card the other side then
// accepts / counters / declines. Suggestion-grade — a false read is just an
// ignorable chip. A message can raise BOTH (shows both chips).

import { useState } from 'react';
import { detectNegotiation } from '@/lib/chat-negotiation-detect';
import { createChangeRequestFromChat } from './negotiation-actions';

function numFromExcerpt(excerpt?: string): string {
  if (!excerpt) return '';
  const m = excerpt.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return m ? m[0] : '';
}

function DiscountForm({ threadId, returnPath, prefill }: { threadId: string; returnPath: string; prefill: string }) {
  return (
    <form
      action={createChangeRequestFromChat}
      className="mt-1.5 flex flex-col gap-2 rounded-xl border border-mulberry/20 bg-mulberry/[0.04] p-2.5"
    >
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="return_to" value={returnPath} />
      <input type="hidden" name="request_kind" value="discount" />
      <label className="flex flex-col gap-1 text-[11px] font-medium text-ink/60">
        Discount (₱ off)
        <input
          type="number"
          name="amount"
          min="1"
          step="1"
          required
          defaultValue={prefill}
          className="input-field h-9 text-sm"
        />
      </label>
      <input type="text" name="note" maxLength={200} placeholder="Note (optional)" className="input-field h-9 text-sm" />
      <button className="inline-flex h-9 items-center self-start rounded-lg bg-mulberry px-3.5 text-sm font-medium text-cream hover:bg-mulberry-600">
        Send discount request
      </button>
    </form>
  );
}

function InclusionForm({ threadId, returnPath, prefill }: { threadId: string; returnPath: string; prefill: string }) {
  return (
    <form
      action={createChangeRequestFromChat}
      className="mt-1.5 flex flex-col gap-2 rounded-xl border border-mulberry/20 bg-mulberry/[0.04] p-2.5"
    >
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="return_to" value={returnPath} />
      <input type="hidden" name="request_kind" value="inclusion" />
      <input
        type="text"
        name="title"
        required
        maxLength={120}
        defaultValue={prefill}
        placeholder="What to include (e.g. second photographer)"
        className="input-field h-9 text-sm"
      />
      <label className="flex flex-col gap-1 text-[11px] font-medium text-ink/60">
        Your offer (₱, optional)
        <input type="number" name="amount" min="1" step="1" className="input-field h-9 text-sm" />
      </label>
      <button className="inline-flex h-9 items-center self-start rounded-lg bg-mulberry px-3.5 text-sm font-medium text-cream hover:bg-mulberry-600">
        Send inclusion request
      </button>
    </form>
  );
}

export function ChangeRequestSuggestChip({
  threadId,
  returnPath,
  body,
}: {
  threadId: string;
  returnPath: string;
  body: string;
}) {
  const signals = detectNegotiation(body).signals;
  const discount = signals.find((s) => s.type === 'discount');
  const inclusion = signals.find((s) => s.type === 'inclusion');
  const [open, setOpen] = useState<'discount' | 'inclusion' | null>(null);

  if (!discount && !inclusion) return null;

  return (
    <div className="mt-1 flex flex-col items-start gap-1">
      {open === null ? (
        <div className="flex flex-wrap gap-1.5">
          {discount ? (
            <button
              type="button"
              onClick={() => setOpen('discount')}
              className="inline-flex items-center gap-1.5 rounded-full border border-mulberry/30 bg-mulberry/[0.06] px-3 py-1 text-xs font-medium text-mulberry hover:bg-mulberry/10"
            >
              💸 Request a discount
            </button>
          ) : null}
          {inclusion ? (
            <button
              type="button"
              onClick={() => setOpen('inclusion')}
              className="inline-flex items-center gap-1.5 rounded-full border border-mulberry/30 bg-mulberry/[0.06] px-3 py-1 text-xs font-medium text-mulberry hover:bg-mulberry/10"
            >
              ➕ Request an inclusion
            </button>
          ) : null}
        </div>
      ) : (
        <div className="w-full max-w-[80%]">
          {open === 'discount' ? (
            <DiscountForm threadId={threadId} returnPath={returnPath} prefill={numFromExcerpt(discount?.excerpt)} />
          ) : (
            <InclusionForm threadId={threadId} returnPath={returnPath} prefill={inclusion?.excerpt ?? ''} />
          )}
          <button
            type="button"
            onClick={() => setOpen(null)}
            className="mt-1 text-xs text-ink/50 hover:text-ink"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

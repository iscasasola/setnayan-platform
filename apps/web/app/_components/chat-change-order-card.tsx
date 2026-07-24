'use client';

// In-thread change-order card (negotiation Phase 2). Renders a discount /
// inclusion request that landed in the chat stream (a chat_messages row with
// change_order_id set) and gives the COUNTERPARTY accept / counter / decline —
// all backed by the existing accept_change_order / decline_change_order RPCs +
// (for counter) a fresh opposite-role change order. The proposer sees status.

import { useState } from 'react';
import {
  respondChangeRequestFromChat,
  counterChangeRequestFromChat,
} from './negotiation-actions';

export type ChatChangeOrderData = {
  change_order_id: string;
  title: string;
  delta_amount_php: number;
  status: 'proposed' | 'accepted' | 'declined' | 'withdrawn';
  raised_by: 'couple' | 'vendor' | null;
};

type Props = {
  data: ChatChangeOrderData;
  viewerRole: 'couple' | 'vendor';
  threadId: string;
  returnPath: string;
};

function peso(n: number): string {
  return `₱${Math.abs(n).toLocaleString('en-PH')}`;
}

const STATUS_META: Record<ChatChangeOrderData['status'], { label: string; cls: string }> = {
  proposed: { label: 'Awaiting response', cls: 'bg-warn-100 text-warn-900' },
  accepted: { label: 'Accepted', cls: 'bg-success-100 text-success-900' },
  declined: { label: 'Declined', cls: 'bg-ink/5 text-ink/50' },
  withdrawn: { label: 'Withdrawn', cls: 'bg-ink/5 text-ink/50' },
};

export function ChatChangeOrderCard({ data, viewerRole, threadId, returnPath }: Props) {
  const [counterOpen, setCounterOpen] = useState(false);
  const isDiscount = data.delta_amount_php < 0;
  const isProposer = data.raised_by === viewerRole;
  const canAct = data.status === 'proposed' && !isProposer;
  const meta = STATUS_META[data.status];

  const amountLine = isDiscount
    ? `${peso(data.delta_amount_php)} off`
    : data.delta_amount_php > 0
      ? `+${peso(data.delta_amount_php)}`
      : 'Please include — price to confirm';

  const hidden = (
    <>
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="change_order_id" value={data.change_order_id} />
      <input type="hidden" name="return_to" value={returnPath} />
    </>
  );

  return (
    <div className="w-full max-w-[92%] rounded-xl border border-terracotta/40 bg-terracotta/[0.06] p-3">
      <div className="flex items-center gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
          {isDiscount ? '💸 Discount request' : '➕ Inclusion request'}
        </p>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.cls}`}>
          {meta.label}
        </span>
      </div>
      <p className="mt-1 text-sm font-semibold text-ink">{data.title}</p>
      <p className="text-sm text-ink/70">{amountLine}</p>

      {canAct ? (
        <div className="mt-2.5 flex flex-wrap gap-2">
          <form action={respondChangeRequestFromChat}>
            {hidden}
            <input type="hidden" name="decision" value="accept" />
            <button className="inline-flex h-9 items-center rounded-lg bg-mulberry px-3.5 text-sm font-medium text-cream hover:bg-mulberry-600">
              Accept
            </button>
          </form>
          <button
            type="button"
            onClick={() => setCounterOpen((v) => !v)}
            className="inline-flex h-9 items-center rounded-lg border border-ink/20 px-3.5 text-sm font-medium text-ink/75 hover:bg-ink/[0.04]"
          >
            Counter
          </button>
          <form action={respondChangeRequestFromChat}>
            {hidden}
            <input type="hidden" name="decision" value="decline" />
            <button className="inline-flex h-9 items-center rounded-lg border border-ink/15 px-3.5 text-sm font-medium text-terracotta hover:bg-terracotta/5">
              Decline
            </button>
          </form>
        </div>
      ) : null}

      {canAct && counterOpen ? (
        <form
          action={counterChangeRequestFromChat}
          className="mt-2.5 flex flex-col gap-2 rounded-lg border border-ink/10 bg-cream p-2.5"
        >
          {hidden}
          <input type="hidden" name="request_kind" value={isDiscount ? 'discount' : 'inclusion'} />
          {!isDiscount ? (
            <input
              type="text"
              name="title"
              defaultValue={data.title}
              maxLength={120}
              placeholder="Inclusion"
              className="input-field h-9 text-sm"
            />
          ) : null}
          <label className="flex flex-col gap-1 text-[11px] font-medium text-ink/60">
            {isDiscount ? 'Your counter (₱ off)' : 'Price (₱)'}
            <input
              type="number"
              name="amount"
              min="1"
              step="1"
              required
              className="input-field h-9 text-sm"
            />
          </label>
          <button className="inline-flex h-9 items-center self-start rounded-lg bg-mulberry px-3.5 text-sm font-medium text-cream hover:bg-mulberry-600">
            Send counter
          </button>
        </form>
      ) : null}

      {data.status === 'proposed' && isProposer ? (
        <p className="mt-2 text-xs text-ink/55">
          Waiting for {viewerRole === 'couple' ? 'the vendor' : 'the couple'} to respond.
        </p>
      ) : null}
    </div>
  );
}

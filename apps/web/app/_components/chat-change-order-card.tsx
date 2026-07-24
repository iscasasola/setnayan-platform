'use client';

// In-thread change-order card (negotiation Phase 2) — rendered as a structured
// information card (NegotiationCardShell). The COUNTERPARTY gets accept /
// counter / decline (backed by accept_change_order / decline_change_order + a
// fresh opposite-role change order for counter); the proposer sees status.

import { useState } from 'react';
import {
  respondChangeRequestFromChat,
  counterChangeRequestFromChat,
} from './negotiation-actions';
import { NegotiationCardShell, type NegRow, type NegStatusTone } from './negotiation-card-shell';

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

const STATUS: Record<ChatChangeOrderData['status'], { tone: NegStatusTone; label: string }> = {
  proposed: { tone: 'awaiting', label: 'Awaiting' },
  accepted: { tone: 'agreed', label: 'Accepted' },
  declined: { tone: 'declined', label: 'Declined' },
  withdrawn: { tone: 'declined', label: 'Withdrawn' },
};

export function ChatChangeOrderCard({ data, viewerRole, threadId, returnPath }: Props) {
  const [counterOpen, setCounterOpen] = useState(false);
  const isDiscount = data.delta_amount_php < 0;
  const isProposer = data.raised_by === viewerRole;
  const canAct = data.status === 'proposed' && !isProposer;
  const st = STATUS[data.status];

  const amountValue = isDiscount
    ? `${peso(data.delta_amount_php)} off`
    : data.delta_amount_php > 0
      ? `+${peso(data.delta_amount_php)}`
      : 'Price to confirm';

  const rows: NegRow[] = [
    { label: isDiscount ? 'Discount' : 'Price', value: amountValue },
    {
      label: 'Requested by',
      value: isProposer ? 'You' : viewerRole === 'couple' ? 'The vendor' : 'The couple',
    },
  ];

  const hidden = (
    <>
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="change_order_id" value={data.change_order_id} />
      <input type="hidden" name="return_to" value={returnPath} />
    </>
  );

  const footer = canAct ? (
    <>
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
      {counterOpen ? (
        <form action={counterChangeRequestFromChat} className="mt-1 flex w-full flex-col gap-2">
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
            <input type="number" name="amount" min="1" step="1" required className="input-field h-9 text-sm" />
          </label>
          <button className="inline-flex h-9 items-center self-start rounded-lg bg-mulberry px-3.5 text-sm font-medium text-cream hover:bg-mulberry-600">
            Send counter
          </button>
        </form>
      ) : null}
    </>
  ) : null;

  return (
    <NegotiationCardShell
      type={isDiscount ? 'discount' : 'inclusion'}
      title={data.title}
      statusTone={st.tone}
      statusLabel={st.label}
      rows={rows}
      footer={footer}
    />
  );
}

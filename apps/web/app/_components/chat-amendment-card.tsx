'use client';

// In-thread bundled proposal amendment card (negotiation Phase 3). Shows the
// CURRENT proposal total and the REQUESTED changes (discount / add-on / freebie /
// specialized request) → NEW total. The counterparty accepts / counters /
// declines the whole bundle; accepted 'request' items become a checklist the
// vendor marks delivered. Styled to match the info-card family.

import { useState } from 'react';
import { ReceiptText, Check } from 'lucide-react';
import {
  respondAmendmentFromChat,
  counterAmendmentFromChat,
  markAmendmentItemDelivered,
} from './negotiation-actions';
import { AmendmentBuilder, type AmendmentBuilderRow } from './amendment-builder';
import {
  ITEM_KIND_LABEL,
  isMoneyKind,
  newTotalPhp,
  pesoLabel,
  type AmendmentItemKind,
  type AmendmentStatus,
} from '@/lib/proposal-amendments';

export type AmendmentItemView = {
  item_id: string;
  kind: AmendmentItemKind;
  label: string;
  amount_php: number | null;
  delivered_at: string | null;
};

export type ChatAmendmentData = {
  amendment_id: string;
  status: AmendmentStatus;
  raised_by: 'couple' | 'vendor' | null;
  note: string | null;
  baseTotalCentavos: number | null;
};

type Props = {
  data: ChatAmendmentData;
  items: AmendmentItemView[];
  viewerRole: 'couple' | 'vendor';
  threadId: string;
  returnPath: string;
};

const STATUS: Record<AmendmentStatus, { label: string; cls: string }> = {
  proposed: { label: 'Awaiting', cls: 'bg-warn-100 text-warn-900' },
  accepted: { label: 'Accepted', cls: 'bg-success-100 text-success-900' },
  declined: { label: 'Declined', cls: 'bg-ink/10 text-ink/55' },
  withdrawn: { label: 'Withdrawn', cls: 'bg-ink/10 text-ink/55' },
};

function amountText(kind: AmendmentItemKind, amount: number | null): string {
  if (kind === 'freebie') return 'Free';
  if (kind === 'request') return '—';
  if (amount == null) return '—';
  return `${amount < 0 ? '−' : '+'}₱${Math.abs(amount).toLocaleString('en-PH')}`;
}

export function ChatAmendmentCard({ data, items, viewerRole, threadId, returnPath }: Props) {
  const [counterOpen, setCounterOpen] = useState(false);
  const isProposer = data.raised_by === viewerRole;
  const canAct = data.status === 'proposed' && !isProposer;
  const isAccepted = data.status === 'accepted';
  const meta = STATUS[data.status];
  const newTotal = newTotalPhp(data.baseTotalCentavos, items);

  const hidden = (
    <>
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="amendment_id" value={data.amendment_id} />
      <input type="hidden" name="return_to" value={returnPath} />
    </>
  );

  const counterInitial: AmendmentBuilderRow[] = items.map((it) => ({
    kind: it.kind,
    label: it.label,
    amount: isMoneyKind(it.kind) && it.amount_php != null ? String(Math.abs(it.amount_php)) : '',
  }));

  return (
    <div className="w-full max-w-[92%] overflow-hidden rounded-xl border border-ink/10 border-l-[3px] border-l-mulberry bg-surface shadow-sm">
      <div className="flex items-center gap-3 px-3.5 py-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-mulberry/10 text-mulberry">
          <ReceiptText className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50">
            Proposal changes
          </p>
          <p className="truncate text-[15px] font-medium text-ink">
            {items.length} item{items.length === 1 ? '' : 's'} requested
          </p>
        </div>
        <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.cls}`}>
          {meta.label}
        </span>
      </div>

      <div className="border-t border-ink/10 px-3.5 py-3">
        {data.baseTotalCentavos != null ? (
          <p className="mb-2 text-[13px] text-ink/60">
            Current proposal: ₱{(data.baseTotalCentavos / 100).toLocaleString('en-PH')}
          </p>
        ) : null}

        <ul className="space-y-1.5">
          {items.map((it) => (
            <li key={it.item_id} className="flex items-center gap-2 text-[13px]">
              <span className="rounded bg-ink/[0.05] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink/55">
                {ITEM_KIND_LABEL[it.kind]}
              </span>
              <span className="min-w-0 flex-1 truncate text-ink/85">{it.label}</span>
              {it.kind === 'request' && isAccepted ? (
                it.delivered_at ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success-700">
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden /> Delivered
                  </span>
                ) : viewerRole === 'vendor' ? (
                  <form action={markAmendmentItemDelivered}>
                    <input type="hidden" name="thread_id" value={threadId} />
                    <input type="hidden" name="item_id" value={it.item_id} />
                    <input type="hidden" name="return_to" value={returnPath} />
                    <button className="rounded-md border border-ink/15 px-2 py-0.5 text-[11px] font-medium text-ink/70 hover:bg-ink/[0.04]">
                      Mark delivered
                    </button>
                  </form>
                ) : (
                  <span className="text-[11px] text-ink/45">Pending</span>
                )
              ) : (
                <span className={`shrink-0 font-medium ${it.kind === 'discount' ? 'text-terracotta' : 'text-ink/70'}`}>
                  {amountText(it.kind, it.amount_php)}
                </span>
              )}
            </li>
          ))}
        </ul>

        {newTotal != null ? (
          <p className="mt-2.5 border-t border-ink/10 pt-2 text-sm font-medium text-ink">
            New total: ₱{newTotal.toLocaleString('en-PH')}
          </p>
        ) : null}

        {data.note ? <p className="mt-2 text-[13px] text-ink/60">“{data.note}”</p> : null}
      </div>

      {canAct ? (
        <div className="flex flex-wrap gap-2 border-t border-ink/10 bg-ink/[0.02] px-3.5 py-2.5">
          <form action={respondAmendmentFromChat}>
            {hidden}
            <input type="hidden" name="decision" value="accept" />
            <button className="inline-flex h-9 items-center rounded-lg bg-mulberry px-3.5 text-sm font-medium text-cream hover:bg-mulberry-600">
              Accept all
            </button>
          </form>
          <button
            type="button"
            onClick={() => setCounterOpen((v) => !v)}
            className="inline-flex h-9 items-center rounded-lg border border-ink/20 px-3.5 text-sm font-medium text-ink/75 hover:bg-ink/[0.04]"
          >
            Counter
          </button>
          <form action={respondAmendmentFromChat}>
            {hidden}
            <input type="hidden" name="decision" value="decline" />
            <button className="inline-flex h-9 items-center rounded-lg border border-ink/15 px-3.5 text-sm font-medium text-terracotta hover:bg-terracotta/5">
              Decline
            </button>
          </form>
          {counterOpen ? (
            <AmendmentBuilder
              action={counterAmendmentFromChat}
              threadId={threadId}
              returnPath={returnPath}
              amendmentId={data.amendment_id}
              submitLabel="Send counter"
              initial={counterInitial}
              onCancel={() => setCounterOpen(false)}
            />
          ) : null}
        </div>
      ) : null}

      {data.status === 'proposed' && isProposer ? (
        <p className="border-t border-ink/10 px-3.5 py-2 text-xs text-ink/55">
          Waiting for {viewerRole === 'couple' ? 'the vendor' : 'the couple'} to respond.
        </p>
      ) : null}
    </div>
  );
}

'use client';

// ==========================================================================
// Delivery Handover — COUPLE surface (Wave 4 day-of run-of-show & handover).
//
// Lists the vendor's posted handovers (gallery link / proof image / note /
// sign-off) and lets the couple CONFIRM RECEIPT. Confirming calls the
// single-winner acknowledge_handover RPC (via the acknowledgeHandover action),
// which is idempotent — a double-click is a benign no-op. The "also mark this
// vendor delivered" toggle reuses the existing delivered transition (which owns
// the review-request emit). Operational only — no money.
// ==========================================================================

import { useState, useTransition } from 'react';
import {
  PackageCheck,
  CheckCircle2,
  Link2,
  FileText,
  MessageSquare,
} from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Badge } from '@/app/_components/badge';
import { InfoTip } from '@/app/_components/info-tip';
import { acknowledgeHandover } from '../../../actions';
import { useSaveLoader } from '@/components/sd-loader';

export type HandoverRow = {
  handover_id: string;
  kind: 'gallery_link' | 'file' | 'note' | 'signoff';
  label: string | null;
  payload: string | null;
  status: 'delivered' | 'acknowledged' | 'disputed';
  delivered_at: string;
  couple_acknowledged_at: string | null;
};

type Props = {
  eventId: string;
  vendorId: string;
  vendorName: string;
  handovers: HandoverRow[];
  /** True when the booking isn't already delivered/complete — drives whether we
   *  offer the "also mark delivered" opt-in on confirm. */
  canAdvanceToDelivered: boolean;
};

const KIND_META: Record<
  HandoverRow['kind'],
  { label: string; Icon: typeof Link2 }
> = {
  gallery_link: { label: 'Album link', Icon: Link2 },
  file: { label: 'Sample / proof', Icon: FileText },
  note: { label: 'Note', Icon: MessageSquare },
  signoff: { label: 'All delivered', Icon: PackageCheck },
};

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

export function HandoverInbox({
  eventId,
  vendorId,
  vendorName,
  handovers,
  canAdvanceToDelivered,
}: Props) {
  if (handovers.length === 0) return null;

  return (
    // 📐 DESIGN TEMPLATE (14 Nov 2026, rules 2 · 3 · 5 · 7 · 11 · 13 · 15): no card — the section's grey capitals with
    // what "confirm" records behind ⓘ; each handover a plain row (a gold edge while it waits on you), its state a soft
    // chip, Confirm receipt the shared green pill (grey while it saves, no spinner).
    <div className="space-y-1">
      <p className="mb-1 mt-[18px] flex items-center gap-2">
        <PackageCheck aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
        <InfoTip
          label="Delivery handover"
          labelAs="span"
          labelClassName="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70"
          align="start"
        >
          {vendorName} sent these. Confirm receipt once you have everything — it records that the work was delivered.
        </InfoTip>
      </p>
      <ul className="divide-y divide-ink/10">
        {handovers.map((h) => (
          <HandoverItem
            key={h.handover_id}
            eventId={eventId}
            vendorId={vendorId}
            handover={h}
            canAdvanceToDelivered={canAdvanceToDelivered}
          />
        ))}
      </ul>
    </div>
  );
}

function HandoverItem({
  eventId,
  vendorId,
  handover,
  canAdvanceToDelivered,
}: {
  eventId: string;
  vendorId: string;
  handover: HandoverRow;
  canAdvanceToDelivered: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // ☐ Starts UNTICKED (walk 13 Nov 2026, F-W1-72): marking a supplier delivered is the couple's own choice, never a default.
  const [advance, setAdvance] = useState(false);
  const save = useSaveLoader();
  const { label, Icon } = KIND_META[handover.kind];
  const acked = handover.status === 'acknowledged';

  function confirm() {
    setErrorMsg(null);
    const form = new FormData();
    form.set('handover_id', handover.handover_id);
    form.set('event_id', eventId);
    form.set('vendor_id', vendorId);
    if (advance) form.set('advance_status', 'on');
    startTransition(async () => {
      const result = await save.run(() => acknowledgeHandover(form), {
        steps: ['Confirming receipt'],
        hint: 'Saving',
      });
      if (result.status === 'error') {
        setErrorMsg(result.message ?? 'Could not confirm — please try again.');
      } else if (result.status === 'not_signed_in') {
        setErrorMsg('Please sign in again to confirm receipt.');
      }
      // 'ok' / 'already' / 'not_ackable' all resolve to a confirmed view via
      // the server revalidate; no extra client state needed.
    });
  }

  return (
    <li className={`min-h-14 py-2.5 ${acked ? '' : 'border-l-[3px] border-l-terracotta pl-3'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          <Icon aria-hidden className="h-4 w-4 text-ink/70" strokeWidth={1.75} />
          {label}
          {handover.label ? <span className="font-normal text-ink/70">· {handover.label}</span> : null}
        </p>
        {acked ? (
          <Badge tone="ok">Confirmed {fmtDate(handover.couple_acknowledged_at)}</Badge>
        ) : (
          <Badge tone="wait">Awaiting your confirmation</Badge>
        )}
      </div>

      {/* The deliverable itself. */}
      {handover.kind === 'gallery_link' && handover.payload ? (
        <a
          href={handover.payload}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-sn-accent underline-offset-2 hover:underline"
        >
          <Link2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Open album
        </a>
      ) : handover.kind === 'file' && handover.payload ? (
        <a
          href={handover.payload}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-sn-accent underline-offset-2 hover:underline"
        >
          <FileText aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          View file
        </a>
      ) : handover.payload ? (
        <p className="mt-1 whitespace-pre-wrap text-[13px] text-ink/70">{handover.payload}</p>
      ) : null}

      {!acked ? (
        <div className="mt-2 space-y-2">
          {canAdvanceToDelivered ? (
            <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={advance}
                onChange={(e) => setAdvance(e.target.checked)}
                className="h-4 w-4 rounded border-ink/30 accent-mulberry"
              />
              Also mark this supplier delivered (asks you for a review)
            </label>
          ) : null}
          {errorMsg ? (
            <p role="alert" className="text-[13px] font-medium text-[rgb(var(--color-danger))]">
              {errorMsg}
            </p>
          ) : null}
          <ActionButton tone="ok" icon={CheckCircle2} label="Confirm receipt" onClick={confirm} waiting={pending} />
        </div>
      ) : null}
    </li>
  );
}

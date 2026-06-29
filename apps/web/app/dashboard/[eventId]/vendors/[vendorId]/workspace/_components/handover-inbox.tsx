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
  Clock,
  Link2,
  FileText,
  MessageSquare,
  Loader2,
} from 'lucide-react';
import { acknowledgeHandover } from '../../../actions';

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
  gallery_link: { label: 'Gallery link', Icon: Link2 },
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
    <div className="space-y-2 rounded-lg border border-ink/10 bg-white/60 p-4">
      <p className="flex items-center gap-2 text-xs font-semibold text-ink">
        <PackageCheck aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
        Delivery handover
      </p>
      <p className="text-[11px] text-ink/60">
        {vendorName} sent these. Confirm receipt once you have everything — it
        records that the work was delivered.
      </p>
      <ul className="space-y-2 pt-1">
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
  const [advance, setAdvance] = useState(canAdvanceToDelivered);
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
      const result = await acknowledgeHandover(form);
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
    <li className="rounded-lg border border-ink/10 bg-cream/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-medium text-ink">
          <Icon aria-hidden className="h-3.5 w-3.5 text-ink/55" strokeWidth={1.75} />
          {label}
          {handover.label ? <span className="text-ink/60">· {handover.label}</span> : null}
        </p>
        {acked ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success-400 bg-success-50 px-2.5 py-1 text-[11px] font-semibold text-success-700">
            <CheckCircle2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Confirmed {fmtDate(handover.couple_acknowledged_at)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-warn-300 bg-warn-50 px-2.5 py-1 text-[11px] font-semibold text-warn-900">
            <Clock aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Awaiting your confirmation
          </span>
        )}
      </div>

      {/* The deliverable itself. */}
      {handover.kind === 'gallery_link' && handover.payload ? (
        <a
          href={handover.payload}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-medium text-terracotta underline-offset-2 hover:underline"
        >
          <Link2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Open gallery
        </a>
      ) : handover.kind === 'file' && handover.payload ? (
        <a
          href={handover.payload}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-medium text-terracotta underline-offset-2 hover:underline"
        >
          <FileText aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          View file
        </a>
      ) : handover.payload ? (
        <p className="mt-1 whitespace-pre-wrap text-[11px] text-ink/70">{handover.payload}</p>
      ) : null}

      {!acked ? (
        <div className="mt-2 space-y-2">
          {canAdvanceToDelivered ? (
            <label className="flex items-center gap-2 text-[11px] text-ink/65">
              <input
                type="checkbox"
                checked={advance}
                onChange={(e) => setAdvance(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-ink/30 text-terracotta focus:ring-terracotta"
              />
              Also mark this vendor delivered (asks you for a review)
            </label>
          ) : null}
          {errorMsg ? (
            <p role="alert" className="text-[11px] font-medium text-danger-600">
              {errorMsg}
            </p>
          ) : null}
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-terracotta bg-terracotta px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-terracotta/90 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <CheckCircle2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            )}
            Confirm receipt
          </button>
        </div>
      ) : null}
    </li>
  );
}

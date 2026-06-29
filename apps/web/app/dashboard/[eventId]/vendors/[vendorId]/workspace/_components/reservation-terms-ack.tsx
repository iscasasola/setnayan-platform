/**
 * ReservationTermsAck — No-Show Downpayment Protection · couple read-only view.
 *
 * Renders the FROZEN reservation-terms acknowledgement beside the payment plan
 * on the couple's per-vendor workspace. The couple ticked these terms before the
 * booking locked; the snapshot is immutable evidence (a later vendor policy edit
 * can NOT rewrite it). Setnayan never holds the downpayment — this is the
 * couple's recorded consent + the defensible paper trail for a forfeit dispute.
 *
 * Server component (no interactivity) — it only displays the frozen snapshot.
 */
import { ShieldCheck } from 'lucide-react';
import type { PolicyAcknowledgement } from '@/lib/vendor-service-payment-schedules.server';

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function ReservationTermsAck({
  ack,
  vendorName,
}: {
  ack: PolicyAcknowledgement;
  vendorName: string;
}) {
  const p = ack.snapshot;
  const amountLabel =
    p.downpayment_amount_php != null
      ? `₱${Math.round(p.downpayment_amount_php).toLocaleString('en-PH')}`
      : null;

  return (
    <div className="space-y-2 rounded-lg border border-terracotta/25 bg-terracotta/[0.04] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
          <ShieldCheck aria-hidden className="h-3.5 w-3.5 text-terracotta" strokeWidth={1.75} />
          Reservation terms
        </p>
        <span className="rounded-full bg-terracotta/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-terracotta-700">
          Acknowledged {fmtDate(ack.acknowledgedAt)}
        </span>
      </div>

      <p className="text-[11px] leading-snug text-ink/55">
        You agreed to {vendorName}&rsquo;s downpayment policy when you locked this
        booking. These are the exact terms on record — they can&rsquo;t be changed
        after the fact.
      </p>

      <ul className="space-y-1.5 text-xs text-ink/85">
        {p.downpayment_non_refundable ? (
          <li className="flex items-start gap-1.5">
            <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta" />
            <span>
              The downpayment{amountLabel ? ` (${amountLabel})` : ''} is{' '}
              <strong>non-refundable</strong>.
            </span>
          </li>
        ) : null}
        {p.no_show_forfeit ? (
          <li className="flex items-start gap-1.5">
            <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta" />
            <span>
              A <strong>no-show forfeits</strong> the downpayment.
            </span>
          </li>
        ) : null}
        {p.refund_window_days != null ? (
          <li className="flex items-start gap-1.5">
            <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-ink/40" />
            <span>
              Refundable if cancelled within{' '}
              <strong>
                {p.refund_window_days} day{p.refund_window_days === 1 ? '' : 's'}
              </strong>{' '}
              of booking.
            </span>
          </li>
        ) : null}
      </ul>

      {p.cancellation_terms ? (
        <p className="whitespace-pre-wrap border-t border-terracotta/15 pt-2 text-[11px] leading-snug text-ink/70">
          {p.cancellation_terms}
        </p>
      ) : null}
    </div>
  );
}

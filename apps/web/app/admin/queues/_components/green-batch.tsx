import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { SubmitButton } from '@/app/_components/submit-button';
import { approvePaymentFromWorkList } from '@/app/admin/work/actions';
import { formatCentavosPhp } from '@/lib/payouts';
import { formatCount } from '@/lib/format-number';
import type { PaymentLightRow } from '@/lib/admin/green-payments';

/** What the Work page hands the payments row: the sorted rows, or a failed read. */
export type GreenBatch = { ok: true; rows: PaymentLightRow[] } | { ok: false };

/**
 * "APPROVE ALL N GREEN" — the one action on the Work › Payments row (admin slice
 * 4, 2026-11-13; approved drawing Setnayan-specs prototypes/admin_pub/work.html).
 *
 * 🔑 THE CONFIRM STEP STAYS. The press opens the house confirm (`ConfirmForm`)
 * listing every payment it will approve — the drawing's "one confirm, one
 * press, the list is in it". Amber rows are not in the list; nothing is
 * approved until a person presses; the server re-sorts every id before it
 * writes (approvePaymentFromWorkList → intent "approve-green").
 *
 * ⚠ A FAILED SORT SAYS SO. It never draws "0 green": that would read as "none of
 * these is clean" when the truth is "we could not check".
 */
export function GreenBatchAction({ batch, backTo }: { batch: GreenBatch; backTo: string }) {
  if (!batch.ok) {
    return (
      <p className="flex items-start gap-2 border-t border-[color:var(--sn-line)] px-4 py-2.5 text-xs" style={{ color: 'var(--sn-warning-deep)' }}>
        <ShieldAlert aria-hidden className="mt-px h-4 w-4 shrink-0" strokeWidth={1.75} />
        <span>Couldn’t sort the payments into green and held — this is not the same as none being clean. Open them one by one.</span>
      </p>
    );
  }
  const green = batch.rows.filter((r) => r.light.light === 'green');
  if (green.length === 0) return null;
  const n = green.length;
  const label = `Approve all ${formatCount(n)} green`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--sn-line)] px-4 py-2.5">
      <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--sn-ink-500)' }}>
        <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} style={{ color: 'var(--sn-success)' }} />
        {formatCount(n)} {n === 1 ? 'payment is' : 'payments are'} a clean match
      </span>
      <ConfirmForm
        action={approvePaymentFromWorkList}
        title={`Approve ${formatCount(n)} green ${n === 1 ? 'payment' : 'payments'}?`}
        confirmLabel={label}
        destructive={false}
        message={
          <div className="space-y-3 text-sm">
            <ul className="space-y-1">
              {green.map((r) => (
                <li key={r.paymentId}>
                  <strong>{formatCentavosPhp(Math.round(r.amountPhp * 100))}</strong> · {r.who}
                  {r.referenceNumber ? ` · ref ${r.referenceNumber}` : ''}
                </li>
              ))}
            </ul>
            <p>
              ✓ Each order is marked paid and switched on, with its receipt — the same as confirming it on its
              own.
            </p>
            <p>
              ✗ Held (amber) payments are not in this list — they open one by one. Each one is checked again
              before it is approved; any that is no longer a clean match is left for you.
            </p>
            <p style={{ color: 'var(--sn-ink-500)' }}>Still check your bank app — a screenshot is not proof the money arrived.</p>
          </div>
        }
      >
        <input type="hidden" name="intent" value="approve-green" />
        <input type="hidden" name="back" value={backTo} />
        {green.map((r) => (
          <input key={r.paymentId} type="hidden" name="batch_payment_ids" value={r.paymentId} />
        ))}
        <SubmitButton
          pendingLabel="Approving…"
          className="min-h-[44px] rounded-md px-3 py-1.5 text-xs font-semibold"
          style={{ background: 'var(--sn-accent)', color: 'var(--sn-on-accent)' }}
        >
          {label}
        </SubmitButton>
      </ConfirmForm>
    </div>
  );
}

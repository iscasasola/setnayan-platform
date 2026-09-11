import { Receipt } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { relativeTime } from '@/lib/activity';
import { displayUrlForPrivateStoredAsset } from '@/lib/uploads';
import { budgetPaymentProofPolicy } from '@/lib/r2-client-ref';
import { SubmitButton } from '@/app/_components/submit-button';
import { settlePaymentDispute } from '../actions';

/**
 * "This payment never reached me" — for an INSTALLMENT. H4.
 *
 * ⚖ Owner 2026-09-11, "one path for every payment": installments are refereed
 * on the SAME page as the downpayment, by the same two outcomes, with the same
 * rule that nothing the couple sent is deleted. This is the downpayment
 * section's twin (`deposit-disputes-section.tsx`), reading the ledger row
 * instead of the booking. A refused DEPOSIT never appears here — its refusal
 * lives on the booking and is listed in the section below this one.
 *
 * ⚠ AN OPEN DISPUTE IS "REFUSED AND NOT YET SETTLED" — both halves, the same
 * definition `countOpenDisputes` uses, so the badge and this list agree.
 */

type OpenPaymentDispute = {
  payment_id: string;
  event_id: string | null;
  vendor_id: string;
  amount_php: number | null;
  method: string | null;
  reference: string | null;
  paid_at: string | null;
  proof_r2_key: string | null;
  payment_refused_at: string | null;
  payment_refusal_reason: string | null;
};

const peso = (n: number | null) =>
  typeof n === 'number' ? `₱${Number(n).toLocaleString('en-PH')}` : '—';

export async function PaymentDisputesSection() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('event_vendor_payments')
    .select(
      'payment_id,event_id,vendor_id,amount_php,method,reference,paid_at,proof_r2_key,payment_refused_at,payment_refusal_reason',
    )
    .not('payment_refused_at', 'is', null)
    .is('payment_dispute_settled_at', null)
    .order('payment_refused_at', { ascending: true })
    .limit(200);
  if (error) logQueryError('AdminDisputesPage (payment disputes)', error);
  // NULL, not [] — a refused read must stay distinguishable from a real zero.
  const rows = (data as OpenPaymentDispute[] | null) ?? null;

  // Supplier names, one read. A missing name degrades to "Unnamed supplier",
  // never to a dropped row.
  const nameByBooking = new Map<string, string | null>();
  if (rows && rows.length > 0) {
    const { data: bookings, error: bookingErr } = await admin
      .from('event_vendors')
      .select('vendor_id, vendor_name')
      .in('vendor_id', Array.from(new Set(rows.map((r) => r.vendor_id))));
    if (bookingErr) logQueryError('AdminDisputesPage (payment dispute names)', bookingErr);
    for (const b of (bookings ?? []) as Array<{ vendor_id: string; vendor_name: string | null }>) {
      nameByBooking.set(b.vendor_id, b.vendor_name);
    }
  }

  // The couple's receipt sits in the PRIVATE thread-files bucket; sign it from
  // the one folder its writer accepts, exactly as the supplier's card does.
  const receiptByPayment = new Map<string, string | null>();
  for (const r of rows ?? []) {
    if (!r.proof_r2_key || !r.event_id) continue;
    try {
      receiptByPayment.set(
        r.payment_id,
        await displayUrlForPrivateStoredAsset(r.proof_r2_key, budgetPaymentProofPolicy(r.event_id)),
      );
    } catch {
      receiptByPayment.set(r.payment_id, null);
    }
  }

  return (
    <section className="mt-10" aria-labelledby="payment-disputes-heading">
      <div className="mb-3 flex items-center gap-2">
        <Receipt className="h-4 w-4 text-ink/60" aria-hidden />
        <h2 id="payment-disputes-heading" className="text-sm font-semibold text-ink">
          “This payment never reached me”
        </h2>
      </div>
      <p className="mb-4 max-w-2xl text-xs text-ink/60">
        A supplier says an installment the couple logged never arrived. Nothing the couple
        sent is deleted while this is open — their amount, method, reference and receipt all
        stand. Confirm it by hand against the bank record.
      </p>

      {rows === null ? (
        <p className="rounded-lg bg-[var(--sn-warning-soft)] px-4 py-3 text-xs text-[color:var(--sn-warning)]">
          This list could not be read, so it is not known whether anything is waiting. It is
          deliberately not shown as “nothing waiting”.
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg bg-ink/[0.03] px-4 py-3 text-xs text-ink/60">
          No installment is in dispute.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => {
            const receipt = receiptByPayment.get(r.payment_id) ?? null;
            return (
              <li key={r.payment_id} className="rounded-xl border border-ink/10 bg-white p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-ink">
                    {nameByBooking.get(r.vendor_id)?.trim() || 'Unnamed supplier'}
                  </span>
                  <span className="text-xs text-ink/50">
                    refused {r.payment_refused_at ? relativeTime(r.payment_refused_at) : '—'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink/70">
                  Couple logged {peso(r.amount_php)}
                  {r.method ? ` via ${r.method}` : ''}
                  {r.reference ? ` · ref ${r.reference}` : ''}
                  {r.paid_at ? ` · paid ${relativeTime(r.paid_at)}` : ''}
                  {receipt ? (
                    <>
                      {' · '}
                      <a className="underline" href={receipt} target="_blank" rel="noopener noreferrer">
                        receipt
                      </a>
                    </>
                  ) : (
                    ' · no receipt on file'
                  )}
                </p>
                {r.payment_refusal_reason ? (
                  <p className="mt-2 rounded-lg bg-ink/[0.03] px-3 py-2 text-xs text-ink/80">
                    Supplier’s words: “{r.payment_refusal_reason}”
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-ink/50">The supplier gave no reason.</p>
                )}

                <form action={settlePaymentDispute} className="mt-3 flex flex-col gap-2">
                  <input type="hidden" name="payment_id" value={r.payment_id} />
                  <label className="sr-only" htmlFor={`pay-note-${r.payment_id}`}>
                    What Setnayan confirmed
                  </label>
                  <textarea
                    id={`pay-note-${r.payment_id}`}
                    name="note"
                    required
                    rows={2}
                    maxLength={500}
                    placeholder="What you confirmed against the bank record — both parties are shown this."
                    className="w-full rounded-lg border border-ink/15 px-3 py-2 text-xs text-ink"
                  />
                  <div className="flex flex-wrap gap-2">
                    <SubmitButton
                      name="outcome"
                      value="payment_stands"
                      className="rounded-lg bg-ink px-3 py-2 text-xs text-white"
                    >
                      The payment stands
                    </SubmitButton>
                    <SubmitButton
                      name="outcome"
                      value="not_received"
                      className="rounded-lg border border-ink/20 px-3 py-2 text-xs text-ink"
                    >
                      It did not arrive
                    </SubmitButton>
                  </div>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

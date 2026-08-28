import { Receipt } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { relativeTime } from '@/lib/activity';
import { SubmitButton } from '@/app/_components/submit-button';
import { settleDepositDispute } from '../actions';

/**
 * "The downpayment never reached me" — the questions only Setnayan can answer.
 *
 * ⚖ Owner 2026-08-28: "no. do not. we will confirm it manually." Until this
 * shipped, a supplier's refusal reached the COUPLE and nobody else: there was
 * no queue, no surface and no function with which to confirm anything. The two
 * parties were left disagreeing about money with no referee.
 *
 * 🔑 IT IS A SECTION ON THE DISPUTES PAGE, NOT A NEW PAGE. An admin settling a
 * dispute already opens /admin/disputes; a second route would need a nav entry
 * (owned by another session this week) and would split one job across two
 * addresses.
 *
 * ⚠ AN OPEN DISPUTE IS "REFUSED AND NOT YET SETTLED" — both halves. The second
 * half is what makes a SECOND refusal months later a new question instead of
 * one that silently inherits the first settlement and never appears here.
 */

type OpenDepositDispute = {
  vendor_id: string;
  event_id: string | null;
  vendor_name: string | null;
  deposit_paid_php: number | null;
  deposit_proof_url: string | null;
  deposit_method_label: string | null;
  deposit_recorded_at: string | null;
  deposit_declined_at: string | null;
  deposit_decline_reason: string | null;
};

const peso = (n: number | null) =>
  typeof n === 'number' ? `₱${n.toLocaleString('en-PH')}` : '—';

export async function DepositDisputesSection() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('event_vendors')
    .select(
      'vendor_id,event_id,vendor_name,deposit_paid_php,deposit_proof_url,deposit_method_label,deposit_recorded_at,deposit_declined_at,deposit_decline_reason',
    )
    .not('deposit_declined_at', 'is', null)
    .is('deposit_dispute_settled_at', null)
    .order('deposit_declined_at', { ascending: true })
    .limit(200);

  if (error) logQueryError('AdminDisputesPage (deposit disputes)', error);
  // NULL, not [] — a refused read must stay distinguishable from a real zero,
  // or "nothing waiting" is what a broken query looks like.
  const rows = (data as OpenDepositDispute[] | null) ?? null;

  return (
    <section className="mt-10" aria-labelledby="deposit-disputes-heading">
      <div className="mb-3 flex items-center gap-2">
        <Receipt className="h-4 w-4 text-ink/60" aria-hidden />
        <h2 id="deposit-disputes-heading" className="text-sm font-semibold text-ink">
          “The downpayment never reached me”
        </h2>
      </div>
      <p className="mb-4 max-w-2xl text-xs text-ink/60">
        A supplier says a downpayment the couple recorded never arrived. Nothing the couple
        sent is deleted while this is open — their amount, receipt, method and ledger row all
        stand. Confirm it by hand against the bank record.
      </p>

      {rows === null ? (
        <p className="rounded-lg bg-[var(--sn-warning-soft)] px-4 py-3 text-xs text-[color:var(--sn-warning)]">
          This list could not be read, so it is not known whether anything is waiting. It is
          deliberately not shown as “nothing waiting”.
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg bg-ink/[0.03] px-4 py-3 text-xs text-ink/60">
          No downpayment is in dispute.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.vendor_id} className="rounded-xl border border-ink/10 bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-ink">
                  {r.vendor_name?.trim() || 'Unnamed supplier'}
                </span>
                <span className="text-xs text-ink/50">
                  refused {r.deposit_declined_at ? relativeTime(r.deposit_declined_at) : '—'}
                </span>
              </div>
              <p className="mt-1 text-xs text-ink/70">
                Couple recorded {peso(r.deposit_paid_php)}
                {r.deposit_method_label ? ` via ${r.deposit_method_label}` : ''}
                {r.deposit_recorded_at ? ` · ${relativeTime(r.deposit_recorded_at)}` : ''}
                {r.deposit_proof_url ? (
                  <>
                    {' · '}
                    <a
                      className="underline"
                      href={r.deposit_proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      receipt
                    </a>
                  </>
                ) : (
                  ' · no receipt on file'
                )}
              </p>
              {r.deposit_decline_reason ? (
                <p className="mt-2 rounded-lg bg-ink/[0.03] px-3 py-2 text-xs text-ink/80">
                  Supplier’s words: “{r.deposit_decline_reason}”
                </p>
              ) : (
                <p className="mt-2 text-xs text-ink/50">The supplier gave no reason.</p>
              )}

              <form action={settleDepositDispute} className="mt-3 flex flex-col gap-2">
                <input type="hidden" name="event_vendor_id" value={r.vendor_id} />
                <label className="sr-only" htmlFor={`note-${r.vendor_id}`}>
                  What Setnayan confirmed
                </label>
                <textarea
                  id={`note-${r.vendor_id}`}
                  name="note"
                  required
                  rows={2}
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
          ))}
        </ul>
      )}
    </section>
  );
}

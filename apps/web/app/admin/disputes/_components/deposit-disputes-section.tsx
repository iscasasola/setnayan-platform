import { Receipt } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { relativeTime } from '@/lib/activity';
import { depositProofDisplayUrl } from '@/lib/deposit-proof.server';
import { SubmitButton } from '@/app/_components/submit-button';
import { settleDepositDispute } from '../actions';
import {
  DEPOSIT_REFUSAL_HISTORY_COLUMNS,
  closureLabel,
  historyByBooking,
  rulingLine,
  type DepositRefusalHistoryRow,
} from '@/lib/deposit-refusal-history';

/** How far back "answered by sending it again" reaches. */
const RESENT_WINDOW_DAYS = 30;

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
  // 🔒 The receipt is a PRIVATE file: a short-lived link scoped to the row's own
  // event deposit folder, never the stored value as an href.
  const receiptUrls = new Map<string, string>();
  await Promise.all(
    (rows ?? []).map(async (r) => {
      const url = await depositProofDisplayUrl(r.deposit_proof_url, r.event_id);
      if (url) receiptUrls.set(r.vendor_id, url);
    }),
  );

  /*
    THE HISTORY (FOLLOW-UPS A, 2026-09-11). A refusal that ENDS is archived by
    the database — the couple sending it again, the supplier confirming after
    all, a ruling, a removed booking — so a dispute that left this queue is not
    a dispute that vanished. Two reads: the earlier refusals of each booking
    still in dispute, and the recent ones the couple answered by re-sending
    (which put the question back with the supplier). NULL on a failed read, as
    above — never a confident "no history".
  */
  const openIds = (rows ?? []).map((r) => r.vendor_id);
  const since = new Date(Date.now() - RESENT_WINDOW_DAYS * 86_400_000).toISOString();
  const [earlierRes, resentRes] = await Promise.all([
    openIds.length > 0
      ? admin
          .from('event_vendor_deposit_refusals')
          .select(DEPOSIT_REFUSAL_HISTORY_COLUMNS)
          .in('event_vendor_id', openIds)
          .order('closed_at', { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [], error: null }),
    admin
      .from('event_vendor_deposit_refusals')
      .select(DEPOSIT_REFUSAL_HISTORY_COLUMNS)
      .eq('closed_by', 'couple_resent')
      .gte('closed_at', since)
      .order('closed_at', { ascending: false })
      .limit(100),
  ]);
  if (earlierRes.error) logQueryError('AdminDisputesPage (deposit refusal history)', earlierRes.error);
  if (resentRes.error) logQueryError('AdminDisputesPage (deposit re-sends)', resentRes.error);
  const earlierByBooking = earlierRes.error
    ? null
    : historyByBooking((earlierRes.data ?? []) as DepositRefusalHistoryRow[]);
  const openSet = new Set(openIds);
  const resent = resentRes.error
    ? null
    : ((resentRes.data ?? []) as DepositRefusalHistoryRow[]).filter((h) => !openSet.has(h.event_vendor_id));

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
                {receiptUrls.get(r.vendor_id) ? (
                  <>
                    {' · '}
                    <a
                      className="underline"
                      href={receiptUrls.get(r.vendor_id)}
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
              {earlierByBooking === null ? (
                <p className="mt-2 text-xs text-[color:var(--sn-warning)]">
                  Earlier refusals on this booking could not be read.
                </p>
              ) : (earlierByBooking.get(r.vendor_id) ?? []).length > 0 ? (
                <div className="mt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink/50">
                    Earlier on this booking
                  </p>
                  <ul className="mt-1 flex flex-col gap-1">
                    {(earlierByBooking.get(r.vendor_id) ?? []).map((h) => (
                      <li key={h.refusal_id} className="text-xs text-ink/70">
                        Refused {relativeTime(h.refused_at)}
                        {h.reason ? ` — “${h.reason}”` : ''}
                        {rulingLine(h) ? ` · ${rulingLine(h)}` : ''} · then {closureLabel(h.closed_by)}{' '}
                        {relativeTime(h.closed_at)}.
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

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

      <div className="mt-6">
        <h3 className="text-xs font-semibold text-ink">
          Answered by sending it again · last {RESENT_WINDOW_DAYS} days
        </h3>
        <p className="mt-1 max-w-2xl text-xs text-ink/60">
          A re-send takes a dispute off this list and puts the question back with the supplier.
          It is kept here so it does not simply disappear.
        </p>
        {resent === null ? (
          <p className="mt-2 rounded-lg bg-[var(--sn-warning-soft)] px-4 py-3 text-xs text-[color:var(--sn-warning)]">
            This list could not be read — it is not known whether any dispute was answered by a
            re-send.
          </p>
        ) : resent.length === 0 ? (
          <p className="mt-2 rounded-lg bg-ink/[0.03] px-4 py-3 text-xs text-ink/60">
            No downpayment was sent again after a refusal in this window.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {resent.map((h) => (
              <li key={h.refusal_id} className="rounded-lg border border-ink/10 bg-white px-3 py-2 text-xs text-ink/75">
                <span className="font-medium text-ink">{h.vendor_name?.trim() || 'Unnamed supplier'}</span>
                {' · '}refused {relativeTime(h.refused_at)}
                {h.reason ? ` — “${h.reason}”` : ''}
                {rulingLine(h) ? ` · ${rulingLine(h)}` : ''} · the couple sent it again{' '}
                {relativeTime(h.closed_at)}.
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

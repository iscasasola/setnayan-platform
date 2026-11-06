import { Scale } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { relativeTime } from '@/lib/activity';
import { formatLongDate } from '@/lib/format-date';
import { SubmitButton } from '@/app/_components/submit-button';
import { SOURCED_INQUIRY_SOURCES, SETNAYAN_SAVE_SOURCES } from '@/lib/booking-fee-gate';
import { foundReceiptLine } from '@/lib/booking-fee-dispute';
import { DisputeNoteField } from '@/app/_components/dispute-note-field';
import { bookingFeeDispute } from '@/app/_actions/booking-fee-dispute-actions';

/**
 * 🕵️ "THIS COUPLE DID NOT FIND ME THROUGH SETNAYAN" — a supplier's booking-fee disputes waiting for an admin.
 *
 * ⚖ Owner 2026-07-27 (DECISION_LOG grace-first ladder): the first dispute per supplier is accepted on the spot;
 * *"second dispute will be upon review of our admin"* — this is that review. Owner 2026-11-05: "build dispute".
 *
 * 🔑 A SECTION ON THE DISPUTES PAGE, NOT A NEW PAGE — the same reasoning as the downpayment section beside it.
 * It is NOT a `vendor_disputes` row: those are a couple's complaint about a supplier and count toward the supplier's
 * demotion. This is a supplier questioning OUR fee, and must never count against them.
 *
 * The receipts are the same facts fee rule B decided on — the found-record (when the couple first opened the shop
 * here, and how often), a chat started from Setnayan, a save from Find — so the admin judges what the bill judged.
 * Accept waives the fee and voids the open bill; reject leaves it standing. Both tell the supplier in the app.
 */

type DisputeRow = {
  dispute_id: string;
  charge_id: string;
  vendor_profile_id: string;
  reason: string | null;
  status: string;
  decision_note: string | null;
  decided_at: string | null;
  created_at: string;
};

type ChargeRow = {
  charge_id: string;
  event_id: string | null;
  status: string;
  amount_charged_centavos: number | string | null;
};

const peso = (centavos: number | string | null): string => {
  const n = Number(centavos);
  return Number.isFinite(n) ? `₱${(n / 100).toLocaleString('en-PH', { maximumFractionDigits: 2 })}` : '—';
};

export async function BookingFeeDisputesSection({ result }: { result?: string }) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('booking_fee_disputes')
    .select('dispute_id, charge_id, vendor_profile_id, reason, status, decision_note, decided_at, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) logQueryError('AdminDisputesPage (booking fee disputes)', error);
  // NULL, not [] — a refused read must never look like "nothing waiting".
  const rows = (data as DisputeRow[] | null) ?? null;
  const waiting = (rows ?? []).filter((r) => r.status === 'under_review');
  const decided = (rows ?? []).filter((r) => r.status !== 'under_review').slice(0, 20);

  const chargeIds = waiting.map((r) => r.charge_id);
  const shopIds = Array.from(new Set((rows ?? []).map((r) => r.vendor_profile_id)));
  const [chargesRes, shopsRes] = await Promise.all([
    chargeIds.length
      ? admin.from('booking_fee_charges').select('charge_id, event_id, status, amount_charged_centavos').in('charge_id', chargeIds)
      : Promise.resolve({ data: [], error: null }),
    shopIds.length
      ? admin.from('vendor_profiles').select('vendor_profile_id, business_name').in('vendor_profile_id', shopIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (chargesRes.error) logQueryError('AdminDisputesPage (fee dispute charges)', chargesRes.error);
  const charges = new Map(((chargesRes.data ?? []) as ChargeRow[]).map((c) => [c.charge_id, c]));
  const shopName = new Map(
    ((shopsRes.data ?? []) as { vendor_profile_id: string; business_name: string | null }[]).map((s) => [
      s.vendor_profile_id,
      s.business_name?.trim() || 'Unnamed shop',
    ]),
  );

  // The receipts, per waiting dispute: its event, the found-record, a sourced chat, a Find save.
  const receipts = new Map<
    string,
    { eventName: string | null; eventDate: string | null; found: string; chat: boolean; save: boolean; prior: number }
  >();
  await Promise.all(
    waiting.map(async (r) => {
      const c = charges.get(r.charge_id);
      if (!c?.event_id) return;
      const [ev, found, threads, saves] = await Promise.all([
        admin.from('events').select('display_name, event_date').eq('event_id', c.event_id).maybeSingle(),
        admin
          .from('event_vendor_found')
          .select('first_found_at, view_count')
          .eq('event_id', c.event_id)
          .eq('vendor_profile_id', r.vendor_profile_id)
          .maybeSingle(),
        admin.from('chat_threads').select('inquiry_source').eq('event_id', c.event_id).eq('vendor_profile_id', r.vendor_profile_id),
        admin.from('event_vendors').select('source').eq('event_id', c.event_id).eq('marketplace_vendor_id', r.vendor_profile_id),
      ]);
      const f = found.data as { first_found_at: string | null; view_count: number | null } | null;
      const e = ev.data as { display_name: string | null; event_date: string | null } | null;
      receipts.set(r.dispute_id, {
        eventName: e?.display_name ?? null,
        eventDate: e?.event_date ?? null,
        found: found.error ? 'The found-record could not be read.' : foundReceiptLine(f?.first_found_at ?? null, f?.view_count ?? null),
        chat: ((threads.data ?? []) as { inquiry_source: string | null }[]).some(
          (t) => t.inquiry_source != null && SOURCED_INQUIRY_SOURCES.has(t.inquiry_source),
        ),
        save: ((saves.data ?? []) as { source: string | null }[]).some((s) => s.source != null && SETNAYAN_SAVE_SOURCES.has(s.source)),
        prior: (rows ?? []).filter((x) => x.vendor_profile_id === r.vendor_profile_id && x.dispute_id !== r.dispute_id).length,
      });
    }),
  );

  return (
    <section className="mt-10" aria-labelledby="fee-disputes-heading" id="fee-disputes">
      <div className="mb-3 flex items-center gap-2">
        <Scale className="h-4 w-4 text-ink/60" aria-hidden />
        <h2 id="fee-disputes-heading" className="text-sm font-semibold text-ink">
          Booking fee disputes
        </h2>
      </div>
      <p className="mb-4 max-w-2xl text-xs text-ink/60">
        A supplier says a couple did not find them through Setnayan. Their first dispute was accepted on the spot; these
        are later ones. Accept waives the fee and cancels its open bill. Reject keeps the bill. The supplier is told in
        the app either way.
      </p>

      {result === 'error' ? (
        <p role="alert" className="mb-3 rounded-lg bg-[var(--sn-warning-soft)] px-4 py-3 text-xs text-[color:var(--sn-warning)]">
          That decision could not be saved. Nothing changed.
        </p>
      ) : null}

      {rows === null ? (
        <p className="rounded-lg bg-[var(--sn-warning-soft)] px-4 py-3 text-xs text-[color:var(--sn-warning)]">
          This list could not be read, so it is not known whether anything is waiting. It is deliberately not shown as
          “nothing waiting”.
        </p>
      ) : waiting.length === 0 ? (
        <p className="rounded-lg bg-ink/[0.03] px-4 py-3 text-xs text-ink/60">No booking fee dispute is waiting.</p>
      ) : (
        <ul className="divide-y divide-ink/10">
          {waiting.map((r) => {
            const c = charges.get(r.charge_id);
            const rc = receipts.get(r.dispute_id);
            return (
              <li key={r.dispute_id} className="py-4" data-fee-dispute-row="">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-ink">{shopName.get(r.vendor_profile_id) ?? 'Unnamed shop'}</span>
                  <span className="text-xs text-ink/50">disputed {relativeTime(r.created_at)}</span>
                </div>
                <p className="mt-1 text-xs text-ink/70">
                  Fee {peso(c?.amount_charged_centavos ?? null)} · bill {c?.status ?? 'unknown'}
                  {rc?.eventName ? ` · ${rc.eventName}` : ''}
                  {rc?.eventDate ? ` on ${formatLongDate(rc.eventDate)}` : ''}
                  {rc ? ` · ${rc.prior} earlier dispute${rc.prior === 1 ? '' : 's'}` : ''}
                </p>
                <p className="mt-2 text-xs text-ink/80">
                  <span className="font-medium">Their words:</span> {r.reason ? `“${r.reason}”` : 'none given'}
                </p>
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-ink/70">
                  <li>{rc?.found ?? 'The receipts could not be read.'}</li>
                  <li>{rc ? (rc.chat ? 'A chat was started from Setnayan.' : 'No chat was started from Setnayan.') : '—'}</li>
                  <li>{rc ? (rc.save ? 'The couple saved this shop from Find.' : 'No save from Find.') : '—'}</li>
                </ul>
                <form action={bookingFeeDispute} className="mt-3 space-y-2">
                  <input type="hidden" name="op" value="decide" />
                  <input type="hidden" name="dispute_id" value={r.dispute_id} />
                  <DisputeNoteField name="Note to the supplier" empty="Optional" fieldName="note" />
                  <div className="flex flex-wrap gap-2">
                    <SubmitButton name="decision" value="accept" pendingLabel="Saving…" className="button-primary">
                      Accept — waive the fee
                    </SubmitButton>
                    <SubmitButton name="decision" value="reject" pendingLabel="Saving…" className="button-secondary">
                      Reject — the fee stands
                    </SubmitButton>
                  </div>
                </form>
              </li>
            );
          })}
        </ul>
      )}

      {decided.length > 0 ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-ink/60">Recently decided ({decided.length})</summary>
          <ul className="mt-2 space-y-1 text-xs text-ink/70">
            {decided.map((r) => (
              <li key={r.dispute_id}>
                {shopName.get(r.vendor_profile_id) ?? 'Unnamed shop'} ·{' '}
                {r.status === 'auto_accepted' ? 'first dispute, accepted on the spot' : r.status}
                {r.decided_at ? ` · ${relativeTime(r.decided_at)}` : ''}
                {r.decision_note ? ` · “${r.decision_note}”` : ''}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

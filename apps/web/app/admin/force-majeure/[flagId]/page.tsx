import Image from 'next/image';
import { notFound } from 'next/navigation';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { RECORD_SUBLINE, RecordBack, RecordEmpty, RecordSection } from '../../_components/record-kit';
import { actionButtonClass } from '@/components/action-button-class';
import { PageMasthead } from '@/app/_components/page-masthead';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { ReadFailed } from '../../_components/read-failed';
import { displayUrlsForPrivateStoredAssets } from '@/lib/uploads';
import { depositProofDisplayUrl } from '@/lib/deposit-proof.server';
import { ProofImage } from '@/app/_components/proof-image';
import { disputeEvidencePolicy } from '@/lib/r2-client-ref';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  FLAG_STATUS_LABEL,
  FLAG_STATUS_TONE,
  FLAG_TYPE_LABEL,
  RESOLUTION_ACTIONS,
  formatAutoResolveCountdown,
  type FlagStatus,
  type FlagType,
} from '@/lib/force-majeure';
import { resolveFlag, takeOwnership } from '../actions';

import { requireAdmin } from '@/lib/admin/require-admin';
export const metadata = { title: 'Force majeure flag · Admin' };

type FlagRow = {
  flag_id: string;
  public_id: string;
  event_id: string;
  event_vendor_id: string | null;
  couple_user_id: string | null;
  flag_type: FlagType;
  status: FlagStatus;
  description: string;
  evidence_urls: string[] | null;
  resolution_notes: string | null;
  admin_handler_user_id: string | null;
  auto_resolve_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

type EventLookup = {
  event_id: string;
  display_name: string;
  public_id: string;
  event_date: string | null;
};

type EventVendorLookup = {
  vendor_id: string;
  event_id: string;
  vendor_name: string;
  category: string;
  deposit_recorded_at: string | null;
  deposit_acknowledged_at: string | null;
  deposit_proof_url: string | null;
};

type UserLookup = {
  user_id: string;
  display_name: string | null;
  email: string | null;
};

type ChangeOrderLookup = {
  change_order_id: string;
  raised_by: 'couple' | 'vendor';
  title: string | null;
  delta_amount_php: number | string | null;
  status: 'proposed' | 'accepted' | 'declined' | 'withdrawn';
  acknowledged_at: string | null;
  decline_reason: string | null;
  created_at: string;
};

type Props = {
  params: Promise<{ flagId: string }>;
};

export default async function AdminForceMajeureDetailPage({ params }: Props) {
  await requireAdmin();
  const { flagId } = await params;
  const admin = createAdminClient();

  const { data: flag, error } = await admin
    .from('force_majeure_flags')
    .select(
      'flag_id, public_id, event_id, event_vendor_id, couple_user_id, flag_type, status, description, evidence_urls, resolution_notes, admin_handler_user_id, auto_resolve_at, resolved_at, created_at, updated_at',
    )
    .eq('flag_id', flagId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!flag) notFound();
  const row = flag as FlagRow;

  const [eventRes, vendorRes, coupleRes, handlerRes] = await Promise.all([
    admin
      .from('events')
      .select('event_id, display_name, public_id, event_date')
      .eq('event_id', row.event_id)
      .maybeSingle(),
    row.event_vendor_id
      ? admin
          .from('event_vendors')
          .select(
            'vendor_id, event_id, vendor_name, category, deposit_recorded_at, deposit_acknowledged_at, deposit_proof_url',
          )
          .eq('vendor_id', row.event_vendor_id)
          .maybeSingle()
      : Promise.resolve({ data: null as EventVendorLookup | null, error: null }),
    row.couple_user_id
      ? admin
          .from('users')
          .select('user_id, display_name, email')
          .eq('user_id', row.couple_user_id)
          .maybeSingle()
      : Promise.resolve({ data: null as UserLookup | null, error: null }),
    row.admin_handler_user_id
      ? admin
          .from('users')
          .select('user_id, display_name, email')
          .eq('user_id', row.admin_handler_user_id)
          .maybeSingle()
      : Promise.resolve({ data: null as UserLookup | null, error: null }),
  ]);

  const event = eventRes.data as EventLookup | null;
  const vendor = vendorRes.data as EventVendorLookup | null;
  const couple = coupleRes.data as UserLookup | null;
  const handler = handlerRes.data as UserLookup | null;
  // A8·E-5: an unread lookup is SAID — a booking that could not be read is not
  // "Whole event", a handler who could not be read is not "Unassigned".
  for (const [what, res] of [['event', eventRes], ['booking', vendorRes], ['couple', coupleRes], ['handler', handlerRes]] as const) {
    if (res.error) logQueryError(`AdminForceMajeureDetail (${what})`, res.error);
  }
  const eventUnread = Boolean(eventRes.error) || !event;
  const vendorUnread = Boolean(row.event_vendor_id) && (Boolean(vendorRes.error) || !vendor);
  const coupleUnread = Boolean(row.couple_user_id) && (Boolean(coupleRes.error) || !couple);
  const handlerUnread = Boolean(row.admin_handler_user_id) && (Boolean(handlerRes.error) || !handler);

  // The couple's evidence is stored as `r2://setnayan-thread-files/events/<id>/
  // disputes/…` refs — a PRIVATE bucket, so the raw ref never rendered here (an
  // <img src="r2://…"> is a broken image). Signed through the scoped signer, only
  // from THIS flag's event's own disputes folder (N4 part 3); a legacy public
  // URL passes through as before.
  // 🔑 `null` means "signing failed", NOT "no evidence": a dispute the owner is
  // judging must never read "No evidence attached." because a signer timed out.
  // Even a signer that answers can return fewer links than the row stores, so
  // the check is against what the row says is attached.
  const evidenceStored = (row.evidence_urls ?? []).length;
  const signedEvidence = await displayUrlsForPrivateStoredAssets(
    row.evidence_urls ?? [],
    disputeEvidencePolicy(row.event_id),
  ).catch((err: unknown) => {
    logQueryError('AdminForceMajeureDetail (evidence signing)', err);
    return null;
  });
  const evidenceUrls = signedEvidence ?? [];
  const evidenceUnread = signedEvidence === null || signedEvidence.length < evidenceStored;

  // 🔒 The deposit receipt is a PRIVATE file too: a short-lived link scoped to
  // the booking row's own event deposit folder — never the stored value as an
  // href (lib/deposit-proof.server.ts).
  let depositProofUnread = false;
  const depositProofUrl = vendor
    ? await depositProofDisplayUrl(vendor.deposit_proof_url, vendor.event_id).catch((err: unknown) => {
        logQueryError('AdminForceMajeureDetail (deposit proof signing)', err);
        depositProofUnread = Boolean(vendor.deposit_proof_url);
        return null;
      })
    : null;

  // Change-Order Trail (Wave 3) — the immutable both-acknowledged add-on/removal
  // log for this booking, so an admin handling the dispute sees every scope/price
  // change and who acknowledged it. Read-only here; admins never raise/resolve.
  const changeOrdersRes = row.event_vendor_id
    ? await admin
        .from('vendor_change_orders')
        .select(
          'change_order_id, raised_by, title, delta_amount_php, status, acknowledged_at, decline_reason, created_at',
        )
        .eq('event_vendor_id', row.event_vendor_id)
        .order('created_at', { ascending: false })
    : null;
  if (changeOrdersRes?.error) {
    logQueryError('AdminForceMajeureDetail (change orders)', changeOrdersRes.error);
  }
  const changeOrdersUnread = Boolean(changeOrdersRes?.error);
  const changeOrders = (changeOrdersRes?.data ?? []) as ChangeOrderLookup[];

  const isResolved = Boolean(row.resolved_at);
  const countdown = isResolved
    ? `Resolved ${row.resolved_at?.slice(0, 10) ?? ''}`
    : formatAutoResolveCountdown(row.auto_resolve_at);

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pb-8 pt-2 sm:px-6">
      <RecordBack href="/admin/force-majeure" label="Back to queue" />

      {/* 🔑 A RECORD PAGE IS THE ONE PLACE THE HEADING IS NOT A PAGE NAME.
          The owner removed the row that repeats the menu item you just tapped.
          The name below is the RECORD — it is the content, it is why you
          opened this page, and hiding it would be deleting data rather than
          chrome. So the visible name stays exactly as it looked, and only its
          `<h1>` moves to the masthead, which carries the same words at zero
          pixels. One heading, in the document, where a screen reader and a
          skip link can find it. */}
      <PageMasthead titleNode={row.public_id} />
      {/* 📐 ADMIN CLEAN PORT (owner 19 Nov 2026): the record-kit head's look — the flag code stays the visible name
          (`admin-page-starts-at-its-content.test.ts` RECORD_PAGES), its status a chip, the kind + dates one quiet line. */}
      <header data-record-head="" className="pb-2 pt-1">
        <div className="flex items-start gap-3">
          <span className="grid h-14 w-14 flex-none place-items-center rounded-full bg-terracotta/10 text-terracotta">
            <AlertTriangle aria-hidden className="h-6 w-6" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className={`truncate ${RECORD_SUBLINE}`}>
              {FLAG_TYPE_LABEL[row.flag_type]} · filed {row.created_at.slice(0, 10)}{' '}
              {countdown ? `· ${countdown}` : ''}
            </p>
            <p className="text-[24px] font-extrabold leading-tight text-ink [overflow-wrap:anywhere]">
              {row.public_id}
            </p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${FLAG_STATUS_TONE[row.status]}`}>
            {FLAG_STATUS_LABEL[row.status]}
          </span>
        </div>
      </header>

      <dl className="mb-6 [&>div+div]:border-t [&>div+div]:border-[color:var(--m-line)]">
        <Field
          label="Event"
          value={
            event ? (
              <>
                <span className="font-medium text-ink">
                  {event.display_name}
                </span>
                <br />
                <span className="text-[12px] text-ink/55 tabular-nums">
                  {event.public_id}
                  {event.event_date ? ` · ${event.event_date}` : ''}
                </span>
              </>
            ) : eventUnread ? (
              <span className="text-ink/55">Couldn&rsquo;t read</span>
            ) : (
              '—'
            )
          }
        />
        <Field
          label="Scope"
          value={
            vendor ? (
              <>
                <span className="font-medium text-ink">{vendor.vendor_name}</span>
                <br />
                <span className="text-[12px] text-ink/55 tabular-nums">
                  {vendor.category}
                </span>
              </>
            ) : vendorUnread ? (
              <span className="text-ink/55">Couldn&rsquo;t read the booking</span>
            ) : (
              <span className="text-ink/65">Whole event</span>
            )
          }
        />
        <Field
          label="Filed by"
          value={
            couple ? (
              <a
                href={`mailto:${couple.email ?? ''}`}
                className="text-mulberry hover:underline"
              >
                {couple.display_name ?? couple.email ?? '—'}
              </a>
            ) : coupleUnread ? (
              <span className="text-ink/55">Couldn&rsquo;t read</span>
            ) : (
              '—'
            )
          }
        />
        <Field
          label="Handler"
          value={
            handler ? (
              <span className="inline-flex items-center gap-1 font-medium text-ink">
                <ShieldCheck
                  aria-hidden
                  className="h-3.5 w-3.5 text-mulberry"
                  strokeWidth={2}
                />
                {handler.display_name ?? handler.email ?? '—'}
              </span>
            ) : handlerUnread ? (
              <span className="text-ink/55">Couldn&rsquo;t read</span>
            ) : (
              <span className="text-ink/55">Unassigned</span>
            )
          }
        />
        {/* Deposit Reservation Lock-Free — surface the deposit state so an
            admin handling the dispute sees whether a deposit was recorded (date
            held) and whether the vendor acknowledged it, plus the proof link.
            Record/acknowledge only — Setnayan never held the money. */}
        {vendor ? (
          <Field
            label="Deposit"
            value={
              vendor.deposit_recorded_at ? (
                /* A <div>, not a <span>: the receipt below is a picture in its
                   own block, and a block inside an inline element is re-parented
                   by the browser into a hydration mismatch. `<dd>` already
                   allows flow content, so nothing else changes. */
                <div className="text-ink/75">
                  {vendor.deposit_acknowledged_at ? (
                    <span className="font-medium text-ink">
                      Acknowledged by supplier ({vendor.deposit_acknowledged_at.slice(0, 10)})
                    </span>
                  ) : (
                    <span className="font-medium text-ink">
                      Recorded · date held, awaiting supplier confirmation (
                      {vendor.deposit_recorded_at.slice(0, 10)})
                    </span>
                  )}
                  {/* THE RECEIPT, SHOWN (owner, live, 2026-09-20). An admin
                      ruling on a force-majeure flag reads the deposit proof to
                      decide; "View deposit proof" as a link made that a second
                      tab away. Already a short-lived signed link, scoped to this
                      event's own deposit folder (resolved above). */}
                  {depositProofUrl ? (
                    <ProofImage
                      url={depositProofUrl}
                      alt="The deposit proof on file"
                      className="mt-2"
                    />
                  ) : depositProofUnread ? (
                    <span className="mt-2 block text-ink/55">Couldn&rsquo;t open the deposit proof just now.</span>
                  ) : null}
                </div>
              ) : (
                <span className="text-ink/55">No deposit recorded</span>
              )
            }
          />
        ) : vendorUnread ? (
          <Field label="Deposit" value={<span className="text-ink/55">Couldn&rsquo;t read the deposit</span>} />
        ) : null}
      </dl>

      {/* Change-Order Trail — the immutable both-acknowledged add-on/removal log
          for this booking. Admins read it as evidence; they never raise/resolve. */}
      {row.event_vendor_id ? (
        <RecordSection label={`Change orders (${changeOrdersUnread ? '—' : changeOrders.length})`}>
          {changeOrdersUnread ? (
            <ReadFailed what="this booking’s change orders" />
          ) : changeOrders.length === 0 ? (
            <RecordEmpty>No change orders on this booking.</RecordEmpty>
          ) : (
            <ul className="[&>li+li]:border-t [&>li+li]:border-[color:var(--m-line)]">
              {changeOrders.map((co) => {
                const deltaNum =
                  typeof co.delta_amount_php === 'string'
                    ? Number(co.delta_amount_php)
                    : co.delta_amount_php ?? 0;
                const sign = deltaNum < 0 ? '−' : '+';
                const abs = Math.abs(deltaNum).toLocaleString('en-PH', {
                  style: 'currency',
                  currency: 'PHP',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                });
                return (
                  <li
                    key={co.change_order_id}
                    className="py-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-ink">
                        {co.title ?? 'Change order'}{' '}
                        <span
                          className={`tabular-nums ${deltaNum < 0 ? 'text-success-700' : 'text-ink/70'}`}
                        >
                          {sign}
                          {abs}
                        </span>
                      </span>
                      <span className={RECORD_SUBLINE}>{co.status}</span>
                    </div>
                    <p className="mt-0.5 text-[12px] text-ink/55">
                      Raised by {co.raised_by} · {co.created_at.slice(0, 10)}
                      {co.acknowledged_at ? ` · acknowledged ${co.acknowledged_at.slice(0, 10)}` : ''}
                    </p>
                    {co.status === 'declined' && co.decline_reason ? (
                      <p className="mt-0.5 text-[12px] text-ink/55">Reason: {co.decline_reason}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </RecordSection>
      ) : null}

      <RecordSection label="Description">
        <p className="whitespace-pre-wrap pb-2 text-sm text-ink/85">
          {row.description}
        </p>
      </RecordSection>

      <RecordSection
        label={`Evidence (${evidenceUnread ? (evidenceStored > 0 ? `${evidenceStored} attached` : '—') : evidenceUrls.length})`}
      >
        {evidenceUnread ? (
          <ReadFailed
            what={`${evidenceStored > 0 ? `${evidenceStored} attached file${evidenceStored === 1 ? '' : 's'}` : 'the attached files'}${evidenceUrls.length > 0 ? ` — only ${evidenceUrls.length} loaded below` : ''}`}
          />
        ) : null}
        {evidenceUrls.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {evidenceUrls.map((url, idx) => (
              <li key={url} className="overflow-hidden rounded-md border border-ink/10">
                <a href={url} target="_blank" rel="noreferrer" className="block">
                  <span className="relative block aspect-square">
                    <Image
                      src={url}
                      alt={`Evidence ${idx + 1}`}
                      fill
                      sizes="(max-width: 768px) 50vw, 200px"
                      className="object-cover"
                      unoptimized
                    />
                  </span>
                  <span className={`block px-2 py-1 text-center ${RECORD_SUBLINE}`}>
                    file {idx + 1}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : evidenceUnread ? null : (
          <p className={`py-3 text-[14px] ${RECORD_SUBLINE}`}>No evidence attached.</p>
        )}
      </RecordSection>

      {row.resolution_notes ? (
        <RecordSection label="Resolution notes">
          <p className="whitespace-pre-wrap pb-2 text-sm text-success-900">
            {row.resolution_notes}
          </p>
        </RecordSection>
      ) : null}

      <RecordSection label="Actions">

        <form action={takeOwnership} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="flag_id" value={row.flag_id} />
          <SubmitButton className={actionButtonClass('neutral')} pendingLabel="…">
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
            Take ownership
          </SubmitButton>
          <span className="text-xs text-ink/55">
            Assigns this flag to you and moves it to Under review.
          </span>
        </form>

        <div className="mt-3 space-y-3 border-t border-[color:var(--m-line)] pt-3">
          <p className={RECORD_SUBLINE}>Resolve as</p>
          <ul className="space-y-3">
            {RESOLUTION_ACTIONS.map((act) => (
              <li key={act}>
                <details className="rounded-md border border-ink/10">
                  <summary
                    className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm font-medium ${FLAG_STATUS_TONE[act]} rounded-md`}
                  >
                    <span>{FLAG_STATUS_LABEL[act]}</span>
                    <span className={RECORD_SUBLINE}>open</span>
                  </summary>
                  <form
                    action={resolveFlag}
                    className="space-y-3 border-t border-ink/10 p-3"
                  >
                    <input type="hidden" name="flag_id" value={row.flag_id} />
                    <input type="hidden" name="action" value={act} />
                    <label className="block space-y-1">
                      <span className={`block ${RECORD_SUBLINE}`}>
                        Resolution notes{' '}
                        {act === 'refund_issued' || act === 'partial_credit'
                          ? '(required — amount + channel)'
                          : '(optional)'}
                      </span>
                      <textarea
                        name="resolution_notes"
                        rows={3}
                        required={
                          act === 'refund_issued' || act === 'partial_credit'
                        }
                        placeholder={
                          act === 'refund_issued'
                            ? 'e.g. refund sent via GCash — add the date and the reference number'
                            : 'Short note for the couple and the audit trail.'
                        }
                        className="input-field min-h-[72px] py-2 text-sm"
                      />
                    </label>
                    <SubmitButton className={actionButtonClass('brand', { main: true })} pendingLabel="Saving…">
                      Apply {FLAG_STATUS_LABEL[act]}
                    </SubmitButton>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </RecordSection>
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex min-h-11 items-baseline gap-3 py-2">
      <dt className={`flex-none ${RECORD_SUBLINE}`}>{label}</dt>
      <dd className="min-w-0 flex-1 text-right text-[14px] text-ink [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}

import { InfoTip } from '@/app/_components/info-tip';
import { LinkPickMenu } from '@/app/_components/link-pick-menu';
import { TEMPLATE_SUBLINE, TemplateEmpty, TemplateSection } from '@/app/_components/template-rows';
import { actionButtonClass } from '@/components/action-button-class';
import { ADMIN_FRAME } from '../_components/admin-frame';
import { ArrowRight } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { relativeTime } from '@/lib/activity';
import { FormFlash } from '@/app/_components/forms/form-flash';
import { SubmitButton } from '@/app/_components/submit-button';
import { ConfirmForm } from '@/app/_components/confirm-form';
import {
  LOCKED_FIELD_LABEL,
  fetchCorrectionRequestsMeasured,
  type CorrectionRequestStatus,
  type VendorCorrectionRequestRow,
} from '@/lib/vendor-corrections';
import {
  applyCorrectionRequest,
  correctShopAddress,
  declineCorrectionRequest,
} from './actions';

import { requireAdmin } from '@/lib/admin/require-admin';
import { checkShopNameHold } from '@/lib/shop-name-hold';
import { PageMasthead } from '@/app/_components/page-masthead';
import { logQueryError } from '@/lib/supabase/error-detect';
import { ReadFailed } from '../_components/read-failed';
export const metadata = { title: 'Profile corrections · Admin' };
export const dynamic = 'force-dynamic';

/**
 * /admin/corrections — request-a-correction queue for VERIFIED vendors
 * (migration 20270503892144, owner 2026-07-02). A verified shop's 8 identity
 * fields are locked server-side; instead of editing, the vendor files a
 * correction request ("change <field> from <current> to <requested>"). An
 * admin APPLIES it (writes the requested value to vendor_profiles — the only
 * write path that may touch a verified shop's identity) or DECLINES it.
 *
 * Reads are defensive: a pre-migration database renders an empty queue.
 * Auth is enforced at the layout level (app/admin/layout.tsx → notFound()
 * for non-admins), same as every other /admin surface.
 */

type StatusFilter = CorrectionRequestStatus | 'all';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'applied', label: 'Applied' },
  { value: 'declined', label: 'Declined' },
  { value: 'all', label: 'All' },
];

const STATUS_TONE: Record<CorrectionRequestStatus, string> = {
  open: 'bg-warn-100 text-warn-900',
  applied: 'bg-success-100 text-success-800',
  declined: 'bg-ink/10 text-ink/60',
};

function normalizeStatus(raw: string): StatusFilter {
  return (['open', 'applied', 'declined', 'all'] as const).includes(
    raw as StatusFilter,
  )
    ? (raw as StatusFilter)
    : 'open';
}

export default async function AdminCorrectionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    applied?: string;
    declined?: string;
    already_resolved?: string;
    address_moved?: string;
    error?: string;
  }>;
}) {
  await requireAdmin();
  const search = await searchParams;
  const status = normalizeStatus(search.status ?? 'open');

  const admin = createAdminClient();
  const { ok: rowsOk, rows } = await fetchCorrectionRequestsMeasured(admin, { status });

  // Resolve vendor business names for the visible page in one batch.
  const vendorIds = Array.from(new Set(rows.map((r) => r.vendor_profile_id)));
  let vendorNames: Record<string, string> = {};
  let vendorNamesFailed = false;
  if (vendorIds.length > 0) {
    const { data: vendorData, error: vendorNamesError } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id,business_name,business_slug')
      .in('vendor_profile_id', vendorIds);
    if (vendorNamesError) {
      logQueryError('AdminCorrectionsPage (supplier names)', vendorNamesError);
      vendorNamesFailed = true;
    }
    vendorNames = Object.fromEntries(
      (vendorData ?? []).map((v) => [
        v.vendor_profile_id as string,
        (v.business_name as string | null) || 'Unnamed supplier',
      ]),
    );
  }

  // ── HELD NAMES (owner 2026-11-06, "A HELD SHOP NAME HOLDS ITS CORE") ──────
  // An OPEN shop-name request whose core is held — an "It's my business" claim, or a verified shop's correction —
  // shows the admin WHICH shop holds it and WHY, so the papers can be checked against the right business. Admin-only:
  // the vendor is never told this. Asked of the same function every writer asks; a check that could not run says so.
  const heldBy: Record<number, HeldBy> = {};
  for (const r of rows) {
    if (r.status !== 'open' || r.field_key !== 'business_name' || !r.requested_value) continue;
    const hold = await checkShopNameHold(admin, r.requested_value, { vendorProfileId: r.vendor_profile_id });
    if (hold.state === 'unverified') {
      heldBy[r.id] = { unverified: true };
      continue;
    }
    if (hold.state !== 'held') continue;
    let holderName: string | null = null;
    if (hold.holder) {
      const { data: holderRow, error: holderErr } = await admin
        .from('vendor_profiles')
        .select('business_name,business_slug,public_id')
        .eq('vendor_profile_id', hold.holder)
        .maybeSingle();
      if (holderErr) logQueryError('AdminCorrectionsPage (held-name holder)', holderErr);
      const h = holderRow as { business_name?: string | null; business_slug?: string | null; public_id?: string | null } | null;
      holderName = (h?.business_name ?? '').trim() || h?.business_slug || h?.public_id || null;
    }
    heldBy[r.id] = { core: hold.core, reason: hold.reason, holderName };
  }

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pb-8 pt-2 sm:px-6">
      <PageMasthead
        title="Profile corrections"
      />

      {search.error ? (
        <FormFlash tone="error">{decodeURIComponent(search.error)}</FormFlash>
      ) : null}
      {search.applied === '1' ? (
        <FormFlash tone="success">
          Correction applied — the supplier&rsquo;s profile now shows the
          requested value.
        </FormFlash>
      ) : null}
      {search.declined === '1' ? (
        <p role="status" className={`mb-2 ${TEMPLATE_SUBLINE}`}>
          Correction declined — the supplier&rsquo;s profile is unchanged.
        </p>
      ) : null}
      {search.already_resolved === '1' ? (
        <p role="status" className={`mb-2 ${TEMPLATE_SUBLINE}`}>
          That request was already resolved by another admin — nothing changed.
        </p>
      ) : null}
      {search.address_moved ? (
        <FormFlash tone="success">
          Address corrected for <strong>{decodeURIComponent(search.address_moved)}</strong>.
          The old one now forwards to it, so links and QR codes already printed
          keep working.
        </FormFlash>
      ) : null}

      <ShopAddressCorrection />

      <TemplateSection
        label="Requests"
        data="correction-requests"
        right={
          <LinkPickMenu
            label="Request status"
            value={status}
            dataAttr="correction-status"
            options={STATUS_FILTERS.map((t) => ({ key: t.value, label: t.label, href: `/admin/corrections?status=${t.value}` }))}
          />
        }
      >
      {!rowsOk ? (
        <ReadFailed what="the correction requests" />
      ) : rows.length === 0 ? (
        <TemplateEmpty data="correction-requests">
          <InfoTip label="No correction requests for this filter." align="start">
            Verified suppliers file them from their My Shop profile when a locked detail needs to change.
          </InfoTip>
        </TemplateEmpty>
      ) : (
        <ul className="[&>li+li]:border-t [&>li+li]:border-[color:var(--m-line)]">
          {rows.map((r) => (
            <li key={r.id}>
              <RequestCard
                request={r}
                heldBy={heldBy[r.id] ?? null}
                vendorName={vendorNames[r.vendor_profile_id] ?? (vendorNamesFailed ? 'Name couldn’t load' : 'Unnamed supplier')}
              />
            </li>
          ))}
        </ul>
      )}
      </TemplateSection>
    </div>
  );
}

type HeldBy =
  | { unverified: true }
  | { core: string; reason: 'closed' | 'banned' | 'suspended' | null; holderName: string | null };

const HOLD_REASON_LABEL = { closed: 'closed (address still held)', banned: 'banned', suspended: 'suspended' } as const;

function RequestCard({
  request,
  vendorName,
  heldBy,
}: {
  request: VendorCorrectionRequestRow;
  vendorName: string;
  heldBy: HeldBy | null;
}) {
  const fieldLabel = LOCKED_FIELD_LABEL[request.field_key] ?? request.field_key;
  return (
    <article className="space-y-3 py-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-ink">{vendorName}</p>
          <p className={`mt-0.5 flex flex-wrap items-center gap-2 ${TEMPLATE_SUBLINE}`}>
            <span>{request.public_id}</span>
            <span aria-hidden>·</span>
            <span>{fieldLabel}</span>
            <span aria-hidden>·</span>
            <span>{relativeTime(request.created_at)}</span>
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${STATUS_TONE[request.status]}`}
        >
          {request.status}
        </span>
      </header>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-md border border-ink/15 bg-ink/[0.03] px-2.5 py-1 text-ink/70">
          {request.current_value || <em className="text-ink/45">empty</em>}
        </span>
        <ArrowRight aria-hidden className="h-4 w-4 text-ink/40" strokeWidth={1.75} />
        <span className="rounded-md border border-success-200 bg-success-50 px-2.5 py-1 font-medium text-success-800">
          {request.requested_value || <em className="font-normal text-ink/45">empty</em>}
        </span>
      </div>

      {heldBy ? (
        <div className="text-[13px] leading-snug" style={{ color: 'rgb(var(--color-warn))' }} data-held-name-holder>
          {'unverified' in heldBy ? (
            <>Couldn&rsquo;t check whether this name is held — reload before applying.</>
          ) : (
            <>
              <span className="font-medium">Held name.</span> Its core &ldquo;{heldBy.core}&rdquo; is held by{' '}
              <strong>{heldBy.holderName ?? 'a shop'}</strong>
              {heldBy.reason ? <> ({HOLD_REASON_LABEL[heldBy.reason]})</> : null}.{' '}
              <InfoTip label="Check the papers" align="start">
                Check this supplier&rsquo;s papers prove it is the same business before you apply. Applying also frees
                this core for this shop.
              </InfoTip>
            </>
          )}
        </div>
      ) : null}

      {request.note ? (
        <p className={TEMPLATE_SUBLINE}>
          <span className="font-medium">Supplier note:</span> {request.note}
        </p>
      ) : null}

      {request.status === 'open' ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3">
          <ConfirmForm
            action={applyCorrectionRequest}
            title="Apply this correction?"
            confirmLabel="Apply to profile"
            destructive={false}
            message={`Writes "${request.requested_value ?? ''}" to this supplier's ${fieldLabel} — the only edit path for a verified shop's locked details.`}
          >
            <input type="hidden" name="request_id" value={request.id} />
            <SubmitButton pendingLabel="Applying…" className={actionButtonClass('ok', { main: true })}>
              Apply to profile
            </SubmitButton>
          </ConfirmForm>
          <ConfirmForm
            action={declineCorrectionRequest}
            title="Decline this correction?"
            confirmLabel="Decline"
            message="Leaves the supplier's profile unchanged and closes the request."
          >
            <input type="hidden" name="request_id" value={request.id} />
            <SubmitButton pendingLabel="Declining…" className={actionButtonClass('neutral')}>
              Decline
            </SubmitButton>
          </ConfirmForm>
        </div>
      ) : request.resolved_at ? (
        <p className={`border-t border-[color:var(--m-line)] pt-3 ${TEMPLATE_SUBLINE}`}>
          Resolved {relativeTime(request.resolved_at)}
        </p>
      ) : null}
    </article>
  );
}

/**
 * Correct a shop's web address.
 *
 * ⚠ THIS IS A DIRECT FORM, NOT A QUEUE ITEM, AND THAT IS DELIBERATE. Nothing
 * anywhere can FILE a correction request — `requestProfileCorrection` has zero
 * callers and production holds zero rows — so routing the only remedy for a
 * permanent address through this queue would have shipped a fix nobody can
 * reach. The applied record is still written, so the decision is auditable.
 *
 * ⛔ The immutability trigger is NOT weakened. This is the one door it always
 * anticipated, behind the service role and an admin session.
 */
function ShopAddressCorrection() {
  return (
    <details className={`${ADMIN_FRAME} mb-2 mt-1 px-4 py-3`}>
      <summary className="flex min-h-11 cursor-pointer items-center text-[15px] font-semibold text-ink">
        Correct a shop&rsquo;s web address
      </summary>
      <div className="mt-2 space-y-4">
        <InfoTip label="About moving an address" align="start" labelClassName="text-[13px] font-semibold text-ink/70">
          A shop&rsquo;s address is permanent — it goes on save-the-dates,
          printed QR codes and the sitemap, and the shop cannot change it
          themselves. This is the only way to move one, for a typo, a
          trademark complaint, or an address built from a name the business
          has since corrected. The old address will keep working and send
          visitors to the new one.
        </InfoTip>
        <form action={correctShopAddress} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className={TEMPLATE_SUBLINE}>
                Current address
              </span>
              <input
                name="current_slug"
                required
                placeholder="banaweflorals"
                className="input-field w-full font-mono text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className={TEMPLATE_SUBLINE}>
                New address
              </span>
              <input
                name="new_slug"
                required
                pattern="[a-z0-9\-]{3,32}"
                placeholder="banaweblooms"
                className="input-field w-full font-mono text-sm"
              />
            </label>
          </div>
          <label className="block space-y-1">
            <span className={TEMPLATE_SUBLINE}>
              Why (recorded against the shop)
            </span>
            <textarea
              name="reason"
              required
              minLength={10}
              rows={2}
              placeholder="Registered as “Banawe Flroals” — typo in the shop name at signup."
              className="input-field w-full text-sm"
            />
          </label>
          <SubmitButton pendingLabel="Moving…" className={actionButtonClass('brand')}>
            Move the address
          </SubmitButton>
        </form>
      </div>
    </details>
  );
}

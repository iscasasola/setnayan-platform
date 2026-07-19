import Link from 'next/link';
import { PencilRuler, ArrowRight } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { relativeTime } from '@/lib/activity';
import { FormFlash } from '@/app/_components/forms/form-flash';
import { SubmitButton } from '@/app/_components/submit-button';
import { ConfirmForm } from '@/app/_components/confirm-form';
import {
  LOCKED_FIELD_LABEL,
  fetchCorrectionRequests,
  type CorrectionRequestStatus,
  type VendorCorrectionRequestRow,
} from '@/lib/vendor-corrections';
import { applyCorrectionRequest, declineCorrectionRequest } from './actions';

import { requireAdmin } from '@/lib/admin/require-admin';
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
    error?: string;
  }>;
}) {
  await requireAdmin();
  const search = await searchParams;
  const status = normalizeStatus(search.status ?? 'open');

  const admin = createAdminClient();
  const rows = await fetchCorrectionRequests(admin, { status });

  // Resolve vendor business names for the visible page in one batch.
  const vendorIds = Array.from(new Set(rows.map((r) => r.vendor_profile_id)));
  let vendorNames: Record<string, string> = {};
  if (vendorIds.length > 0) {
    const { data: vendorData } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id,business_name,business_slug')
      .in('vendor_profile_id', vendorIds);
    vendorNames = Object.fromEntries(
      (vendorData ?? []).map((v) => [
        v.vendor_profile_id as string,
        (v.business_name as string | null) || 'Unnamed vendor',
      ]),
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <p className="sn-eye flex items-center gap-2">
          <PencilRuler aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Verified-profile lock
        </p>
        <h1 className="sn-h1">
          Profile corrections
        </h1>
        <p className="max-w-2xl text-sm text-ink/65">
          Verified shops can&rsquo;t edit their identity details directly —
          they file a correction request instead. Applying writes the
          requested value to the vendor&rsquo;s profile; declining leaves it
          untouched. Either way the vendor sees the outcome.
        </p>
      </header>

      {search.error ? (
        <FormFlash tone="error">{decodeURIComponent(search.error)}</FormFlash>
      ) : null}
      {search.applied === '1' ? (
        <FormFlash tone="success">
          Correction applied — the vendor&rsquo;s profile now shows the
          requested value.
        </FormFlash>
      ) : null}
      {search.declined === '1' ? (
        <p className="mb-4 rounded-md border border-ink/15 bg-ink/5 px-4 py-3 text-sm text-ink/75">
          Correction declined — the vendor&rsquo;s profile is unchanged.
        </p>
      ) : null}
      {search.already_resolved === '1' ? (
        <p className="mb-4 rounded-md border border-ink/15 bg-ink/5 px-4 py-3 text-sm text-ink/75">
          That request was already resolved by another admin — nothing changed.
        </p>
      ) : null}

      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Request status">
        {STATUS_FILTERS.map((t) => {
          const active = status === t.value;
          return (
            <Link
              key={t.value}
              href={`/admin/corrections?status=${t.value}`}
              aria-pressed={active}
              className={
                active
                  ? 'inline-flex items-center rounded-full bg-ink px-3 py-1 text-xs font-medium text-cream'
                  : 'inline-flex items-center rounded-full border border-ink/20 bg-white/70 px-3 py-1 text-xs text-ink/70 hover:bg-ink/5'
              }
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink/15 bg-white/50 p-10 text-center text-sm text-ink/55">
          No correction requests for this filter. Verified vendors file them
          from their My Shop profile when a locked detail needs to change.
        </p>
      ) : (
        <ul className="grid gap-3">
          {rows.map((r) => (
            <li key={r.id}>
              <RequestCard
                request={r}
                vendorName={vendorNames[r.vendor_profile_id] ?? 'Unnamed vendor'}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RequestCard({
  request,
  vendorName,
}: {
  request: VendorCorrectionRequestRow;
  vendorName: string;
}) {
  const fieldLabel = LOCKED_FIELD_LABEL[request.field_key] ?? request.field_key;
  return (
    <article className="space-y-3 sn-tile p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-ink">{vendorName}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            <span>{request.public_id}</span>
            <span aria-hidden>·</span>
            <span>{fieldLabel}</span>
            <span aria-hidden>·</span>
            <span>{relativeTime(request.created_at)}</span>
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${STATUS_TONE[request.status]}`}
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

      {request.note ? (
        <p className="rounded-md border border-white/60 bg-white/70 px-3 py-2 text-xs text-ink/70">
          <span className="font-medium">Vendor note:</span> {request.note}
        </p>
      ) : null}

      {request.status === 'open' ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3">
          <ConfirmForm
            action={applyCorrectionRequest}
            title="Apply this correction?"
            confirmLabel="Apply to profile"
            destructive={false}
            message={`Writes "${request.requested_value ?? ''}" to this vendor's ${fieldLabel} — the only edit path for a verified shop's locked details.`}
          >
            <input type="hidden" name="request_id" value={request.id} />
            <SubmitButton pendingLabel="Applying…" className="button-primary h-9 px-3 text-xs">
              Apply to profile
            </SubmitButton>
          </ConfirmForm>
          <ConfirmForm
            action={declineCorrectionRequest}
            title="Decline this correction?"
            confirmLabel="Decline"
            message="Leaves the vendor's profile unchanged and closes the request."
          >
            <input type="hidden" name="request_id" value={request.id} />
            <SubmitButton
              pendingLabel="Declining…"
              className="inline-flex h-9 items-center rounded-md border border-ink/20 px-3 text-xs text-ink/70 hover:bg-ink/5"
            >
              Decline
            </SubmitButton>
          </ConfirmForm>
        </div>
      ) : request.resolved_at ? (
        <p className="border-t border-ink/10 pt-3 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
          Resolved {relativeTime(request.resolved_at)}
        </p>
      ) : null}
    </article>
  );
}

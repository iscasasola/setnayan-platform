import Link from 'next/link';
import Image from 'next/image';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { displayServiceLabel } from '@/lib/vendors';
import { FormFlash } from '@/app/_components/forms/form-flash';
import {
  VENDOR_PUBLIC_VISIBILITY_LABEL,
  parseVisibility,
  type VendorPublicVisibility,
} from '@/lib/vendor-visibility';
import {
  APPLICATION_TYPE_LABEL,
  DOC_SLOTS,
  computeSlaTone,
  countCompleteSlots,
  formatPhpCentavos,
  formatSlaCountdown,
  parseApplicationStatus,
  parseVerificationState,
  type ApplicationStatus,
  type DocUploadMap,
  type SlaTone,
  type VerificationState,
} from '@/lib/vendor-verification';
import { VerificationStateBadge } from '@/app/_components/verification/verification-status-card';
import { SubmitButton } from '@/app/_components/submit-button';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { BadgeCheck } from 'lucide-react';
import {
  approveApplication,
  approveVendor,
  archiveVendor,
  demoteVendor,
  rejectApplication,
  rejectVendor,
  setApplicationInReview,
  verifyVendorExperience,
} from './actions';
import { vendorExperienceEnabled } from '@/lib/vendor-experience';

export const metadata = { title: 'Verification queue · Admin' };

type Props = {
  searchParams: Promise<{
    surface?: string; // 'applications' (default) | 'visibility'
    status?: string;
    approved?: string;
    rejected?: string;
    archived?: string;
    app_approved?: string;
    app_rejected?: string;
    demoted?: string;
    in_review?: string;
    error?: string;
  }>;
};

type VendorVisibilityRow = {
  vendor_profile_id: string;
  public_id: string;
  business_name: string;
  business_slug: string | null;
  tagline: string | null;
  logo_url: string | null;
  services: string[];
  location_city: string | null;
  contact_email: string | null;
  public_visibility: VendorPublicVisibility;
  created_at: string;
};

type ApplicationRow = {
  application_id: string;
  public_id: string;
  vendor_profile_id: string;
  application_type: 'initial' | 'annual_renewal' | 'post_demotion';
  fee_php_centavos: number;
  status: ApplicationStatus;
  doc_uploads: DocUploadMap;
  docs_complete: boolean;
  submitted_at: string | null;
  sla_due_at: string | null;
  decision: 'approved' | 'rejected' | null;
  decision_reason: string | null;
  decided_at: string | null;
  admin_user_id: string | null;
  created_at: string;
  vendor: {
    vendor_profile_id: string;
    business_name: string;
    business_slug: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    location_city: string | null;
    verification_state: VerificationState;
    demotion_count: number;
    inBusinessSinceYear: number | null;
    experienceVerifiedAt: string | null;
  };
};

/**
 * Admin Verification Queue.
 *
 * Two surfaces, switched by ?surface= (default 'applications'):
 *   • applications — Vendor Verification flow queue (locked 2026-05-16).
 *     Tabs: pending / in_review / approved / rejected / demoted / all.
 *     Per-row actions: Set in review · Approve · Reject (reason) · Demote.
 *     SLA badge turns amber at 3 BD, red at 5 BD per 0006 § "Setnayan SLA".
 *
 *   • visibility — Vendor marketplace listing visibility queue from PR #56.
 *     Tabs: coming_soon / verified / hidden / archived / all.
 *     Per-row actions: Approve → Verified · Reject → Hidden · Archive.
 *
 * Per 0023 § 3.2 + 0006 § Vendor Verification flow + decision log 2026-05-16.
 */
export default async function AdminVerifyPage({ searchParams }: Props) {
  const search = await searchParams;
  const surface = search.surface === 'visibility' ? 'visibility' : 'applications';

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      {/*
       * v2.1 chrome overlay (2026-05-28) — eyebrow uses .m-eyebrow, heading
       * uses .m-display-tight (Saira Condensed). Matches admin overview +
       * couple/vendor dashboard treatment. Logic + queue table preserved.
       */}
      <header className="mb-6 space-y-2">
        <p className="m-eyebrow text-[color:var(--m-orange-2)]">
          Iteration 0006 · § Vendor Verification · 0023 § 3.2
        </p>
        <h1 className="m-display-tight text-2xl text-[color:var(--m-ink)] sm:text-3xl">
          Verification queue
        </h1>
        <p className="max-w-2xl text-sm text-ink/65">
          Vendors submit a 12-document checklist; Setnayan reviews within 3–5
          business days and flips them to <span className="font-medium">Verified</span>.
          The companion <span className="font-medium">Visibility</span> surface
          governs marketplace listing state (coming_soon · verified · hidden ·
          archived) independent of the verification workflow.
        </p>
      </header>

      <FlashBanner search={search} />

      <SurfaceTabs current={surface} />

      {surface === 'applications' ? (
        <ApplicationsSurface statusParam={search.status} error={search.error} />
      ) : (
        <VisibilitySurface statusParam={search.status} error={search.error} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Surface tabs (top-level)
// ---------------------------------------------------------------------------

function SurfaceTabs({ current }: { current: 'applications' | 'visibility' }) {
  const tabs: Array<{ key: 'applications' | 'visibility'; label: string }> = [
    { key: 'applications', label: 'Applications' },
    { key: 'visibility', label: 'Listing visibility' },
  ];
  return (
    <nav
      className="mb-4 inline-flex gap-1 rounded-lg border border-ink/15 bg-cream p-1"
      aria-label="Verification surfaces"
    >
      {tabs.map((t) => {
        const active = current === t.key;
        return (
          <Link
            key={t.key}
            href={`/admin/verify?surface=${t.key}`}
            aria-pressed={active}
            className={
              active
                ? 'inline-flex items-center rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-cream sn-bounce'
                : 'inline-flex items-center rounded-md px-3 py-1.5 text-xs text-ink/70 hover:bg-ink/5'
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

function FlashBanner({
  search,
}: {
  search: Awaited<Props['searchParams']>;
}) {
  if (search.error) {
    return <FormFlash tone="error">{decodeURIComponent(search.error)}</FormFlash>;
  }
  if (search.app_approved === '1') {
    return (
      <p className="mb-4 rounded-md border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-800">
        Application approved — vendor is now verified.
      </p>
    );
  }
  if (search.app_rejected === '1') {
    return (
      <p className="mb-4 rounded-md border border-ink/15 bg-ink/5 px-4 py-3 text-sm text-ink/75">
        Application rejected — vendor was notified with the decision reason.
      </p>
    );
  }
  if (search.demoted === '1') {
    return (
      <p className="mb-4 rounded-md border border-warn-300 bg-warn-50 px-4 py-3 text-sm text-warn-900">
        Vendor demoted — verified-tier perks revoked + 3-stage payout
        reinstated for any legacy bookings still routing through Setnayan.
      </p>
    );
  }
  if (search.in_review === '1') {
    return (
      <p className="mb-4 rounded-md border border-ink/15 bg-ink/5 px-4 py-3 text-sm text-ink/75">
        Application marked as in review.
      </p>
    );
  }
  if (search.approved === '1') {
    return (
      <p className="mb-4 rounded-md border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-800">
        Vendor approved — they&rsquo;re now publicly bookable.
      </p>
    );
  }
  if (search.rejected === '1') {
    return (
      <p className="mb-4 rounded-md border border-ink/15 bg-ink/5 px-4 py-3 text-sm text-ink/75">
        Vendor visibility rejected — they stay in their current state.
      </p>
    );
  }
  if (search.archived === '1') {
    return (
      <p className="mb-4 rounded-md border border-ink/15 bg-ink/5 px-4 py-3 text-sm text-ink/75">
        Vendor archived — they no longer appear in browse.
      </p>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// PART A — Applications surface
// ---------------------------------------------------------------------------

async function ApplicationsSurface({
  statusParam,
  error,
}: {
  statusParam?: string;
  error?: string;
}) {
  const tabFilter = parseApplicationsTab(statusParam);
  const admin = createAdminClient();

  // Read applications joined with their vendor row. We don't use a foreign-key
  // joined select via Supabase JS because the relationship hasn't been declared
  // in the schema cache here — two round trips is fine for queue volumes.
  const { data: appData, error: appErr } = await admin
    .from('vendor_verification_applications')
    .select(
      'application_id,public_id,vendor_profile_id,application_type,fee_php_centavos,status,doc_uploads,docs_complete,submitted_at,sla_due_at,decision,decision_reason,decided_at,admin_user_id,created_at',
    )
    .in('status', tabFilter.statuses)
    .order('submitted_at', { ascending: true, nullsFirst: false })
    .limit(200);

  if (appErr) {
    logQueryError('AdminVerifyPage (vendor_verification_applications)', appErr);
  }

  const apps = (appData ?? []) as Omit<ApplicationRow, 'vendor'>[];
  const vendorIds = Array.from(new Set(apps.map((a) => a.vendor_profile_id)));
  // Declared experience (flag + schema gated; soft-probe degrades on 42703 so a
  // pre-migration DB never breaks the queue). Keyed by vendor_profile_id.
  const expMap: Record<string, { year: number | null; verifiedAt: string | null }> = {};
  if (vendorExperienceEnabled() && vendorIds.length > 0) {
    const { data: expRows } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id, in_business_since_year, experience_verified_at')
      .in('vendor_profile_id', vendorIds)
      .then((r) => (r.error ? { data: null } : r));
    for (const v of (expRows ?? []) as Array<{ vendor_profile_id: string; in_business_since_year?: number | null; experience_verified_at?: string | null }>) {
      expMap[v.vendor_profile_id] = {
        year: v.in_business_since_year ?? null,
        verifiedAt: v.experience_verified_at ?? null,
      };
    }
  }

  let vendorMap: Record<string, ApplicationRow['vendor']> = {};
  if (vendorIds.length > 0) {
    const { data: vendorData } = await admin
      .from('vendor_profiles')
      .select(
        'vendor_profile_id,business_name,business_slug,contact_email,contact_phone,location_city,verification_state,demotion_count',
      )
      .in('vendor_profile_id', vendorIds);
    vendorMap = Object.fromEntries(
      (vendorData ?? []).map((v) => [
        v.vendor_profile_id,
        {
          vendor_profile_id: v.vendor_profile_id,
          business_name: v.business_name ?? '',
          business_slug: v.business_slug ?? null,
          contact_email: v.contact_email ?? null,
          contact_phone: v.contact_phone ?? null,
          location_city: v.location_city ?? null,
          verification_state: parseVerificationState(v.verification_state),
          demotion_count: (v.demotion_count as number | null) ?? 0,
          inBusinessSinceYear: expMap[v.vendor_profile_id]?.year ?? null,
          experienceVerifiedAt: expMap[v.vendor_profile_id]?.verifiedAt ?? null,
        },
      ]),
    );
  }

  // Optional: a "demoted" tab also surfaces vendor rows that aren't tied to a
  // pending application — vendors who got auto-demoted via the dispute cron.
  let demotedFallback: ApplicationRow['vendor'][] = [];
  if (statusParam === 'demoted') {
    const { data: demotedVendors } = await admin
      .from('vendor_profiles')
      .select(
        'vendor_profile_id,business_name,business_slug,contact_email,contact_phone,location_city,verification_state,demotion_count',
      )
      .eq('verification_state', 'demoted')
      .order('last_demoted_at', { ascending: false })
      .limit(100);
    demotedFallback = (demotedVendors ?? []).map((v) => ({
      vendor_profile_id: v.vendor_profile_id,
      business_name: v.business_name ?? '',
      business_slug: v.business_slug ?? null,
      contact_email: v.contact_email ?? null,
      contact_phone: v.contact_phone ?? null,
      location_city: v.location_city ?? null,
      verification_state: parseVerificationState(v.verification_state),
      demotion_count: (v.demotion_count as number | null) ?? 0,
      inBusinessSinceYear: null,
      experienceVerifiedAt: null,
    }));
  }

  const fullRows: ApplicationRow[] = apps.map((a) => ({
    ...a,
    application_type: a.application_type as ApplicationRow['application_type'],
    status: parseApplicationStatus(a.status),
    doc_uploads: (a.doc_uploads ?? {}) as DocUploadMap,
    vendor: vendorMap[a.vendor_profile_id] ?? {
      vendor_profile_id: a.vendor_profile_id,
      business_name: '',
      business_slug: null,
      contact_email: null,
      contact_phone: null,
      location_city: null,
      verification_state: 'unverified',
      demotion_count: 0,
      inBusinessSinceYear: null,
      experienceVerifiedAt: null,
    },
  }));

  return (
    <>
      <ApplicationsTabs current={statusParam ?? 'pending_review'} />

      {appErr ? (
        <FormFlash tone="error">
          Verification applications couldn&apos;t load right now. We&apos;ve logged the issue — refresh in a moment or check Sentry for the full detail.
        </FormFlash>
      ) : null}

      {error ? null : null}

      {fullRows.length === 0 && demotedFallback.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink/20 bg-cream p-10 text-center text-sm text-ink/55">
          {tabFilter.emptyHint}
        </p>
      ) : (
        <>
          <ul className="grid gap-3">
            {fullRows.map((r) => (
              <li key={r.application_id}>
                <ApplicationCard application={r} />
              </li>
            ))}
          </ul>

          {demotedFallback.length > 0 ? (
            <section className="mt-8 space-y-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
                Currently demoted (no pending application)
              </p>
              <ul className="grid gap-3 sm:grid-cols-2">
                {demotedFallback.map((v) => (
                  <li key={v.vendor_profile_id}>
                    <DemotedVendorCard vendor={v} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}

function parseApplicationsTab(raw: string | undefined): {
  statuses: ApplicationStatus[];
  emptyHint: string;
} {
  switch (raw) {
    case 'in_review':
      return {
        statuses: ['in_review'],
        emptyHint: 'No applications in active review.',
      };
    case 'approved':
      return {
        statuses: ['approved'],
        emptyHint: 'No recently approved applications.',
      };
    case 'rejected':
      return {
        statuses: ['rejected'],
        emptyHint: 'No rejected applications.',
      };
    case 'demoted':
      return {
        statuses: [],
        emptyHint:
          'No vendors currently demoted. (Demote happens when a verified vendor accumulates 3+ disputes in 30 days.)',
      };
    case 'all':
      return {
        statuses: [
          'draft',
          'pending_review',
          'in_review',
          'approved',
          'rejected',
          'withdrawn',
        ],
        emptyHint: 'No applications on file.',
      };
    case 'pending':
    case 'pending_review':
    default:
      return {
        statuses: ['pending_review'],
        emptyHint: 'No applications waiting for review.',
      };
  }
}

function ApplicationsTabs({ current }: { current: string }) {
  const tabs: ReadonlyArray<{ key: string; label: string }> = [
    { key: 'pending_review', label: 'Pending' },
    { key: 'in_review', label: 'In review' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'demoted', label: 'Demoted' },
    { key: 'all', label: 'All' },
  ];
  // Normalise legacy ?status=pending to pending_review.
  const normalized = current === 'pending' ? 'pending_review' : current;
  return (
    <nav className="mb-4 flex flex-wrap gap-2" aria-label="Application status">
      {tabs.map((t) => {
        const active = normalized === t.key;
        return (
          <Link
            key={t.key}
            href={`/admin/verify?surface=applications&status=${t.key}`}
            aria-pressed={active}
            className={
              active
                ? 'inline-flex items-center rounded-full bg-ink px-3 py-1 text-xs font-medium text-cream'
                : 'inline-flex items-center rounded-full border border-ink/20 bg-cream px-3 py-1 text-xs text-ink/70 hover:bg-ink/5'
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

function ApplicationCard({ application }: { application: ApplicationRow }) {
  const completeCount = countCompleteSlots(application.doc_uploads);
  const slaTone = computeSlaTone(
    application.submitted_at,
    application.decided_at,
  );
  const slaText = formatSlaCountdown(
    application.submitted_at,
    application.decided_at,
  );

  return (
    <article className="space-y-4 rounded-xl border border-ink/10 bg-cream p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-ink">
            {application.vendor.business_name || 'Unnamed vendor'}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            <span>{application.public_id}</span>
            <span aria-hidden>·</span>
            <span>{APPLICATION_TYPE_LABEL[application.application_type]}</span>
            <span aria-hidden>·</span>
            <span>{formatPhpCentavos(application.fee_php_centavos)}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SlaBadge tone={slaTone} label={slaText} />
          <VerificationStateBadge state={application.vendor.verification_state} />
          <StatusBadge status={application.status} />
        </div>
      </header>

      <div className="grid gap-3 text-xs text-ink/65 sm:grid-cols-2">
        <div className="space-y-0.5">
          {application.vendor.contact_email ? (
            <p>{application.vendor.contact_email}</p>
          ) : null}
          {application.vendor.contact_phone ? (
            <p>{application.vendor.contact_phone}</p>
          ) : null}
          {application.vendor.location_city ? (
            <p>{application.vendor.location_city}</p>
          ) : null}
        </div>
        <div className="space-y-0.5">
          <p>
            Checklist:{' '}
            <span className="font-medium text-ink">{completeCount}</span>/
            {DOC_SLOTS.length} items complete
          </p>
          {application.submitted_at ? (
            <p>
              Submitted{' '}
              {new Date(application.submitted_at).toLocaleString('en-PH')}
            </p>
          ) : null}
          {application.decided_at ? (
            <p>
              Decided{' '}
              {new Date(application.decided_at).toLocaleString('en-PH')}
            </p>
          ) : null}
          {application.vendor.demotion_count > 0 ? (
            <p className="text-warn-700">
              Prior demotions: {application.vendor.demotion_count}
            </p>
          ) : null}
        </div>
      </div>

      {application.decision_reason ? (
        <p className="rounded-md border border-ink/15 bg-ink/[0.03] px-3 py-2 text-xs text-ink/75">
          <span className="font-medium">Decision reason:</span>{' '}
          {application.decision_reason}
        </p>
      ) : null}

      <details className="rounded-md border border-ink/10 bg-cream/60">
        <summary className="cursor-pointer px-3 py-2 text-xs text-ink/65">
          12-doc checklist
        </summary>
        <ul className="space-y-1 px-3 pb-3 text-xs">
          {DOC_SLOTS.map((slot) => {
            const v = application.doc_uploads?.[slot.key];
            const tone = v
              ? 'text-success-700'
              : slot.kind === 'upload'
                ? 'text-warn-700'
                : 'text-ink/60';
            return (
              <li key={slot.key} className={`flex items-center gap-2 ${tone}`}>
                <span className="inline-flex h-4 w-5 items-center justify-center rounded-full bg-ink/5 font-mono text-[9px]">
                  {slot.number}
                </span>
                <span className="font-medium">{slot.label}</span>
              </li>
            );
          })}
        </ul>
      </details>

      {vendorExperienceEnabled() && application.vendor.inBusinessSinceYear != null ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-ink/10 bg-cream/60 px-3 py-2 text-xs">
          <span className="text-ink/75">
            Declared:{' '}
            <span className="font-medium text-ink">
              in business since {application.vendor.inBusinessSinceYear}
            </span>{' '}
            — confirm against the DTI document above.
          </span>
          {application.vendor.experienceVerifiedAt ? (
            <span className="inline-flex items-center gap-1 font-medium text-success-700">
              <BadgeCheck aria-hidden className="h-4 w-4" strokeWidth={2} />
              Experience verified
            </span>
          ) : (
            <ConfirmForm
              action={verifyVendorExperience}
              title="Confirm this vendor's experience?"
              confirmLabel="Confirm — matches DTI"
              destructive={false}
              message={`Marks "in business since ${application.vendor.inBusinessSinceYear}" as verified against their DTI registration — a verified experience badge then shows on their card.`}
            >
              <input type="hidden" name="vendor_profile_id" value={application.vendor.vendor_profile_id} />
              <SubmitButton
                pendingLabel="Verifying…"
                className="inline-flex h-9 items-center rounded-md border border-ink/20 px-3 text-xs text-ink/70 hover:bg-ink/5"
              >
                Confirm — matches DTI
              </SubmitButton>
            </ConfirmForm>
          )}
        </div>
      ) : null}

      <ActionRow application={application} />
    </article>
  );
}

function ActionRow({ application }: { application: ApplicationRow }) {
  const isPendingOrReview =
    application.status === 'pending_review' ||
    application.status === 'in_review';
  const isApproved = application.status === 'approved';

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 pt-4">
      {application.status === 'pending_review' ? (
        <form action={setApplicationInReview}>
          <input
            type="hidden"
            name="application_id"
            value={application.application_id}
          />
          <SubmitButton
            pendingLabel="Marking…"
            className="inline-flex h-11 items-center rounded-md border border-ink/20 px-3 text-xs text-ink/70 hover:bg-ink/5"
          >
            Mark in review
          </SubmitButton>
        </form>
      ) : null}

      {isPendingOrReview ? (
        <ConfirmForm
          action={approveApplication}
          title="Approve this application?"
          confirmLabel="Approve → Verified"
          destructive={false}
          message="Approving flips this vendor to Verified — their public listing goes live, the verified badge appears, Pro/Enterprise unlock, and they're notified."
        >
          <input
            type="hidden"
            name="application_id"
            value={application.application_id}
          />
          <input type="hidden" name="reason" value="" />
          <SubmitButton
            pendingLabel="Approving…"
            className="button-primary h-9 px-3 text-xs"
          >
            Approve → Verified
          </SubmitButton>
        </ConfirmForm>
      ) : null}

      {isPendingOrReview ? (
        <details className="relative">
          <summary className="inline-flex h-9 cursor-pointer items-center rounded-md border border-terracotta/30 bg-terracotta/5 px-3 text-xs text-terracotta-700">
            Reject…
          </summary>
          <form
            action={rejectApplication}
            className="absolute right-0 z-10 mt-2 w-72 space-y-2 rounded-md border border-ink/15 bg-cream p-3 shadow-lg"
          >
            <input
              type="hidden"
              name="application_id"
              value={application.application_id}
            />
            <label
              className="block text-xs text-ink/65"
              htmlFor={`reason-${application.application_id}`}
            >
              Reason (required — surfaces to vendor)
            </label>
            <textarea
              id={`reason-${application.application_id}`}
              name="reason"
              required
              minLength={5}
              rows={3}
              placeholder="e.g. DTI certificate image is unreadable; please re-upload"
              className="block w-full rounded-md border border-ink/20 bg-cream px-2 py-1 text-xs text-ink"
            />
            <SubmitButton
              pendingLabel="Rejecting…"
              className="inline-flex h-11 items-center rounded-md bg-terracotta/15 px-3 text-xs font-medium text-terracotta-700 hover:bg-terracotta/25"
            >
              Confirm reject
            </SubmitButton>
          </form>
        </details>
      ) : null}

      {isApproved ? (
        <details className="relative">
          <summary className="inline-flex h-9 cursor-pointer items-center rounded-md border border-warn-300 bg-warn-50 px-3 text-xs text-warn-900">
            Demote…
          </summary>
          <form
            action={demoteVendor}
            className="absolute right-0 z-10 mt-2 w-72 space-y-2 rounded-md border border-ink/15 bg-cream p-3 shadow-lg"
          >
            <input
              type="hidden"
              name="vendor_profile_id"
              value={application.vendor_profile_id}
            />
            <input
              type="hidden"
              name="application_id"
              value={application.application_id}
            />
            <label
              className="block text-xs text-ink/65"
              htmlFor={`demote-reason-${application.application_id}`}
            >
              Reason (required)
            </label>
            <textarea
              id={`demote-reason-${application.application_id}`}
              name="reason"
              required
              minLength={5}
              rows={3}
              placeholder="e.g. 3+ disputes in 30 days; revoking verified-tier perks"
              className="block w-full rounded-md border border-ink/20 bg-cream px-2 py-1 text-xs text-ink"
            />
            <SubmitButton
              pendingLabel="Demoting…"
              className="inline-flex h-11 items-center rounded-md bg-warn-100 px-3 text-xs font-medium text-warn-900 hover:bg-warn-200"
            >
              Confirm demote
            </SubmitButton>
          </form>
        </details>
      ) : null}
    </div>
  );
}

function DemotedVendorCard({
  vendor,
}: {
  vendor: ApplicationRow['vendor'];
}) {
  return (
    <article className="space-y-2 rounded-xl border border-warn-300/60 bg-warn-50/40 p-4">
      <p className="text-sm font-semibold text-ink">
        {vendor.business_name || 'Unnamed vendor'}
      </p>
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
        {vendor.location_city ?? '—'} · demotions: {vendor.demotion_count}
      </p>
      <p className="text-xs text-ink/65">
        Re-verification fee:{' '}
        <span className="font-medium">{formatPhpCentavos(250000)}</span>. Vendor
        has to submit a new <span className="font-medium">post_demotion</span>{' '}
        application to climb back.
      </p>
    </article>
  );
}

// ---------------------------------------------------------------------------
// PART B — Visibility surface (preserved from PR #56)
// ---------------------------------------------------------------------------

async function VisibilitySurface({
  statusParam,
  error,
}: {
  statusParam?: string;
  error?: string;
}) {
  const statusFilter = parseVisibilityTab(statusParam);
  const admin = createAdminClient();
  const { data, error: queryError } = await admin
    .from('vendor_profiles')
    .select(
      'vendor_profile_id,public_id,business_name,business_slug,tagline,logo_url,services,location_city,contact_email,public_visibility,created_at',
    )
    .in('public_visibility', statusFilter)
    .order('created_at', { ascending: false })
    .limit(200);

  if (queryError) {
    logQueryError('AdminVerifyPage (vendor_profiles visibility)', queryError);
  }

  const vendors = (data ?? []) as VendorVisibilityRow[];

  return (
    <>
      <VisibilityTabs current={statusParam ?? 'coming_soon'} />

      {queryError ? (
        <FormFlash tone="error">
          Vendor visibility queue couldn&apos;t load right now. We&apos;ve logged the issue — refresh in a moment or check Sentry for the full detail.
        </FormFlash>
      ) : null}

      {error ? null : null}

      {vendors.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink/20 bg-cream p-10 text-center text-sm text-ink/55">
          Queue is empty for this filter. Try widening the status.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {vendors.map((v) => (
            <li key={v.vendor_profile_id}>
              <VerifyCard vendor={v} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function parseVisibilityTab(raw: string | undefined): VendorPublicVisibility[] {
  switch (raw) {
    case 'all':
      return ['hidden', 'coming_soon', 'verified', 'archived'];
    case 'verified':
      return ['verified'];
    case 'hidden':
      return ['hidden'];
    case 'archived':
      return ['archived'];
    case 'coming_soon':
    default:
      return ['coming_soon'];
  }
}

function VisibilityTabs({ current }: { current: string }) {
  const tabs: ReadonlyArray<{ key: string; label: string }> = [
    { key: 'coming_soon', label: 'Coming soon' },
    { key: 'verified', label: 'Verified' },
    { key: 'hidden', label: 'Hidden' },
    { key: 'archived', label: 'Archived' },
    { key: 'all', label: 'All' },
  ];
  return (
    <nav className="mb-4 flex flex-wrap gap-2" aria-label="Visibility status">
      {tabs.map((t) => {
        const active = current === t.key;
        return (
          <Link
            key={t.key}
            href={`/admin/verify?surface=visibility&status=${t.key}`}
            aria-pressed={active}
            className={
              active
                ? 'inline-flex items-center rounded-full bg-ink px-3 py-1 text-xs font-medium text-cream'
                : 'inline-flex items-center rounded-full border border-ink/20 bg-cream px-3 py-1 text-xs text-ink/70 hover:bg-ink/5'
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

function VerifyCard({ vendor }: { vendor: VendorVisibilityRow }) {
  const visibility = parseVisibility(vendor.public_visibility);
  const slug = vendor.business_slug ?? null;
  return (
    <article className="flex h-full flex-col gap-3 rounded-xl border border-ink/10 bg-cream p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar logoUrl={vendor.logo_url} name={vendor.business_name || 'Vendor'} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">
              {vendor.business_name || 'Unnamed'}
            </p>
            {slug ? (
              <p className="truncate font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                /v/{slug}
              </p>
            ) : null}
          </div>
        </div>
        <VisibilityBadge value={visibility} />
      </header>

      {vendor.tagline ? <p className="text-xs text-ink/65">{vendor.tagline}</p> : null}

      <div className="space-y-0.5 text-xs text-ink/65">
        {vendor.contact_email ? <p>{vendor.contact_email}</p> : null}
        {vendor.location_city ? <p>{vendor.location_city}</p> : null}
        {vendor.services.length > 0 ? (
          <p>
            {vendor.services.slice(0, 3).map(displayServiceLabel).join(', ')}
            {vendor.services.length > 3 ? ` +${vendor.services.length - 3}` : ''}
          </p>
        ) : null}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
        {visibility !== 'verified' ? (
          <ConfirmForm
            action={approveVendor}
            title="Make this vendor public?"
            confirmLabel="Approve → Verified"
            destructive={false}
            message="This makes the vendor publicly bookable on the marketplace (visibility → Verified) and notifies them."
          >
            <input type="hidden" name="vendor_profile_id" value={vendor.vendor_profile_id} />
            <SubmitButton pendingLabel="Approving…" className="button-primary h-9 px-3 text-xs">
              Approve → Verified
            </SubmitButton>
          </ConfirmForm>
        ) : null}
        {visibility !== 'hidden' ? (
          <ConfirmForm
            action={rejectVendor}
            title="Hide this vendor?"
            confirmLabel="Reject → Hidden"
            message="This hides the vendor from marketplace browse — couples can no longer find them. Reversible by approving again later."
          >
            <input type="hidden" name="vendor_profile_id" value={vendor.vendor_profile_id} />
            <input type="hidden" name="reject_to" value="hidden" />
            <SubmitButton pendingLabel="Hiding…" className="button-secondary h-9 px-3 text-xs">
              Reject → Hidden
            </SubmitButton>
          </ConfirmForm>
        ) : null}
        {visibility !== 'archived' ? (
          <ConfirmForm
            action={archiveVendor}
            title="Archive this vendor?"
            confirmLabel="Archive"
            message="This archives the vendor — permanently removed from marketplace browse."
          >
            <input type="hidden" name="vendor_profile_id" value={vendor.vendor_profile_id} />
            <SubmitButton
              pendingLabel="Archiving…"
              className="inline-flex h-11 items-center rounded-md border border-ink/20 px-3 text-xs text-ink/70 hover:bg-ink/5"
            >
              Archive
            </SubmitButton>
          </ConfirmForm>
        ) : null}
      </div>

      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
        {vendor.public_id}
      </p>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

function SlaBadge({ tone, label }: { tone: SlaTone; label: string }) {
  const palette: Record<SlaTone, string> = {
    on_track: 'bg-success-50 text-success-800 border-success-200',
    warning: 'bg-warn-50 text-warn-900 border-warn-300',
    overdue: 'bg-terracotta/10 text-terracotta-700 border-terracotta/30',
    closed: 'bg-ink/5 text-ink/55 border-ink/15',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${palette[tone]}`}
      title="Setnayan SLA is 3–5 business days. Amber after 3 BD; red after 5 BD."
    >
      SLA · {label}
    </span>
  );
}

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const tone: Record<ApplicationStatus, string> = {
    draft: 'bg-ink/5 text-ink/65',
    pending_review: 'bg-warn-100 text-warn-900',
    in_review: 'bg-warn-50 text-warn-900 border border-warn-300',
    approved: 'bg-success-100 text-success-800',
    rejected: 'bg-terracotta/10 text-terracotta-700',
    withdrawn: 'bg-ink/8 text-ink/55',
  };
  const label: Record<ApplicationStatus, string> = {
    draft: 'Draft',
    pending_review: 'Pending',
    in_review: 'In review',
    approved: 'Approved',
    rejected: 'Rejected',
    withdrawn: 'Withdrawn',
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${tone[status]}`}
    >
      {label[status]}
    </span>
  );
}

function VisibilityBadge({ value }: { value: VendorPublicVisibility }) {
  const tone: Record<VendorPublicVisibility, string> = {
    coming_soon: 'bg-warn-100 text-warn-900',
    verified: 'bg-success-100 text-success-800',
    hidden: 'bg-ink/8 text-ink/65',
    archived: 'bg-ink/8 text-ink/45',
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${tone[value]}`}
    >
      {VENDOR_PUBLIC_VISIBILITY_LABEL[value]}
    </span>
  );
}

function Avatar({ logoUrl, name }: { logoUrl: string | null; name: string }) {
  if (logoUrl) {
    return (
      <span className="inline-flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-ink/10 bg-cream">
        <Image
          src={logoUrl}
          alt={`${name} logo`}
          width={40}
          height={40}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </span>
    );
  }
  const initials = name
    .split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
  return (
    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terracotta/15 font-mono text-xs font-semibold text-terracotta-700">
      {initials || '?'}
    </span>
  );
}

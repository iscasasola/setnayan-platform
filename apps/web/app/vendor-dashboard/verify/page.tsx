import { redirect } from 'next/navigation';
import {
  CheckCircle2,
  FileCheck,
  ShieldCheck,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import {
  APPLICATION_TYPE_LABEL,
  DOC_SLOTS,
  countCompleteSlots,
  fetchLatestApplication,
  formatPhpCentavos,
  formatSlaCountdown,
  isSlotComplete,
  parseVerificationState,
  recommendedApplicationType,
  type ApplicationType,
  type DocUploadMap,
  type DocSlot,
} from '@/lib/vendor-verification';
import { SubmitButton } from '@/app/_components/submit-button';
import { FileUpload } from '@/app/_components/file-upload';
import { VerificationStatusCard } from '@/app/_components/verification/verification-status-card';
import { DocSlotCard } from '@/app/_components/verification/doc-slot-card';
import { ApplicationProgress } from '@/app/_components/verification/application-progress';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import {
  ensureDraftApplication,
  submitApplication,
  updateDocUpload,
  withdrawApplication,
} from './actions';

export const metadata = {
  title: 'Verification · Vendor',
  description:
    'Submit the 12-document vendor verification checklist to unlock Pro Vendor and the verified marketplace badge.',
};

type Props = {
  searchParams: Promise<{
    error?: string;
    slot_saved?: string;
    submitted?: string;
    withdrawn?: string;
  }>;
};

export default async function VendorVerifyPage({ searchParams }: Props) {
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // We extended VendorProfileRow with a few verification columns in the
  // 2026-05-16 migration. Pull them directly here so we don't have to widen
  // the shared helper for every consumer (this surface is the only one that
  // needs the verification-specific columns today).
  const { data: verRow } = await supabase
    .from('vendor_profiles')
    .select(
      'verification_state, last_verified_at, next_renewal_due_at, demotion_count, last_demoted_at',
    )
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();

  const verificationState = parseVerificationState(verRow?.verification_state);
  const lastVerifiedAt = (verRow?.last_verified_at as string | null) ?? null;
  const application = await fetchLatestApplication(
    supabase,
    profile.vendor_profile_id,
  );

  // Resolve presigned display URLs for every R2 ref the vendor has uploaded
  // so the FileUpload widgets render their thumbnails on mount. Each upload
  // bucket needs a separate signing round-trip; do them in parallel.
  const docMap = (application?.doc_uploads ?? {}) as DocUploadMap;
  const seedUrlEntries: Array<[string, string]> = [];
  await Promise.all(
    Object.values(docMap).flatMap((entry) => {
      if (!entry) return [];
      if (Array.isArray(entry)) {
        return entry
          .filter((e) => typeof e?.r2_key === 'string')
          .map(async (e) => {
            const ref = e.r2_key as string;
            const url = await displayUrlForStoredAsset(ref);
            if (url) seedUrlEntries.push([ref, url]);
          });
      }
      if (typeof entry === 'object' && 'r2_key' in entry && entry.r2_key) {
        return [
          displayUrlForStoredAsset(entry.r2_key as string).then((url) => {
            if (url) seedUrlEntries.push([entry.r2_key as string, url]);
          }),
        ];
      }
      return [];
    }),
  );
  const seedUrlMap: Record<string, string> =
    Object.fromEntries(seedUrlEntries);

  const recommended = recommendedApplicationType(
    verificationState,
    lastVerifiedAt,
  );
  const completeCount = countCompleteSlots(docMap);
  const totalSlots = DOC_SLOTS.length;
  const hasDraft = application?.status === 'draft';
  const isPending = application?.status === 'pending_review';
  const isInReview = application?.status === 'in_review';
  const isApproved = application?.status === 'approved';
  const isRejected = application?.status === 'rejected';

  return (
    <section className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
            <ShieldCheck aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Verification
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Submit the 12-item checklist below to flip your profile to{' '}
          <span className="font-medium">Verified</span> on the marketplace.
          Verified vendors unlock Pro Vendor and Enterprise subscriptions
          and the verified badge on every listing.
          Initial verification is{' '}
          <span className="font-medium">free</span>; annual renewal is{' '}
          <span className="font-medium">{formatPhpCentavos(150000)}</span>;
          post-demotion re-verification is{' '}
          <span className="font-medium">{formatPhpCentavos(250000)}</span>.
        </p>
      </header>

      <article className="flex items-start gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
        <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
        <div className="space-y-1">
          <p className="font-medium">Verification is free during launch</p>
          <p>
            Every vendor the Setnayan team verifies gets the verified
            marketplace badge, eligibility for{' '}
            <span className="font-semibold">Pro Vendor and Enterprise</span>, and
            full visibility in couple searches — no listing fee, no badge fee.
          </p>
        </div>
      </article>

      {search.error ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {decodeURIComponent(search.error)}
        </p>
      ) : null}
      {search.slot_saved ? (
        <p
          role="status"
          className="rounded-md border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          Saved. {completeCount} of {totalSlots} items complete.
        </p>
      ) : null}
      {search.submitted ? (
        <p
          role="status"
          className="rounded-md border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          Application submitted. Setnayan will review within 3–5 business days.
        </p>
      ) : null}
      {search.withdrawn ? (
        <p
          role="status"
          className="rounded-md border border-ink/15 bg-ink/5 px-4 py-3 text-sm text-ink/75"
        >
          Application withdrawn. You can start a new one any time.
        </p>
      ) : null}

      <VerificationStatusCard
        verificationState={verificationState}
        meta={
          application ? (
            <p className="text-xs opacity-75">
              Latest application:{' '}
              <span className="font-mono">{application.public_id}</span> ·{' '}
              {APPLICATION_TYPE_LABEL[application.application_type]}
            </p>
          ) : null
        }
      />

      {!application || application.status === 'withdrawn' ? (
        <StartApplicationCard recommended={recommended} />
      ) : null}

      {hasDraft && application ? (
        <ApplicationProgress
          completeCount={completeCount}
          totalSlots={totalSlots}
          applicationType={application.application_type}
        />
      ) : null}

      {hasDraft && application ? (
        <DocChecklist
          applicationId={application.application_id}
          docMap={docMap}
          vendorProfileId={profile.vendor_profile_id}
          seedDisplayUrls={seedUrlMap}
        />
      ) : null}

      {hasDraft && application ? (
        <SubmitCard
          applicationId={application.application_id}
          completeCount={completeCount}
          totalSlots={totalSlots}
        />
      ) : null}

      {(isPending || isInReview) && application ? (
        <PendingReviewCard application={application} />
      ) : null}

      {isApproved && application ? (
        <ApprovedCard application={application} />
      ) : null}

      {isRejected && application ? (
        <RejectedCard application={application} />
      ) : null}
    </section>
  );
}

function StartApplicationCard({
  recommended,
}: {
  recommended: ApplicationType | null;
}) {
  if (!recommended) return null;
  return (
    <article className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5">
      <div className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Start a new application
        </p>
        <h2 className="text-xl font-semibold">
          {APPLICATION_TYPE_LABEL[recommended]}
        </h2>
        <p className="text-sm text-ink/65">
          We recommend the{' '}
          <span className="font-medium">
            {APPLICATION_TYPE_LABEL[recommended].toLowerCase()}
          </span>{' '}
          application based on your current state. Picking a different type is
          fine — pricing follows the type you choose.
        </p>
      </div>
      <form action={ensureDraftApplication} className="space-y-3">
        <fieldset className="grid gap-2 sm:grid-cols-3">
          <TypeOption
            value="initial"
            label="Initial — FREE"
            help="First-time verification."
            defaultChecked={recommended === 'initial'}
          />
          <TypeOption
            value="annual_renewal"
            label="Annual renewal — ₱1,500"
            help="Renew before next_renewal_due_at."
            defaultChecked={recommended === 'annual_renewal'}
          />
          <TypeOption
            value="post_demotion"
            label="Post-demotion — ₱2,500"
            help="Re-apply after demotion."
            defaultChecked={recommended === 'post_demotion'}
          />
        </fieldset>
        <SubmitButton
          className="button-primary inline-flex h-10 items-center gap-2 px-4 text-sm"
          pendingLabel="Starting…"
        >
          <FileCheck aria-hidden className="h-4 w-4" strokeWidth={2} />
          Start application
        </SubmitButton>
      </form>
    </article>
  );
}

function TypeOption({
  value,
  label,
  help,
  defaultChecked,
}: {
  value: ApplicationType;
  label: string;
  help: string;
  defaultChecked?: boolean;
}) {
  return (
    <label
      className="flex cursor-pointer flex-col gap-1 rounded-xl border border-ink/15 bg-cream p-3 text-sm transition-colors has-[input:checked]:border-terracotta has-[input:checked]:bg-terracotta/5"
      htmlFor={`type-${value}`}
    >
      <span className="flex items-center gap-2">
        <input
          id={`type-${value}`}
          type="radio"
          name="application_type"
          value={value}
          defaultChecked={defaultChecked}
          className="h-3.5 w-3.5"
        />
        <span className="font-medium">{label}</span>
      </span>
      <span className="text-xs text-ink/65">{help}</span>
    </label>
  );
}

function DocChecklist({
  applicationId,
  docMap,
  vendorProfileId,
  seedDisplayUrls,
}: {
  applicationId: string;
  docMap: DocUploadMap;
  vendorProfileId: string;
  seedDisplayUrls: Record<string, string>;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">12-document checklist</h2>
      <p className="text-sm text-ink/65">
        Uploads land in the secure{' '}
        <span className="font-mono">setnayan-vendor-verification</span> R2
        bucket. 90-day rolling retention for raw uploads; 7-year retention for
        the verification audit trail (BIR § 235).
      </p>
      <ul className="grid gap-3 lg:grid-cols-2">
        {DOC_SLOTS.map((slot) => (
          <li key={slot.key}>
            <VendorDocSlotCard
              slot={slot}
              applicationId={applicationId}
              docMap={docMap}
              vendorProfileId={vendorProfileId}
              seedDisplayUrls={seedDisplayUrls}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function VendorDocSlotCard({
  slot,
  applicationId,
  docMap,
  vendorProfileId,
  seedDisplayUrls,
}: {
  slot: DocSlot;
  applicationId: string;
  docMap: DocUploadMap;
  vendorProfileId: string;
  seedDisplayUrls: Record<string, string>;
}) {
  const current = docMap?.[slot.key] ?? null;
  const complete = isSlotComplete(slot.key, current);

  return (
    <DocSlotCard slot={slot} complete={complete}>
      <SlotInputForm
        slot={slot}
        applicationId={applicationId}
        current={current}
        vendorProfileId={vendorProfileId}
        seedDisplayUrls={seedDisplayUrls}
      />
    </DocSlotCard>
  );
}

function SlotInputForm({
  slot,
  applicationId,
  current,
  vendorProfileId,
  seedDisplayUrls,
}: {
  slot: DocSlot;
  applicationId: string;
  current: DocUploadMap[string] | null;
  vendorProfileId: string;
  seedDisplayUrls: Record<string, string>;
}) {
  // Special handling per slot type.

  if (slot.key === 'social_media') {
    const currentUrl =
      current &&
      typeof current === 'object' &&
      'url' in current &&
      typeof current.url === 'string'
        ? current.url
        : '';
    return (
      <form action={updateDocUpload} className="space-y-2">
        <input type="hidden" name="application_id" value={applicationId} />
        <input type="hidden" name="slot_key" value={slot.key} />
        <label className="text-xs text-ink/65" htmlFor={`${slot.key}-url`}>
          Public Instagram / Facebook business URL
        </label>
        <input
          id={`${slot.key}-url`}
          name="url"
          type="url"
          inputMode="url"
          placeholder="https://instagram.com/your-brand"
          defaultValue={currentUrl}
          className="block w-full rounded-md border border-ink/20 bg-cream px-3 py-2 text-sm text-ink"
        />
        <SubmitButton
          className="button-secondary h-9 px-3 text-xs"
          pendingLabel="Saving…"
        >
          Save link
        </SubmitButton>
      </form>
    );
  }

  if (slot.key === 'google_meet') {
    return (
      <p className="rounded-md border border-dashed border-ink/15 bg-ink/[0.03] px-3 py-2 text-xs text-ink/70">
        Setnayan staff schedules this after your checklist is submitted. Watch
        your email + your dashboard notifications.
      </p>
    );
  }

  if (slot.key === 'phone_email_otp') {
    return (
      <p className="rounded-md border border-dashed border-ink/15 bg-ink/[0.03] px-3 py-2 text-xs text-ink/70">
        Phone OTP and email confirmation flip on the back-end once both
        confirmation events land. No action needed here.
      </p>
    );
  }

  if (slot.key === 'amlc_screening') {
    return (
      <p className="rounded-md border border-dashed border-ink/15 bg-ink/[0.03] px-3 py-2 text-xs text-ink/70">
        Setnayan runs AMLC sanctions / PEP screening server-side. Result lands
        on this row automatically once the integration is live.
      </p>
    );
  }

  // Default: file upload slot.
  // portfolio_samples + client_references accept multiple files; everything
  // else is single-file.
  const multiple =
    slot.key === 'portfolio_samples' || slot.key === 'client_references';
  const accept =
    slot.key === 'portfolio_samples'
      ? ['image/png', 'image/jpeg', 'image/webp']
      : ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];

  const seedValue = !current
    ? null
    : Array.isArray(current)
      ? current
          .filter((e) => typeof e?.r2_key === 'string')
          .map((e) => e.r2_key as string)
      : 'r2_key' in current && typeof current.r2_key === 'string'
        ? current.r2_key
        : null;

  return (
    <form action={updateDocUpload} className="space-y-3">
      <input type="hidden" name="application_id" value={applicationId} />
      <input type="hidden" name="slot_key" value={slot.key} />
      <FileUpload
        bucket="vendor-verification"
        pathPrefix={`vendors/${vendorProfileId}/verification/${slot.key}`}
        multiple={multiple}
        maxFiles={multiple ? 10 : 1}
        maxSizeMB={15}
        acceptedTypes={accept}
        name="r2_ref"
        currentValue={seedValue}
        initialDisplayUrls={seedDisplayUrls}
        variant="wide"
      />
      <SubmitButton
        className="button-secondary h-9 px-3 text-xs"
        pendingLabel="Saving…"
      >
        Save upload
      </SubmitButton>
    </form>
  );
}

function SubmitCard({
  applicationId,
  completeCount,
  totalSlots,
}: {
  applicationId: string;
  completeCount: number;
  totalSlots: number;
}) {
  const REQUIRED_TO_SUBMIT = 8;
  const eligible = completeCount >= REQUIRED_TO_SUBMIT;
  return (
    <article className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Submit for review
        </p>
        <h2 className="mt-1 text-xl font-semibold">
          Hand it off to Setnayan staff
        </h2>
        <p className="mt-1 text-sm text-ink/65">
          Submit at least <span className="font-medium">8</span> of the{' '}
          <span className="font-medium">{totalSlots}</span> items (the four
          remaining slots — Persona ID liveness, Google Meet, SMS/email OTP,
          AMLC screening — are admin-run and complete after submission).
          Setnayan SLA is <span className="font-medium">3–5 business days</span>
          .
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {eligible ? (
          <form action={submitApplication}>
            <input type="hidden" name="application_id" value={applicationId} />
            <SubmitButton
              className="button-primary inline-flex h-10 items-center gap-2 px-4 text-sm"
              pendingLabel="Submitting…"
            >
              <FileCheck aria-hidden className="h-4 w-4" strokeWidth={2} />
              Submit for review ({completeCount}/{totalSlots})
            </SubmitButton>
          </form>
        ) : (
          <button
            type="button"
            disabled
            className="button-primary inline-flex h-10 cursor-not-allowed items-center gap-2 px-4 text-sm opacity-50"
            title={`Add ${REQUIRED_TO_SUBMIT - completeCount} more checklist items to submit.`}
          >
            <FileCheck aria-hidden className="h-4 w-4" strokeWidth={2} />
            Submit for review ({completeCount}/{totalSlots})
          </button>
        )}
        <form action={withdrawApplication}>
          <input type="hidden" name="application_id" value={applicationId} />
          <SubmitButton
            pendingLabel="Withdrawing…"
            className="inline-flex h-10 items-center rounded-md border border-ink/20 px-3 text-xs text-ink/70 hover:bg-ink/5"
          >
            Withdraw draft
          </SubmitButton>
        </form>
      </div>
    </article>
  );
}

function PendingReviewCard({
  application,
}: {
  application: NonNullable<Awaited<ReturnType<typeof fetchLatestApplication>>>;
}) {
  const slaLabel = formatSlaCountdown(
    application.submitted_at,
    application.decided_at,
  );
  return (
    <article className="space-y-2 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-900">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] opacity-75">
        {application.status === 'in_review' ? 'In review' : 'Pending review'}
      </p>
      <h2 className="text-xl font-semibold">
        Setnayan staff is reviewing your submission
      </h2>
      <p className="text-sm">
        Submitted{' '}
        {application.submitted_at
          ? new Date(application.submitted_at).toLocaleString()
          : 'recently'}{' '}
        · <span className="font-medium">{slaLabel}</span>. Watch your
        notifications — Setnayan may follow up with questions or schedule the
        15-min Google Meet.
      </p>
    </article>
  );
}

function ApprovedCard({
  application,
}: {
  application: NonNullable<Awaited<ReturnType<typeof fetchLatestApplication>>>;
}) {
  return (
    <article className="space-y-2 rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-900">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] opacity-75">
        Approved
      </p>
      <h2 className="text-xl font-semibold">You&rsquo;re verified.</h2>
      <p className="text-sm">
        Pro Vendor and Enterprise subscriptions are available to start, and the
        verified badge is live on your marketplace listing. Approved{' '}
        {application.decided_at
          ? new Date(application.decided_at).toLocaleString()
          : ''}
        .
      </p>
    </article>
  );
}

function RejectedCard({
  application,
}: {
  application: NonNullable<Awaited<ReturnType<typeof fetchLatestApplication>>>;
}) {
  return (
    <article className="space-y-2 rounded-2xl border border-terracotta/40 bg-terracotta/5 p-5 text-terracotta-700">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] opacity-75">
        Rejected
      </p>
      <h2 className="text-xl font-semibold">
        Setnayan couldn&rsquo;t approve this application
      </h2>
      {application.decision_reason ? (
        <p className="rounded-md border border-terracotta/30 bg-cream/60 px-3 py-2 text-sm">
          <span className="font-medium">Reason:</span>{' '}
          {application.decision_reason}
        </p>
      ) : null}
      <p className="text-sm">
        Address the items above, then start a new application. If you have
        questions, reach out at{' '}
        <a className="underline" href="mailto:help@setnayan.com">
          help@setnayan.com
        </a>
        .
      </p>
    </article>
  );
}

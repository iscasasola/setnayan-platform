import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, ShieldCheck, ShieldOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SubmitButton } from '@/app/_components/submit-button';
import { StarRatingInput } from '@/app/_components/star-rating-input';
import { fetchOwnReviewForVendor, REVIEW_AXIS_LABEL, type ReviewAxis } from '@/lib/reviews';
import { VENDOR_CATEGORY_LABEL } from '@/lib/vendors';
import {
  detectSelfReviewSignal,
  SELF_REVIEW_SIGNAL_LABEL,
  SELF_REVIEW_SIGNAL_TONE,
  SELF_REVIEW_SIGNALS,
  type SelfReviewSignal,
} from '@/lib/self-review-gate';
import { submitCoupleReview, submitReviewAppeal } from './actions';

function parseBlockedSignal(raw: string | undefined): SelfReviewSignal | null {
  if (!raw) return null;
  if ((SELF_REVIEW_SIGNALS as ReadonlyArray<string>).includes(raw)) {
    return raw as SelfReviewSignal;
  }
  return null;
}

export const metadata = { title: 'Leave a review · Setnayan' };

const AXES: ReadonlyArray<ReviewAxis> = [
  'overall',
  'communication',
  'quality',
  'value',
  'on_time',
];

type Props = {
  params: Promise<{ eventId: string; eventVendorId: string }>;
  searchParams: Promise<{ blocked?: string; appeal_filed?: string }>;
};

type EventVendorLookup = {
  vendor_id: string;
  event_id: string;
  vendor_name: string;
  category: string;
  contact_email: string | null;
  status: string;
};

export default async function CoupleReviewVendorPage({ params, searchParams }: Props) {
  const { eventId, eventVendorId } = await params;
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: ev } = await supabase
    .from('event_vendors')
    .select('vendor_id, event_id, vendor_name, category, contact_email, status')
    .eq('vendor_id', eventVendorId)
    .eq('event_id', eventId)
    .maybeSingle();
  const eventVendor = ev as EventVendorLookup | null;
  if (!eventVendor) notFound();

  if (eventVendor.status !== 'delivered' && eventVendor.status !== 'complete') {
    return (
      <NotEligibleState
        eventId={eventId}
        vendorName={eventVendor.vendor_name}
        status={eventVendor.status}
      />
    );
  }

  // Resolve the matching vendor_profile by contact_email. This is the only
  // join key V1 ships with — once the linkage column lands on event_vendors
  // we can swap this for a direct FK. We use the service-role client because
  // vendor_profiles RLS only exposes published profiles publicly, and an
  // unpublished one we still want to surface to the reviewing couple.
  type VendorProfileLookup = {
    vendor_profile_id: string;
    business_name: string;
    business_slug: string | null;
  };
  const admin = createAdminClient();
  let vendorProfile: VendorProfileLookup | null = null;
  if (eventVendor.contact_email) {
    const { data: vp } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name, business_slug')
      .ilike('contact_email', eventVendor.contact_email)
      .maybeSingle();
    vendorProfile = (vp ?? null) as VendorProfileLookup | null;
  }

  if (!vendorProfile) {
    return (
      <NoLinkedProfileState
        eventId={eventId}
        vendorName={eventVendor.vendor_name}
        category={eventVendor.category}
      />
    );
  }

  const existing = await fetchOwnReviewForVendor(
    supabase,
    vendorProfile.vendor_profile_id,
    eventId,
    user.id,
  );

  if (existing) {
    return (
      <AlreadyReviewedState
        eventId={eventId}
        vendorName={vendorProfile.business_name || eventVendor.vendor_name}
        slug={vendorProfile.business_slug ?? null}
      />
    );
  }

  // Decision 1 (CLAUDE.md 2026-05-15) — § 2.2d.i Self-review block.
  // Surface the blocked state up front so the user doesn't waste effort
  // filling the form. The DB trigger is still authoritative on submit.
  // The `?blocked=<signal>` query param overrides the probe so the post-
  // submit redirect from submitCoupleReview lands cleanly on this state.
  const queryBlockedSignal = parseBlockedSignal(search.blocked);
  const blockSignal =
    queryBlockedSignal
    ?? (await detectSelfReviewSignal(
      supabase,
      vendorProfile.vendor_profile_id,
      user.id,
    ));
  if (blockSignal) {
    return (
      <SelfReviewBlockedState
        eventId={eventId}
        eventVendorId={eventVendor.vendor_id}
        vendorProfileId={vendorProfile.vendor_profile_id}
        vendorName={vendorProfile.business_name || eventVendor.vendor_name}
        signal={blockSignal}
        appealFiled={search.appeal_filed === '1'}
      />
    );
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <Link
          href={`/dashboard/${eventId}/vendors`}
          className="inline-flex items-center gap-1 text-xs font-medium text-ink/60 hover:text-terracotta"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Back to vendors
        </Link>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
          Leave a review
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          How was {vendorProfile.business_name || eventVendor.vendor_name}?
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Reviews are public on the Setnayan marketplace and on the vendor&rsquo;s landing
          page. They&rsquo;re permanent per the Vendor Agreement &sect;&nbsp;3.10 — the
          vendor can reply once, but the review itself stays as you wrote it.
        </p>
      </header>

      <form
        action={submitCoupleReview}
        className="space-y-6 rounded-2xl border border-ink/10 bg-cream p-6"
      >
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="event_vendor_id" value={eventVendor.vendor_id} />
        <input type="hidden" name="vendor_profile_id" value={vendorProfile.vendor_profile_id} />

        <section className="space-y-3">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Ratings
          </h2>
          <ul className="divide-y divide-ink/10">
            {AXES.map((axis) => (
              <li key={axis} className="py-2">
                <StarRatingInput
                  name={`rating_${axis}`}
                  label={REVIEW_AXIS_LABEL[axis]}
                  required
                />
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <label
            className="block font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55"
            htmlFor="body"
          >
            Your review (optional)
          </label>
          <textarea
            id="body"
            name="body"
            rows={6}
            maxLength={4000}
            placeholder="What stood out? Anything future couples should know?"
            className="input-field min-h-[140px] py-2"
          />
          <p className="text-xs text-ink/50">Up to 4,000 characters.</p>
        </section>

        <div className="flex items-center justify-between gap-3 border-t border-ink/10 pt-4">
          <p className="inline-flex items-center gap-2 text-xs text-ink/60">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" strokeWidth={2} />
            Verified couple — review tied to a delivered service.
          </p>
          <SubmitButton className="button-primary" pendingLabel="Submitting…">
            Post review
          </SubmitButton>
        </div>
      </form>
    </section>
  );
}

function NotEligibleState({
  eventId,
  vendorName,
  status,
}: {
  eventId: string;
  vendorName: string;
  status: string;
}) {
  return (
    <section className="space-y-4">
      <Link
        href={`/dashboard/${eventId}/vendors`}
        className="inline-flex items-center gap-1 text-xs font-medium text-ink/60 hover:text-terracotta"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        Back to vendors
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Not yet ready for a review</h1>
      <p className="max-w-prose text-base text-ink/65">
        You can review <span className="font-medium text-ink">{vendorName}</span> once the
        service is marked <em>delivered</em>. Their current status is{' '}
        <span className="font-mono text-xs uppercase tracking-[0.15em]">{status}</span>.
        Flip the status from the vendor card on the tracker first.
      </p>
    </section>
  );
}

function NoLinkedProfileState({
  eventId,
  vendorName,
  category,
}: {
  eventId: string;
  vendorName: string;
  category: string;
}) {
  return (
    <section className="space-y-4">
      <Link
        href={`/dashboard/${eventId}/vendors`}
        className="inline-flex items-center gap-1 text-xs font-medium text-ink/60 hover:text-terracotta"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        Back to vendors
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Vendor isn&rsquo;t on Setnayan</h1>
      <p className="max-w-prose text-base text-ink/65">
        <span className="font-medium text-ink">{vendorName}</span> (
        {VENDOR_CATEGORY_LABEL[category as keyof typeof VENDOR_CATEGORY_LABEL] ?? category})
        doesn&rsquo;t have a Setnayan vendor profile linked yet, so a public review
        can&rsquo;t be posted. You can still note your private notes inside the vendor
        card on the tracker.
      </p>
    </section>
  );
}

function SelfReviewBlockedState({
  eventId,
  eventVendorId,
  vendorProfileId,
  vendorName,
  signal,
  appealFiled,
}: {
  eventId: string;
  eventVendorId: string;
  vendorProfileId: string;
  vendorName: string;
  signal: SelfReviewSignal;
  appealFiled?: boolean;
}) {
  const isHard = SELF_REVIEW_SIGNAL_TONE[signal] === 'hard';
  return (
    <section className="space-y-4">
      <Link
        href={`/dashboard/${eventId}/vendors`}
        className="inline-flex items-center gap-1 text-xs font-medium text-ink/60 hover:text-terracotta"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        Back to vendors
      </Link>
      <header className="space-y-2">
        <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-rose-700">
          <ShieldOff className="h-3.5 w-3.5" strokeWidth={2} />
          Review blocked
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          You can&rsquo;t review your own services
        </h1>
      </header>
      <p className="max-w-prose text-base text-ink/65">
        We can&rsquo;t accept a review for{' '}
        <span className="font-medium text-ink">{vendorName}</span> because{' '}
        {SELF_REVIEW_SIGNAL_LABEL[signal].toLowerCase()}
      </p>
      <p className="max-w-prose text-sm text-ink/60">
        Reviews exist to help future couples decide which vendors to book — that signal
        gets noisy when a vendor (or someone connected to one) rates their own catalog,
        so the platform hard-blocks self-reviews at submission.
      </p>

      {appealFiled ? (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
          Appeal filed. An admin will review within 48 hours and email you the outcome.
          If overturned, your review is published with an audit trail.
        </div>
      ) : isHard ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          This block is final — owners and team members can never review the vendor they
          run. If you booked this vendor from a separate account that has no connection
          to its team, sign in with that account to leave the review.
        </div>
      ) : (
        <AppealForm
          eventId={eventId}
          eventVendorId={eventVendorId}
          vendorProfileId={vendorProfileId}
          vendorName={vendorName}
          signal={signal}
        />
      )}
    </section>
  );
}

function AppealForm({
  eventId,
  eventVendorId,
  vendorProfileId,
  vendorName,
  signal,
}: {
  eventId: string;
  eventVendorId: string;
  vendorProfileId: string;
  vendorName: string;
  signal: SelfReviewSignal;
}) {
  return (
    <form
      action={submitReviewAppeal}
      className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-5"
    >
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="event_vendor_id" value={eventVendorId} />
      <input type="hidden" name="vendor_profile_id" value={vendorProfileId} />
      <input type="hidden" name="matched_signal" value={signal} />
      <header className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber-900">
          Filed an appeal
        </p>
        <p className="text-sm text-amber-950">
          Filipino households often share GCash, devices, and addresses across
          unrelated members. If this block looks like a false positive, file an appeal
          and an admin will review.
        </p>
      </header>

      <label htmlFor="appeal_reason" className="block space-y-1">
        <span className="block text-xs font-medium text-amber-950">
          What&rsquo;s the connection? (Required)
        </span>
        <textarea
          id="appeal_reason"
          name="appeal_reason"
          required
          rows={4}
          maxLength={4000}
          placeholder={`My GCash is also the GCash my mother-in-law uses; she runs ${vendorName} but I'm not part of her team.`}
          className="input-field min-h-[100px] w-full py-2"
        />
        <span className="block text-xs text-amber-900/70">
          Up to 4,000 characters. The admin will see this when deciding the appeal.
        </span>
      </label>

      <details className="space-y-2 text-xs text-amber-950/80">
        <summary className="cursor-pointer font-medium">Want to attach the review you would have posted?</summary>
        <div className="mt-2 space-y-3 rounded-lg border border-amber-200 bg-white/60 p-3">
          <label className="block space-y-1">
            <span className="block text-[11px] font-medium uppercase tracking-wide text-amber-950">
              Overall rating (1–5)
            </span>
            <input
              type="number"
              name="payload_rating_overall"
              min={1}
              max={5}
              step={1}
              className="input-field h-9 w-20 py-1"
            />
          </label>
          <label className="block space-y-1">
            <span className="block text-[11px] font-medium uppercase tracking-wide text-amber-950">
              Review body (optional)
            </span>
            <textarea
              name="payload_body"
              rows={3}
              maxLength={4000}
              className="input-field min-h-[60px] w-full py-2"
              placeholder="The review you'd post if the gate is overturned…"
            />
          </label>
        </div>
      </details>

      <div className="flex items-center justify-between gap-3 border-t border-amber-200 pt-3">
        <p className="text-xs text-amber-950/70">
          Single-admin authority. SLA: 48 hours.
        </p>
        <SubmitButton className="button-primary" pendingLabel="Filing…">
          File appeal
        </SubmitButton>
      </div>
    </form>
  );
}

function AlreadyReviewedState({
  eventId,
  vendorName,
  slug,
}: {
  eventId: string;
  vendorName: string;
  slug: string | null;
}) {
  return (
    <section className="space-y-4">
      <Link
        href={`/dashboard/${eventId}/vendors`}
        className="inline-flex items-center gap-1 text-xs font-medium text-ink/60 hover:text-terracotta"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        Back to vendors
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">You already reviewed this vendor</h1>
      <p className="max-w-prose text-base text-ink/65">
        Thanks for the review of <span className="font-medium text-ink">{vendorName}</span>.
        Reviews are one-per-event per the Vendor Agreement &sect;&nbsp;3.10 — visit their
        landing page to see how it surfaces publicly.
      </p>
      {slug ? (
        <Link className="button-secondary inline-flex" href={`/v/${slug}`}>
          Open vendor profile
        </Link>
      ) : null}
    </section>
  );
}

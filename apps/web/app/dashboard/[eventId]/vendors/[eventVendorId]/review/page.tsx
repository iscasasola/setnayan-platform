import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SubmitButton } from '@/app/_components/submit-button';
import { StarRatingInput } from '@/app/_components/star-rating-input';
import { fetchOwnReviewForVendor, REVIEW_AXIS_LABEL, type ReviewAxis } from '@/lib/reviews';
import { VENDOR_CATEGORY_LABEL } from '@/lib/vendors';
import { submitCoupleReview } from './actions';

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
};

type EventVendorLookup = {
  vendor_id: string;
  event_id: string;
  vendor_name: string;
  category: string;
  contact_email: string | null;
  status: string;
};

export default async function CoupleReviewVendorPage({ params }: Props) {
  const { eventId, eventVendorId } = await params;
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

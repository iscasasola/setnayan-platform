import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Sparkles, CalendarDays, Store } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { listHostEvents, coerceVendorCategory } from '@/lib/vendor-couple-invite';
import { VENDOR_CATEGORY_LABEL, type VendorCategory } from '@/lib/vendors';
import { formatEventDate } from '@/lib/events';
import { SubmitButton } from '@/app/_components/submit-button';
import { claimVendorInviteToEvent } from './actions';

export const metadata = {
  title: 'Add a vendor to your plan · Setnayan',
  // Per-vendor invite landings shouldn't be indexed.
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
};

const STATUS_COPY: Record<string, string> = {
  pick_event: 'Choose which event to add this vendor to.',
  not_your_event: 'That event isn’t one you host — pick one of yours.',
  not_found: 'This vendor link is no longer available.',
  error: 'Something went wrong adding the vendor. Please try again.',
};

export default async function VendorInvitePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { status } = await searchParams;

  const admin = createAdminClient();
  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select(
      'vendor_profile_id, business_name, tagline, logo_url, services, location_city, is_published',
    )
    .eq('business_slug', slug)
    .maybeSingle();
  if (!vendor || !vendor.is_published) notFound();

  const category = coerceVendorCategory((vendor.services ?? []) as string[]);
  const categoryLabel =
    VENDOR_CATEGORY_LABEL[category as VendorCategory] ?? 'Vendor';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const hostEvents = user ? await listHostEvents(admin, user.id) : [];
  const nextPath = `/vendor-invite/${slug}`;
  const statusMessage = status ? STATUS_COPY[status] ?? null : null;

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6">
      {/* Vendor identity */}
      <div className="rounded-3xl border border-ink/10 bg-cream p-6 text-center">
        {vendor.logo_url ? (
          <Image
            src={vendor.logo_url}
            alt={vendor.business_name}
            width={88}
            height={88}
            className="mx-auto h-20 w-20 rounded-2xl object-cover"
          />
        ) : (
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-ink/5">
            <Store className="h-8 w-8 text-ink/40" strokeWidth={1.5} />
          </div>
        )}
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/45">
          {categoryLabel} · invites you
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {vendor.business_name}
        </h1>
        {vendor.tagline ? (
          <p className="mt-1 text-sm text-ink/60">{vendor.tagline}</p>
        ) : null}
        {vendor.location_city ? (
          <p className="mt-1 text-xs text-ink/45">{vendor.location_city}</p>
        ) : null}
      </div>

      {statusMessage ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {statusMessage}
        </p>
      ) : null}

      {/* Action zone — depends on auth + event state */}
      <div className="mt-6">
        {!user ? (
          // Signed out → sign up / sign in, returning to this page.
          <div className="rounded-2xl border border-ink/10 bg-white/60 p-5 text-center">
            <Sparkles className="mx-auto h-5 w-5 text-terracotta" strokeWidth={1.75} />
            <p className="mt-2 text-sm text-ink/70">
              Create your free Setnayan plan to save {vendor.business_name} to
              your event — and manage your whole wedding in one place.
            </p>
            <Link
              href={`/signup?as=couple&next=${encodeURIComponent(nextPath)}`}
              className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-cream hover:bg-ink/90"
            >
              Sign up free & add this vendor
            </Link>
            <Link
              href={`/login?next=${encodeURIComponent(nextPath)}`}
              className="mt-3 inline-block text-sm text-ink/60 underline hover:text-terracotta"
            >
              I already have an account
            </Link>
          </div>
        ) : hostEvents.length === 0 ? (
          // Signed in, no event yet → create one, returning here to finish.
          <div className="rounded-2xl border border-ink/10 bg-white/60 p-5 text-center">
            <p className="text-sm text-ink/70">
              Create your event first, then we’ll add {vendor.business_name} to
              its shortlist.
            </p>
            <Link
              href={`/dashboard/create-event?next=${encodeURIComponent(nextPath)}`}
              className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-cream hover:bg-ink/90"
            >
              Create your event
            </Link>
          </div>
        ) : (
          // Signed in with events → pick which one to add the vendor to.
          <form action={claimVendorInviteToEvent} className="space-y-3">
            <input type="hidden" name="slug" value={slug} />
            <p className="text-sm font-medium text-ink/80">
              Add to which event?
            </p>
            <fieldset className="space-y-2">
              {hostEvents.map((ev, i) => (
                <label
                  key={ev.event_id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-ink/15 bg-white/60 px-4 py-3 has-[:checked]:border-terracotta has-[:checked]:bg-terracotta/5"
                >
                  <input
                    type="radio"
                    name="event_id"
                    value={ev.event_id}
                    defaultChecked={i === 0}
                    className="accent-terracotta"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {ev.display_name ?? 'Untitled event'}
                      {ev.is_primary ? (
                        <span className="ml-2 rounded bg-ink/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink/50">
                          Primary
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-ink/50">
                      <CalendarDays className="h-3 w-3" strokeWidth={1.75} />
                      {ev.event_date ? formatEventDate(ev.event_date, 'en-PH') : 'Date TBD'}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
            <SubmitButton
              pendingLabel="Adding…"
              className="w-full rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-cream hover:bg-ink/90"
            >
              Add {vendor.business_name} to my plan
            </SubmitButton>
            <Link
              href="/dashboard/create-event"
              className="block text-center text-xs text-ink/50 underline hover:text-terracotta"
            >
              or create a new event
            </Link>
          </form>
        )}
      </div>

      <p className="mt-6 text-center text-[11px] text-ink/40">
        Adding a vendor to your plan is free. You can remove them any time.
      </p>
    </div>
  );
}

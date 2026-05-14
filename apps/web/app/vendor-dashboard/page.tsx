import { redirect } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile, profileCompletion } from '@/lib/vendor-profile';
import { fetchVendorThreads } from '@/lib/chat';
import { SubmitButton } from '@/app/_components/submit-button';
import { VendorEventDayPrepCta } from '@/app/_components/vendor-event-day-prep-cta';
import { saveVendorProfile } from './actions';
import { ServicesPicker } from './_components/services-picker';

/**
 * Returns true when `eventDate` falls inside the vendor pre-load window
 * (T-3 days through T+1 day). Matches the visibility gate inside
 * `<VendorEventDayPrepCta>`; we duplicate the check on the server so we can
 * skip rendering threads that wouldn't show a CTA anyway.
 */
function isUpcomingForPreload(eventDate: string | null): boolean {
  if (!eventDate) return false;
  const event = new Date(`${eventDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((event.getTime() - today.getTime()) / 86_400_000);
  return days <= 3 && days >= -1;
}

export const metadata = { title: 'Vendor profile · Setnayan' };

type Props = {
  searchParams: Promise<{ saved?: string; error?: string }>;
};

export default async function VendorDashboardHome({ searchParams }: Props) {
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  const completion = profileCompletion(profile);
  const pct =
    completion.total === 0 ? 0 : Math.round((completion.done / completion.total) * 100);

  // Vendor-side event-day pre-load: surface a CTA per upcoming event the
  // vendor has a contracted relationship with (proxied through their open
  // chat threads, which RLS already scopes to the vendor's profile).
  const upcomingThreads = profile
    ? (await fetchVendorThreads(supabase, profile.vendor_profile_id)).filter((t) =>
        isUpcomingForPreload(t.event?.event_date ?? null),
      )
    : [];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your profile</h1>
        <p className="text-base text-ink/65">
          Edit your business info. Couples find you by the contact email below and start
          chats from their dashboard — see those at Messages.
        </p>
      </header>

      {upcomingThreads.length > 0 ? (
        <section className="mb-6 space-y-2">
          {upcomingThreads.map((t) => (
            <VendorEventDayPrepCta
              key={t.thread_id}
              threadId={t.thread_id}
              eventId={t.event_id}
              eventDisplayName={t.event?.display_name ?? 'Upcoming event'}
              eventDate={t.event?.event_date ?? null}
            />
          ))}
        </section>
      ) : null}

      {search.error ? (
        <p
          role="alert"
          className="mb-4 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {search.error}
        </p>
      ) : null}
      {search.saved ? (
        <p
          role="status"
          className="mb-4 rounded-md border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          Profile saved.
        </p>
      ) : null}

      <section className="mb-6 space-y-3 rounded-2xl border border-ink/10 bg-cream p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Completion
          </h2>
          <span className="font-mono text-sm font-semibold text-terracotta-700">{pct}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
          <span
            className="block h-full rounded-full bg-terracotta transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-ink/55">
          {completion.done} of {completion.total} fields complete
          {completion.missing.length > 0 ? ` · still needed: ${completion.missing.join(', ')}` : ''}
        </p>
        {!profile?.logo_url ? (
          <p className="inline-flex items-center gap-1 text-xs text-amber-900">
            <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
            Logo URL is mandatory before couples can see this profile.
          </p>
        ) : null}
      </section>

      <form action={saveVendorProfile} className="space-y-5">
        <Field label="Business name" htmlFor="business_name" required>
          <input
            id="business_name"
            name="business_name"
            required
            maxLength={128}
            defaultValue={profile?.business_name ?? ''}
            placeholder="Your studio / company name"
            className="input-field"
          />
        </Field>

        <Field
          label="Slug"
          htmlFor="business_slug"
          help="3–32 chars: lowercase letters, numbers, hyphens. Used in your public vendor URL (coming soon)."
        >
          <input
            id="business_slug"
            name="business_slug"
            pattern="[a-z0-9-]{3,32}"
            defaultValue={profile?.business_slug ?? ''}
            placeholder="bistro-ramos"
            className="input-field font-mono"
          />
        </Field>

        <Field label="Tagline" htmlFor="tagline">
          <input
            id="tagline"
            name="tagline"
            maxLength={140}
            defaultValue={profile?.tagline ?? ''}
            placeholder="A short one-line description"
            className="input-field"
          />
        </Field>

        <Field
          label="Logo URL"
          htmlFor="logo_url"
          help="Hosted image URL. File upload to Setnayan R2 ships in a follow-on."
        >
          <input
            id="logo_url"
            name="logo_url"
            type="url"
            defaultValue={profile?.logo_url ?? ''}
            placeholder="https://example.com/logo.png"
            className="input-field"
          />
        </Field>

        <Field
          label="Services"
          htmlFor="services"
          help="Tick the standard categories you offer. Add custom services for anything not on the list."
        >
          <ServicesPicker name="services" initial={profile?.services ?? []} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Location (city)" htmlFor="location_city">
            <input
              id="location_city"
              name="location_city"
              maxLength={64}
              defaultValue={profile?.location_city ?? ''}
              placeholder="Quezon City"
              className="input-field"
            />
          </Field>
          <Field label="Website" htmlFor="website">
            <input
              id="website"
              name="website"
              type="url"
              defaultValue={profile?.website ?? ''}
              placeholder="https://"
              className="input-field"
            />
          </Field>
          <Field label="Contact email" htmlFor="contact_email">
            <input
              id="contact_email"
              name="contact_email"
              type="email"
              defaultValue={profile?.contact_email ?? ''}
              placeholder="hello@yourstudio.ph"
              className="input-field"
            />
          </Field>
          <Field label="Contact phone" htmlFor="contact_phone">
            <input
              id="contact_phone"
              name="contact_phone"
              defaultValue={profile?.contact_phone ?? ''}
              placeholder="+63 917 …"
              className="input-field"
            />
          </Field>
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-ink/10 bg-cream p-4">
          <input
            type="checkbox"
            name="is_published"
            defaultChecked={profile?.is_published ?? false}
            className="mt-0.5 h-4 w-4 cursor-pointer accent-terracotta"
          />
          <span>
            <span className="block text-sm font-medium text-ink">Published</span>
            <span className="block text-xs text-ink/55">
              When on, your profile becomes discoverable. In V1 nothing displays it publicly
              yet — this toggle lights up the moment the vendor marketplace ships.
            </span>
          </span>
        </label>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
            Account ID · {profile?.public_id ?? '—'}
          </p>
          <SubmitButton className="button-primary" pendingLabel="Saving…">
            Save profile
          </SubmitButton>
        </div>
      </form>

      <section className="mt-10 space-y-3 rounded-2xl border border-dashed border-ink/15 bg-cream p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Coming later
        </p>
        <ul className="list-inside list-disc space-y-1 text-sm text-ink/65">
          <li>Logo + portfolio uploads to Setnayan R2 (file picker, not URLs)</li>
          <li>Public vendor page at /v/[slug]</li>
          <li>Bookings — events where couples have added you to their event_vendors</li>
          <li>Chat with couples (iteration 0019 + identity masking)</li>
          <li>Settings · payouts</li>
        </ul>
      </section>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  required = false,
  help,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block space-y-1">
      <span className="block text-sm font-medium text-ink">
        {label}
        {required ? <span className="ml-1 text-terracotta">*</span> : null}
      </span>
      {children}
      {help ? <span className="block text-xs text-ink/55">{help}</span> : null}
    </label>
  );
}

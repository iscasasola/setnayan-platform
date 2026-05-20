import { redirect } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import {
  fetchOwnVendorProfile,
  fetchVendorCompletedEventStats,
  profileCompletion,
} from '@/lib/vendor-profile';
import { fetchVendorThreads } from '@/lib/chat';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { SubmitButton } from '@/app/_components/submit-button';
import { FileUpload } from '@/app/_components/file-upload';
import { VendorEventDayPrepCta } from '@/app/_components/vendor-event-day-prep-cta';
import { saveVendorProfile } from './actions';
import { ServicesPicker } from './_components/services-picker';
import { CompletedEventsCard } from './_components/completed-events-card';

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

// Iteration 0043 — wedding-type compatibility tags rendered on the vendor
// profile form. Mirror the events.ceremony_type / events.venue_setting
// CHECK constraints from migration 20260521000000. Labels are kebabbed
// English (no Tagalog yet — vendor surface stays EN for V1).
const CEREMONY_TYPES: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'catholic', label: 'Catholic' },
  { key: 'civil', label: 'Civil' },
  { key: 'inc', label: 'INC' },
  { key: 'christian', label: 'Christian' },
  { key: 'muslim', label: 'Muslim' },
  { key: 'cultural', label: 'Cultural' },
  { key: 'mixed', label: 'Mixed / interfaith' },
];

const VENUE_SETTINGS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'banquet_hall', label: 'Banquet hall' },
  { key: 'garden', label: 'Garden' },
  { key: 'beach', label: 'Beach' },
  { key: 'destination', label: 'Destination' },
  { key: 'heritage', label: 'Heritage' },
  { key: 'outdoor_tent', label: 'Outdoor tent' },
  { key: 'civil_registrar', label: 'Civil registrar' },
];

// Iteration 0041 — event_types vendor opt-in roster. Mirrors the live
// `public.event_type` enum + the `vendor_profiles_event_types_check`
// constraint in migration 20260521090000. Vendors check which event types
// they actually serve; the marketplace `?event_type=` filter at /vendors
// reads vendor_profiles.event_types[] to match.
//
// All 9 enum values are checkable here even though only wedding + debut
// are creatable in the picker today — vendors can pre-tag for Coming-Soon
// event_types so they're ready when those tiles enable.
const EVENT_TYPES_SERVED: ReadonlyArray<{ key: string; label: string; emoji: string }> = [
  { key: 'wedding', label: 'Wedding', emoji: '💍' },
  { key: 'debut', label: 'Debut', emoji: '👑' },
  { key: 'gender_reveal', label: 'Gender Reveal', emoji: '🎈' },
  { key: 'birthday', label: 'Birthday', emoji: '🎂' },
  { key: 'celebration', label: 'Celebration', emoji: '🥂' },
  { key: 'christening', label: 'Christening', emoji: '🕯️' },
  { key: 'corporate', label: 'Corporate', emoji: '🏢' },
  { key: 'travel', label: 'Travel', emoji: '✈️' },
  { key: 'tournament', label: 'Tournament', emoji: '🏆' },
];

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

  // Crash guard — every subsequent fetch is wrapped so a transient DB / RLS
  // / column-drift failure shows a friendly error state instead of crashing
  // the whole page with a generic Next.js 5xx digest. Sentry still captures
  // the underlying exception via the console.error + the instrumentation
  // hook in apps/web/sentry.server.config.ts.
  //
  // Added 2026-05-20 after PR #188 deploy surfaced a digest-486685855 crash
  // on /vendor-dashboard; the actual root cause needs Sentry's stack to
  // diagnose. This guard limits blast radius until that diagnosis lands.
  let loaderState:
    | {
        ok: true;
        profile: Awaited<ReturnType<typeof fetchOwnVendorProfile>>;
        upcomingThreads: Awaited<ReturnType<typeof fetchVendorThreads>>;
        completedStats: Awaited<ReturnType<typeof fetchVendorCompletedEventStats>>;
        logoDisplayUrl: string | null;
        portfolioDisplayMap: Record<string, string>;
        logoDisplayMap: Record<string, string>;
      }
    | { ok: false; message: string };
  try {
    const profile = await fetchOwnVendorProfile(supabase, user.id);

    // Vendor-side event-day pre-load: surface a CTA per upcoming event the
    // vendor has a contracted relationship with (proxied through their open
    // chat threads, which RLS already scopes to the vendor's profile).
    const upcomingThreads = profile
      ? (await fetchVendorThreads(supabase, profile.vendor_profile_id)).filter((t) =>
          isUpcomingForPreload(t.event?.event_date ?? null),
        )
      : [];

    // Completed-events count — public + full sibling views from
    // 20260515000000_public_stats_exclusion.sql. Falls back to {0, 0} if the
    // vendor has no row in the views yet (brand-new profile).
    const completedStats = profile
      ? await fetchVendorCompletedEventStats(supabase, profile.vendor_profile_id)
      : { public_completed_count: 0, full_completed_count: 0 };

    // Pre-resolve display URLs for the logo + every portfolio entry so the
    // <FileUpload> thumbnails render on first paint without an extra
    // round-trip. Both `displayUrlForStoredAsset` calls passes legacy http(s)
    // values through unchanged and presigns r2:// refs with a 24h TTL.
    const logoDisplayUrl = profile?.logo_url
      ? await displayUrlForStoredAsset(profile.logo_url)
      : null;
    const portfolioDisplayMap: Record<string, string> = {};
    if (profile?.portfolio_r2_keys?.length) {
      const resolved = await Promise.all(
        profile.portfolio_r2_keys.map(async (ref) => {
          const url = await displayUrlForStoredAsset(ref);
          return [ref, url] as const;
        }),
      );
      for (const [ref, url] of resolved) {
        if (url) portfolioDisplayMap[ref] = url;
      }
    }
    const logoDisplayMap: Record<string, string> = {};
    if (profile?.logo_url && logoDisplayUrl) {
      logoDisplayMap[profile.logo_url] = logoDisplayUrl;
    }

    loaderState = {
      ok: true,
      profile,
      upcomingThreads,
      completedStats,
      logoDisplayUrl,
      portfolioDisplayMap,
      logoDisplayMap,
    };
  } catch (err) {
    // Log so Sentry's nodejs runtime hook picks it up. The thrown Error
    // typically carries enough context (column name / RLS detail) to
    // diagnose; without this log we only see the digest in the UI.
    // eslint-disable-next-line no-console
    console.error('[/vendor-dashboard] loader failed', err);
    const message = err instanceof Error ? err.message : String(err);
    loaderState = { ok: false, message };
  }

  if (!loaderState.ok) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <header className="mb-6 flex items-start gap-3">
          <AlertTriangle aria-hidden className="mt-0.5 h-6 w-6 shrink-0 text-terracotta" strokeWidth={1.75} />
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Your vendor dashboard is temporarily unavailable.</h1>
            <p className="text-sm text-ink/65">
              We hit an error loading your profile. The Setnayan team has been notified
              via Sentry. Refreshing in a minute usually clears transient failures;
              if it persists, please reply to your last vendor email and we&rsquo;ll
              dig in.
            </p>
          </div>
        </header>
        {process.env.NODE_ENV !== 'production' ? (
          <pre className="overflow-auto rounded-md border border-ink/15 bg-ink/[0.03] p-3 text-xs text-ink/65">
            {loaderState.message}
          </pre>
        ) : null}
      </div>
    );
  }

  const {
    profile,
    upcomingThreads,
    completedStats,
    logoDisplayUrl,
    portfolioDisplayMap,
    logoDisplayMap,
  } = loaderState;
  const completion = profileCompletion(profile);
  const pct =
    completion.total === 0 ? 0 : Math.round((completion.done / completion.total) * 100);

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

      {profile ? (
        <div className="mb-6">
          <CompletedEventsCard
            publicCount={completedStats.public_completed_count}
            fullCount={completedStats.full_completed_count}
            showTeamBookings={profile.show_team_bookings_in_backend_count}
          />
        </div>
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
          label="Logo"
          htmlFor="logo_url"
          help="PNG, JPEG, or WebP up to 2 MB. Couples see this on every vendor card."
        >
          <FileUpload
            bucket="media"
            pathPrefix={`vendors/${profile?.vendor_profile_id ?? 'unassigned'}/logo`}
            name="logo_url"
            currentValue={profile?.logo_url ?? null}
            initialDisplayUrls={logoDisplayMap}
            maxSizeMB={2}
            acceptedTypes={['image/png', 'image/jpeg', 'image/webp']}
            variant="square"
          />
        </Field>

        <Field
          label="Portfolio"
          htmlFor="portfolio_r2_keys"
          help="Show off recent work. Up to 10 images, 5 MB each. Couples browse this on your public page."
        >
          <FileUpload
            bucket="media"
            pathPrefix={`vendors/${profile?.vendor_profile_id ?? 'unassigned'}/portfolio`}
            name="portfolio_r2_keys"
            currentValue={profile?.portfolio_r2_keys ?? []}
            initialDisplayUrls={portfolioDisplayMap}
            multiple
            maxFiles={10}
            maxSizeMB={5}
            acceptedTypes={['image/png', 'image/jpeg', 'image/webp']}
            variant="wide"
            watermark
          />
        </Field>

        <Field
          label="Services"
          htmlFor="services"
          help="Tick the standard categories you offer. Add custom services for anything not on the list."
        >
          <ServicesPicker name="services" initial={profile?.services ?? []} />
        </Field>

        <Field
          label="Event types you serve"
          htmlFor="event_types"
          help="Tick every event type you take bookings for. Couples browsing each marketplace see only vendors who serve their event. Wedding is checked by default for every vendor; tick others to expand your reach as those marketplaces open."
        >
          <div className="flex flex-wrap gap-2">
            {EVENT_TYPES_SERVED.map((et) => {
              const checked = profile?.event_types?.includes(et.key) ?? (et.key === 'wedding');
              return (
                <label
                  key={et.key}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-3 py-1.5 text-xs text-ink/75 transition has-[:checked]:border-terracotta has-[:checked]:bg-terracotta/10 has-[:checked]:text-terracotta-700 hover:border-ink/30"
                >
                  <input
                    type="checkbox"
                    name="event_types"
                    value={et.key}
                    defaultChecked={checked}
                    className="h-3.5 w-3.5 rounded border-ink/25 text-terracotta focus:ring-terracotta/40"
                  />
                  <span aria-hidden>{et.emoji}</span>
                  <span>{et.label}</span>
                </label>
              );
            })}
          </div>
        </Field>

        <Field
          label="Wedding compatibility"
          htmlFor="compatible_ceremony_types"
          help="Tick the ceremonies + venues you serve. Couples who turn on “Match my wedding” on the marketplace see only vendors whose tags include their event. Leave everything unchecked to stay open to every wedding (matches the default for legacy profiles)."
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                Ceremony types
              </p>
              <div className="flex flex-wrap gap-2">
                {CEREMONY_TYPES.map((ct) => {
                  const checked = profile?.compatible_ceremony_types?.includes(ct.key) ?? false;
                  return (
                    <label
                      key={ct.key}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-3 py-1.5 text-xs text-ink/75 transition has-[:checked]:border-terracotta has-[:checked]:bg-terracotta/10 has-[:checked]:text-terracotta-700 hover:border-ink/30"
                    >
                      <input
                        type="checkbox"
                        name="compatible_ceremony_types"
                        value={ct.key}
                        defaultChecked={checked}
                        className="h-3.5 w-3.5 rounded border-ink/25 text-terracotta focus:ring-terracotta/40"
                      />
                      <span>{ct.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                Venue settings
              </p>
              <div className="flex flex-wrap gap-2">
                {VENUE_SETTINGS.map((v) => {
                  const checked = profile?.compatible_venue_settings?.includes(v.key) ?? false;
                  return (
                    <label
                      key={v.key}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-3 py-1.5 text-xs text-ink/75 transition has-[:checked]:border-terracotta has-[:checked]:bg-terracotta/10 has-[:checked]:text-terracotta-700 hover:border-ink/30"
                    >
                      <input
                        type="checkbox"
                        name="compatible_venue_settings"
                        value={v.key}
                        defaultChecked={checked}
                        className="h-3.5 w-3.5 rounded border-ink/25 text-terracotta focus:ring-terracotta/40"
                      />
                      <span>{v.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
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
          <Field
            label="HQ address (for distance to couples)"
            htmlFor="hq_address"
          >
            <input
              id="hq_address"
              name="hq_address"
              maxLength={500}
              defaultValue={profile?.hq_address ?? ''}
              placeholder="123 Katipunan Ave, Quezon City, Metro Manila"
              className="input-field"
            />
            <p className="mt-1 text-xs text-ink/55">
              Used to show couples how far you are from their reception
              venue. Street address geocodes more precisely than a city
              alone.
            </p>
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
              When on, your profile appears in the Setnayan vendor marketplace. New
              profiles show with a <em>Coming soon</em> badge until Setnayan
              verifies your business — the badge flips to <em>Verified</em> the
              moment your application is approved.
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

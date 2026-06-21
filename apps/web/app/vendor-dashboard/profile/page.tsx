import { redirect } from 'next/navigation';
import { AlertTriangle, KeyRound, MonitorSmartphone, BadgeCheck } from 'lucide-react';
import { vendorExperienceEnabled } from '@/lib/vendor-experience';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sweepLapsedSubscriptions } from '@/lib/subscriptions';
import {
  fetchOwnVendorProfile,
  fetchVendorCompletedEventStats,
  profileCompletion,
} from '@/lib/vendor-profile';
import { fetchVendorThreads } from '@/lib/chat';
import { tierCaps, asVendorTier } from '@/lib/vendor-tier-caps';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { SubmitButton } from '@/app/_components/submit-button';
import { Field } from '@/app/_components/forms/field';
import { FormFlash } from '@/app/_components/forms/form-flash';
import { FileUpload } from '@/app/_components/file-upload';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { VendorEventDayPrepCta } from '@/app/_components/vendor-event-day-prep-cta';
import {
  changePassword,
  signOutOtherDevices,
} from '@/lib/account-security-actions';
import { getEventTypeVocab } from '@/lib/event-types-db';
import { getTaxonomy } from '@/lib/taxonomy-db';
import { VENDOR_CATEGORIES } from '@/lib/vendors';
import { labelForVendorCategory } from '@/lib/vendor-category-taxonomy';
import { saveVendorProfile } from '../actions';
import { ServicesPicker } from '../_components/services-picker';
import { CompletedEventsCard } from '../_components/completed-events-card';

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
  { key: 'chinese', label: 'Chinese' },
  { key: 'jewish', label: 'Jewish' },
  { key: 'born_again', label: 'Born Again' },
  { key: 'aglipayan', label: 'Aglipayan (IFI)' },
  { key: 'lds', label: 'LDS (Latter-day Saints)' },
  { key: 'sda', label: 'Seventh-day Adventist' },
  { key: 'jw', label: "Jehovah's Witnesses" },
  { key: 'hindu', label: 'Hindu' },
  { key: 'sikh', label: 'Sikh' },
  { key: 'buddhist', label: 'Buddhist' },
  { key: 'orthodox', label: 'Orthodox Christian' },
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

// Event-types-you-serve roster — DB-driven since the 2026-06-13 cutover.
// Every ACTIVE `event_type_vocab` row is checkable here, regardless of its
// couple-side `enabled` flag: vendors can pre-tag coverage for types the
// owner hasn't publicly launched yet, so they're ready when the tile flips.
// Fetched inside the page body via getEventTypeVocab().

export const metadata = { title: 'Vendor profile · Setnayan' };

type Props = {
  searchParams: Promise<{
    saved?: string;
    error?: string;
    password_changed?: string;
    signed_out_others?: string;
  }>;
};

export default async function VendorDashboardHome({ searchParams }: Props) {
  // Top-level try/catch wrap added 2026-05-29 (PR #631 + this PR chain).
  // PR #628 wrapped the page.tsx:99-equivalent sweep call. PR #631 added
  // a route-segment error.tsx boundary at /vendor-dashboard/error.tsx.
  // BOTH shipped to production (Sentry release confirmed `4df8cf3`), yet
  // the owner still reports the same Sentry digest `1341067551` rendering
  // through the GLOBAL `app/error.tsx` ("Something on our end didn't
  // work · Take me home") — meaning whatever is throwing is escaping
  // every previous guard:
  //   - It's NOT page.tsx:99 (that's wrapped)
  //   - It's NOT the data-fetch try/catch at 147-207 (that would render
  //     the inline "Your vendor dashboard is temporarily unavailable"
  //     friendly UI, not the global root error)
  //   - It's NOT one of the child components in the JSX tree below
  //     (those are 'use client' or pure-JSX Server Components)
  //   - It's NOT `createAdminClient` itself — /vendor-dashboard/team and
  //     /earnings call it unguarded and work fine for the same user
  //
  // What it IS, we don't yet know. Sentry shows digest only; we'd need
  // dashboard access to see the actual stack. With pilot 3 days out,
  // the pragmatic move is a top-level try/catch around the ENTIRE
  // function body. Any unknown throw lands in the existing friendly
  // fallback UI (which has a refresh hint + escape to customer view via
  // role-pill) instead of dumping the user into the brand-voice
  // "Something on our end didn't work" page with no path forward.
  //
  // CRITICAL: Next.js `redirect()` and `notFound()` throw special
  // marker Errors with `digest` starting with `NEXT_` (NEXT_REDIRECT,
  // NEXT_NOT_FOUND). We MUST re-throw those so navigation works.
  // Catching them would silently break /login redirect for unauthed
  // visitors + any future notFound() callsites.
  //
  // Per CLAUDE.md memory rules:
  //   - feedback_setnayan_document_changes_with_why: WHY block above
  //   - feedback_setnayan_no_dev_text_post_launch: friendly fallback
  //     uses existing brand-voice copy (already at line 209 + below)
  try {
  const search = await searchParams;
  const supabase = await createClient();
  // DB-driven event-type roster (2026-06-13) — every ACTIVE vocab row is
  // checkable; falls back to the pre-cutover constant on DB hiccups.
  const eventTypesServed = await getEventTypeVocab();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Lazy subscription expiry sweep (Task #23 — pilot blocker). Scoped to
  // this vendor's auth user so the vendor-dashboard hot path stays fast.
  // Fire-and-forget — failures are swallowed inside the sweep itself, and
  // the admin global sweep at /admin/payments is the safety net of last
  // resort.
  //
  // Wrapped in try/catch 2026-05-29 after production /vendor-dashboard
  // crashed into the root error boundary ("Something on our end didn't
  // work" · Sentry digest 1341067551). Root cause: `createAdminClient()`
  // is called outside the page's main try/catch and throws synchronously
  // when `SUPABASE_SERVICE_ROLE_KEY` is missing (apps/web/lib/supabase/
  // admin.ts:17). Even though the env var IS in the Vercel project
  // settings + listed in `turbo.json`, an unhandled rejection from the
  // returned Promise OR a synchronous throw at construction crashes the
  // page render. This belt-and-suspenders wrapper isolates the sweep so
  // the page renders even if the admin client can't be built · the sweep
  // is best-effort + admin global sweep at /admin/payments is the canonical
  // safety net.
  try {
    void sweepLapsedSubscriptions(createAdminClient(), {
      vendorUserId: user.id,
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[/vendor-dashboard] sweep promise rejected', err);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      '[/vendor-dashboard] sweepLapsedSubscriptions construction threw',
      err,
    );
  }

  // Login-driven vendor-tier lapse downgrade (Phase D · Tier #5, cron-free per
  // [[project_setnayan_cron_free]]). sweep_vendor_tier_expiry reverts an expired
  // pro/enterprise tier back to verified (if still verified) else free — and is
  // idempotent + downgrade-only. We probe the vendor's profile id (the RPC keys
  // on vendor_profile_id, not auth.uid()) and fire-and-forget so a failure never
  // blocks the page. Best-effort: the next login retries the sweep.
  try {
    const { data: vp } = await supabase
      .from('vendor_profiles')
      .select('vendor_profile_id')
      .eq('user_id', user.id)
      .maybeSingle();
    const vendorProfileId = (vp as { vendor_profile_id?: string } | null)
      ?.vendor_profile_id;
    if (vendorProfileId) {
      void supabase
        .rpc('sweep_vendor_tier_expiry', { p_vendor_id: vendorProfileId })
        .then(({ error }) => {
          if (error) {
            // eslint-disable-next-line no-console
            console.error('[/vendor-dashboard] tier-expiry sweep failed', error);
          }
        });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[/vendor-dashboard] tier-expiry sweep threw', err);
  }

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
        portfolioMax: number;
        canCustomSlug: boolean;
        socialFeatureOptOut: boolean;
        sameDayAvailable: boolean;
        expSinceYear: number | null;
        expWeddings: number | null;
        expVerifiedAt: string | null;
      }
    | { ok: false; message: string };
  try {
    const profile = await fetchOwnVendorProfile(supabase, user.id);

    // Tier portfolio-photo cap (Phase B). Soft-probe tier_state (not in the
    // shared profile select) → FREE 30 · VERIFIED 50 · PRO 100 · ENTERPRISE ∞.
    // The <FileUpload> needs a finite maxFiles, so ∞ → a high sentinel.
    const { data: tierRow } = await supabase
      .from('vendor_profiles')
      .select('tier_state')
      .eq('user_id', user.id)
      .maybeSingle();
    const caps = tierCaps(
      asVendorTier((tierRow as { tier_state?: string | null } | null)?.tier_state),
    );

    // social_feature_opt_out (Social Sharing Program · 20261203000000) gets
    // its OWN soft-probe — never combined with the tier read, so a
    // pre-migration DB (42703 on the new column) degrades this checkbox to
    // default-off without also nuking the tier-derived portfolio cap.
    const { data: socialRow } = await supabase
      .from('vendor_profiles')
      .select('social_feature_opt_out')
      .eq('user_id', user.id)
      .maybeSingle()
      .then((r) => (r.error ? { data: null } : r));
    const socialFeatureOptOut = Boolean(
      (socialRow as { social_feature_opt_out?: boolean | null } | null)
        ?.social_feature_opt_out,
    );

    // same_day_available (Event Lifecycle Menu PR5 · 20270104000000) — its own
    // soft-probe for the same reason as social: a pre-migration DB (42703 on the
    // new column) degrades the toggle to default-off without nuking anything else.
    const { data: sameDayRow } = await supabase
      .from('vendor_profiles')
      .select('same_day_available')
      .eq('user_id', user.id)
      .maybeSingle()
      .then((r) => (r.error ? { data: null } : r));
    const sameDayAvailable = Boolean(
      (sameDayRow as { same_day_available?: boolean | null } | null)?.same_day_available,
    );

    // Declared experience (flag + schema gated; soft-probe degrades on 42703 so
    // a pre-migration DB never breaks the page). Only read when the feature is on.
    let expSinceYear: number | null = null;
    let expWeddings: number | null = null;
    let expVerifiedAt: string | null = null;
    if (vendorExperienceEnabled()) {
      const { data: expRow } = await supabase
        .from('vendor_profiles')
        .select('in_business_since_year, weddings_done_approx, experience_verified_at')
        .eq('user_id', user.id)
        .maybeSingle()
        .then((r) => (r.error ? { data: null } : r));
      const e = expRow as
        | { in_business_since_year?: number | null; weddings_done_approx?: number | null; experience_verified_at?: string | null }
        | null;
      expSinceYear = e?.in_business_since_year ?? null;
      expWeddings = e?.weddings_done_approx ?? null;
      expVerifiedAt = e?.experience_verified_at ?? null;
    }
    const portfolioCap = caps.portfolioPhotos;
    const portfolioMax = Number.isFinite(portfolioCap) ? portfolioCap : 999;
    // Phase C #4 — a custom website slug is PRO/ENTERPRISE only. Advisory UI;
    // the server guard in saveVendorProfile is the real gate.
    const canCustomSlug = caps.customWebsiteName;

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
      portfolioMax,
      canCustomSlug,
      socialFeatureOptOut,
      sameDayAvailable,
      expSinceYear,
      expWeddings,
      expVerifiedAt,
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
          <AlertTriangle
            aria-hidden
            className="mt-0.5 h-6 w-6 shrink-0 text-terracotta"
            strokeWidth={1.75}
          />
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Your vendor dashboard is temporarily unavailable.
            </h1>
            <p className="text-sm text-ink/65">
              We hit an error loading your profile. The Setnayan team has been notified via Sentry.
              Refreshing in a minute usually clears transient failures; if it persists, please reply
              to your last vendor email and we&rsquo;ll dig in.
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
    portfolioMax,
    canCustomSlug,
    socialFeatureOptOut,
    sameDayAvailable,
    expSinceYear,
    expWeddings,
    expVerifiedAt,
  } = loaderState;
  const completion = profileCompletion(profile);
  const pct = completion.total === 0 ? 0 : Math.round((completion.done / completion.total) * 100);

  // Live admin-taxonomy DISPLAY labels for the "what do you offer" picker. The
  // stored vocabulary is UNCHANGED — labelForVendorCategory only swaps the
  // human-readable text to whatever an admin set on each anchor tile, falling
  // back to the in-code VENDOR_CATEGORY_LABEL per category. getTaxonomy() is
  // itself fallback-safe (uses lib/taxonomy.ts when the DB is unseeded), so this
  // is safe before any migration. Wrapped so a taxonomy hiccup leaves the picker
  // rendering exactly as before (labels=undefined → in-code labels).
  let serviceLabels: Record<string, string> | undefined;
  try {
    const tax = await getTaxonomy();
    serviceLabels = Object.fromEntries(
      VENDOR_CATEGORIES.map((c) => [c, labelForVendorCategory(c, tax)]),
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[/vendor-dashboard] taxonomy label lookup failed', err);
    serviceLabels = undefined;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      {/*
        v2.1 visual overlay 2026-05-28 — label-mono uppercase eyebrow above
        the display heading mirrors vendor-dashboard.jsx template per the
        canonical v2.1 lock at CLAUDE.md 10th 2026-05-28 row. Visual treatment
        only; the profile form below + every button + every interaction stay
        unchanged per [[feedback_setnayan_button_preservation]]. Body copy
        reframes around the v2.1 publisher posture: couples find vendors via
        the marketplace; Setnayan never sits in the booking-money path.
      */}
      {/*
        v2.1 deep-fix (2026-05-28) — Header eyebrow uses .m-eyebrow
        utility (Saira condensed uppercase) with --m-orange-2 sienna;
        heading uses .m-display (Instrument Serif) per v2.1 template
        vendor-dashboard.jsx. Body copy stays since it already reads
        the publisher posture (0% commission). Pattern mirrors couple
        WelcomeHeader from PR #587.
      */}
      <header className="mb-6 space-y-2">
        <p className="m-eyebrow" style={{ color: 'var(--m-orange-2)' }}>
          Vendor dashboard · Public profile
        </p>
        <h1 className="m-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Your profile
        </h1>
        <p className="text-base" style={{ color: 'var(--m-slate)' }}>
          Edit your business info. Couples find you on the marketplace and start chats from their
          dashboard — see those at Messages. Setnayan takes 0% on your bookings; everything you quote
          is yours.
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
        <FormFlash tone="error">{search.error}</FormFlash>
      ) : null}
      {search.saved ? <FormFlash tone="success">Profile saved.</FormFlash> : null}
      {search.password_changed ? (
        <FormFlash tone="success">
          Password changed. Your session stays active; use the new password next time you sign in.
        </FormFlash>
      ) : null}
      {search.signed_out_others ? (
        <FormFlash tone="success">
          Signed out everywhere else. Only this device is still signed in.
        </FormFlash>
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

      {/*
        v2.1 deep-fix (2026-05-28) — Completion card chrome swaps to
        --m-paper background + --m-line border + --m-shadow-sm + sienna
        progress fill (--m-orange) over --m-line-soft track. Eyebrow
        uses .m-label-mono (Saira condensed uppercase) per the v2.1
        template card pattern. Logic + percentage math unchanged.
      */}
      <section
        className="mb-6 space-y-3 rounded-2xl p-5"
        style={{
          background: 'var(--m-paper)',
          border: '1px solid var(--m-line)',
          boxShadow: 'var(--m-shadow-sm)',
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="m-label-mono" style={{ color: 'var(--m-slate)' }}>
            Completion
          </h2>
          <span className="font-mono text-sm font-semibold" style={{ color: 'var(--m-orange-2)' }}>
            {pct}%
          </span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: 'var(--m-line-soft)' }}
        >
          <span
            className="block h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: 'var(--m-orange)' }}
          />
        </div>
        <p className="text-xs" style={{ color: 'var(--m-slate)' }}>
          {completion.done} of {completion.total} fields complete
          {completion.missing.length > 0 ? ` · still needed: ${completion.missing.join(', ')}` : ''}
        </p>
        {!profile?.logo_url ? (
          <p className="inline-flex items-center gap-1 text-xs text-warn-900">
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
          help={
            canCustomSlug
              ? '3–32 chars: lowercase letters, numbers, hyphens. Used in your public vendor URL (coming soon).'
              : 'A custom website address is a Pro feature. Upgrade to Pro or Enterprise to set or change your slug.'
          }
        >
          <input
            id="business_slug"
            name="business_slug"
            pattern="[a-z0-9-]{3,32}"
            defaultValue={profile?.business_slug ?? ''}
            placeholder="bistro-ramos"
            className="input-field font-mono"
            disabled={!canCustomSlug}
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

        {vendorExperienceEnabled() ? (
          <div className="space-y-3 rounded-lg border border-ink/10 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-ink">Your experience</p>
              {expVerifiedAt ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-success-700">
                  <BadgeCheck aria-hidden className="h-4 w-4" strokeWidth={2} />
                  Verified
                </span>
              ) : (
                <span className="text-xs text-ink/45">Self-reported</span>
              )}
            </div>
            <p className="text-xs text-ink/55">
              Shown on your card so couples see you&rsquo;re established. We confirm your
              &ldquo;in business since&rdquo; year against your DTI registration during verification.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="In business since (year)" htmlFor="in_business_since_year">
                <input
                  id="in_business_since_year"
                  name="in_business_since_year"
                  type="number"
                  min={1900}
                  max={new Date().getFullYear()}
                  defaultValue={expSinceYear ?? ''}
                  placeholder="2017"
                  className="input-field"
                />
              </Field>
              <Field label="Approx. weddings done" htmlFor="weddings_done_approx">
                <input
                  id="weddings_done_approx"
                  name="weddings_done_approx"
                  type="number"
                  min={0}
                  defaultValue={expWeddings ?? ''}
                  placeholder="240"
                  className="input-field"
                />
              </Field>
            </div>
            {expVerifiedAt ? (
              <p className="text-xs text-ink/45">Changing your &ldquo;since&rdquo; year will need us to re-verify it.</p>
            ) : null}
          </div>
        ) : null}

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
          help={`Show off recent work. Up to ${portfolioMax >= 999 ? 'unlimited' : portfolioMax} images, 5 MB each. Couples browse this on your public page.`}
        >
          <FileUpload
            bucket="media"
            pathPrefix={`vendors/${profile?.vendor_profile_id ?? 'unassigned'}/portfolio`}
            name="portfolio_r2_keys"
            currentValue={profile?.portfolio_r2_keys ?? []}
            initialDisplayUrls={portfolioDisplayMap}
            multiple
            maxFiles={portfolioMax}
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
          <ServicesPicker
            name="services"
            initial={profile?.services ?? []}
            labels={serviceLabels}
          />
        </Field>

        <Field
          label="Event types you serve"
          htmlFor="event_types"
          help="Tick every event type you take bookings for. Couples browsing each marketplace see only vendors who serve their event. Wedding is checked by default for every vendor; tick others to expand your reach as those marketplaces open."
        >
          <div className="flex flex-wrap gap-2">
            {eventTypesServed.map((et) => {
              const checked = profile?.event_types?.includes(et.key) ?? et.key === 'wedding';
              return (
                <label
                  key={et.key}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-3 py-1.5 text-xs text-ink/75 transition hover:border-ink/30 has-[:checked]:border-terracotta has-[:checked]:bg-terracotta/10 has-[:checked]:text-terracotta-700"
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
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-3 py-1.5 text-xs text-ink/75 transition hover:border-ink/30 has-[:checked]:border-terracotta has-[:checked]:bg-terracotta/10 has-[:checked]:text-terracotta-700"
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
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-3 py-1.5 text-xs text-ink/75 transition hover:border-ink/30 has-[:checked]:border-terracotta has-[:checked]:bg-terracotta/10 has-[:checked]:text-terracotta-700"
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
          <Field label="HQ address (for distance to couples)" htmlFor="hq_address">
            <input
              id="hq_address"
              name="hq_address"
              maxLength={500}
              defaultValue={profile?.hq_address ?? ''}
              placeholder="123 Katipunan Ave, Quezon City, Metro Manila"
              className="input-field"
            />
            <p className="mt-1 text-xs text-ink/55">
              Used to show couples how far you are from their reception venue. Street address
              geocodes more precisely than a city alone.
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

        {/*
          v2.1 deep-fix — Published toggle card swaps to --m-paper warm
          background + --m-line border to match the Completion card
          chrome above. Checkbox accent + body copy unchanged.
        */}
        <label
          className="flex items-start gap-3 rounded-xl p-4"
          style={{ background: 'var(--m-paper)', border: '1px solid var(--m-line)' }}
        >
          <input
            type="checkbox"
            name="is_published"
            defaultChecked={profile?.is_published ?? false}
            className="mt-0.5 h-4 w-4 cursor-pointer accent-terracotta"
          />
          <span>
            <span className="block text-sm font-medium text-ink">Published</span>
            <span className="block text-xs text-ink/55">
              When on, your profile appears in the Setnayan vendor marketplace. New profiles show
              with a <em>Coming soon</em> badge until Setnayan verifies your business — the badge
              flips to <em>Verified</em> the moment your application is approved.
            </span>
          </span>
        </label>

        {/*
          Social Sharing & Featuring Program (migration 20261203000000) — the
          verification celebration post is opt-OUT: every newly verified
          vendor gets featured on Setnayan's Facebook page unless this is
          ticked. Free = unnamed category mention · Pro+ = named feature
          (tiers sell reach · project_setnayan_vendor_hybrid_anonymity).
        */}
        <label
          className="flex items-start gap-3 rounded-xl p-4"
          style={{ background: 'var(--m-paper)', border: '1px solid var(--m-line)' }}
        >
          <input
            type="checkbox"
            name="social_feature_opt_out"
            defaultChecked={socialFeatureOptOut}
            className="mt-0.5 h-4 w-4 cursor-pointer accent-terracotta"
          />
          <span>
            <span className="block text-sm font-medium text-ink">
              Don&rsquo;t feature my business on Setnayan&rsquo;s social pages
            </span>
            <span className="block text-xs text-ink/55">
              When you pass verification we celebrate it on our social pages — Facebook,
              Instagram &amp; TikTok. Free listings get an unnamed category mention, Pro gets a
              named feature with your logo. Tick to opt out.
            </span>
          </span>
        </label>

        {/*
          Same-day "Get help" opt-in (Event Lifecycle Menu PR5 · 20270104000000).
          When a couple hits trouble ON the wedding day, we surface verified,
          PAID vendors who opted into same-day work — nearest the venue first.
          Opt-IN (default off); only shown to verified Pro+ profiles in the
          shortlist (free+verified names stay masked per hybrid-anonymity).
        */}
        <label
          className="flex items-start gap-3 rounded-xl p-4"
          style={{ background: 'var(--m-paper)', border: '1px solid var(--m-line)' }}
        >
          <input
            type="checkbox"
            name="same_day_available"
            defaultChecked={sameDayAvailable}
            className="mt-0.5 h-4 w-4 cursor-pointer accent-terracotta"
          />
          <span>
            <span className="block text-sm font-medium text-ink">
              I can take same-day &amp; day-of jobs
            </span>
            <span className="block text-xs text-ink/55">
              Couples who run into trouble on their wedding day see a shortlist of nearby vendors
              who can help right away. Tick this if you&rsquo;re open to last-minute, same-day work
              — you&rsquo;ll appear to couples near you when they need a hand. (Verified Pro vendors
              only.)
            </span>
          </span>
        </label>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* v2.1 deep-fix — Account ID label uses .m-label-mono utility
              (Saira condensed) over --m-slate body color. Submit CTA
              keeps button-primary class — globals.css redefines that
              class to sienna fill via the v2.1 foundation tokens. */}
          <p className="m-label-mono" style={{ color: 'var(--m-slate)' }}>
            Account ID · {profile?.public_id ?? '—'}
          </p>
          <SubmitButton className="button-primary" pendingLabel="Saving…">
            Save profile
          </SubmitButton>
        </div>
      </form>

      {/*
        Security — account-security suite 2026-06-11. Same hardened shared
        actions as the customer/admin profile (lib/account-security-actions.ts):
        change password requires the CURRENT password (verified on a stateless
        throwaway client so the real session cookies are never rewritten), and
        "Sign out other devices" revokes every session except this one.
        Chrome matches the vendor surface (--m-paper cards · m-label-mono
        eyebrows · .app-surface Source Sans from the vendor layout).
      */}
      <section className="mt-10 space-y-4">
        <div className="space-y-1">
          <h2 className="m-label-mono" style={{ color: 'var(--m-slate)' }}>
            Security
          </h2>
          <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
            Enter your current password, then a new one (minimum 8 characters).
            Your current session stays active. Forgot your current password —
            or signed up with Google/Facebook or a magic link? Sign out and use
            the reset link on the sign-in page instead.
          </p>
        </div>
        <form
          action={changePassword}
          className="space-y-3 rounded-2xl p-5"
          style={{
            background: 'var(--m-paper)',
            border: '1px solid var(--m-line)',
            boxShadow: 'var(--m-shadow-sm)',
          }}
        >
          <input type="hidden" name="return_to" value="/vendor-dashboard/profile" />
          <Field label="Current password" htmlFor="current_password">
            <input
              id="current_password"
              name="current_password"
              type="password"
              required
              autoComplete="current-password"
              className="input-field"
            />
          </Field>
          <Field label="New password" htmlFor="new_password">
            <input
              id="new_password"
              name="new_password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="input-field"
            />
          </Field>
          <Field label="Confirm new password" htmlFor="confirm_password">
            <input
              id="confirm_password"
              name="confirm_password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="input-field"
            />
          </Field>
          <SubmitButton
            className="button-primary inline-flex items-center gap-2"
            pendingLabel="Changing…"
          >
            <KeyRound aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Change password
          </SubmitButton>
        </form>
        <div
          className="flex flex-col gap-3 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between"
          style={{
            background: 'var(--m-paper)',
            border: '1px solid var(--m-line)',
            boxShadow: 'var(--m-shadow-sm)',
          }}
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Sign out other devices</p>
            <p className="text-xs" style={{ color: 'var(--m-slate)' }}>
              Ends every session except this one — handy if a teammate&rsquo;s
              laptop or a shared phone is still signed in.
            </p>
          </div>
          <ConfirmForm
            action={signOutOtherDevices}
            title="Sign out other devices?"
            message="This signs you out on every other phone/laptop where you're logged in. This device stays signed in."
            confirmLabel="Sign out others"
            destructive={false}
          >
            <input type="hidden" name="return_to" value="/vendor-dashboard/profile" />
            <SubmitButton
              className="button-secondary inline-flex items-center gap-2"
              pendingLabel="Signing out…"
            >
              <MonitorSmartphone aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Sign out other devices
            </SubmitButton>
          </ConfirmForm>
        </div>
      </section>
    </div>
  );
  } catch (err) {
    // Re-throw Next.js navigation signals (NEXT_REDIRECT, NEXT_NOT_FOUND) —
    // catching those would silently break /login redirect for unauthed
    // visitors. See WHY block at the top of this function (lines 87-130).
    if (err instanceof Error && 'digest' in err && typeof (err as { digest?: unknown }).digest === 'string') {
      const digest = (err as { digest: string }).digest;
      if (digest.startsWith('NEXT_')) throw err;
    }
    // Log so Sentry's nodejs runtime hook picks it up + Vercel function
    // logs surface the actual message.
    // eslint-disable-next-line no-console
    console.error('[/vendor-dashboard] top-level page render failed (final guard)', err);
    const message = err instanceof Error ? err.message : String(err);
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <header className="mb-6 flex items-start gap-3">
          <AlertTriangle
            aria-hidden
            className="mt-0.5 h-6 w-6 shrink-0 text-terracotta"
            strokeWidth={1.75}
          />
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Your shop console is temporarily unavailable.
            </h1>
            <p className="text-sm text-ink/65">
              We hit an unexpected error loading your dashboard. Refreshing in a
              moment usually clears transient failures; if it persists, use the
              role pill at the top right to switch to your customer view and
              we&rsquo;ll dig in on our end.
            </p>
          </div>
        </header>
        {process.env.NODE_ENV !== 'production' ? (
          <pre className="overflow-auto rounded-md border border-ink/15 bg-ink/[0.03] p-3 text-xs text-ink/65">
            {message}
          </pre>
        ) : null}
      </div>
    );
  }
}

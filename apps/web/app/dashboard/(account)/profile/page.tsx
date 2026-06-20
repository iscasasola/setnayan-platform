import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  AlertTriangle,
  Compass,
  KeyRound,
  Gem,
  MonitorSmartphone,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { isPlaceholderEmail } from '@/lib/anon-onboarding';
import { CONCIERGE_ENABLED } from '@/lib/concierge';
import { fetchUserEvents } from '@/lib/events';
import { restartTour } from '@/lib/tour-actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { Field } from '@/app/_components/forms/field';
import { FormFlash } from '@/app/_components/forms/form-flash';
import { FileUpload } from '@/app/_components/file-upload';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { makeT } from '@/lib/i18n';
import { ConfirmForm } from '@/app/_components/confirm-form';
import {
  changePassword,
  signOutOtherDevices,
} from '@/lib/account-security-actions';
import { HapticsToggle } from './_components/haptics-toggle';
import { PushToggle } from './_components/push-toggle';
import { SHARE_ARTIFACT_LABEL, type ShareArtifactType } from '@/lib/social-sharing';
import { revokeShareConsent } from '@/app/dashboard/[eventId]/_actions/share-consent';
import {
  cancelAccountDeletionRequest,
  requestAccountDeletion,
  updateLocalePreference,
  updatePersonalInfo,
  updatePlannerMode,
  updateRemindersEnabled,
} from './actions';

export const metadata = { title: 'Profile' };

type Props = {
  searchParams: Promise<{
    saved?: string;
    error?: string;
    tour_restarted?: string;
    password_changed?: string;
    signed_out_others?: string;
    deletion_requested?: string;
    deletion_cancelled?: string;
  }>;
};

// Light-locked 2026-06-04: the theme picker (Light · Dark · Auto) was removed —
// Setnayan always renders light. `users.theme_preference` is left dormant. See
// _components/theme-provider.tsx and CLAUDE.md decision-log.

export default async function ProfilePage({ searchParams }: Props) {
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Use `.maybeSingle()` per the canonical guard pattern established in
  // `apps/web/app/dashboard/[eventId]/layout.tsx` (post-third-hotfix-pass):
  // `.single()` flags PGRST116 "0 rows" as an error which silently drops
  // when only `data` is destructured; `.maybeSingle()` returns `null` cleanly
  // so downstream optional chaining is the canonical handler. Log real DB /
  // column errors via `logQueryError` so future ADD COLUMN migrations that
  // land on code before SQL surface as logged graceful-degrade rather than
  // a confusing UI render. Profile is allowed to be null — every downstream
  // read uses `profile?.field` and the page renders a coherent first-load
  // state even when the row hasn't been created yet (auth.users-vs-public.users
  // race during signup).
  const { data: profile, error: profileErr } = await supabase
    .from('users')
    .select(
      'public_id, email, display_name, phone, profile_photo_url, account_type, is_internal, is_team_member, locale, planner_mode, marketing_opt_in, birth_date, public_greeting_opt_in, reminders_enabled, created_at',
    )
    .eq('user_id', user.id)
    .maybeSingle();
  if (profileErr) {
    logQueryError(
      'ProfilePage (users)',
      profileErr,
      { user_id: user.id },
      'graceful_degrade',
    );
  }

  // Self-serve account-deletion request (App Store 5.1.1(v) / Google Play).
  // We surface the latest still-pending request so the user sees its status +
  // a Cancel control instead of being able to file a duplicate.
  const { data: pendingDeletion, error: pendingDeletionErr } = await supabase
    .from('account_deletion_requests')
    .select('request_id, status, created_at')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .maybeSingle();
  if (pendingDeletionErr) {
    logQueryError(
      'ProfilePage (account_deletion_requests)',
      pendingDeletionErr,
      { user_id: user.id },
      'graceful_degrade',
    );
  }

  // Presigned display URL for the existing profile photo so the <FileUpload>
  // thumbnail renders on first paint (legacy http(s) values pass through and
  // need no map entry — the component falls back to the raw value for those).
  const photoDisplayMap: Record<string, string> = {};
  if (profile?.profile_photo_url?.startsWith('r2://')) {
    const url = await displayUrlForStoredAsset(profile.profile_photo_url).catch(
      () => null,
    );
    if (url) photoDisplayMap[profile.profile_photo_url] = url;
  }

  const activePlannerMode = (profile?.planner_mode ?? 'guided') as 'guided' | 'diy';
  const remindersOn = (profile?.reminders_enabled ?? true) as boolean;
  // Iteration 0025 — runtime EN/TL toggle. The DB enum also has 'ceb' but the
  // UI exposes EN/TL only; anything else falls back to EN in the toggle.
  const activeLocale: 'en' | 'tl' = profile?.locale === 'tl' ? 'tl' : 'en';
  const tr = makeT(activeLocale);
  const isAdmin =
    profile?.is_internal ||
    profile?.is_team_member ||
    profile?.account_type === 'admin';

  // Social Sharing & Featuring Program (migration 20261203000000) — the
  // user's LIVE share consents across their events, for the "Featured on
  // Setnayan's page" block under Privacy & data. The couple RLS policy
  // scopes the read to their own events; the `.then` guard degrades to an
  // empty list on a drifted DB (table may post-date this deploy). Event
  // display names resolve in a second cheap read (no FK-joined select —
  // matches the verify-queue two-round-trip convention).
  const { data: shareConsentRows } = await supabase
    .from('marketing_share_consents')
    .select('consent_id, event_id, artifact_type, credit_mode, consented_at, posted_at, post_url')
    .is('revoked_at', null)
    .order('consented_at', { ascending: false })
    .limit(50)
    .then((r) => (r.error ? { data: [] } : r));
  const shareConsents = (shareConsentRows ?? []) as Array<{
    consent_id: string;
    event_id: string;
    artifact_type: string;
    credit_mode: string;
    consented_at: string;
    posted_at: string | null;
    post_url: string | null;
  }>;
  let consentEventNames: Record<string, string> = {};
  if (shareConsents.length > 0) {
    const eventIds = Array.from(new Set(shareConsents.map((c) => c.event_id)));
    const { data: consentEvents } = await supabase
      .from('events')
      .select('event_id, display_name')
      .in('event_id', eventIds)
      .then((r) => (r.error ? { data: [] } : r));
    consentEventNames = Object.fromEntries(
      ((consentEvents ?? []) as Array<{ event_id: string; display_name: string | null }>).map(
        (e) => [e.event_id, e.display_name ?? ''],
      ),
    );
  }

  // If the user has exactly one active event, "Back" lands on that event's
  // home rather than the event-picker. Two+ events fall through to /dashboard.
  const events = await fetchUserEvents(supabase, user.id, 'couple');
  const activeEvents = events.filter((e) => !e.archived);
  const backHref =
    activeEvents.length === 1 && activeEvents[0]
      ? `/dashboard/${activeEvents[0].event_id}`
      : '/dashboard';
  const backLabel = activeEvents.length === 1 ? 'Back to Home' : 'Back to events';

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 space-y-2">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          {backLabel}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Profile &amp; settings
        </h1>
      </header>

      {search.error ? (
        <FormFlash tone="error">{decodeURIComponent(search.error)}</FormFlash>
      ) : null}
      {search.saved ? <FormFlash tone="success">Saved.</FormFlash> : null}
      {search.tour_restarted ? (
        <FormFlash tone="success">
          Welcome tour restarted — head back to your dashboard to see it again.
        </FormFlash>
      ) : null}
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
      {search.deletion_requested ? (
        <p
          role="status"
          className="mb-4 rounded-md border border-warn-300/60 bg-warn-50 px-4 py-3 text-sm text-warn-900"
        >
          Account-deletion request received. Our team will review it within 24 hours. You can
          cancel any time before it&rsquo;s approved — see Privacy &amp; data below.
        </p>
      ) : null}
      {search.deletion_cancelled ? (
        <FormFlash tone="success">
          Account-deletion request cancelled. Your account stays active.
        </FormFlash>
      ) : null}

      {/* Personal info */}
      <section className="mb-10 space-y-4">
        <div className="space-y-1">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Personal info
          </h2>
        </div>
        <form action={updatePersonalInfo} className="space-y-4">
          <Field label="Display name" htmlFor="display_name">
            <input
              id="display_name"
              name="display_name"
              maxLength={128}
              defaultValue={profile?.display_name ?? ''}
              placeholder="How you want to appear in the app"
              className="input-field"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" htmlFor="phone">
              <input
                id="phone"
                name="phone"
                maxLength={32}
                defaultValue={profile?.phone ?? ''}
                placeholder="+63 917 …"
                className="input-field"
              />
            </Field>
            {/* Profile photo upload (owner directive 2026-06-12: the account
                avatar is the account's OWN photo, never the event logo —
                this replaces the "file upload ships later" URL input). Same
                R2 presigned-PUT pipeline as the vendor logo. No watermark:
                the 2026-05-21 watermark directive covers marketplace photos,
                not account identity. Clearing the photo emits no hidden
                input → updatePersonalInfo nulls the column → avatar falls
                back to the account initial. */}
            <Field
              label="Profile photo"
              htmlFor="profile_photo_url"
              help="Shown as your account avatar across the app. PNG / JPG / WebP, up to 2 MB."
            >
              <FileUpload
                bucket="media"
                pathPrefix={`profile-photo/${user.id}`}
                name="profile_photo_url"
                currentValue={profile?.profile_photo_url ?? null}
                initialDisplayUrls={photoDisplayMap}
                maxSizeMB={2}
                acceptedTypes={['image/png', 'image/jpeg', 'image/webp']}
                variant="square"
              />
            </Field>
          </div>
          <Field
            label="Birthday"
            htmlFor="birth_date"
            help="Optional — so we can greet you on your day 🎂"
          >
            <input
              id="birth_date"
              name="birth_date"
              type="date"
              defaultValue={profile?.birth_date ?? ''}
              className="input-field"
            />
          </Field>
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-ink/10 bg-cream p-3 text-sm">
            <input
              type="checkbox"
              name="public_greeting_opt_in"
              defaultChecked={profile?.public_greeting_opt_in ?? false}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-terracotta"
            />
            <span>
              <span className="block font-medium text-ink">
                Allow public birthday &amp; anniversary greetings
              </span>
              <span className="block text-xs text-ink/55">
                Lets Setnayan greet you on our social pages — Facebook, Instagram
                &amp; TikTok — for birthdays and wedding anniversaries. Email
                greetings don&rsquo;t need this. Default off.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-ink/10 bg-cream p-3 text-sm">
            <input
              type="checkbox"
              name="marketing_opt_in"
              defaultChecked={profile?.marketing_opt_in ?? false}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-terracotta"
            />
            <span>
              <span className="block font-medium text-ink">
                Receive marketing emails
              </span>
              <span className="block text-xs text-ink/55">
                Product updates · new templates · seasonal promos. RA 10173 opt-in. Default
                off.
              </span>
            </span>
          </label>
          <SubmitButton className="button-primary" pendingLabel="Saving…">
            Save personal info
          </SubmitButton>
        </form>
      </section>

      <section className="mb-10 space-y-4">
        <div className="space-y-1">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Change password
          </h2>
          <p className="text-sm text-ink/60">
            Enter your current password, then a new one (minimum 8 characters).
            Your current session stays active. Forgot your current password —
            or signed up with Google/Facebook or a magic link? Sign out and use
            the reset link on the sign-in page instead.
          </p>
        </div>
        <form action={changePassword} className="space-y-3 rounded-xl border border-ink/10 bg-cream p-4">
          <input type="hidden" name="return_to" value="/dashboard/profile" />
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
      </section>

      <section className="mb-10 space-y-4">
        <div className="space-y-1">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Sessions
          </h2>
          <p className="text-sm text-ink/60">
            Left yourself signed in on a borrowed laptop or a shared phone?
            Sign out everywhere else in one tap — this device stays signed in.
          </p>
        </div>
        <div className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-cream p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Sign out other devices</p>
            <p className="text-xs text-ink/55">
              Ends every session except this one. Other devices will need your
              password to sign back in.
            </p>
          </div>
          <ConfirmForm
            action={signOutOtherDevices}
            title="Sign out other devices?"
            message="This signs you out on every other phone/laptop where you're logged in. This device stays signed in."
            confirmLabel="Sign out others"
            destructive={false}
          >
            <input type="hidden" name="return_to" value="/dashboard/profile" />
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

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Row
          label="Email"
          value={
            isPlaceholderEmail(profile?.email ?? user.email)
              ? 'Not secured yet — add an email to keep your plan'
              : (profile?.email ?? user.email ?? '—')
          }
        />
        <Row label="Account ID" value={profile?.public_id ?? '—'} mono />
        <Row label="Account type" value={profile?.account_type ?? '—'} />
        <Row label="Locale" value={profile?.locale ?? '—'} />
        <Row
          label="Internal account"
          value={
            profile?.is_internal
              ? 'Yes (§ 10a — owner)'
              : profile?.is_team_member
                ? 'Yes (§ 10b — team pool)'
                : 'No'
          }
        />
      </dl>

      {/*
        Anchor target for the Settings row of the (I) menu in
        apps/web/app/_components/profile-menu.tsx. The menu splits
        identity rows (above this section) from preferences rows
        (this section onward — Planner mode, Display language,
        Appearance, Privacy & data). `scroll-mt-24` pads under the
        sticky dashboard chrome so the section heading doesn't hide
        behind the top bar when anchor-scrolled. WHY this lives here
        instead of /dashboard/settings: V1 keeps a single Profile
        page; the menu split is anchor-based, not route-based, so
        deep links survive without a route migration.
      */}
      <section id="settings" className="mt-10 space-y-4 scroll-mt-24">
        <div className="space-y-1">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Planner mode
          </h2>
          <p className="text-sm text-ink/60">
            Guided shows the 9-step checklist on your Home tab. DIY hides it so you can plan
            in any order without the prompts.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(
            [
              {
                key: 'guided' as const,
                label: 'Guided',
                tagline: '9-step checklist · best for first weddings',
              },
              {
                key: 'diy' as const,
                label: 'DIY',
                tagline: 'Hide the checklist · pick what to do next',
              },
            ]
          ).map((mode) => {
            const isActive = mode.key === activePlannerMode;
            return (
              <form key={mode.key} action={updatePlannerMode}>
                <input type="hidden" name="planner_mode" value={mode.key} />
                <button
                  type="submit"
                  disabled={isActive}
                  className={`group flex w-full flex-col items-start gap-1 rounded-xl border p-4 text-left transition-colors ${
                    isActive
                      ? 'border-terracotta bg-terracotta/5'
                      : 'border-ink/10 bg-cream hover:border-terracotta/50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{mode.label}</span>
                    {isActive ? (
                      <span className="rounded-full bg-terracotta/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700">
                        Active
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-ink/55">{mode.tagline}</span>
                </button>
              </form>
            );
          })}
        </div>
      </section>

      <section className="mt-10 space-y-4">
        <div className="space-y-1">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Planning reminders
          </h2>
          <p className="text-sm text-ink/60">
            Friendly nudges on your Home tab for when to book each vendor and
            handle key documents. On by default — turn off to plan on your own
            clock.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(
            [
              {
                key: 'true' as const,
                label: 'On',
                tagline: 'Show recommended deadlines on your Home tab',
              },
              {
                key: 'false' as const,
                label: 'Off',
                tagline: 'Hide them · plan on your own clock',
              },
            ]
          ).map((opt) => {
            const isActive = (opt.key === 'true') === remindersOn;
            return (
              <form key={opt.key} action={updateRemindersEnabled}>
                <input type="hidden" name="reminders_enabled" value={opt.key} />
                <button
                  type="submit"
                  disabled={isActive}
                  className={`group flex w-full flex-col items-start gap-1 rounded-xl border p-4 text-left transition-colors ${
                    isActive
                      ? 'border-terracotta bg-terracotta/5'
                      : 'border-ink/10 bg-cream hover:border-terracotta/50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{opt.label}</span>
                    {isActive ? (
                      <span className="rounded-full bg-terracotta/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700">
                        Active
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-ink/55">{opt.tagline}</span>
                </button>
              </form>
            );
          })}
        </div>
      </section>

      <section className="mt-10 space-y-4">
        <div className="space-y-1">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Display language
          </h2>
          <p className="text-sm text-ink/60">
            Switches dashboard nav, headings, and common buttons between English and
            Tagalog. Your guest list, vendor names, and the marketing site stay in
            whatever you typed them in.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(
            [
              {
                key: 'en' as const,
                label: 'English',
                tagline: 'Default · ships across every Setnayan surface',
              },
              {
                key: 'tl' as const,
                label: 'Tagalog',
                tagline: 'Dashboard chrome only · conversational tone',
              },
            ]
          ).map((opt) => {
            const isActive = opt.key === activeLocale;
            return (
              <form key={opt.key} action={updateLocalePreference}>
                <input type="hidden" name="locale" value={opt.key} />
                <button
                  type="submit"
                  disabled={isActive}
                  className={`group flex w-full flex-col items-start gap-1 rounded-xl border p-4 text-left transition-colors ${
                    isActive
                      ? 'border-terracotta bg-terracotta/5'
                      : 'border-ink/10 bg-cream hover:border-terracotta/50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{opt.label}</span>
                    {isActive ? (
                      <span className="rounded-full bg-terracotta/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700">
                        Active
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-ink/55">{opt.tagline}</span>
                </button>
              </form>
            );
          })}
        </div>
      </section>

      <section className="mt-10 space-y-4">
        <div className="space-y-1">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Notifications &amp; feedback
          </h2>
          <p className="text-sm text-ink/60">
            Turn on push to hear about new messages and inquiries even when the
            app is closed. Haptics adds a gentle tap when you press buttons, on
            phones that support it.
          </p>
        </div>
        <PushToggle />
        <HapticsToggle />
      </section>

      <section className="mt-10 space-y-4">
        <div className="space-y-1">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Privacy &amp; data (RA 10173)
          </h2>
          <p className="text-sm text-ink/60">
            Export your data or request account deletion at any time. Deletion
            requests are reviewed by our team within 24 hours before they take
            effect.
          </p>
        </div>
        <div className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-cream p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Export my data</p>
            <p className="text-xs text-ink/55">
              Downloads a JSON file with your profile, events you&rsquo;re on, vendor
              profile (if any), and chat messages you authored.
            </p>
          </div>
          <a
            href="/api/profile/export"
            download
            className="button-secondary inline-flex items-center gap-2"
          >
            <Download aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Download .json
          </a>
        </div>

        {/*
          Social Sharing & Featuring Program — live consents the user can
          revoke. A revoke after a post went live still works (revoked_at
          flips); the admin Social Queue then handles the take-down within
          the 24-hour SLA. See migration 20261203000000.
        */}
        <div className="space-y-3 rounded-xl border border-ink/10 bg-cream p-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">
              Featured on Setnayan&rsquo;s pages
            </p>
            <p className="text-xs text-ink/55">
              Creations you&rsquo;ve allowed us to feature on our social pages
              (Facebook, Instagram &amp; TikTok) — always after your event, never
              before.
            </p>
          </div>
          {shareConsents.length === 0 ? (
            <p className="text-xs text-ink/45">
              Nothing here — when you allow a creation to be featured, it shows up
              here and can be revoked any time.
            </p>
          ) : (
            <ul className="space-y-2">
              {shareConsents.map((c) => (
                <li
                  key={c.consent_id}
                  className="flex flex-col gap-2 rounded-md border border-ink/10 bg-cream/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium text-ink">
                      {SHARE_ARTIFACT_LABEL[c.artifact_type as ShareArtifactType] ??
                        c.artifact_type}
                      {consentEventNames[c.event_id] ? (
                        <span className="text-ink/55"> · {consentEventNames[c.event_id]}</span>
                      ) : null}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                      {c.credit_mode === 'anonymous' ? 'Anonymous' : 'First names'} · allowed{' '}
                      {c.consented_at.slice(0, 10)} ·{' '}
                      {c.posted_at ? (
                        c.post_url ? (
                          <a
                            href={c.post_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-terracotta hover:underline"
                          >
                            posted ↗
                          </a>
                        ) : (
                          'posted'
                        )
                      ) : (
                        'queued — posts after your event'
                      )}
                    </p>
                  </div>
                  <form action={revokeShareConsent}>
                    <input type="hidden" name="consent_id" value={c.consent_id} />
                    <input type="hidden" name="revalidate_path" value="/dashboard/profile" />
                    <SubmitButton
                      className="button-secondary text-xs"
                      pendingLabel="Revoking…"
                    >
                      Revoke
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>

        {pendingDeletion ? (
          <div className="space-y-3 rounded-xl border border-warn-300/60 bg-warn-50/60 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle
                aria-hidden
                className="mt-0.5 h-4 w-4 shrink-0 text-warn-700"
                strokeWidth={1.75}
              />
              <div className="space-y-1">
                <p className="text-sm font-medium text-warn-900">
                  Account-deletion request pending review
                </p>
                <p className="text-xs text-warn-900/85">
                  Filed {pendingDeletion.created_at.slice(0, 10)}. Our team reviews
                  deletion requests within 24 hours. If you have active events,
                  bookings, or an outstanding balance, we may reach out before
                  removing your account. Changed your mind? Cancel below.
                </p>
              </div>
            </div>
            <form action={cancelAccountDeletionRequest}>
              <input type="hidden" name="request_id" value={pendingDeletion.request_id} />
              <SubmitButton
                className="button-secondary inline-flex items-center gap-2"
                pendingLabel="Cancelling…"
              >
                Cancel deletion request
              </SubmitButton>
            </form>
          </div>
        ) : (
          <details className="space-y-3 rounded-xl border border-danger-200/60 bg-danger-50/50 p-4">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-danger-800">
              <AlertTriangle aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Delete my account
            </summary>
            <form action={requestAccountDeletion} className="mt-3 space-y-3">
              <p className="text-sm text-danger-900">
                This files a request to delete your account. Our team reviews it
                within 24 hours before it takes effect — this lets us check for
                active events, bookings, or an outstanding balance first. Once
                approved, deletion is permanent and your email may be blocked from
                re-registering. Type{' '}
                <code className="rounded bg-danger-100 px-1 font-mono text-xs">DELETE</code> below
                to confirm.
              </p>
              <label className="block space-y-1">
                <span className="block text-sm font-medium text-danger-900">
                  Reason (optional)
                </span>
                <textarea
                  name="reason"
                  rows={2}
                  maxLength={1000}
                  placeholder="Helps us improve — and lets us flag anything we should handle before deletion."
                  className="input-field bg-cream"
                />
              </label>
              <input
                name="confirm"
                required
                autoComplete="off"
                placeholder="Type DELETE to confirm"
                className="input-field bg-cream"
              />
              <SubmitButton
                className="inline-flex items-center gap-2 rounded-md bg-danger-700 px-4 py-2 text-sm font-medium text-cream hover:bg-danger-800 disabled:opacity-70"
                pendingLabel="Submitting…"
              >
                Request account deletion
              </SubmitButton>
            </form>
          </details>
        )}
      </section>

      <section className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {/* Route URL stays `/dashboard/profile/concierge` to avoid cross-iteration
            import + spec-corpus churn. Visible label rewritten to V2 brand
            "Setnayan AI" per CLAUDE.md 2026-05-28 V1→V2 cutover row 3 lock. */}
        {CONCIERGE_ENABLED ? (
          <Link
            href="/dashboard/profile/concierge"
            className="button-secondary inline-flex items-center gap-2"
          >
            <Gem aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Setnayan AI
          </Link>
        ) : null}
        <Link href="/help" className="button-secondary">
          {tr('common.help')}
        </Link>
        <Link href="/dashboard/api-keys" className="button-secondary">
          API keys
        </Link>
        <form action={restartTour}>
          <SubmitButton pendingLabel="Restarting…" className="button-secondary inline-flex items-center gap-2">
            <Compass aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Restart welcome tour
          </SubmitButton>
        </form>
        {isAdmin ? (
          <Link href="/admin" className="button-secondary">
            Setnayan HQ ↗
          </Link>
        ) : null}
        <form action="/auth/sign-out" method="post">
          <SubmitButton pendingLabel="Signing out…" className="button-secondary">
            {tr('cta.sign_out')}
          </SubmitButton>
        </form>
      </section>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1 rounded-md border border-ink/10 bg-cream/60 p-4">
      <dt className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/50">{label}</dt>
      <dd className={`text-base text-ink ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}

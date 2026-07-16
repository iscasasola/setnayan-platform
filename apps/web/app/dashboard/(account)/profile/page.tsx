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
  UserCircle,
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
import { TurnstileField } from '@/app/_components/auth/turnstile-field';
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
  updatePublicProfileEnabled,
  updateRemindersEnabled,
  updateUserSlug,
} from './actions';
import { accountFaceProfileEnabled } from '@/lib/account-face-profile';
import {
  CIVIL_STATUSES,
  CIVIL_STATUS_LABELS,
  RELIGIONS,
  RELIGION_LABELS,
  SEXES,
  SEX_LABELS,
} from '@/lib/profile-personalization';
import {
  setAccountFaceProfileConsent,
  forgetMyFaceEverywhere,
} from './face-profile-actions';

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
    face_forgotten?: string;
    slug_saved?: string;
    slug_error?: string;
    public_profile_saved?: string;
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

  // Anon-draft: a not-yet-secured (anonymous) account has no password and no
  // meaningful multi-device sessions. Hide the Change-password + Sessions
  // sections for them — the "Not secured yet" email banner below already nudges
  // them to add an email (which IS where they set their first password).
  const isAnon = !!user.is_anonymous;

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
      'public_id, email, display_name, phone, profile_photo_url, account_type, is_internal, is_team_member, locale, planner_mode, marketing_opt_in, birth_date, public_greeting_opt_in, religion, civil_status, sex, reminders_enabled, slug, public_profile_enabled, created_at',
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

  // Public account handle (#7a/#7b). `slug` is backfilled for every account;
  // `public_profile_enabled` gates whether /u/[slug] is reachable by strangers
  // at all (dormant/off by default). The host is derived from the deploy URL so
  // the preview matches production (falls back to the canonical apex).
  const currentSlug = (profile?.slug ?? null) as string | null;
  const publicProfileOn = (profile?.public_profile_enabled ?? false) as boolean;
  const publicHost = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com')
    .replace(/\/+$/, '')
    .replace(/^https?:\/\//, '');
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

  // ACCOUNT-LEVEL FACE PROFILE (owner-locked 2026-06-26) — only read the opt-in
  // state when the feature flag is ON; otherwise the section is never rendered
  // and we skip the query entirely. RLS scopes this to the caller's own row.
  const faceProfileFlagOn = accountFaceProfileEnabled();
  let faceProfileOptedIn = false;
  if (faceProfileFlagOn) {
    const { data: faceProfile } = await supabase
      .from('user_face_profiles')
      .select('profile_id, revoked_at')
      .eq('user_id', user.id)
      .is('revoked_at', null)
      .maybeSingle()
      .then((r) => (r.error ? { data: null } : r));
    faceProfileOptedIn = Boolean(faceProfile);
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
        <Link href={backHref} className="sn-chip sn-press w-fit">
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          {backLabel}
        </Link>
        <p className="sn-eye">
          <UserCircle aria-hidden strokeWidth={1.75} />
          Your account
        </p>
        <h1 className="sn-h1">Profile &amp; settings</h1>
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
      {search.face_forgotten ? (
        <FormFlash tone="success">
          Done — your face profile has been forgotten.
        </FormFlash>
      ) : null}
      {search.slug_saved ? (
        <FormFlash tone="success">Your public handle has been updated.</FormFlash>
      ) : null}
      {search.slug_error ? (
        <FormFlash tone="error">{decodeURIComponent(search.slug_error)}</FormFlash>
      ) : null}
      {search.public_profile_saved ? (
        <FormFlash tone="success">Public profile setting saved.</FormFlash>
      ) : null}

      {/* Personal info */}
      <section className="mb-10 space-y-4">
        <div className="space-y-1">
          <h2 className="sn-sec">
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

          {/* Optional, reference-only personalization (date-anchor model). Both
              fields are sensitive PI (RA 10173 §3(l)) — opt-in, never required,
              never shared. Leaving them blank changes nothing. */}
          <fieldset className="sn-row space-y-3 p-4">
            <legend className="px-1 text-xs font-medium uppercase tracking-[0.12em] text-ink/50">
              Personalize your events — optional
            </legend>
            <p className="text-xs leading-relaxed text-ink/55">
              Add these to tailor your events — your wedding ceremony, your milestones.
              Optional and used only to personalize; never required, never shared.{' '}
              <span className="font-medium text-ink/70">We store your events, not your documents.</span>
            </p>
            <Field
              label="Civil status"
              htmlFor="civil_status"
              help="Helps tailor wedding &amp; anniversary suggestions"
            >
              <select
                id="civil_status"
                name="civil_status"
                defaultValue={profile?.civil_status ?? ''}
                className="input-field"
              >
                <option value="">Prefer not to say</option>
                {CIVIL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {CIVIL_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Religion"
              htmlFor="religion"
              help="Pre-selects your ceremony &amp; faith milestones"
            >
              <select
                id="religion"
                name="religion"
                defaultValue={profile?.religion ?? ''}
                className="input-field"
              >
                <option value="">Prefer not to say</option>
                {RELIGIONS.map((r) => (
                  <option key={r} value={r}>
                    {RELIGION_LABELS[r]}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Gender"
              htmlFor="sex"
              help="Personalizes your own milestones — e.g. your debut (18th / 21st)"
            >
              <select
                id="sex"
                name="sex"
                defaultValue={profile?.sex ?? ''}
                className="input-field"
              >
                <option value="">Prefer not to say</option>
                {SEXES.map((s) => (
                  <option key={s} value={s}>
                    {SEX_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
          </fieldset>
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
          {/* Anon-draft: marketing email would go to the non-routable
              placeholder address. Hide until they secure a real email. */}
          {isAnon ? null : (
            <label className="sn-row flex cursor-pointer items-start gap-3 p-3 text-sm">
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
          )}
          <SubmitButton className="button-primary" pendingLabel="Saving…">
            Save personal info
          </SubmitButton>
        </form>
      </section>

      {isAnon ? null : (
      <>
      <section className="mb-10 space-y-4">
        <div className="space-y-1">
          <h2 className="sn-sec">
            Change password
          </h2>
          <p className="text-sm text-ink/60">
            Enter your current password, then a new one (minimum 8 characters).
            Your current session stays active. Forgot your current password —
            or signed up with Google/Facebook or a magic link? Sign out and use
            the reset link on the sign-in page instead.
          </p>
        </div>
        <form action={changePassword} className="sn-tile space-y-3">
          <input type="hidden" name="return_to" value="/dashboard/profile" />
          <TurnstileField action="reauth" />
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
          <h2 className="sn-sec">
            Sessions
          </h2>
          <p className="text-sm text-ink/60">
            Left yourself signed in on a borrowed laptop or a shared phone?
            Sign out everywhere else in one tap — this device stays signed in.
          </p>
        </div>
        <div className="sn-tile flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
      </>
      )}

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
          <h2 className="sn-sec">
            Planner mode
          </h2>
          <p className="text-sm text-ink/60">
            Guided shows the 9-step checklist on your Overview tab. DIY hides it so you can plan
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

      {/* URL & Slug — public handle editor (#7a) + public-profile gate (#7b).
          The handle is a public identifier derived from the account name, so
          RA-10173 requires it be user-controllable; the toggle keeps the /u
          showcase dormant until the owner opts in. Hidden for anon drafts —
          they have no durable public identity to publish. */}
      {isAnon ? null : (
        <section id="url-slug" className="mt-10 space-y-4 scroll-mt-24">
          <div className="space-y-1">
            <h2 className="sn-sec">URL &amp; handle</h2>
            <p className="text-sm text-ink/60">
              Your public profile lives at{' '}
              <span className="font-mono text-ink/80">
                {publicHost}/u/{currentSlug ?? 'your-handle'}
              </span>
              . Change the handle any time — the old link keeps redirecting for
              90 days.
            </p>
          </div>

          <form action={updateUserSlug} className="sn-tile space-y-3">
            <Field
              label="Handle"
              htmlFor="slug"
              help="3–32 characters · lowercase letters, numbers, and hyphens only."
            >
              <div className="flex items-center gap-2">
                <span className="shrink-0 font-mono text-xs text-ink/50">
                  {publicHost}/u/
                </span>
                <input
                  id="slug"
                  name="slug"
                  maxLength={32}
                  defaultValue={currentSlug ?? ''}
                  placeholder="your-handle"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="input-field font-mono"
                />
              </div>
            </Field>
            <SubmitButton
              className="button-secondary inline-flex items-center gap-2"
              pendingLabel="Saving…"
            >
              Save handle
            </SubmitButton>
          </form>

          <div className="space-y-1 pt-2">
            <h3 className="text-sm font-semibold text-ink">Public profile page</h3>
            <p className="text-sm text-ink/60">
              A public profile turns{' '}
              <span className="font-mono text-ink/80">{publicHost}/u/{currentSlug ?? 'your-handle'}</span>{' '}
              into a shareable showcase of the celebrations you&rsquo;ve made
              public. It&rsquo;s <span className="font-medium">off by default</span> — while
              off, the page is hidden from everyone but you, and never appears in
              search. This is separate from each event&rsquo;s own privacy setting;
              your profile only ever lists events you&rsquo;ve already made public.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(
              [
                {
                  key: 'false' as const,
                  label: 'Off',
                  tagline: 'Hidden · only you can see it · not in search',
                },
                {
                  key: 'true' as const,
                  label: 'On',
                  tagline: 'Anyone with the link can view your public celebrations',
                },
              ]
            ).map((opt) => {
              const isActive = (opt.key === 'true') === publicProfileOn;
              return (
                <form key={opt.key} action={updatePublicProfileEnabled}>
                  <input type="hidden" name="public_profile_enabled" value={opt.key} />
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
          {publicProfileOn && currentSlug ? (
            <Link
              href={`/u/${currentSlug}`}
              className="sn-chip sn-press w-fit"
              prefetch={false}
            >
              Preview your public profile
            </Link>
          ) : null}
        </section>
      )}

      <section className="mt-10 space-y-4">
        <div className="space-y-1">
          <h2 className="sn-sec">
            Planning reminders
          </h2>
          <p className="text-sm text-ink/60">
            Friendly nudges on your Overview tab for when to book each vendor and
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
                tagline: 'Show recommended deadlines on your Overview tab',
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
          <h2 className="sn-sec">
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
          <h2 className="sn-sec">
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
          <h2 className="sn-sec">
            Privacy &amp; data (RA 10173)
          </h2>
          <p className="text-sm text-ink/60">
            Export your data or request account deletion at any time. Deletion
            requests are reviewed by our team within 24 hours before they take
            effect.
          </p>
        </div>
        <div className="sn-tile flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
          LEGACY CONTACT (reserved · person-spine Phase 3, owner-locked
          2026-07-04). Designate-while-alive — who inherits your memories. Inert
          placeholder here; the actual flow (memorialization + inheritance) ships
          in Phase 3 behind PH counsel. Baked in now so the setting has its
          permanent home. See 03_Strategy/People_Graph_and_Lifelong_Identity_
          2026-07-04.md.
        */}
        <div className="sn-tile flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Legacy contact</p>
            <p className="text-xs text-ink/55">
              Choose who inherits your memories. You decide, while living, who your
              archive passes to. Coming soon.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center rounded-full border border-ink/15 bg-white/60 px-3 py-1 text-xs text-ink/50">
            Not set
          </span>
        </div>

        {/*
          ACCOUNT-LEVEL FACE PROFILE (owner-locked 2026-06-26 reversal of
          per-event scoping). OPT-IN, OFF by default. Rendered only when the
          feature flag is ON — DPO sign-off on this consent copy + retention is
          required before the flag is flipped. Never names the model ("Setnayan
          AI"). Two controls: the opt-in toggle, and account-level erasure.
        */}
        {faceProfileFlagOn ? (
          <div className="sn-tile space-y-3">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium text-ink">
                Remember my face across my events
              </p>
              <p className="text-xs text-ink/55">
                When on, Setnayan AI can use a face profile saved to your account
                to recognize you and tag your photos faster — at any Setnayan event
                you attend, not just one. It is only ever used to find{' '}
                <strong>you</strong>, never to identify anyone else, and you can
                turn it off and erase it any time. Off by default. Biometric data
                is handled under the Data Privacy Act (RA 10173).
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(
                [
                  {
                    key: 'true' as const,
                    label: 'On',
                    tagline: 'Reuse my account face profile across my events',
                  },
                  {
                    key: 'false' as const,
                    label: 'Off',
                    tagline: 'Don’t save a face profile to my account',
                  },
                ]
              ).map((opt) => {
                const isActive = (opt.key === 'true') === faceProfileOptedIn;
                return (
                  <form key={opt.key} action={setAccountFaceProfileConsent}>
                    <input type="hidden" name="enabled" value={opt.key} />
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

            {/* Account-level erasure (guardrail #3) — one action wipes the
                account profile and, optionally, the per-event enrollments too. */}
            <details className="space-y-3 rounded-md border border-danger-200/60 bg-danger-50/40 p-3">
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-danger-800">
                <AlertTriangle aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                Forget my face everywhere
              </summary>
              <form action={forgetMyFaceEverywhere} className="mt-3 space-y-3">
                <p className="text-sm text-danger-900">
                  This deletes the face profile saved to your account. Tick the box
                  below to also remove the face data saved for your individual
                  events. This can’t be undone.
                </p>
                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-danger-200/60 bg-cream p-3 text-sm">
                  <input
                    type="checkbox"
                    name="also_event_enrollments"
                    value="1"
                    defaultChecked
                    className="mt-0.5 h-4 w-4 cursor-pointer accent-terracotta"
                  />
                  <span className="text-danger-900">
                    Also remove the face data saved for my individual events
                  </span>
                </label>
                <SubmitButton
                  className="inline-flex items-center gap-2 rounded-md bg-danger-700 px-4 py-2 text-sm font-medium text-cream hover:bg-danger-800 disabled:opacity-70"
                  pendingLabel="Forgetting…"
                >
                  Forget my face everywhere
                </SubmitButton>
              </form>
            </details>
          </div>
        ) : null}

        {/*
          Social Sharing & Featuring Program — live consents the user can
          revoke. A revoke after a post went live still works (revoked_at
          flips); the admin Social Queue then handles the take-down within
          the 24-hour SLA. See migration 20261203000000.
        */}
        <div className="sn-tile space-y-3">
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
                  className="sn-row flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
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
        ) : isAnon ? (
          // Anon-draft: there's no permanent account to delete — the deletion
          // queue is for real accounts. Explain instead of showing a confirm
          // box that just redirects to /signup.
          <p className="sn-row p-4 text-sm text-ink/70">
            Your plan isn&rsquo;t saved to an account yet, so there&rsquo;s nothing to delete. To
            discard it, just close the tab; to keep it,{' '}
            <Link
              href="/signup?next=%2Fdashboard%2Fprofile"
              className="font-medium text-mulberry hover:text-mulberry-600"
            >
              secure your plan
            </Link>
            .
          </p>
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
        {isAnon ? (
          // Anon-draft: signing out destroys their only key to the plan (no
          // password to get back in). Offer "Secure your plan" instead of a
          // one-way "Sign out".
          <Link href="/signup?next=%2Fdashboard%2Fprofile" className="button-primary">
            Secure your plan
          </Link>
        ) : (
          <form action="/auth/sign-out" method="post">
            <SubmitButton pendingLabel="Signing out…" className="button-secondary">
              {tr('cta.sign_out')}
            </SubmitButton>
          </form>
        )}
      </section>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="sn-row space-y-1 p-4">
      <dt className="sn-eye">{label}</dt>
      <dd className={`text-base text-ink ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}

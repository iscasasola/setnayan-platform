import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Download, AlertTriangle, Compass } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchUserEvents } from '@/lib/events';
import { restartTour } from '@/lib/tour-actions';
import {
  softDeleteAccount,
  updatePersonalInfo,
  updatePlannerMode,
  updateThemePreference,
} from './actions';

export const metadata = { title: 'Profile' };

type Props = {
  searchParams: Promise<{ saved?: string; error?: string; tour_restarted?: string }>;
};

type ThemeKey = 'setnayan_default' | 'victorian' | 'classy' | 'ios';

const THEMES: Array<{
  key: ThemeKey;
  label: string;
  tagline: string;
  swatches: { cream: string; ink: string; accent: string };
}> = [
  {
    key: 'setnayan_default',
    label: 'Setnayan Default',
    tagline: 'Warm cream · ink · terracotta',
    swatches: { cream: '#FAF7F2', ink: '#1A1A1A', accent: '#C97B4B' },
  },
  {
    key: 'victorian',
    label: 'Victorian',
    tagline: 'Parchment · burgundy · ornate',
    swatches: { cream: '#F5EBD9', ink: '#2E1A1A', accent: '#8B1E3F' },
  },
  {
    key: 'classy',
    label: 'Classy',
    tagline: 'Warm white · black · champagne',
    swatches: { cream: '#F4F4F2', ink: '#0F0F0F', accent: '#A38560' },
  },
  {
    key: 'ios',
    label: 'iOS',
    tagline: 'System grey · black · blue',
    swatches: { cream: '#F2F2F7', ink: '#000000', accent: '#007AFF' },
  },
];

export default async function ProfilePage({ searchParams }: Props) {
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select(
      'public_id, email, display_name, phone, profile_photo_url, account_type, is_internal, is_team_member, locale, theme_preference, planner_mode, marketing_opt_in, created_at',
    )
    .eq('user_id', user.id)
    .single();

  const activeTheme = (profile?.theme_preference ?? 'setnayan_default') as ThemeKey;
  const activePlannerMode = (profile?.planner_mode ?? 'guided') as 'guided' | 'diy';
  const isAdmin =
    profile?.is_internal ||
    profile?.is_team_member ||
    profile?.account_type === 'admin';

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
        <p
          role="alert"
          className="mb-4 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {decodeURIComponent(search.error)}
        </p>
      ) : null}
      {search.saved ? (
        <p
          role="status"
          className="mb-4 rounded-md border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          Saved.
        </p>
      ) : null}
      {search.tour_restarted ? (
        <p
          role="status"
          className="mb-4 rounded-md border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          Welcome tour restarted — head back to your dashboard to see it again.
        </p>
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
            <Field label="Profile photo URL" htmlFor="profile_photo_url">
              <input
                id="profile_photo_url"
                name="profile_photo_url"
                type="url"
                defaultValue={profile?.profile_photo_url ?? ''}
                placeholder="https://… (file upload ships later)"
                className="input-field"
              />
            </Field>
          </div>
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
          <button type="submit" className="button-primary">
            Save personal info
          </button>
        </form>
      </section>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Row label="Email" value={profile?.email ?? user.email ?? '—'} />
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

      <section className="mt-10 space-y-4">
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
            Theme
          </h2>
          <p className="text-sm text-ink/60">
            Switches the look of every dashboard surface. Your public invitation site stays on
            Setnayan Default — that&rsquo;s a separate branding control on the invitation page.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {THEMES.map((t) => {
            const isActive = t.key === activeTheme;
            return (
              <form key={t.key} action={updateThemePreference}>
                <input type="hidden" name="theme" value={t.key} />
                <button
                  type="submit"
                  disabled={isActive}
                  className={`group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                    isActive
                      ? 'border-terracotta bg-terracotta/5'
                      : 'border-ink/10 bg-cream hover:border-terracotta/50'
                  }`}
                >
                  <span
                    aria-hidden
                    className="flex h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-ink/10"
                    style={{ backgroundColor: t.swatches.cream }}
                  >
                    <span
                      className="h-full w-1/2"
                      style={{ backgroundColor: t.swatches.ink }}
                    />
                    <span
                      className="h-full w-1/2"
                      style={{ backgroundColor: t.swatches.accent }}
                    />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-ink">{t.label}</span>
                      {isActive ? (
                        <span className="rounded-full bg-terracotta/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700">
                          Active
                        </span>
                      ) : null}
                    </span>
                    <span className="truncate text-xs text-ink/55">{t.tagline}</span>
                  </span>
                </button>
              </form>
            );
          })}
        </div>
      </section>

      <section className="mt-10 space-y-4">
        <div className="space-y-1">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Privacy &amp; data (RA 10173)
          </h2>
          <p className="text-sm text-ink/60">
            Export your data or close your account at any time. Setnayan keeps
            soft-deleted accounts for 30 days so an admin can restore by request.
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

        <details className="space-y-3 rounded-xl border border-rose-200/60 bg-rose-50/50 p-4">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-rose-800">
            <AlertTriangle aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Delete my account
          </summary>
          <form action={softDeleteAccount} className="mt-3 space-y-3">
            <p className="text-sm text-rose-900">
              This soft-deletes your account. You won&rsquo;t be able to sign in, and your
              events become invisible to you. Internal admins can restore within 30 days; after
              that, deletion becomes permanent. Type{' '}
              <code className="rounded bg-rose-100 px-1 font-mono text-xs">DELETE</code> below
              to confirm.
            </p>
            <input
              name="confirm"
              required
              autoComplete="off"
              placeholder="Type DELETE to confirm"
              className="input-field bg-cream"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-md bg-rose-700 px-4 py-2 text-sm font-medium text-cream hover:bg-rose-800"
            >
              Delete account
            </button>
          </form>
        </details>
      </section>

      <section className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link href="/help" className="button-secondary">
          Help &amp; support
        </Link>
        <form action={restartTour}>
          <button className="button-secondary inline-flex items-center gap-2" type="submit">
            <Compass aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Restart welcome tour
          </button>
        </form>
        {isAdmin ? (
          <Link href="/admin" className="button-secondary">
            Admin console ↗
          </Link>
        ) : null}
        <form action="/auth/sign-out" method="post">
          <button className="button-secondary" type="submit">
            Sign out
          </button>
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

function Field({
  label,
  htmlFor,
  help,
  children,
}: {
  label: string;
  htmlFor: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block space-y-1">
      <span className="block text-sm font-medium text-ink">{label}</span>
      {children}
      {help ? <span className="block text-xs text-ink/55">{help}</span> : null}
    </label>
  );
}

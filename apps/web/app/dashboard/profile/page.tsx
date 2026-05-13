import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { updatePlannerMode, updateThemePreference } from './actions';

export const metadata = { title: 'Profile' };

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

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select(
      'public_id, email, display_name, phone, account_type, is_internal, is_team_member, locale, theme_preference, planner_mode, created_at',
    )
    .eq('user_id', user.id)
    .single();

  const activeTheme = (profile?.theme_preference ?? 'setnayan_default') as ThemeKey;
  const activePlannerMode = (profile?.planner_mode ?? 'guided') as 'guided' | 'diy';

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 space-y-2">
        <Link
          href="/dashboard"
          className="font-mono text-xs uppercase tracking-[0.2em] text-ink/50 hover:text-terracotta"
        >
          ‹ Back to events
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Profile &amp; settings
        </h1>
        <p className="text-base text-ink/60">
          Minimal V1 — iteration 0025 ships the full 6-tab settings surface.
        </p>
      </header>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Row label="Display name" value={profile?.display_name ?? '—'} />
        <Row label="Email" value={profile?.email ?? user.email ?? '—'} />
        <Row label="Phone" value={profile?.phone ?? '—'} />
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

      <section className="mt-10 space-y-3 rounded-xl border border-ink/10 bg-cream p-6">
        <p className="font-medium text-ink">Coming in iteration 0025 (Profile Settings):</p>
        <ul className="list-inside list-disc space-y-1 text-sm text-ink/60">
          <li>Edit display name, phone, profile photo</li>
          <li>Notification preferences</li>
          <li>URL &amp; slug for your public landing page</li>
          <li>Payment methods</li>
          <li>RA 10173 — data export, soft/hard account delete, face-data revocation</li>
        </ul>
      </section>

      <section className="mt-6 flex flex-col gap-3 sm:flex-row">
        <a
          href="/?preview=1"
          target="_blank"
          rel="noreferrer"
          className="button-secondary"
        >
          Preview public landing ↗
        </a>
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

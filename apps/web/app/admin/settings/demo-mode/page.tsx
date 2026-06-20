/**
 * Admin · Settings · Demo mode toggle page.
 *
 * Sister to the Sentry smoke-test section in /admin/settings — narrow
 * UI for a single owner-action: turn demo mode on or off for the
 * current admin session.
 *
 * Admin-only (the `/admin/*` layout gates the whole tree; this page
 * adds nothing on top — the layout's notFound() for non-admins is the
 * actual enforcement).
 *
 * What this page does:
 *   - Shows current state (ON / OFF) via the cookie.
 *   - Surfaces a single Toggle button that POSTs to
 *     /api/admin/demo-mode/toggle.
 *   - Renders the "last toggled" line from admin_audit_log so the
 *     audit trail is visible without leaving the page.
 *   - Provides quick links into /vendors with demo mode + (when
 *     Agent 1 ships the page) /admin/demo-vendors for cleanup.
 *
 * Reference: PR brief 2026-05-22 evening, CLAUDE.md row 458 follow-on
 * (the open "hide-prices spec lock" question).
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Sparkles, ExternalLink, ShieldCheck } from 'lucide-react';
import { BackButton } from '@/app/_components/back-button';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import {
  DEMO_MODE_CLEANUP_DEADLINE,
  DEMO_MODE_COOKIE_NAME,
  isAdminProfile,
} from '@/lib/demo-mode';
import { FormFlash } from '@/app/_components/forms/form-flash';
import { SubmitButton } from '@/app/_components/submit-button';

export const metadata = { title: 'Demo mode · Admin · Setnayan' };
export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{ toggled?: string }>;
};

export default async function DemoModeAdminPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath('/admin/settings/demo-mode'));

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('users')
    .select('display_name, email, account_type, is_internal, is_team_member')
    .eq('user_id', user.id)
    .maybeSingle();

  // The /admin layout already gates on admin status with notFound(),
  // so this is defense in depth — both branches arrive at the same
  // outcome but the page handles the case where someone reaches it
  // before layout resolution (e.g., direct redirect from the API).
  if (!isAdminProfile(profile)) redirect('/');

  const cookieStore = await cookies();
  const isOn = cookieStore.get(DEMO_MODE_COOKIE_NAME)?.value === '1';

  // Pull the most-recent demo_mode_* row from admin_audit_log so the
  // page reads as a real audit surface, not just a toggle.
  const admin = createAdminClient();
  const { data: auditRows } = await admin
    .from('admin_audit_log')
    .select('action, actor_user_id, created_at, after_json')
    .in('action', ['demo_mode_enabled', 'demo_mode_disabled'])
    .order('created_at', { ascending: false })
    .limit(1);
  const lastToggle = auditRows?.[0] ?? null;

  let lastToggleActorLabel: string | null = null;
  if (lastToggle?.actor_user_id) {
    const { data: actor } = await admin
      .from('users')
      .select('display_name, email')
      .eq('user_id', lastToggle.actor_user_id)
      .maybeSingle();
    lastToggleActorLabel =
      actor?.display_name ?? actor?.email ?? lastToggle.actor_user_id;
  }

  const search = await searchParams;
  const justToggled = search.toggled === 'on' || search.toggled === 'off';
  const cleanupLabel = new Date(DEMO_MODE_CLEANUP_DEADLINE).toLocaleDateString(
    'en-PH',
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Manila',
    },
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <BackButton href="/admin/settings" label="Back to settings" />

      <header className="mb-6 space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          <h1 className="text-2xl font-semibold tracking-tight">Demo mode</h1>
        </div>
        <p className="text-sm text-ink/65">
          When demo mode is on, the marketplace and individual vendor profile
          pages additionally surface vendors marked{' '}
          <code className="rounded bg-ink/5 px-1 py-0.5 font-mono text-[11px]">
            is_demo = TRUE
          </code>{' '}
          and display their pricing publicly. Real vendor visibility (the
          2026-05-16 hide-prices lock) is unchanged. Admins only — non-admin
          sessions silently ignore the flag.
        </p>
      </header>

      {justToggled ? (
        <FormFlash tone="success">
          Demo mode is now <strong>{search.toggled === 'on' ? 'ON' : 'OFF'}</strong>.
          The cookie is set for the current admin session.
        </FormFlash>
      ) : null}

      <section className="space-y-5 rounded-xl border border-ink/10 bg-cream p-5">
        <div className="flex items-center gap-3">
          <span
            className={
              isOn
                ? 'inline-flex items-center gap-1.5 rounded-full bg-success-100 px-3 py-1 text-xs font-medium text-success-800'
                : 'inline-flex items-center gap-1.5 rounded-full bg-ink/10 px-3 py-1 text-xs font-medium text-ink/60'
            }
          >
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${
                isOn ? 'bg-success-600' : 'bg-ink/30'
              }`}
            />
            {isOn ? 'Demo mode is ON' : 'Demo mode is OFF'}
          </span>
        </div>

        <form action="/api/admin/demo-mode/toggle" method="post">
          <input type="hidden" name="state" value={isOn ? 'off' : 'on'} />
          <SubmitButton
            className={
              isOn
                ? 'rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream hover:bg-ink/90'
                : 'rounded-full bg-terracotta px-5 py-2 text-sm font-medium text-cream hover:bg-terracotta/90'
            }
            pendingLabel="Toggling…"
          >
            {isOn ? 'Turn demo mode OFF' : 'Turn demo mode ON'}
          </SubmitButton>
        </form>

        {lastToggle ? (
          <p className="text-xs text-ink/55">
            Last toggled{' '}
            <strong className="text-ink/75">
              {new Date(lastToggle.created_at).toLocaleString('en-PH', {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: 'Asia/Manila',
              })}
            </strong>{' '}
            by{' '}
            <span className="text-ink/75">{lastToggleActorLabel ?? 'admin'}</span>{' '}
            — set to{' '}
            <code className="rounded bg-ink/5 px-1 py-0.5 font-mono text-[11px]">
              {lastToggle.action === 'demo_mode_enabled' ? 'on' : 'off'}
            </code>
          </p>
        ) : (
          <p className="text-xs text-ink/55">
            Demo mode has not been toggled before. The audit log will start
            tracking transitions from the first toggle.
          </p>
        )}
      </section>

      <section className="mt-6 space-y-3 rounded-xl border border-ink/10 bg-cream p-5">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Quick links
        </h2>
        <ul className="space-y-2 text-sm">
          <li>
            <Link
              href="/explore"
              className="inline-flex items-center gap-1.5 text-ink/80 underline-offset-2 hover:underline"
            >
              View /vendors {isOn ? '(demo vendors visible)' : '(without demo)'}
              <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Link>
          </li>
          <li>
            <Link
              href="/admin/demo-vendors"
              className="inline-flex items-center gap-1.5 text-ink/80 underline-offset-2 hover:underline"
            >
              Manage demo vendors (cleanup before {cleanupLabel})
              <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Link>
          </li>
        </ul>
      </section>

      <section className="mt-6 space-y-2 rounded-xl border border-warn-200/60 bg-warn-50/60 p-5 text-sm text-warn-900">
        <div className="flex items-center gap-2">
          <ShieldCheck
            className="h-4 w-4 text-warn-700"
            strokeWidth={1.75}
            aria-hidden
          />
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-warn-700">
            Cleanup deadline
          </h2>
        </div>
        <p>
          Demo vendor records and the demo-mode override are pre-V1 dogfood
          tooling — both must be cleaned out before <strong>{cleanupLabel}</strong>,
          the V1 public launch cutover.
        </p>
      </section>

      <section className="mt-6 rounded-xl border border-ink/10 bg-cream p-5 text-sm text-ink/65">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Shortcut
        </h2>
        <p className="mt-2">
          Append <code className="rounded bg-ink/5 px-1 py-0.5 font-mono text-[11px]">?demo=1</code>{' '}
          to any URL to enable demo mode (admin session required; non-admins are
          silently ignored). <code className="rounded bg-ink/5 px-1 py-0.5 font-mono text-[11px]">?demo=0</code>{' '}
          clears it.
        </p>
      </section>
    </div>
  );
}

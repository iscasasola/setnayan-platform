import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Mail,
  ShieldAlert,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { saveResendConfig, clearResendKey } from './actions';
import { TestResendButton } from './_components/test-resend-button';

// Integration Activation Console — PR1 (email slice).
//
// Lets an admin set the Resend API key + from-address from the app (encrypted,
// DB-first) so transactional email goes live WITHOUT a Vercel redeploy. PR1
// ships email only; social / Recraft / R2 cards follow.

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Integrations · Setnayan HQ' };

export default async function AdminIntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; cleared?: string }>;
}) {
  const { saved, cleared } = await searchParams;

  // Defense-in-depth admin gate (team-member-aware).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    notFound();
  }

  const admin = createAdminClient();
  const [secretRes, settingsRes] = await Promise.all([
    admin
      .from('platform_integration_secrets')
      .select('resend_api_key_enc, last_verified_at')
      .eq('id', 1)
      .maybeSingle(),
    admin
      .from('platform_settings')
      .select('resend_from_address')
      .eq('id', 1)
      .maybeSingle(),
  ]);

  const dbHasKey = Boolean(secretRes.data?.resend_api_key_enc);
  const envHasKey = Boolean(process.env.RESEND_API_KEY);
  const lastVerifiedAt = (secretRes.data?.last_verified_at as string | null) ?? null;
  const fromAddress =
    (settingsRes.data?.resend_from_address as string | null) ??
    process.env.RESEND_FROM_ADDRESS ??
    process.env.RESEND_FROM_EMAIL ??
    '';

  const source = dbHasKey
    ? 'Saved here (database)'
    : envHasKey
      ? 'Environment variable (Vercel)'
      : 'Not configured';

  return (
    <section className="space-y-6">
      <Link
        href="/admin/more"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--m-orange-2)]"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Back to admin
      </Link>

      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <KeyRound aria-hidden className="h-6 w-6" strokeWidth={1.75} /> Integrations
        </h1>
        <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
          Turn integrations on without a redeploy. Keys are stored encrypted; the
          app reads them DB-first and falls back to the Vercel env. PR1 ships
          email — social, Recraft, and R2 cards follow.
        </p>
      </header>

      {saved ? (
        <p
          role="status"
          className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/70 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} /> Saved.
        </p>
      ) : null}
      {cleared ? (
        <p
          role="status"
          className="inline-flex items-center gap-2 rounded-2xl border border-ink/15 bg-cream px-4 py-3 text-sm text-ink/70"
        >
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} /> Key cleared —
          email now falls back to the Vercel env (if set).
        </p>
      ) : null}

      {/* Resend card */}
      <section className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="inline-flex items-center gap-1.5 text-lg font-semibold tracking-tight">
            <Mail aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
            Resend — transactional email
          </h2>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
              dbHasKey || envHasKey
                ? 'bg-emerald-100 text-emerald-900'
                : 'bg-amber-100 text-amber-900'
            }`}
          >
            {dbHasKey || envHasKey ? 'Active' : 'Off'}
          </span>
        </div>

        <dl className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-[140px_1fr]">
          <dt className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">Key source</dt>
          <dd className="text-ink/80">{source}</dd>
          <dt className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">From address</dt>
          <dd className="text-ink/80">{fromAddress || <span className="text-ink/45">— not set —</span>}</dd>
          {lastVerifiedAt ? (
            <>
              <dt className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">Last tested</dt>
              <dd className="text-ink/80">
                {new Date(lastVerifiedAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
              </dd>
            </>
          ) : null}
        </dl>

        <form action={saveResendConfig} className="space-y-3 border-t border-ink/10 pt-4">
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
              {dbHasKey ? 'Replace API key (leave blank to keep current)' : 'Resend API key'}
            </span>
            <input
              type="password"
              name="resend_api_key"
              autoComplete="off"
              placeholder={dbHasKey ? 're_••••••••••••••••' : 're_xxxxxxxxxxxxxxxx'}
              className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-terracotta/50"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
              From address
            </span>
            <input
              type="text"
              name="resend_from_address"
              defaultValue={fromAddress}
              placeholder="Setnayan <noreply@setnayan.com>"
              className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-terracotta/50"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600"
            >
              Save
            </button>
          </div>
        </form>

        <div className="flex flex-wrap items-center gap-3 border-t border-ink/10 pt-4">
          <TestResendButton />
          {dbHasKey ? (
            <form action={clearResendKey}>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/15 bg-cream px-4 py-2 text-sm font-medium text-ink/60 transition-colors hover:border-rose-300 hover:text-rose-700"
              >
                Clear saved key
              </button>
            </form>
          ) : null}
        </div>
      </section>

      <p
        className="inline-flex items-start gap-2 rounded-2xl border border-amber-200/70 bg-amber-50/60 px-4 py-3 text-xs text-amber-900/90"
      >
        <ShieldAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
        <span>
          The API key is encrypted (AES-256-GCM) before storage and never shown
          back. Storing it in the database is a deliberate trade vs env-only — it
          relies on <code>ENCRYPTION_KEY</code> staying set and secret (the same
          key also protects OAuth tokens), so don&rsquo;t rotate it casually.
          NEXT_PUBLIC_* flags and the R2 public host still need a redeploy.
        </span>
      </p>
    </section>
  );
}

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Mail,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { saveResendConfig, clearResendKey, setAiPaywall } from './actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { TestResendButton } from './_components/test-resend-button';
import { SecretCard } from './_components/secret-card';
import { OAuthCard } from './_components/oauth-card';
import { MayaCard } from './_components/maya-card';
import { BuildTimeStatus } from './_components/build-time-status';
import {
  SECRET_INTEGRATIONS,
  OAUTH_INTEGRATIONS,
  SOCIAL_INTEGRATIONS,
  MAYA_INTEGRATION,
} from '@/lib/integrations/registry';
import { getSecretPresenceMap } from '@/lib/integration-config';

import { requireAdmin } from '@/lib/admin/require-admin';
// Integration Activation Console.
//
// Lets an admin turn integrations on WITHOUT a Vercel redeploy: secrets stored
// encrypted (DB-first, env-fallback), config + flags on platform_settings.
// PR1 = email (Resend) + the Setnayan-AI paywall flag. PR2 = a data-driven
// registry of "simple secret" integrations (OpenAI first; more follow).

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Integrations · Setnayan HQ' };

export default async function AdminIntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; cleared?: string; error?: string }>;
}) {
  await requireAdmin();
  const { saved, cleared, error } = await searchParams;

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
  const [secretRes, settingsRes, secretPresence] = await Promise.all([
    admin
      .from('platform_integration_secrets')
      .select('resend_api_key_enc, last_verified_at')
      .eq('id', 1)
      .maybeSingle(),
    // '*' on platform_settings (WORLD-READABLE — no secret here) covers the
    // Resend from-address + AI-paywall flag + every OAuth config column read
    // dynamically below. (Secrets stay in platform_integration_secrets.)
    admin.from('platform_settings').select('*').eq('id', 1).maybeSingle(),
    // Registry secret presence as a { [column]: boolean } map — the ciphertext
    // never enters this component's render tree (defense-in-depth: a future edit
    // can't accidentally pass a secrets object to a client prop / log).
    getSecretPresenceMap(),
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

  // Setnayan AI paywall — tri-state (NULL = defer to env). Effective value is
  // DB-first / env-fallback, mirroring resolveSetnayanAiPaywallEnabled().
  const paywallDb =
    (settingsRes.data?.setnayan_ai_paywall_enabled as boolean | null | undefined) ??
    null;
  const paywallEnvOn = process.env.SETNAYAN_AI_PAYWALL_ENABLED === 'true';
  const paywallEffectiveOn =
    typeof paywallDb === 'boolean' ? paywallDb : paywallEnvOn;
  const paywallMode = paywallDb === true ? 'on' : paywallDb === false ? 'off' : 'env';
  const paywallSource =
    paywallDb === null
      ? `Environment default (env says ${paywallEnvOn ? 'ON' : 'OFF'})`
      : 'Set here (database)';

  // platform_settings row (world-readable, no secrets) — read once for the OAuth
  // config field pre-fill below.
  const oauthSettings = settingsRes.data as Record<string, unknown> | null;

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
          app reads them DB-first and falls back to the Vercel env. Live now:
          email (Resend), the Setnayan&nbsp;AI paywall, and OpenAI moderation;
          more integrations follow.
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
      {error === 'invalid_config' ? (
        <p
          role="alert"
          className="inline-flex items-center gap-2 rounded-2xl border border-rose-300/70 bg-rose-50 px-4 py-3 text-sm text-rose-900"
        >
          <ShieldAlert aria-hidden className="h-4 w-4" strokeWidth={1.75} /> A field had an
          invalid value (redirect URIs must be http(s) URLs; IDs must be numeric) — nothing
          was saved. Check the values and try again.
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
            <SubmitButton
              pendingLabel="Saving…"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600"
            >
              Save
            </SubmitButton>
          </div>
        </form>

        <div className="flex flex-wrap items-center gap-3 border-t border-ink/10 pt-4">
          <TestResendButton />
          {dbHasKey ? (
            <form action={clearResendKey}>
              <SubmitButton
                pendingLabel="Clearing…"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/15 bg-cream px-4 py-2 text-sm font-medium text-ink/60 transition-colors hover:border-rose-300 hover:text-rose-700"
              >
                Clear saved key
              </SubmitButton>
            </form>
          ) : null}
        </div>
      </section>

      {/* Setnayan AI paywall card */}
      <section className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="inline-flex items-center gap-1.5 text-lg font-semibold tracking-tight">
            <Sparkles aria-hidden className="h-5 w-5 text-mulberry" strokeWidth={1.75} />
            Setnayan AI — paywall
          </h2>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
              paywallEffectiveOn
                ? 'bg-emerald-100 text-emerald-900'
                : 'bg-ink/10 text-ink/70'
            }`}
          >
            {paywallEffectiveOn ? 'On — couples pay to unlock' : 'Off — free for everyone'}
          </span>
        </div>

        <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
          When ON, Setnayan AI (the ranked match, % fit, proximity sort, deadlines)
          requires a purchased per-event unlock. When OFF, the full intelligence is
          free during launch. Takes effect on the next request — no redeploy.
        </p>

        <dl className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-[140px_1fr]">
          <dt className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">Effective</dt>
          <dd className="text-ink/80">{paywallEffectiveOn ? 'On' : 'Off'}</dd>
          <dt className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">Source</dt>
          <dd className="text-ink/80">{paywallSource}</dd>
        </dl>

        <form action={setAiPaywall} className="space-y-3 border-t border-ink/10 pt-4">
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
              Paywall
            </span>
            <select
              name="mode"
              defaultValue={paywallMode}
              className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-terracotta/50"
            >
              <option value="env">
                Use environment default (env says {paywallEnvOn ? 'ON' : 'OFF'})
              </option>
              <option value="on">On — require a purchase to unlock</option>
              <option value="off">Off — free for everyone</option>
            </select>
          </label>
          <SubmitButton
            pendingLabel="Saving…"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600"
          >
            Save
          </SubmitButton>
        </form>
      </section>

      {/* Registry-driven "simple secret" integrations (PR2) */}
      {SECRET_INTEGRATIONS.length > 0 ? (
        <section className="space-y-4">
          {SECRET_INTEGRATIONS.map((intg) => (
            <SecretCard
              key={intg.id}
              integration={intg}
              dbHasKey={secretPresence[intg.secretColumn] ?? false}
              envHasKey={Boolean(process.env[intg.envFallback])}
            />
          ))}
        </section>
      ) : null}

      {/* OAuth client integrations (PR3b) — secret + config fields, no redeploy */}
      {OAUTH_INTEGRATIONS.length > 0 ? (
        <section className="space-y-4">
          {OAUTH_INTEGRATIONS.map((intg) => {
            const fields = intg.configFields.map((field) => {
              const dbVal = ((oauthSettings?.[field.column] as string | null) ?? '').trim();
              const envVal = process.env[field.env] ?? '';
              return {
                column: field.column,
                label: field.label,
                placeholder: field.placeholder,
                value: dbVal || envVal,
                fromEnv: !dbVal && Boolean(envVal),
              };
            });
            return (
              <OAuthCard
                key={intg.id}
                integration={intg}
                secretInDb={secretPresence[intg.secretColumn] ?? false}
                secretInEnv={Boolean(process.env[intg.secretEnv])}
                fields={fields}
              />
            );
          })}
        </section>
      ) : null}

      {/* Social-publish credentials (PR4a) — Meta is the LIVE auto-publish path */}
      {SOCIAL_INTEGRATIONS.length > 0 ? (
        <section className="space-y-4">
          {SOCIAL_INTEGRATIONS.map((intg) => {
            const fields = intg.configFields.map((field) => {
              const dbVal = ((oauthSettings?.[field.column] as string | null) ?? '').trim();
              const envVal = process.env[field.env] ?? '';
              return {
                column: field.column,
                label: field.label,
                placeholder: field.placeholder,
                value: dbVal || envVal,
                fromEnv: !dbVal && Boolean(envVal),
              };
            });
            return (
              <OAuthCard
                key={intg.id}
                integration={intg}
                secretInDb={secretPresence[intg.secretColumn] ?? false}
                secretInEnv={Boolean(process.env[intg.secretEnv])}
                fields={fields}
              />
            );
          })}
        </section>
      ) : null}

      {/* Payments (PR4c) — Maya: 2-secret bespoke card */}
      <section className="space-y-4">
        <MayaCard
          publicInDb={secretPresence[MAYA_INTEGRATION.publicKeyColumn] ?? false}
          secretInDb={secretPresence[MAYA_INTEGRATION.secretKeyColumn] ?? false}
          publicInEnv={Boolean(process.env[MAYA_INTEGRATION.publicKeyEnv])}
          secretInEnv={Boolean(process.env[MAYA_INTEGRATION.secretKeyEnv])}
          endpointValue={
            ((oauthSettings?.[MAYA_INTEGRATION.endpointColumn] as string | null) ?? '').trim() ||
            process.env[MAYA_INTEGRATION.endpointEnv] ||
            ''
          }
          endpointFromEnv={
            !((oauthSettings?.[MAYA_INTEGRATION.endpointColumn] as string | null) ?? '').trim() &&
            Boolean(process.env[MAYA_INTEGRATION.endpointEnv])
          }
          statusApproved={process.env.NEXT_PUBLIC_MAYA_STATUS === 'APPROVED'}
        />
      </section>

      {/* Build-time & env-only (PR4d) — read-only; these can't be DB-flipped */}
      <section className="space-y-4">
        <BuildTimeStatus
          items={[
            {
              label: 'R2 media public host (R2_PUBLIC_URL)',
              present: Boolean(process.env.R2_PUBLIC_URL),
              value: process.env.R2_PUBLIC_URL ?? '',
              note: 'Consumed at build time by next/image remotePatterns — changing the host needs a redeploy.',
            },
            {
              label: 'VAPID public key (NEXT_PUBLIC_VAPID_PUBLIC_KEY)',
              present: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
              note: 'Web-push — inlined into the client bundle at build time + paired with the private key.',
            },
            {
              label: 'VAPID private key (VAPID_PRIVATE_KEY)',
              present: Boolean(process.env.VAPID_PRIVATE_KEY),
            },
            {
              label: 'VAPID subject (VAPID_SUBJECT)',
              present: Boolean(process.env.VAPID_SUBJECT),
              value: process.env.VAPID_SUBJECT ?? '(default mailto:hello@setnayan.com)',
            },
            {
              label: 'Encryption key (ENCRYPTION_KEY)',
              present: Boolean(process.env.ENCRYPTION_KEY),
              note: 'Decrypts every stored integration secret + OAuth tokens — never rotate casually.',
            },
            {
              label: 'Supabase service-role key (SUPABASE_SERVICE_ROLE_KEY)',
              present: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
              note: 'Bootstrap — the DB read itself depends on it.',
            },
            {
              label: 'R2 access key id (R2_ACCESS_KEY_ID)',
              present: Boolean(process.env.R2_ACCESS_KEY_ID),
            },
            {
              label: 'R2 secret access key (R2_SECRET_ACCESS_KEY)',
              present: Boolean(process.env.R2_SECRET_ACCESS_KEY),
            },
          ]}
        />
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

import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Rocket, ShieldAlert, ShieldCheck } from 'lucide-react';
import { requireAdmin } from '@/lib/admin/require-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptionKeyStatus } from '@/lib/encryption';
import { getSecretPresenceMap } from '@/lib/integration-config';
import {
  SECRET_REGISTRY,
  GROUP_ORDER,
  GROUP_LABEL,
  consoleColumnsForSecret,
  type SecretDef,
} from '@/lib/secrets/rotation-registry';
import {
  computeStatus,
  formatAge,
  isAlarming,
  resolveLastRotated,
  type SecretStatus,
} from '@/lib/secrets/status';
import { envUpdatedAtMap, listProjectEnvMeta, vercelEnvConfigured } from '@/lib/vercel-env';
import { SubmitButton } from '@/app/_components/submit-button';
import { SecretRow } from './_components/secret-row';
import { EncryptionKeyCard } from './_components/encryption-key-card';
import { redeployProduction } from './actions';

// Secrets & Rotation board.
//
// One place to answer: what secrets does Setnayan hold, where does each live,
// how old is it, and how do I replace it — without opening Vercel. Vercel-stored
// secrets are written through the REST API (write-only: the value goes out, and
// the API can never hand it back); DB-stored secrets are pasted inline and saved
// through the Integrations console's own write layer (lib/integrations/write.ts
// — one encrypt+upsert implementation, no second copy); the rest carry a runbook
// plus a "Mark rotated" stamp.
//
// The owner rule this page answers to (2026-07-25): ANY key, ANY secret →
// /admin/secrets, always. The console keeps the feature setup around a key
// (redirect URIs, Page/IG ids, Verify buttons) and each row links to it.
//
// NOTHING on this page reads a secret VALUE. The Vercel env call returns
// metadata with values stripped; the DB read is a boolean presence map; the
// ENCRYPTION_KEY card shows two booleans. That is the whole contract — a future
// edit that adds "just show the first 4 characters" breaks it.

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Secrets & Rotation HQ' };

const ENCRYPTION_KEY_ID = 'encryption_key';

export default async function AdminSecretsPage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    /** 'db' when the save went to Setnayan's own secrets table, not Vercel. */
    store?: string;
    /** How many boxes a db-paste save wrote — a COUNT, never a value. */
    keys?: string;
    cleared?: string;
    marked?: string;
    redeploy?: string;
    deploying?: string;
    error?: string;
    code?: string;
  }>;
}) {
  await requireAdmin();
  const { saved, store, keys, cleared, marked, redeploy, deploying, error, code } =
    await searchParams;
  const savedToDb = Boolean(saved) && store === 'db';
  const savedKeyCount = keys === '2' ? 2 : 1;

  const now = new Date();
  const vercelWritable = vercelEnvConfigured();

  const admin = createAdminClient();
  const [rotationRes, envRes, registryPresence, resendRes] = await Promise.all([
    admin.from('platform_secret_rotations').select('secret_id, last_rotated_at, note'),
    // Metadata only — listProjectEnvMeta() strips every value before returning.
    vercelWritable
      ? listProjectEnvMeta()
      : Promise.resolve({ ok: false as const, status: 0, error: 'vercel_not_configured' }),
    // { [column]: boolean } — presence only; the ciphertext never enters this
    // render tree (same defence the Integrations console uses).
    getSecretPresenceMap(),
    // Resend predates the integrations registry (bespoke PR1 card), so its
    // column is absent from ALL_SECRET_COLUMNS and therefore from the map
    // above. Read it explicitly — otherwise the single most-used secret on the
    // board would always read "Not configured". Presence boolean only.
    admin
      .from('platform_integration_secrets')
      .select('resend_api_key_enc')
      .eq('id', 1)
      .maybeSingle(),
  ]);

  const consolePresence: Record<string, boolean> = {
    ...registryPresence,
    resend_api_key_enc: Boolean(resendRes.data?.resend_api_key_enc),
  };

  const rotationBySecretId = new Map<string, { at: Date; note: string | null }>();
  for (const row of (rotationRes.data ?? []) as {
    secret_id: string;
    last_rotated_at: string;
    note: string | null;
  }[]) {
    const at = new Date(row.last_rotated_at);
    if (!Number.isNaN(at.getTime())) {
      rotationBySecretId.set(row.secret_id, { at, note: row.note });
    }
  }

  const envUpdatedAt = envRes.ok ? envUpdatedAtMap(envRes.data) : {};

  const envKeys = new Set(envRes.ok ? envRes.data.map((m) => m.key) : []);

  /**
   * "Is a value set?" — booleans only, resolved per store. Vercel rows read the
   * env LISTING (keys, not values); console rows read the presence map; stores
   * we can't see from here (GitHub Actions) honestly report null.
   */
  function isConfigured(def: SecretDef): boolean | null {
    if (def.store === 'db') {
      // Only columns we actually read above can answer; anything else is
      // honestly "unknown" rather than a confident, wrong "not configured".
      const columns = consoleColumnsForSecret(def.id).filter(
        (c) => c in consolePresence,
      );
      if (columns.length === 0) return null;
      return columns.some((c) => consolePresence[c]);
    }
    if (def.store === 'vercel') {
      if (!envRes.ok) return null;
      return def.envVars.some((v) => envKeys.has(v));
    }
    return null;
  }

  type Row = {
    def: SecretDef;
    status: SecretStatus;
    ageLabel: string;
    configured: boolean | null;
  };
  const rows: Row[] = SECRET_REGISTRY.map((def) => {
    const lastRotatedAt = resolveLastRotated(
      def,
      rotationBySecretId.get(def.id)?.at ?? null,
      envUpdatedAt,
    );
    return {
      def,
      status: computeStatus(def, lastRotatedAt, now),
      ageLabel: formatAge(lastRotatedAt, now),
      configured: isConfigured(def),
    };
  });

  const alarming = rows.filter((r) => isAlarming(r.status));
  const dueSoon = rows.filter((r) => r.status === 'due-soon');
  const encryptionRow = rows.find((r) => r.def.id === ENCRYPTION_KEY_ID);
  const keyStatus = encryptionKeyStatus();

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
          <ShieldCheck aria-hidden className="h-6 w-6" strokeWidth={1.75} /> Secrets &amp;
          Rotation
        </h1>
        <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
          Every key Setnayan holds — where it lives, how old it is, and how to
          replace it. Values are write-only: you can set a new one here, but
          nothing on this page can ever show you the current one.
        </p>
      </header>

      {/* ── Alarm banner ─────────────────────────────────────────────────── */}
      {alarming.length > 0 ? (
        <div
          role="alert"
          className="space-y-2 rounded-2xl border border-rose-300/70 bg-rose-50 px-4 py-3 text-sm text-rose-900"
        >
          <p className="inline-flex items-center gap-2 font-medium">
            <ShieldAlert aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            {alarming.length} secret{alarming.length === 1 ? '' : 's'} need
            {alarming.length === 1 ? 's' : ''} attention
          </p>
          <ul className="list-disc space-y-0.5 pl-5 text-xs">
            {alarming.map((r) => (
              <li key={r.def.id}>
                <a href={`#${r.def.id}`} className="underline underline-offset-2">
                  {r.def.label}
                </a>{' '}
                — {r.status === 'overdue' ? 'past its rotation window' : 'never recorded'}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p
          role="status"
          className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/70 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} /> Every
          scheduled secret is inside its rotation window.
        </p>
      )}

      {dueSoon.length > 0 ? (
        <p className="rounded-2xl border border-amber-200/70 bg-amber-50/60 px-4 py-3 text-xs text-amber-900/90">
          Coming up: {dueSoon.map((r) => r.def.label).join(' · ')}.
        </p>
      ) : null}

      {/* ── Save / error flashes ─────────────────────────────────────────── */}
      {saved ? (
        <p
          role="status"
          className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/70 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          {savedToDb
            ? savedKeyCount === 2
              ? 'Saved — both keys are stored. Live on the very next request; no redeploy needed.'
              : 'Saved — live on the very next request; no redeploy needed. Any box you left blank kept the value it already had.'
            : `Saved to Vercel.${redeploy ? ' Now click “Redeploy production” to apply it.' : ''}`}
        </p>
      ) : null}
      {cleared ? (
        <p
          role="status"
          className="inline-flex items-center gap-2 rounded-2xl border border-ink/15 bg-white/70 px-4 py-3 text-sm text-ink/70"
        >
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} /> Removed
          from Setnayan&rsquo;s database. Paste a new value whenever you&rsquo;re
          ready.
        </p>
      ) : null}
      {marked ? (
        <p
          role="status"
          className="inline-flex items-center gap-2 rounded-2xl border border-ink/15 bg-white/70 px-4 py-3 text-sm text-ink/70"
        >
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} /> Rotation
          recorded — the clock is reset.
        </p>
      ) : null}
      {deploying ? (
        <p
          role="status"
          className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/70 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          <Rocket aria-hidden className="h-4 w-4" strokeWidth={1.75} /> Production
          deployment started. It takes a few minutes; watch it in Vercel.
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="inline-flex items-start gap-2 rounded-2xl border border-rose-300/70 bg-rose-50 px-4 py-3 text-sm text-rose-900"
        >
          <ShieldAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span>
            {error === 'empty'
              ? 'Nothing was entered — no change was made.'
              : error === 'redeploy'
                ? 'Couldn’t trigger a deploy — push any commit, or redeploy from the Vercel dashboard.'
                : error === 'db'
                  ? 'Setnayan couldn’t store that value, so nothing changed — the old one is still in place. Try again; if it keeps failing, check that ENCRYPTION_KEY is set in this environment.'
                  : 'Vercel rejected the write. On a two-part key (R2, TURN) the first part may already have been saved — re-enter BOTH values and save again before redeploying.'}
            {code ? <span className="font-mono text-xs"> ({code})</span> : null}
          </span>
        </p>
      ) : null}

      {/* ── Redeploy control ─────────────────────────────────────────────── */}
      <section className="space-y-3 sn-tile p-5">
        <h2 className="text-lg font-semibold tracking-tight">Apply pending changes</h2>
        <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
          A secret saved to the Vercel environment only reaches the running app on
          the next deployment. Rows marked &ldquo;In-app DB&rdquo; are stored in
          Setnayan&rsquo;s own database, take effect on the very next request, and
          need none of this.
        </p>
        <form action={redeployProduction}>
          <SubmitButton
            pendingLabel="Starting deploy…"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600"
          >
            Redeploy production
          </SubmitButton>
        </form>
        {!vercelWritable ? (
          <p className="text-xs text-amber-900/90">
            VERCEL_API_TOKEN / VERCEL_PROJECT_ID aren&rsquo;t set in this
            environment, so in-app editing and redeploys are unavailable here.
          </p>
        ) : null}
      </section>

      {/* ── ENCRYPTION_KEY — its own card, above the grouped list ────────── */}
      {encryptionRow ? (
        <EncryptionKeyCard
          def={encryptionRow.def}
          primarySet={keyStatus.primarySet}
          previousSet={keyStatus.previousSet}
        />
      ) : null}

      {/* ── Grouped registry ─────────────────────────────────────────────── */}
      {GROUP_ORDER.map((group) => {
        const groupRows = rows.filter(
          (r) => r.def.group === group && r.def.id !== ENCRYPTION_KEY_ID,
        );
        if (groupRows.length === 0) return null;
        return (
          <section key={group} className="space-y-3">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
              {GROUP_LABEL[group]}
            </h2>
            <div className="space-y-2">
              {groupRows.map((r) => (
                <SecretRow
                  key={r.def.id}
                  def={r.def}
                  status={r.status}
                  ageLabel={r.ageLabel}
                  vercelWritable={vercelWritable}
                  configured={r.configured}
                />
              ))}
            </div>
          </section>
        );
      })}

      <p className="inline-flex items-start gap-2 rounded-2xl border border-amber-200/70 bg-amber-50/60 px-4 py-3 text-xs text-amber-900/90">
        <ShieldAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
        <span>
          Every input here is write-only. A value you paste goes straight to
          Vercel&rsquo;s encrypted store (or to Setnayan&rsquo;s encrypted
          secrets table) and is never read back, logged, or shown again — so if
          you lose a value, mint a new one at the provider rather than looking
          for it here.
        </span>
      </p>
    </section>
  );
}

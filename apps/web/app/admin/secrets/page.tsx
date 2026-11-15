import { PageMasthead } from '@/app/_components/page-masthead';
import { InfoTip } from '@/app/_components/info-tip';
import { TemplateFail, TemplateRow, TemplateRows, TemplateSection, TEMPLATE_SUBLINE } from '@/app/_components/template-rows';
import { AvatarScreen, ConfirmLines } from '../_components/avatar-screen';
import { ConfirmButton } from '../_components/avatar-confirm';
import { AppleSecretReminder } from '../_apple-secret-reminder';
import { requireAdmin } from '@/lib/admin/require-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptionKeyStatus } from '@/lib/encryption';
import { getSecretPresenceMapMeasured } from '@/lib/integration-config';
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
export const metadata = { title: 'Secrets & rotation · Admin' };

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
  const [rotationRes, envRes, presence, resendRes] = await Promise.all([
    admin.from('platform_secret_rotations').select('secret_id, last_rotated_at, note'),
    // Metadata only — listProjectEnvMeta() strips every value before returning.
    vercelWritable
      ? listProjectEnvMeta()
      : Promise.resolve({ ok: false as const, status: 0, error: 'vercel_not_configured' }),
    // { [column]: boolean } — presence only; the ciphertext never enters this
    // render tree (same defence the Integrations console uses).
    getSecretPresenceMapMeasured(),
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

  /* 🚨 A REFUSED READ SAID EVERY SECRET WAS UNSET AND NEVER ROTATED (admin
     audit 2026-09-30, row 35). Presence that couldn't be read now answers
     "Unknown from here" (an empty map ⇒ isConfigured → null) instead of a
     confident "Not configured"; rotation dates that couldn't be read replace
     the alarm/all-clear banner with a notice, because "never recorded" is a
     claim about the log and the log was never seen. */
  const presenceUnread = presence.readFailed || Boolean(resendRes.error);
  const rotationsUnread = Boolean(rotationRes.error);
  const consolePresence: Record<string, boolean> = presenceUnread
    ? {}
    : {
        ...presence.map,
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

  const flash: { tone: 'ok' | 'fail'; words: string } | null = error
    ? {
        tone: 'fail',
        words:
          (error === 'empty'
            ? 'Nothing was entered — no change was made.'
            : error === 'redeploy'
              ? 'Couldn’t trigger a deploy — push any commit, or redeploy from the Vercel dashboard.'
              : error === 'db'
                ? 'Setnayan couldn’t store that value, so nothing changed — the old one is still in place. Try again; if it keeps failing, check that ENCRYPTION_KEY is set in this environment.'
                : 'Vercel rejected the write. On a two-part key (R2, TURN) the first part may already have been saved — re-enter BOTH values and save again before redeploying.') +
          (code ? ` (${code})` : ''),
      }
    : saved
      ? {
          tone: 'ok',
          words: savedToDb
            ? savedKeyCount === 2
              ? 'Saved — both keys are stored. Live on the very next request; no redeploy needed.'
              : 'Saved — live on the very next request; no redeploy needed. Any box you left blank kept the value it already had.'
            : `Saved to Vercel.${redeploy ? ' Now press “Redeploy production” to apply it.' : ''}`,
        }
      : cleared
        ? { tone: 'ok', words: 'Removed from Setnayan’s database. Paste a new value whenever you’re ready.' }
        : marked
          ? { tone: 'ok', words: 'Rotation recorded — the clock is reset.' }
          : deploying
            ? { tone: 'ok', words: 'Production deployment started. It takes a few minutes; watch it in Vercel.' }
            : null;

  return (
    <AvatarScreen data="secrets">
      {/* The page starts at its content. ⚖ The sentence survives inside the ⓘ: values here are WRITE-ONLY. Somebody
          hunting for a key they already hold needs to be told this screen can never show it to them, rather than
          concluding the page is broken. */}
      <PageMasthead title="Secrets & Rotation" />
      <p className={`flex min-h-11 items-center ${TEMPLATE_SUBLINE}`}>
        <InfoTip label="Write-only" align="start" labelClassName="text-[14px] font-semibold text-ink">
          Every key Setnayan holds — where it lives, how old it is, and how to replace it. Values are write-only: you can
          set a new one here, but nothing on this page can ever show you the current one. A value you paste goes
          straight to Vercel’s encrypted store (or to Setnayan’s encrypted secrets table) and is never read back, logged,
          or shown again — so if you lose a value, mint a new one at the provider rather than looking for it here.
        </InfoTip>
      </p>

      {/* ── Alarm line ───────────────────────────────────────────────────── */}
      {rotationsUnread ? (
        <TemplateFail retryHref="/admin/secrets" data="rotations-unread">
          Couldn&rsquo;t load this — refresh to try again. The rotation dates below are not known, so no secret is shown
          as overdue or as fine.
        </TemplateFail>
      ) : alarming.length > 0 ? (
        <div role="alert" data-secrets-alarm="" className="py-2 text-[14px] text-[rgb(var(--color-danger))]">
          <b>
            {alarming.length} secret{alarming.length === 1 ? '' : 's'} need{alarming.length === 1 ? 's' : ''} attention
          </b>{' '}
          ·{' '}
          {alarming.map((r, i) => (
            <span key={r.def.id}>
              {i > 0 ? ' · ' : ''}
              <a href={`#${r.def.id}`} className="underline underline-offset-2">
                {r.def.label}
              </a>{' '}
              — {r.status === 'overdue' ? 'past its rotation window' : 'never recorded'}
            </span>
          ))}
        </div>
      ) : (
        <p role="status" className="py-2 text-[14px] text-[rgb(var(--color-ok))]">
          Every scheduled secret is inside its rotation window.
        </p>
      )}

      {dueSoon.length > 0 && !rotationsUnread ? (
        <p className="py-1 text-[14px]" style={{ color: 'rgb(var(--color-warn))' }}>
          Coming up: {dueSoon.map((r) => r.def.label).join(' · ')}.
        </p>
      ) : null}

      {/* ── Save / error flashes ─────────────────────────────────────────── */}
      {flash ? (
        <p
          role={flash.tone === 'fail' ? 'alert' : 'status'}
          className="py-2 text-[14px]"
          style={{ color: flash.tone === 'fail' ? 'rgb(var(--color-danger))' : 'rgb(var(--color-ok))' }}
        >
          {flash.words}
        </p>
      ) : null}

      {/* ── Redeploy control ─────────────────────────────────────────────── */}
      <TemplateSection
        first
        label="Apply pending changes"
        tip="A secret saved to the Vercel environment only reaches the running app on the next deployment. Rows marked “In-app DB” are stored in Setnayan’s own database, take effect on the very next request, and need none of this."
      >
        <div className="flex flex-wrap items-center gap-2 py-2">
          <ConfirmButton
            action={redeployProduction}
            tone="warn"
            icon="rocket"
            label="Redeploy production"
            main
            title="Redeploy production"
            confirmLabel="Redeploy"
            body={
              <ConfirmLines
                what={['A production deployment starts — a few minutes; watch it in Vercel', 'Every secret saved to Vercel since the last deploy reaches the running app']}
                not={['In-app DB rows need none of this']}
                who="Every visitor gets the new build"
              />
            }
            data="redeploy"
          />
        </div>
        {!vercelWritable ? (
          <p className="text-[13px]" style={{ color: 'rgb(var(--color-warn))' }}>
            VERCEL_API_TOKEN / VERCEL_PROJECT_ID aren&rsquo;t set in this environment, so in-app editing and redeploys
            are unavailable here.
          </p>
        ) : null}
      </TemplateSection>

      {/* ── Waiting: the dated Apple renewal, from Dec 8 (renders nothing before) ── */}
      <AppleSecretReminder />

      {/* ── Integrations: the feature setup around a key ─────────────────── */}
      <TemplateSection label="Integrations" tip="The console keeps the feature setup around a key — redirect URIs, Page/IG ids, the AI paywall card, Verify buttons. Every key is still pasted here or there through the same encrypted write.">
        <TemplateRows>
          <TemplateRow title="Integrations" line="Email · AI paywall · OpenAI · OAuth clients · Meta · TikTok · Maya · CSAM" href="/admin/integrations" data="integrations" />
          <TemplateRow title="Live Watch channels" line="The Setnayan-owned YouTube channel pool and its Google grants" href="/admin/live-studio-channels" data="live-studio-channels" />
        </TemplateRows>
      </TemplateSection>

      {/* ── ENCRYPTION_KEY — its own fold, above the grouped list ───────── */}
      {encryptionRow ? (
        <TemplateSection label="ENCRYPTION_KEY">
          <TemplateRows>
            <EncryptionKeyCard def={encryptionRow.def} primarySet={keyStatus.primarySet} previousSet={keyStatus.previousSet} />
          </TemplateRows>
        </TemplateSection>
      ) : null}

      {/* ── Grouped registry ─────────────────────────────────────────────── */}
      {GROUP_ORDER.map((group) => {
        const groupRows = rows.filter((r) => r.def.group === group && r.def.id !== ENCRYPTION_KEY_ID);
        if (groupRows.length === 0) return null;
        return (
          <TemplateSection key={group} label={GROUP_LABEL[group]} right={String(groupRows.length)}>
            <TemplateRows>
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
            </TemplateRows>
          </TemplateSection>
        );
      })}
    </AvatarScreen>
  );
}

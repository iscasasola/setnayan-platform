import Link from 'next/link';
import { logQueryError } from '@/lib/supabase/error-detect';
import { redirect } from 'next/navigation';
import { ArrowLeft, Copy, Key, Plus, ShieldOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { userHasApiAccessGrant } from '@/lib/enterprise-vendor-gate';
import {
  API_SCOPES,
  DEFAULT_SCOPES,
  SCOPE_COPY,
  type ApiKeyRow,
  type ApiScope,
} from '@/lib/api-keys';
import { SubmitButton } from '@/app/_components/submit-button';
import { FormFlash } from '@/app/_components/forms/form-flash';
import { createApiKey, revokeApiKey } from './actions';
import { PageMasthead } from '@/app/_components/page-masthead';
import { InfoTip } from '@/app/_components/info-tip';
import { Badge } from '@/app/_components/badge';
import { ActionButton } from '@/components/action-button';
import { formatLongDate } from '@/lib/format-date';

export const metadata = { title: 'API keys' };

type Props = {
  searchParams: Promise<{ just_created?: string; error?: string }>;
};

export default async function ApiKeysPage({ searchParams }: Props) {
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error: dataError } = await supabase
    .from('api_keys')
    .select(
      'api_key_id,public_id,user_id,name,key_prefix,scopes,last_used_at,revoked_at,expires_at,created_at',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  // ⚠ the keys this person created. Refused, the list reads as empty and they may
  // ⚠ create a duplicate of one that already exists.
  if (dataError) {
    logQueryError('ApiKeysPage.data', dataError, {}, 'graceful_degrade');
  }
  const keys = (data ?? []) as ApiKeyRow[];

  // The /api/v1 SDK requires an explicit API-access grant on an active Custom
  // vendor plan (owner 2026-07-11) — only that vendor owner may mint keys
  // (enforced in the action + on every request). Everyone else sees an upsell.
  const hasApiAccess = await userHasApiAccessGrant(createAdminClient(), user.id);

  const justCreated = search.just_created ?? null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-4">
        <ActionButton tone="neutral" icon={<ArrowLeft aria-hidden />} label="Back to profile" href="/dashboard/profile" />
      </div>

      <PageMasthead
        title="API keys"
      />

      {search.error ? (
        <FormFlash tone="error">
          {decodeURIComponent(search.error)}
        </FormFlash>
      ) : null}

      {justCreated ? (
        <section className="mb-6 space-y-3 border-l-4 border-[rgb(var(--color-ok))] py-2 pl-4">
          <div className="space-y-1">
            <InfoTip label="Save this key now" labelAs="p" labelClassName="text-xs font-semibold uppercase tracking-[0.06em] text-[rgb(var(--color-ok))]">
              This is the only time we&rsquo;ll show the full value. Store it in your secrets manager — if you lose it,
              revoke and create a new one.
            </InfoTip>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-y border-ink/10 py-3">
            <code className="flex-1 break-all font-mono text-sm text-ink">{justCreated}</code>
            {/* Copy button is intentionally a noscript-friendly visual hint;
                browsers without JS would still see the key text. */}
            <span
              aria-hidden
              className="inline-flex items-center gap-1 text-xs font-semibold text-ink/70"
            >
              <Copy className="h-4 w-4" strokeWidth={1.75} />
              Select all + copy
            </span>
          </div>
        </section>
      ) : null}

      {hasApiAccess ? (
      <section className="mb-8 space-y-4">
        <h2 className="sn-sec">Create a key</h2>
        <form action={createApiKey} className="space-y-4">
          <label className="block space-y-1">
            <span className="block text-xs font-medium text-ink">Key name</span>
            <input
              autoComplete="off"
              name="name"
              required
              maxLength={80}
              placeholder="e.g. Personal scripts, Notion integration"
              className="input-field"
            />
          </label>

          <fieldset className="space-y-2">
            <legend className="sr-only">Scopes</legend>
            <InfoTip label="Scopes" labelAs="span" labelClassName="text-xs font-medium text-ink">
              Choose what this key can read. Defaults to the smallest useful set — opt in only as needed.
            </InfoTip>
            <div className="divide-y divide-ink/10 border-y border-ink/10">
              {API_SCOPES.map((scope) => (
                <ScopeCheckbox
                  key={scope}
                  scope={scope}
                  defaultChecked={DEFAULT_SCOPES.includes(scope)}
                />
              ))}
            </div>
          </fieldset>

          <SubmitButton
            className="ab ab-brand ab-main inline-flex min-h-11 items-center justify-center gap-2"
            pendingLabel="Creating…"
          >
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
            Create key
          </SubmitButton>
        </form>
      </section>
      ) : (
      <section className="mb-8 space-y-3">
        <h2 className="sn-sec">Create a key</h2>
        <InfoTip
          label="It is not open to any plan right now, so keys cannot be made yet."
          labelAs="p"
          labelClassName="text-sm text-ink/75"
        >
          The Setnayan API lets a supplier connect Setnayan to their own systems.
        </InfoTip>
      </section>
      )}

      <section className="space-y-3">
        <h2 className="sn-sec">Your keys ({keys.length})</h2>
        {keys.length === 0 ? (
          <p className="flex items-center gap-2 py-3 text-sm text-ink/70">
            <Key aria-hidden className="h-4 w-4 flex-none" strokeWidth={1.75} />
            No keys yet. Create one above to start calling the API.
          </p>
        ) : (
          <ul className="divide-y divide-ink/10 border-y border-ink/10">
            {keys.map((k) => (
              <li key={k.api_key_id} className="flex min-h-14 flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-ink">{k.name}</p>
                  <p className="break-all font-mono text-xs text-ink/75">
                    {k.key_prefix}…
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(k.scopes ?? []).map((scope) => (
                      <span
                        key={scope}
                        className="rounded-full bg-ink/[0.06] px-2 py-0.5 font-mono text-xs text-ink/75"
                      >
                        {scope}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-ink/70">
                    Created {formatLongDate(k.created_at)}
                    {k.last_used_at ? ` · last used ${formatLongDate(k.last_used_at)}` : ' · never used'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {k.revoked_at ? (
                    <Badge tone="no">Revoked</Badge>
                  ) : (
                    <form action={revokeApiKey}>
                      <input type="hidden" name="api_key_id" value={k.api_key_id} />
                      <SubmitButton
                        className="ab ab-danger inline-flex min-h-11 items-center gap-1 disabled:opacity-60"
                        pendingLabel="Revoking…"
                      >
                        <ShieldOff aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                        Revoke
                      </SubmitButton>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">Try it</p>
        <pre className="overflow-x-auto rounded-md bg-ink/[0.05] p-3 font-mono text-xs text-ink/80">
{`curl https://setnayan-platform-web.vercel.app/api/v1/me \\
  -H "Authorization: Bearer sk_live_…"`}
        </pre>
        <ul className="list-inside list-disc space-y-1 text-sm text-ink/75">
          <li>
            <code className="font-mono text-xs">GET /api/v1/health</code> — public liveness
            probe, no auth required.
          </li>
          <li>
            <code className="font-mono text-xs">GET /api/v1/me</code> — returns your profile
            for the bearer token you send.
          </li>
          <li>
            <code className="font-mono text-xs">GET /api/v1/events</code> — lists your events
            (requires <span className="font-mono">events.read</span>).
          </li>
          <li>
            <code className="font-mono text-xs">GET /api/v1/suppliers</code> — browse published
            suppliers (public, no auth).
          </li>
          <li>
            See <Link href="/api/v1" prefetch={false} className="underline">/api/v1</Link> for the full reference.
          </li>
        </ul>
      </section>
    </div>
  );
}

function ScopeCheckbox({
  scope,
  defaultChecked,
}: {
  scope: ApiScope;
  defaultChecked: boolean;
}) {
  const copy = SCOPE_COPY[scope];
  const alwaysOn = copy.alwaysOn === true;
  return (
    <label
      className="flex min-h-14 items-start gap-3 py-3"
    >
      <input
        type="checkbox"
        name="scopes"
        value={scope}
        defaultChecked={defaultChecked || alwaysOn}
        disabled={alwaysOn}
        className="mt-0.5 h-4 w-4 rounded border-ink/30 text-terracotta focus:ring-terracotta"
      />
      <span className="min-w-0 space-y-0.5">
        <span className="block text-sm font-medium text-ink">{copy.label}</span>
        <span className="block text-xs text-ink/70">{copy.description}</span>
      </span>
    </label>
  );
}

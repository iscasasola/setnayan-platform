import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Copy, Key, Plus, ShieldOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
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

  const { data } = await supabase
    .from('api_keys')
    .select(
      'api_key_id,public_id,user_id,name,key_prefix,scopes,last_used_at,revoked_at,expires_at,created_at',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  const keys = (data ?? []) as ApiKeyRow[];

  const justCreated = search.just_created ?? null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/dashboard/profile"
        className="mb-4 inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to profile
      </Link>

      <header className="mb-6 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">API keys</h1>
        <p className="text-base text-ink/65">
          Personal access tokens for the Setnayan API. Each key authenticates as you and is
          scoped to a subset of resources. Browse the live endpoints at{' '}
          <Link
            href="/api/v1"
            className="underline decoration-ink/40 underline-offset-2 hover:decoration-ink"
          >
            /api/v1
          </Link>
          .
        </p>
      </header>

      {search.error ? (
        <FormFlash tone="error">
          {decodeURIComponent(search.error)}
        </FormFlash>
      ) : null}

      {justCreated ? (
        <section className="mb-6 space-y-3 rounded-2xl border border-emerald-300/60 bg-emerald-50/80 p-5">
          <div className="space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-900">
              Save this key now
            </p>
            <p className="text-sm text-emerald-900">
              This is the only time we&rsquo;ll show the full value. Store it in your secrets
              manager — if you lose it, revoke and create a new one.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-cream p-3">
            <code className="flex-1 break-all font-mono text-sm text-ink">{justCreated}</code>
            {/* Copy button is intentionally a noscript-friendly visual hint;
                browsers without JS would still see the key text. */}
            <span
              aria-hidden
              className="inline-flex items-center gap-1 rounded-md bg-ink/5 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/60"
            >
              <Copy className="h-3 w-3" strokeWidth={2} />
              Select all + copy
            </span>
          </div>
        </section>
      ) : null}

      <section className="mb-8 space-y-4 rounded-2xl border border-ink/10 bg-cream p-5">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Create a key
        </h2>
        <form action={createApiKey} className="space-y-4">
          <label className="block space-y-1">
            <span className="block text-xs font-medium text-ink">Key name</span>
            <input
              name="name"
              required
              maxLength={80}
              placeholder="e.g. Personal scripts, Notion integration"
              className="input-field"
            />
          </label>

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-ink">Scopes</legend>
            <p className="text-xs text-ink/55">
              Choose what this key can read. Defaults to the smallest useful set —
              opt in only as needed.
            </p>
            <div className="space-y-2">
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
            className="button-primary inline-flex items-center justify-center gap-2"
            pendingLabel="Creating…"
          >
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
            Create key
          </SubmitButton>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Your keys ({keys.length})
        </h2>
        {keys.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-8 text-center">
            <Key
              aria-hidden
              className="mx-auto mb-2 h-6 w-6 text-ink/30"
              strokeWidth={1.5}
            />
            <p className="text-sm text-ink/55">
              No keys yet. Create one above to start calling the API.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {keys.map((k) => (
              <li
                key={k.api_key_id}
                className={`flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4 ${
                  k.revoked_at ? 'border-ink/10 bg-ink/[0.02] opacity-70' : 'border-ink/10 bg-cream'
                }`}
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-ink">{k.name}</p>
                  <p className="break-all font-mono text-xs text-ink/65">
                    {k.key_prefix}…
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(k.scopes ?? []).map((scope) => (
                      <span
                        key={scope}
                        className="rounded-full bg-ink/[0.06] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/65"
                      >
                        {scope}
                      </span>
                    ))}
                  </div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
                    Created {k.created_at.slice(0, 10)}
                    {k.last_used_at ? ` · last used ${k.last_used_at.slice(0, 10)}` : ' · never used'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {k.revoked_at ? (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-rose-800">
                      Revoked
                    </span>
                  ) : (
                    <form action={revokeApiKey}>
                      <input type="hidden" name="api_key_id" value={k.api_key_id} />
                      <SubmitButton
                        className="inline-flex items-center gap-1 rounded-md bg-ink/5 px-2 py-1 text-xs font-medium text-ink/70 hover:bg-rose-100 hover:text-rose-700 disabled:opacity-60"
                        pendingLabel="Revoking…"
                      >
                        <ShieldOff className="h-3.5 w-3.5" strokeWidth={1.75} />
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

      <section className="mt-10 space-y-3 rounded-2xl border border-dashed border-ink/15 bg-cream p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Try it
        </p>
        <pre className="overflow-x-auto rounded-md bg-ink/[0.05] p-3 font-mono text-[11px] text-ink/80">
{`curl https://setnayan-platform-web.vercel.app/api/v1/me \\
  -H "Authorization: Bearer sk_live_…"`}
        </pre>
        <ul className="list-inside list-disc space-y-1 text-sm text-ink/65">
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
            <code className="font-mono text-xs">GET /api/v1/vendors</code> — browse published
            vendors (public, no auth).
          </li>
          <li>
            See <Link href="/api/v1" className="underline">/api/v1</Link> for the full reference.
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
      className={`flex items-start gap-3 rounded-md border border-ink/10 bg-cream p-3 ${
        alwaysOn ? 'opacity-90' : 'hover:border-ink/20'
      }`}
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
        <span className="block text-xs text-ink/60">{copy.description}</span>
      </span>
    </label>
  );
}

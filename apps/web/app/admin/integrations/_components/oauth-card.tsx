import { KeyRound } from 'lucide-react';
import type { OAuthIntegrationDef } from '@/lib/integrations/registry';
import { saveOAuthConfig, clearOAuthSecret } from '../actions';
import { SubmitButton } from '@/app/_components/submit-button';

// Integration Activation Console — PR3b. Generic card for an OAuth client:
// one encrypted client secret + N non-secret config fields (client id/key +
// redirect URI[s]). Server component; the secret is never echoed back (masked,
// blank = keep current). Config fields ARE non-secret (they appear in the public
// OAuth consent URL) so their current value is shown + editable.

type Field = {
  column: string;
  label: string;
  placeholder: string;
  value: string;
  fromEnv: boolean;
};

export function OAuthCard({
  integration,
  secretInDb,
  secretInEnv,
  fields,
}: {
  integration: OAuthIntegrationDef;
  secretInDb: boolean;
  secretInEnv: boolean;
  fields: Field[];
}) {
  const active = secretInDb || secretInEnv;
  const secretSource = secretInDb
    ? 'Saved here (database)'
    : secretInEnv
      ? 'Environment variable (Vercel)'
      : 'Not set';

  return (
    <section className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-1.5 text-lg font-semibold tracking-tight">
          <KeyRound aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          {integration.label}
        </h3>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
            active ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'
          }`}
        >
          {active ? 'Secret set' : 'No secret'}
        </span>
      </div>

      <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
        {integration.guidance}
      </p>

      <form action={saveOAuthConfig} className="space-y-3 border-t border-ink/10 pt-4">
        <input type="hidden" name="oauth_id" value={integration.id} />

        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            {integration.secretLabel}
            {secretInDb ? ' (leave blank to keep current)' : ''} ·{' '}
            <span className="text-ink/40">{secretSource}</span>
          </span>
          <input
            type="password"
            name="client_secret"
            autoComplete="off"
            placeholder={secretInDb ? '••••••••••••••••' : 'paste secret'}
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-terracotta/50"
          />
        </label>

        {fields.map((field) => (
          <label key={field.column} className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
              {field.label}
              {field.fromEnv ? (
                <span className="text-ink/40"> · from env</span>
              ) : null}
            </span>
            <input
              type="text"
              name={field.column}
              defaultValue={field.value}
              placeholder={field.placeholder}
              autoComplete="off"
              spellCheck={false}
              className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-terracotta/50"
            />
          </label>
        ))}

        <SubmitButton
          pendingLabel="Saving…"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600"
        >
          Save
        </SubmitButton>
      </form>

      {secretInDb ? (
        <form action={clearOAuthSecret} className="border-t border-ink/10 pt-4">
          <input type="hidden" name="oauth_id" value={integration.id} />
          <SubmitButton
            pendingLabel="Clearing…"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/15 bg-cream px-4 py-2 text-sm font-medium text-ink/60 transition-colors hover:border-rose-300 hover:text-rose-700"
          >
            Clear saved secret
          </SubmitButton>
        </form>
      ) : null}
    </section>
  );
}

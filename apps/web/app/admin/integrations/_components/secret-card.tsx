import { KeyRound } from 'lucide-react';
import type { SecretIntegrationDef } from '@/lib/integrations/registry';
import { saveIntegrationSecret, clearIntegrationSecret } from '../actions';
import { SubmitButton } from '@/app/_components/submit-button';

// Integration Activation Console — PR2. Generic card for a registry "simple
// secret" integration (one encrypted API key, DB-first / env-fallback). Renders
// from SECRET_INTEGRATIONS so adding an integration is a data change, not new UI.
// Server component — the forms post to server actions; the stored key is never
// echoed back (masked placeholder + "leave blank to keep current").

export function SecretCard({
  integration,
  dbHasKey,
  envHasKey,
}: {
  integration: SecretIntegrationDef;
  dbHasKey: boolean;
  envHasKey: boolean;
}) {
  const active = dbHasKey || envHasKey;
  const source = dbHasKey
    ? 'Saved here (database)'
    : envHasKey
      ? 'Environment variable (Vercel)'
      : 'Not configured';

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
          {active ? 'Active' : 'Off'}
        </span>
      </div>

      <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
        {integration.description}
      </p>

      <dl className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-[140px_1fr]">
        <dt className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">Key source</dt>
        <dd className="text-ink/80">{source}</dd>
      </dl>

      <form action={saveIntegrationSecret} className="space-y-3 border-t border-ink/10 pt-4">
        <input type="hidden" name="integration_id" value={integration.id} />
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            {dbHasKey ? 'Replace API key (leave blank to keep current)' : 'API key'}
          </span>
          <input
            type="password"
            name="secret"
            autoComplete="off"
            placeholder={dbHasKey ? '••••••••••••••••' : integration.placeholder}
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-terracotta/50"
          />
        </label>
        <SubmitButton
          pendingLabel="Saving…"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600"
        >
          Save
        </SubmitButton>
      </form>

      {dbHasKey ? (
        <form action={clearIntegrationSecret} className="border-t border-ink/10 pt-4">
          <input type="hidden" name="integration_id" value={integration.id} />
          <SubmitButton
            pendingLabel="Clearing…"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/15 bg-cream px-4 py-2 text-sm font-medium text-ink/60 transition-colors hover:border-rose-300 hover:text-rose-700"
          >
            Clear saved key
          </SubmitButton>
        </form>
      ) : null}
    </section>
  );
}

import { ShieldAlert } from 'lucide-react';
import type { SecretDef } from '@/lib/secrets/rotation-registry';
import { SubmitButton } from '@/app/_components/submit-button';
import { ReencryptPanel } from './reencrypt-panel';
import { markRotated } from '../actions';

// ENCRYPTION_KEY gets its own card, not a registry row.
//
// It is the one secret where a naive rotation is silently destructive: swap the
// env var and every Integration-console secret + stored OAuth token becomes
// undecryptable, with no error anywhere — email just stops. The dual-key
// mechanism (lib/encryption.ts) plus the sweep below is the safe procedure, and
// the card exists so the procedure is impossible to miss.
//
// Shows key PRESENCE as booleans only. No key material, no fingerprint, no
// length — nothing that narrows a guess.

export function EncryptionKeyCard({
  def,
  primarySet,
  previousSet,
}: {
  def: SecretDef;
  primarySet: boolean;
  previousSet: boolean;
}) {
  return (
    <section id={def.id} className="space-y-4 sn-tile p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-1.5 text-lg font-semibold tracking-tight">
          <ShieldAlert aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          {def.label}
        </h2>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
            previousSet ? 'bg-amber-100 text-amber-900' : 'bg-ink/10 text-ink/70'
          }`}
        >
          {previousSet ? 'Rotation in progress' : 'Settled'}
        </span>
      </div>

      <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
        {def.impact}
      </p>

      <dl className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-[220px_1fr]">
        <dt className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
          ENCRYPTION_KEY
        </dt>
        <dd className={primarySet ? 'text-ink/80' : 'font-medium text-rose-700'}>
          {primarySet ? 'Set' : 'NOT SET — stored secrets cannot be read'}
        </dd>
        <dt className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
          ENCRYPTION_KEY_PREVIOUS
        </dt>
        <dd className="text-ink/80">
          {previousSet
            ? 'Set — old ciphertext is still readable while the sweep catches up'
            : 'Not set — no rotation in flight'}
        </dd>
      </dl>

      <div className="space-y-2 border-t border-ink/10 pt-4">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
          The safe rotation, in order
        </h3>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink/80">
          {def.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="rounded-2xl border border-amber-200/70 bg-amber-50/60 px-4 py-3 text-xs text-amber-900/90">
          Never do step 5 before step 4 reports <strong>failed = 0</strong>.
          Deleting ENCRYPTION_KEY_PREVIOUS while anything is still sealed under it
          destroys that value permanently — there is no recovery, only re-entering
          the secret from the provider.
        </p>
      </div>

      <ReencryptPanel />

      <form action={markRotated} className="border-t border-ink/10 pt-4">
        <input type="hidden" name="secret_id" value={def.id} />
        <SubmitButton
          pendingLabel="Recording…"
          className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/15 bg-cream px-4 py-2 text-sm font-medium text-ink/70 transition-colors hover:border-terracotta/50 hover:text-ink"
        >
          Mark rotated
        </SubmitButton>
      </form>
    </section>
  );
}

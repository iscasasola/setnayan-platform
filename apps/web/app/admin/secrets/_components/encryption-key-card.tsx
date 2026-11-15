import type { SecretDef } from '@/lib/secrets/rotation-registry';
import { SubmitButton } from '@/app/_components/submit-button';
import { Fold } from '@/app/_components/fold';
import { InfoTip } from '@/app/_components/info-tip';
import { TEMPLATE_SUBLINE } from '@/app/_components/template-rows';
import { ReencryptPanel } from './reencrypt-panel';
import { markRotated } from '../actions';

// ENCRYPTION_KEY gets its own fold, above the grouped registry (avatar › Secrets & integrations, 2026-11-14).
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
    <li data-secret-row={def.id}>
      <Fold
        anchor={def.id}
        data={`secret-${def.id}`}
        title={def.label}
        summary={previousSet ? 'Rotation in progress — the sweep is catching up' : 'Settled · no rotation in flight'}
        aside={
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-semibold ${
              previousSet ? 'bg-[rgb(var(--color-warn)/0.14)] text-[rgb(var(--color-warn))]' : 'bg-[rgb(var(--color-ok)/0.12)] text-[rgb(var(--color-ok))]'
            }`}
          >
            {previousSet ? 'Rotation in progress' : 'Settled'}
          </span>
        }
      >
        <div className="space-y-3 pb-3">
          <p className={`text-[14px] ${TEMPLATE_SUBLINE}`}>{def.impact}</p>

          <dl className="grid grid-cols-[minmax(0,190px)_1fr] gap-x-3 gap-y-1 border-y border-[color:var(--m-line)] py-2 text-[14px]">
            <dt className={`font-mono text-[13px] ${TEMPLATE_SUBLINE}`}>ENCRYPTION_KEY</dt>
            <dd className={primarySet ? 'text-ink' : 'font-semibold text-[rgb(var(--color-danger))]'}>
              {primarySet ? 'Set' : 'NOT SET — stored secrets cannot be read'}
            </dd>
            <dt className={`font-mono text-[13px] ${TEMPLATE_SUBLINE}`}>ENCRYPTION_KEY_PREVIOUS</dt>
            <dd className="text-ink">
              {previousSet
                ? 'Set — old ciphertext is still readable while the sweep catches up'
                : 'Not set — no rotation in flight'}
            </dd>
          </dl>

          <div className="space-y-1.5">
            <InfoTip label="The safe rotation, in order" align="start" labelClassName="text-[14px] font-semibold text-ink">
              Never do step 5 before step 4 reports failed = 0. Deleting ENCRYPTION_KEY_PREVIOUS while anything is still
              sealed under it destroys that value permanently — there is no recovery, only re-entering the secret from the
              provider.
            </InfoTip>
            <ol className="list-decimal space-y-1 pl-5 text-[14px] text-ink">
              {def.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className="text-[13px]" style={{ color: 'rgb(var(--color-warn))' }}>
              Never do step 5 before step 4 reports <strong>failed = 0</strong>.
            </p>
          </div>

          <ReencryptPanel />

          <form action={markRotated} className="border-t border-[color:var(--m-line)] pt-3">
            <input type="hidden" name="secret_id" value={def.id} />
            <SubmitButton pendingLabel="Recording…" className="ab ab-ok">
              Mark rotated
            </SubmitButton>
          </form>
        </div>
      </Fold>
    </li>
  );
}

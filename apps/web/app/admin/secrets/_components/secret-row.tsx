import Link from 'next/link';
import {
  STORE_LABEL,
  secretFields,
  dbPasteFields,
  type SecretDef,
} from '@/lib/secrets/rotation-registry';
import { STATUS_LABEL, type SecretStatus } from '@/lib/secrets/status';
import { SubmitButton } from '@/app/_components/submit-button';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { Fold } from '@/app/_components/fold';
import { TEMPLATE_SUBLINE } from '@/app/_components/template-rows';
import { SecretValueInput } from './secret-value-input';
import { updateVercelSecret, updateDbSecret, clearDbSecret, markRotated } from '../actions';

// One row on the Secrets & Rotation board — avatar › Secrets & integrations (owner go 14 Nov 2026; the approved
// drawing `admin_five_tabs_2026-11-13/admin.html` `secretFold`).
//
// Server component: nothing here has, wants, or can reach a secret VALUE. It renders public metadata (label, env var
// names, instructions, timestamps) plus the write-only inputs. It is the house Fold (one open at a time; `#<id>` opens
// it), so the board reads as a scannable list of alarms with the full runbook one tap away.

/** The status chip's tone — the edge of the drawing's `secTone`: red = needs you, amber = coming up. */
const STATUS_TONE: Record<SecretStatus, string> = {
  ok: 'bg-[rgb(var(--color-ok)/0.12)] text-[rgb(var(--color-ok))]',
  'due-soon': 'bg-[rgb(var(--color-warn)/0.14)] text-[rgb(var(--color-warn))]',
  overdue: 'bg-[rgb(var(--color-danger)/0.12)] text-[rgb(var(--color-danger))]',
  manual: 'bg-ink/[0.06] text-[color:var(--m-slate-2)]',
  unknown: 'bg-[rgb(var(--color-danger)/0.12)] text-[rgb(var(--color-danger))]',
};

/** T19 look on a pending-aware submit (`SubmitButton`) — the class names the `ActionButton` writes. */
const MAIN_BRAND = 'ab ab-brand ab-main';
const OK = 'ab ab-ok';
const DANGER = 'ab ab-danger';

export function SecretRow({
  def,
  status,
  ageLabel,
  vercelWritable,
  configured,
}: {
  def: SecretDef;
  status: SecretStatus;
  ageLabel: string;
  /** False when VERCEL_API_TOKEN / VERCEL_PROJECT_ID aren't set at runtime. */
  vercelWritable: boolean;
  /**
   * Whether a value EXISTS for this secret right now — a boolean derived from
   * the console presence map / Vercel env listing. Never the value itself.
   * `null` when we can't tell (e.g. Vercel isn't reachable from this runtime).
   */
  configured: boolean | null;
}) {
  const canWriteHere = def.editable === 'vercel-api' && vercelWritable;
  // DB-stored rows paste RIGHT HERE (2026-07-25) — same encrypted write layer
  // the Integrations console uses, so the only difference from that card is
  // which page you happened to be standing on.
  const dbFields = def.editable === 'db-paste' ? dbPasteFields(def) : [];

  return (
    <li data-secret-row={def.id}>
      <Fold
        anchor={def.id}
        data={`secret-${def.id}`}
        title={def.label}
        summary={`${STORE_LABEL[def.store]} · ${ageLabel}`}
        aside={
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-semibold ${STATUS_TONE[status]}`}>
            {STATUS_LABEL[status]}
            {def.policyDays !== null ? ` · every ${def.policyDays}d` : ''}
          </span>
        }
      >
        <div className="space-y-3 pb-3">
          <p className={`text-[14px] ${TEMPLATE_SUBLINE}`}>{def.impact}</p>

          <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 border-y border-[color:var(--m-line)] py-2 text-[14px]">
            <dt className={TEMPLATE_SUBLINE}>Variables</dt>
            <dd className="break-words font-mono text-[13px] text-ink">{def.envVars.join(' · ')}</dd>
            <dt className={TEMPLATE_SUBLINE}>Currently</dt>
            <dd className="text-ink">
              {configured === null ? 'Unknown from here' : configured ? 'A value is set' : 'Not configured'}
            </dd>
            <dt className={TEMPLATE_SUBLINE}>Policy</dt>
            <dd className="text-ink">
              {STATUS_LABEL[status]}
              {def.policyDays !== null ? ` · every ${def.policyDays}d` : ''}
            </dd>
          </dl>

          <ol className="list-decimal space-y-1 pl-5 text-[14px] text-ink">
            {def.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>

          <p>
            <a
              href={def.providerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1 text-[14px] font-semibold text-mulberry"
            >
              Get a fresh value ↗
            </a>
          </p>

          {/* Control — one of three shapes, never nested inside another form. */}
          {canWriteHere ? (
            <form action={updateVercelSecret} className="space-y-2">
              <input type="hidden" name="secret_id" value={def.id} />
              {secretFields(def).map((field) => (
                <SecretValueInput
                  key={field.envVar}
                  name={`value__${field.envVar}`}
                  label={`${field.label} — ${field.envVar}`}
                  generateHint={def.generateHint}
                />
              ))}
              <SubmitButton pendingLabel="Saving to Vercel…" className={MAIN_BRAND}>
                Save to Vercel
              </SubmitButton>
              <p className={`text-[13px] ${TEMPLATE_SUBLINE}`}>
                Written to Production + Preview. A production redeploy is required before the running app sees it — use
                “Redeploy production” at the top of this page.
              </p>
            </form>
          ) : null}

          {def.editable === 'vercel-api' && !vercelWritable ? (
            <p className="text-[13px]" style={{ color: 'rgb(var(--color-warn))' }}>
              In-app editing is off because VERCEL_API_TOKEN / VERCEL_PROJECT_ID aren&rsquo;t set in this environment.
              Change the value in the Vercel dashboard, then use &ldquo;Mark rotated&rdquo; below.
            </p>
          ) : null}

          {dbFields.length > 0 ? (
            <>
              <form action={updateDbSecret} className="space-y-2">
                <input type="hidden" name="secret_id" value={def.id} />
                {dbFields.map((field) => (
                  <SecretValueInput key={field.column} name={`value__${field.column}`} label={field.label} />
                ))}
                <SubmitButton pendingLabel="Saving…" className={MAIN_BRAND}>
                  Save key
                </SubmitButton>
                {/* No redeploy nudge here — that is a Vercel-env step. A value
                    saved into Setnayan's own database is live on the next request. */}
                <p className={`text-[13px] ${TEMPLATE_SUBLINE}`}>
                  Stored encrypted in Setnayan&rsquo;s own database and live on the very next request — no redeploy
                  needed. Saving here also resets this rotation clock.
                  {dbFields.length > 1
                    ? ' Each key is stored on its own: fill in only the one you’re replacing and the other stays exactly as it is.'
                    : ''}
                </p>
              </form>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {def.consoleHref ? (
                  <Link href={def.consoleHref} className="inline-flex min-h-11 items-center text-[14px] font-semibold text-mulberry">
                    Advanced settings ›
                  </Link>
                ) : null}
                {configured ? (
                  <ConfirmForm
                    action={clearDbSecret}
                    title={dbFields.length > 1 ? 'Remove both saved keys?' : 'Remove this saved key?'}
                    confirmLabel={dbFields.length > 1 ? 'Remove them' : 'Remove it'}
                    message={
                      dbFields.length > 1
                        ? 'Both stored keys are deleted. Anything that uses them stops working on the next request unless a matching value is still set in Vercel. You can paste a new pair here anytime.'
                        : 'The stored key is deleted. Anything that uses it stops working on the next request unless the same key is still set in Vercel. You can paste a new one here anytime.'
                    }
                  >
                    <input type="hidden" name="secret_id" value={def.id} />
                    <SubmitButton pendingLabel="Removing…" className={DANGER}>
                      {dbFields.length > 1 ? 'Remove saved keys' : 'Remove saved key'}
                    </SubmitButton>
                  </ConfirmForm>
                ) : null}
              </div>
            </>
          ) : null}

          {/* Always available: record a rotation performed elsewhere. */}
          <form action={markRotated} className="space-y-2 border-t border-[color:var(--m-line)] pt-3">
            <input type="hidden" name="secret_id" value={def.id} />
            <label className="block">
              <span className={`text-[13px] ${TEMPLATE_SUBLINE}`}>Note (optional — never paste the secret itself)</span>
              <input
                type="text"
                name="note"
                autoComplete="off"
                maxLength={500}
                placeholder="e.g. rolled after the laptop was replaced"
                className="sn-input mt-1 w-full"
              />
            </label>
            <SubmitButton pendingLabel="Recording…" className={OK}>
              Mark rotated
            </SubmitButton>
          </form>
        </div>
      </Fold>
    </li>
  );
}

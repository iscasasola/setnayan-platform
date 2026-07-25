import Link from 'next/link';
import { ExternalLink, KeyRound } from 'lucide-react';
import {
  STORE_LABEL,
  secretFields,
  type SecretDef,
} from '@/lib/secrets/rotation-registry';
import { STATUS_LABEL, type SecretStatus } from '@/lib/secrets/status';
import { SubmitButton } from '@/app/_components/submit-button';
import { SecretValueInput } from './secret-value-input';
import { updateVercelSecret, markRotated } from '../actions';

// One row on the Secrets & Rotation board.
//
// Server component: nothing here has, wants, or can reach a secret VALUE. It
// renders public metadata (label, env var names, instructions, timestamps) plus
// the write-only inputs. Collapsed by default via <details> so the board reads
// as a scannable list of alarms, with the full runbook one click away and no
// client JS needed to open it.

const STATUS_CHIP: Record<SecretStatus, string> = {
  ok: 'bg-emerald-100 text-emerald-900',
  'due-soon': 'bg-amber-100 text-amber-900',
  overdue: 'bg-rose-100 text-rose-900',
  manual: 'bg-ink/10 text-ink/70',
  unknown: 'bg-rose-100 text-rose-900',
};

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

  return (
    <details
      id={def.id}
      className="group rounded-2xl border border-ink/10 bg-cream px-5 py-4 open:bg-white/60"
    >
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-2 marker:content-['']">
        <KeyRound
          aria-hidden
          className="h-4 w-4 shrink-0 text-terracotta"
          strokeWidth={1.75}
        />
        <span className="text-sm font-semibold tracking-tight">{def.label}</span>
        <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/60">
          {STORE_LABEL[def.store]}
        </span>
        <span className="text-xs text-ink/55">{ageLabel}</span>
        <span
          className={`ml-auto rounded-full px-2.5 py-1 text-[11px] font-medium ${STATUS_CHIP[status]}`}
        >
          {STATUS_LABEL[status]}
          {def.policyDays !== null ? ` · every ${def.policyDays}d` : ''}
        </span>
      </summary>

      <div className="mt-4 space-y-4 border-t border-ink/10 pt-4">
        <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
          {def.impact}
        </p>

        <dl className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-[160px_1fr]">
          <dt className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
            Variables
          </dt>
          <dd className="font-mono text-xs text-ink/80">{def.envVars.join(' · ')}</dd>
          <dt className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
            Currently
          </dt>
          <dd className="text-ink/80">
            {configured === null
              ? 'Unknown from here'
              : configured
                ? 'A value is set'
                : 'Not configured'}
          </dd>
        </dl>

        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink/80">
          {def.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        <p>
          <a
            href={def.providerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--m-orange-2)]"
          >
            Get a fresh value
            <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          </a>
        </p>

        {/* Control — one of three shapes, never nested inside another form. */}
        {canWriteHere ? (
          <form action={updateVercelSecret} className="space-y-3">
            <input type="hidden" name="secret_id" value={def.id} />
            {secretFields(def).map((field) => (
              <SecretValueInput
                key={field.envVar}
                name={`value__${field.envVar}`}
                label={`${field.label} — ${field.envVar}`}
                generateHint={def.generateHint}
              />
            ))}
            <SubmitButton
              pendingLabel="Saving to Vercel…"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600"
            >
              Save to Vercel
            </SubmitButton>
            <p className="text-xs text-ink/55">
              Written to Production + Preview. A production redeploy is required
              before the running app sees it — use the button at the top of this
              page.
            </p>
          </form>
        ) : null}

        {def.editable === 'vercel-api' && !vercelWritable ? (
          <p className="rounded-2xl border border-amber-200/70 bg-amber-50/60 px-4 py-3 text-xs text-amber-900/90">
            In-app editing is off because VERCEL_API_TOKEN / VERCEL_PROJECT_ID
            aren&rsquo;t set in this environment. Change the value in the Vercel
            dashboard, then use &ldquo;Mark rotated&rdquo; below.
          </p>
        ) : null}

        {def.editable === 'db-paste' && def.consoleHref ? (
          <p>
            <Link
              href={def.consoleHref}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600"
            >
              Open the Integrations console
            </Link>
            <span className="mt-1.5 block text-xs text-ink/55">
              This secret is stored encrypted in Setnayan&rsquo;s own database —
              saving it there takes effect immediately, with no redeploy. Saving
              on that card also resets this rotation clock automatically.
            </span>
          </p>
        ) : null}

        {/* Always available: record a rotation performed elsewhere. */}
        <form action={markRotated} className="space-y-2 border-t border-ink/10 pt-4">
          <input type="hidden" name="secret_id" value={def.id} />
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
              Note (optional — never paste the secret itself)
            </span>
            <input
              type="text"
              name="note"
              autoComplete="off"
              maxLength={500}
              placeholder="e.g. rolled after the laptop was replaced"
              className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-terracotta/50"
            />
          </label>
          <SubmitButton
            pendingLabel="Recording…"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/15 bg-cream px-4 py-2 text-sm font-medium text-ink/70 transition-colors hover:border-terracotta/50 hover:text-ink"
          >
            Mark rotated
          </SubmitButton>
        </form>
      </div>
    </details>
  );
}

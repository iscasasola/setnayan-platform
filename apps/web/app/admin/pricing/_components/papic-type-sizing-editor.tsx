'use client';

import { useActionState } from 'react';
import type { RowActionState } from '@/app/admin/pricing/actions';

export type PapicTypeSizingRow = {
  eventType: string;
  label: string;
  /** The owner's figure. Never overwritten by learning. */
  initialPerGuest: number;
  floorPoints: number;
  ceilingPoints: number;
  /** What was learned from finished celebrations, or null. */
  learnedPerGuest: number | null;
  /** Which of the two a couple is actually quoted. */
  inForce: number;
  inForceSource: 'initial' | 'learned';
  /** Closed celebrations that did NOT run out of credits. */
  sampleSize: number;
  censoredCount: number;
  minSample: number;
  /** What a recompute would produce, and why. */
  candidate: number | null;
  candidateReason: string;
};

/**
 * HOW MANY CREDITS EACH KIND OF CELEBRATION IS RECOMMENDED.
 *
 * ⚖ Owner 2026-09-22, confirming the seventeen figures: *"yes, confirm the
 * table."* Then: *"we will set the initial value. then create an average
 * depending on the total credits used on actual events."*
 *
 * 🔑 THE POINT OF THIS SCREEN IS THE `in force` COLUMN. A learned number that
 * silently replaced a set one is unreviewable — you cannot argue with a figure
 * whose origin is invisible. So every row says which of the two is being quoted
 * to couples right now, what the other one is, and how much evidence stands
 * behind the learned one.
 *
 * ⚠ ALL THREE NUMBERS ARE EDITED TOGETHER because the clamp is part of the
 * answer. 50 credits a head under a 5,000 floor recommends 5,000 credits for a
 * dinner for two — which is the defect the per-type rows exist to fix, and it
 * would come straight back if a per-head box could be saved on its own.
 */
export function PapicTypeSizingEditor({
  rows,
  saveAction,
  recomputeAction,
}: {
  rows: PapicTypeSizingRow[];
  saveAction: (prev: RowActionState, fd: FormData) => Promise<RowActionState>;
  recomputeAction: (prev: RowActionState, fd: FormData) => Promise<RowActionState>;
}) {
  const [recomputeState, recompute, recomputing] = useActionState(recomputeAction, {
    ok: true,
    message: '',
  });

  const learnedCount = rows.filter((r) => r.inForceSource === 'learned').length;

  return (
    <section className="mt-10">
      <h2 className="mb-1 text-base font-semibold tracking-tight">
        Credits recommended, by kind of celebration
      </h2>
      <p className="mb-4 max-w-prose text-sm leading-relaxed text-ink/60">
        What we tell a couple their celebration is likely to want:{' '}
        <span className="font-mono text-[13px]">guests × per head</span>, held between the
        least and the most. A wedding and a christening are not the same job, so they do
        not carry the same number.
      </p>

      <div className="mb-5 rounded-2xl border border-ink/10 bg-ink/[0.02] p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">
              {learnedCount === 0
                ? 'Every figure here is yours'
                : `${learnedCount} figure${learnedCount === 1 ? ' is' : 's are'} learned`}
            </p>
            <p className="mt-0.5 max-w-prose text-[13px] leading-relaxed text-ink/60">
              A figure is only learned from celebrations that have <em>finished</em> shooting{' '}
              <em>and did not run out of credits</em> — an event that spent everything it had
              tells us it wanted <em>at least</em> that much, never that it wanted exactly
              that much. Those can raise a number; they can never lower one. Nothing here
              recomputes on its own.
            </p>
          </div>
          <form action={recompute}>
            <button
              type="submit"
              disabled={recomputing}
              className="shrink-0 rounded-md bg-ink/5 px-3 py-2 text-xs font-medium text-ink/75 hover:bg-ink/10 hover:text-ink disabled:opacity-60"
            >
              {recomputing ? 'Recomputing…' : 'Recompute from finished celebrations'}
            </button>
          </form>
        </div>
        {recomputeState.message ? (
          <p
            className={`mt-2 text-[13px] ${recomputeState.ok ? 'text-ink/70' : 'text-danger-900'}`}
          >
            {recomputeState.message}
          </p>
        ) : null}
      </div>

      <div className="divide-y divide-ink/10 overflow-hidden rounded-2xl border border-ink/10 bg-surface">
        {rows.map((row) => (
          <TypeRow key={row.eventType} row={row} saveAction={saveAction} />
        ))}
      </div>
    </section>
  );
}

function TypeRow({
  row,
  saveAction,
}: {
  row: PapicTypeSizingRow;
  saveAction: (prev: RowActionState, fd: FormData) => Promise<RowActionState>;
}) {
  const [state, save, saving] = useActionState(saveAction, { ok: true, message: '' });
  const learned = row.inForceSource === 'learned';

  return (
    <form action={save} className="space-y-2 p-4 sm:p-5">
      <input type="hidden" name="config_key" value={row.eventType} />

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[15px] font-semibold text-ink">{row.label}</p>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55">
          {/* THE ANSWER TO "what is a couple actually told", first. */}
          {row.inForce} a head ·{' '}
          <span className={learned ? 'text-mulberry-600' : 'text-ink/55'}>
            {learned ? 'learned' : 'yours'}
          </span>
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Field
          name="points_per_guest"
          label="Per head"
          defaultValue={row.initialPerGuest}
          hint={learned ? 'your figure — still the fallback' : 'in force'}
        />
        <Field name="floor_points" label="At least" defaultValue={row.floorPoints} />
        <Field name="ceiling_points" label="At most" defaultValue={row.ceilingPoints} />
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-ink/5 px-3 py-2 text-xs font-medium text-ink/75 hover:bg-ink/10 hover:text-ink disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <p className="text-[12.5px] leading-relaxed text-ink/55">
        {learned ? (
          <>
            Quoting <span className="font-medium text-ink/75">{row.learnedPerGuest}</span> a head,
            learned from {row.sampleSize} finished celebration
            {row.sampleSize === 1 ? '' : 's'}
            {row.censoredCount > 0
              ? ` (${row.censoredCount} more ran out of credits and only raised it)`
              : ''}
            . Your own figure of {row.initialPerGuest} stays as the fallback.
          </>
        ) : (
          <>{row.candidateReason}</>
        )}
      </p>

      {state.message ? (
        <p className={`text-[13px] ${state.ok ? 'text-ink/70' : 'text-danger-900'}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  hint,
}: {
  name: string;
  label: string;
  defaultValue: number;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">
        {label}
      </span>
      <input
        type="number"
        name={name}
        min={0}
        step={1}
        defaultValue={defaultValue}
        className="mt-1 w-28 rounded-lg border border-ink/15 px-2.5 py-1.5 text-sm"
      />
      {hint ? <span className="mt-0.5 block text-[11px] text-ink/45">{hint}</span> : null}
    </label>
  );
}

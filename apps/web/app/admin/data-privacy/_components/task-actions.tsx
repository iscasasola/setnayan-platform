'use client';

import { useActionState } from 'react';
import { setNpcFilingTask, type NpcTaskResult } from '@/app/admin/npc-readiness/actions';
import {
  NPC_TASK_STATUS_LABEL,
  type NpcTaskRow,
  type NpcTaskStatus,
} from '@/lib/npc-filing-tasks';

const STATUS_ORDER: NpcTaskStatus[] = [
  'not_started',
  'in_progress',
  'blocked_on_counsel',
  'resolved',
];

/**
 * In-place status/note/evidence editor for ONE NPC filing task (checklist tab
 * of the compliance hub). useActionState keeps the per-task result without a
 * page navigation — mirrors ControlActions on the controls tab.
 */
export function TaskActions({
  task: t,
  counselGatedStill,
}: {
  task: NpcTaskRow;
  counselGatedStill: boolean;
}) {
  const [state, formAction, isPending] = useActionState<NpcTaskResult | null, FormData>(
    async (_prev, formData) => setNpcFilingTask(formData),
    null,
  );
  const fileTaskFenced = t.key === 't3-13' && counselGatedStill;

  return (
    <form action={formAction} className="flex w-full shrink-0 flex-col gap-2 sm:w-56">
      <input type="hidden" name="task_key" value={t.key} />
      <input
        type="text"
        name="note"
        defaultValue={t.note ?? ''}
        placeholder={t.counselGated ? 'Counsel ref (needed to resolve)' : 'Working note'}
        maxLength={2000}
        className="w-full rounded-md border px-2.5 py-1.5 text-xs"
        style={{ borderColor: 'var(--m-line)', color: 'var(--m-ink)' }}
      />
      <input
        type="text"
        name="evidence"
        defaultValue={t.evidence ?? ''}
        placeholder="Evidence (ref / ack no.)"
        maxLength={500}
        className="w-full rounded-md border px-2.5 py-1.5 text-xs"
        style={{ borderColor: 'var(--m-line)', color: 'var(--m-ink)' }}
      />
      <div className="grid grid-cols-2 gap-1.5">
        {STATUS_ORDER.map((s) => {
          const active = t.status === s;
          const resolveBlocked = s === 'resolved' && fileTaskFenced;
          return (
            <button
              key={s}
              type="submit"
              name="status"
              value={s}
              disabled={isPending || resolveBlocked}
              title={resolveBlocked ? 'Resolve external counsel review (t0-1) first' : undefined}
              className="rounded-lg border px-2 py-1 text-[11px] font-semibold disabled:cursor-not-allowed"
              style={
                active
                  ? { background: 'var(--m-ink)', color: 'var(--m-paper)', borderColor: 'var(--m-ink)' }
                  : { borderColor: 'var(--m-line)', color: 'var(--m-slate)', opacity: resolveBlocked ? 0.5 : 1 }
              }
            >
              {NPC_TASK_STATUS_LABEL[s]}
            </button>
          );
        })}
      </div>
      <button
        type="submit"
        name="status"
        value="not_applicable"
        disabled={isPending}
        className="rounded-lg border px-2 py-1 text-[11px] font-medium disabled:opacity-60"
        style={
          t.status === 'not_applicable'
            ? { background: 'var(--m-slate-3)', color: 'var(--m-paper)', borderColor: 'var(--m-slate-3)' }
            : { borderColor: 'var(--m-line)', color: 'var(--m-slate-3)' }
        }
      >
        Mark N/A
      </button>
      {state?.status === 'ok' ? (
        <p role="status" className="text-xs" style={{ color: 'var(--sn-success, #157347)' }}>
          {state.message}
        </p>
      ) : state?.status === 'error' ? (
        <p role="alert" className="text-xs" style={{ color: 'var(--sn-danger, #b42318)' }}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

'use client';

import { useActionState, useRef } from 'react';
import { ChosenRow, FormRows } from '@/app/_components/form-row';
import type { PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
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

const PRESS =
  'inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-semibold transition-colors disabled:opacity-60';
const FIELD = 'h-11 min-w-0 flex-1 rounded-lg border border-ink/15 bg-transparent px-3 text-sm text-ink sm:max-w-xs';

/**
 * In-place status/note/evidence editor for ONE NPC filing task (checklist view
 * of the compliance hub). useActionState keeps the per-task result without a
 * page navigation — mirrors ControlActions on the controls view.
 *
 * Drawn to the Insights drawing (admin_pub/insights.html › NPC checklist): the note and the evidence as two rows, the
 * status as ONE dropdown row (the four-button grid was a pill row for a choice — the one-selector rule), and "Mark N/A"
 * as its own press. A pick posts the same form with the same `status` field the buttons posted — the same action, the
 * same step, no confirm added. The t3-13 fence stays: "Resolved" is listed but not pickable, its reason in the ⓘ.
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
  const form = useRef<HTMLFormElement>(null);
  const submitter = useRef<HTMLButtonElement>(null);

  const options: PickOption[] = STATUS_ORDER.map((s) => ({
    key: s,
    label: NPC_TASK_STATUS_LABEL[s],
    ...(s === 'resolved' && fileTaskFenced ? { disabledNote: 'Resolve external counsel review (t0-1) first' } : {}),
  }));

  return (
    <form ref={form} action={formAction} className="border-t border-ink/10 py-1" data-task-actions={t.key}>
      <input type="hidden" name="task_key" value={t.key} />
      <label className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-[15px] font-medium text-ink">
        <span>{t.counselGated ? 'Counsel ref' : 'Working note'}</span>
        <input
          type="text"
          name="note"
          defaultValue={t.note ?? ''}
          placeholder={t.counselGated ? 'Counsel ref (needed to resolve)' : 'Working note'}
          maxLength={2000}
          className={FIELD}
        />
      </label>
      <label className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-[15px] font-medium text-ink">
        <span>Evidence</span>
        <input
          type="text"
          name="evidence"
          defaultValue={t.evidence ?? ''}
          placeholder="Evidence (ref / ack no.)"
          maxLength={500}
          className={FIELD}
        />
      </label>
      {/* The pick presses this (unseen) submit button with the picked value — exactly what pressing a status button
          posted (`status=<key>` as the submitter), so "Mark N/A" below still posts only its own value. */}
      <button ref={submitter} type="submit" name="status" value="" tabIndex={-1} aria-hidden className="sr-only" />
      <FormRows data="npc-task-status" attrs={isPending ? { 'data-pending': '' } : undefined}>
        <ChosenRow
          name="Status"
          value={STATUS_ORDER.includes(t.status) ? t.status : null}
          buttonText={STATUS_ORDER.includes(t.status) ? undefined : NPC_TASK_STATUS_LABEL[t.status]}
          options={options}
          onPick={(key) => {
            if (isPending || !submitter.current || !form.current) return;
            if (key === 'resolved' && fileTaskFenced) return;
            submitter.current.value = key;
            form.current.requestSubmit(submitter.current);
          }}
        />
      </FormRows>
      <div className="flex flex-wrap gap-2 py-2">
        <button
          type="submit"
          name="status"
          value="not_applicable"
          disabled={isPending}
          className={
            t.status === 'not_applicable'
              ? `${PRESS} bg-ink/[0.08] text-ink`
              : `${PRESS} border border-ink/15 text-ink hover:bg-ink/[0.03]`
          }
        >
          Mark N/A
        </button>
      </div>
      {state?.status === 'ok' ? (
        <p role="status" className="pb-2 text-[13px] text-[var(--sn-success-deep)]">
          {state.message}
        </p>
      ) : state?.status === 'error' ? (
        <p role="alert" className="pb-2 text-[13px] text-[var(--sn-danger)]">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

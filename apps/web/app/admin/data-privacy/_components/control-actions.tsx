'use client';

import { useActionState } from 'react';
import { Archive, Ban, Check, Power, RotateCcw } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { setDataPrivacyControl, type ControlActionResult } from '../actions';
import type { PrivacyControlRow } from '@/lib/data-privacy-controls';

/**
 * In-place approve / turn-off / block for ONE Data Privacy control.
 *
 * useActionState (React 19) keeps the per-card result without a page
 * navigation: the server action revalidates the board so this card's status
 * badge refreshes in place, and the outcome shows inline. Replaces the old
 * redirect-to-`?flash=` which reloaded + blanked + scrolled the whole page on
 * every approval.
 *
 * Drawn inside the control's fold on the Insights drawing (admin_pub/insights.html › Privacy & NPC): the note as a row,
 * then the presses at 44 px (the house `ActionButton`, tones only). Each press keeps exactly the step it had — a direct
 * submit, no confirm added — and posts `status` through `formName` (controller, 16 Nov 2026: a form-name apart from
 * the accessible name, so "Block" is read as "Block", not "status").
 */
const FIELD = 'h-11 min-w-0 flex-1 rounded-lg border border-ink/15 bg-transparent px-3 text-sm text-ink sm:max-w-xs';

export function ControlActions({ control: c }: { control: PrivacyControlRow }) {
  const [state, formAction, isPending] = useActionState<ControlActionResult | null, FormData>(
    async (_prev, formData) => setDataPrivacyControl(formData),
    null,
  );

  return (
    <form action={formAction} className="border-t border-ink/10 py-2.5" data-control-actions="">
      <input type="hidden" name="control_key" value={c.control_key} />
      <label className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 text-[15px] font-medium text-ink">
        <span>Note (optional)</span>
        <input
          type="text"
          name="note"
          defaultValue={c.note ?? ''}
          placeholder="Note (optional)"
          maxLength={1000}
          className={FIELD}
        />
      </label>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {c.status === 'retired' ? (
          // A retired control's feature is gone/not built — the only move is to
          // bring it back onto the live board (as Off), never straight to Active.
          <ActionButton tone="neutral" icon={RotateCcw} type="submit" formName="status" value="inactive" disabled={isPending} label={isPending ? 'Saving…' : 'Restore (set off)'} />
        ) : (
          <>
            {c.status !== 'active' ? (
              <ActionButton tone="ok" icon={Check} type="submit" formName="status" value="active" disabled={isPending} label={isPending ? 'Saving…' : 'Approve · activate'} />
            ) : (
              <ActionButton tone="neutral" icon={Power} type="submit" formName="status" value="inactive" disabled={isPending} label={isPending ? 'Saving…' : 'Turn off'} />
            )}
            {c.status !== 'blocked' ? (
              <ActionButton tone="danger" icon={Ban} type="submit" formName="status" value="blocked" disabled={isPending} label="Block" />
            ) : null}
            <ActionButton tone="neutral" icon={Archive} type="submit" formName="status" value="retired" disabled={isPending} label="Retire" />
          </>
        )}
      </div>
      {state?.status === 'ok' ? (
        <p role="status" className="mt-2 text-[13px] text-[var(--sn-success-deep)]">
          {state.message}
        </p>
      ) : state?.status === 'error' ? (
        <p role="alert" className="mt-2 text-[13px] text-[var(--sn-danger)]">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

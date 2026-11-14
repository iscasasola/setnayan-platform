'use client';

import { useActionState } from 'react';
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
 * then the presses at 44 px (T19 tones, tokens only). Each press keeps exactly the step it had — a direct submit, no
 * confirm added.
 */
const PRESS =
  'inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-semibold transition-colors disabled:opacity-60';
const BTN_NEUTRAL = `${PRESS} border border-ink/15 text-ink hover:bg-ink/[0.03]`;
const BTN_OK = `${PRESS} bg-[var(--sn-success-soft)] text-[var(--sn-success-deep)] hover:opacity-90`;
const BTN_DANGER = `${PRESS} border border-[var(--sn-danger)] text-[var(--sn-danger)] hover:bg-[var(--sn-danger-soft)]`;
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
          <button type="submit" name="status" value="inactive" disabled={isPending} className={BTN_NEUTRAL}>
            {isPending ? 'Saving…' : 'Restore (set off)'}
          </button>
        ) : (
          <>
            {c.status !== 'active' ? (
              <button type="submit" name="status" value="active" disabled={isPending} className={BTN_OK}>
                {isPending ? 'Saving…' : 'Approve · activate'}
              </button>
            ) : (
              <button type="submit" name="status" value="inactive" disabled={isPending} className={BTN_NEUTRAL}>
                {isPending ? 'Saving…' : 'Turn off'}
              </button>
            )}
            {c.status !== 'blocked' ? (
              <button type="submit" name="status" value="blocked" disabled={isPending} className={BTN_DANGER}>
                Block
              </button>
            ) : null}
            <button type="submit" name="status" value="retired" disabled={isPending} className={BTN_NEUTRAL}>
              Retire
            </button>
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

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
 */
export function ControlActions({ control: c }: { control: PrivacyControlRow }) {
  const [state, formAction, isPending] = useActionState<ControlActionResult | null, FormData>(
    async (_prev, formData) => setDataPrivacyControl(formData),
    null,
  );

  return (
    <form action={formAction} className="flex shrink-0 flex-col items-stretch gap-2">
      <input type="hidden" name="control_key" value={c.control_key} />
      <input
        type="text"
        name="note"
        defaultValue={c.note ?? ''}
        placeholder="Note (optional)"
        maxLength={1000}
        className="w-44 rounded-md border px-2.5 py-1.5 text-xs"
        style={{ borderColor: 'var(--m-line)', color: 'var(--m-ink)' }}
      />
      <div className="flex flex-wrap gap-2">
        {c.status === 'retired' ? (
          // A retired control's feature is gone/not built — the only move is to
          // bring it back onto the live board (as Off), never straight to Active.
          <button
            type="submit"
            name="status"
            value="inactive"
            disabled={isPending}
            className="flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
            style={{ borderColor: 'var(--m-line)', color: 'var(--m-slate)' }}
          >
            {isPending ? 'Saving…' : 'Restore (set off)'}
          </button>
        ) : (
          <>
            {c.status !== 'active' ? (
              <button
                type="submit"
                name="status"
                value="active"
                disabled={isPending}
                className="flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                style={{ background: 'var(--m-ink)' }}
              >
                {isPending ? 'Saving…' : 'Approve · activate'}
              </button>
            ) : (
              <button
                type="submit"
                name="status"
                value="inactive"
                disabled={isPending}
                className="flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                style={{ borderColor: 'var(--m-line)', color: 'var(--m-slate)' }}
              >
                {isPending ? 'Saving…' : 'Turn off'}
              </button>
            )}
            {c.status !== 'blocked' ? (
              <button
                type="submit"
                name="status"
                value="blocked"
                disabled={isPending}
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                style={{ borderColor: 'var(--sn-danger, #b42318)', color: 'var(--sn-danger, #b42318)' }}
              >
                Block
              </button>
            ) : null}
            <button
              type="submit"
              name="status"
              value="retired"
              disabled={isPending}
              className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
              style={{ borderColor: 'var(--m-line)', color: 'var(--m-slate-3)' }}
            >
              Retire
            </button>
          </>
        )}
      </div>
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

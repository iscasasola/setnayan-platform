'use server';

import type { HubDraftActionResult } from '@/lib/hub-draft';

/**
 * The RSVP stage lab's saves (`/dev/rsvp-stage-lab`) — DEV-ONLY stand-ins for
 * `hubDraftAction` and `updatePaxSettings`, so the stage's timing can be
 * measured without a sign-in or a database: a real server-action round trip
 * to the dev server, nothing written. `?fail=1` on the lab binds `'fail'`, to
 * watch a refused save put the field back. In a production build they refuse.
 *
 * 🚂 ONE export, bound per use (train 2026-09-30): every exported server action
 * is a Vercel route (scripts/lint-server-action-budget.mjs), and a dev-only lab
 * must not spend four of them. The pages bind `kind`:
 *   'save' / 'fail' → (eventId, formData) → HubDraftActionResult
 *   'reply-by'      → (formData) → { ok } | { ok: false, … }
 *   'noop'          → (formData) → void — the lab form's Send, never reached
 *                     (the canvas bridge stops a submit), writes nothing.
 */
export type LabRsvpKind = 'save' | 'fail' | 'reply-by' | 'noop';

export async function labRsvp(
  kind: LabRsvpKind,
  ..._args: unknown[]
): Promise<HubDraftActionResult | { ok: true } | { ok: false; code: 'invalid_input'; message: string } | void> {
  const prod = process.env.NODE_ENV === 'production';
  if (kind === 'noop') return;
  if (kind === 'reply-by') {
    if (prod) return { ok: false, code: 'invalid_input', message: 'Not available.' };
    return { ok: true };
  }
  if (kind === 'fail') return { ok: false, intent: 'save', error: 'The lab refused this save on purpose.' };
  if (prod) return { ok: false, intent: 'save', error: 'Not available.' };
  const summary = { hasChanges: true, changeCount: 1, proCount: 0, canUndo: true };
  return {
    ok: true,
    intent: 'save',
    applied: 0,
    held: [],
    bar: { free: summary, owned: summary, proEffects: [], priceLabel: null },
  };
}

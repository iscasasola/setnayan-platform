'use server';

import type { HubDraftActionResult } from '@/lib/hub-draft';

/**
 * The RSVP stage lab's saves (`/dev/rsvp-stage-lab`) — DEV-ONLY stand-ins for
 * `hubDraftAction` and `updatePaxSettings`, so the stage's timing can be
 * measured without a sign-in or a database: a real server-action round trip
 * to the dev server, nothing written. `?fail=1` on the lab swaps in
 * `labRsvpDraftFail`, to watch a refused save put the field back. In a production build they refuse.
 */
export async function labRsvpDraftSave(_eventId: string, _formData: FormData): Promise<HubDraftActionResult> {
  if (process.env.NODE_ENV === 'production') return { ok: false, intent: 'save', error: 'Not available.' };
  const summary = { hasChanges: true, changeCount: 1, proCount: 0, canUndo: true };
  return {
    ok: true,
    intent: 'save',
    applied: 0,
    held: [],
    bar: { free: summary, owned: summary, proEffects: [], priceLabel: null },
  };
}

/** `?fail=1`: every draft save is refused, to watch the field go back and say so. */
export async function labRsvpDraftFail(_eventId: string, _formData: FormData): Promise<HubDraftActionResult> {
  return { ok: false, intent: 'save', error: 'The lab refused this save on purpose.' };
}

export async function labRsvpReplyBy(_formData: FormData): Promise<{ ok: true } | { ok: false; code: 'invalid_input'; message: string }> {
  if (process.env.NODE_ENV === 'production') return { ok: false, code: 'invalid_input', message: 'Not available.' };
  return { ok: true };
}

/** The lab form's Send — never reached (the canvas bridge stops a submit), and writes nothing if it were. */
export async function labRsvpNoop(_formData: FormData): Promise<void> {}

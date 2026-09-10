'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import {
  saveStoryArrangement,
  type SaveArrangementResult,
} from '@/lib/story-arrangement-store';
import { hostUserId } from './_lib/host-authority';

/**
 * "MAKE IT YOURS" — THE ARRANGEMENT'S ONE WRITE (`10_WHAT_IS_LEFT_SESSIONS_2026-09-10.md` step 3).
 *
 * The editor autosaves every change (the prototype's `touched → persist`), so this is called
 * often and must be cheap and safe to repeat: it sends the WHOLE arrangement with the version it
 * was built on, and the database keeps it only if nobody else has saved since. See
 * `saveStoryArrangement` for the rules and for what two tabs get.
 *
 * ⚠ ITS OWN ACTION, NOT PART OF `saveEditorial`. That action rewrites the whole of
 * `draft_json` from a copy it read a moment earlier; the arrangement lives in its own column
 * precisely so that neither can put the other back.
 *
 * 🔑 IT REVALIDATES NOTHING, ON PURPOSE. A server action that revalidates a path sends the
 * browser a fresh render of the page it is on — on an autosave, that is the whole Story Maker
 * re-fetched on every drag. Nothing public reads the arrangement until step 5; the public story
 * is on a 60-second revalidate, and step 5 decides how its readers learn of a change.
 *
 * Authority first, through the caller's own session; only then the service role — the same
 * trust model as the cover and the story's own save.
 */
export async function saveArrangement(
  eventId: string,
  arrangement: unknown,
  expectedVersion: number,
): Promise<SaveArrangementResult> {
  const userId = await hostUserId(eventId);
  if (!userId) {
    return { ok: false, reason: 'failed', message: 'You don’t have access to this celebration.' };
  }
  return saveStoryArrangement(createAdminClient(), {
    eventId,
    input: arrangement,
    expectedVersion,
  });
}

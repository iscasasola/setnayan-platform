/**
 * _lib/papic-in-place.ts — 📍 WHAT A PAPIC ACTION'S REDIRECT MEANS WHEN THE PRESS STAYS IN PLACE (`in-place-actions.ts`).
 *
 * A Papic action ends in `redirect(<back>?<news>)`. Asked in place, that URL is read instead of followed:
 *   · a refusal — `?…_error=<code>` or `?add=full` → `{ ok: false, error }`, said on the row in the page's own words;
 *   · somewhere a press must really go — signed out (`/login…`), not on this event (`/dashboard`), off the dashboard
 *     → `'navigate'` (the redirect is let through);
 *   · anything else (`?…_set=…`, a bare back) → `{ ok: true }`: saved; the action's own `revalidatePath` re-renders
 *     the page in place.
 * Pure. Held by `papic-saves-in-place.test.ts`.
 */

/** Every Papic action a control may save in place through (`in-place-actions.ts` `DOORS`). */
export const PAPIC_DOORS = [
  'setGuestAllotments',
  'setGuestAllotment',
  'releaseTheRest',
  'setPapicWindow',
  'setPapicUploadsOpen',
  'setPapicGuestCaptureEarly',
  'setCoupleFaceTaggingDeclined',
  'setCapturePreserved',
  'setClipShowcaseApproval',
  'setGuestClipShowcaseApproval',
  'reviewVendorChallengeAction',
  'setChallengesPausedAction',
  'setCoupleChallengeActiveAction',
  'createCoupleChallengeAction',
  'addLibraryChallengeAction',
  'armChallengeAction',
  'stopChallengeAction',
  'deleteCoupleChallengeAction',
] as const;
export type PapicDoor = (typeof PAPIC_DOORS)[number];

export type PapicInPlaceResult = { ok: true } | { ok: false; error: string };

const SAY: Readonly<Record<string, string>> = {
  /* The allotments' own words (`page.tsx`'s banner), said on the row instead. */
  bad_everyone: 'A limit of nothing is not a limit, so that number starts at 1. Leave it empty to cap everyone at an equal share.',
  bad_minimum: 'A minimum of nothing is not a promise, so that number starts at 1. Leave it empty for no minimum.',
  minimum_above_limit: 'The least anybody gets cannot be more than the limit you set for everyone.',
  bad_number: 'That needs to be a whole number of credits, or empty to let it work itself out.',
  unknown_guest: 'We could not find that guest on your list.',
  full: 'Ten challenges are already on — turn one off first.',
};
const NOTHING_CHANGED = 'We could not save that. Nothing changed — please try again.';

export function papicInPlaceAnswer(url: string): PapicInPlaceResult | 'navigate' {
  const [path, query = ''] = url.split('?');
  if (!path || !path.startsWith('/dashboard/') || path.startsWith('/login')) return 'navigate';
  const q = new URLSearchParams(query);
  if (q.get('add') === 'full') return { ok: false, error: SAY.full! };
  for (const [k, v] of q) {
    if (k.endsWith('error')) return { ok: false, error: SAY[v] ?? NOTHING_CHANGED };
  }
  return { ok: true };
}

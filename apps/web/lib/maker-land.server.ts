import 'server-only';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { isSafeInternalPath, resolveReturnTo } from './editor-return';
import { MAKER_STAY_FIELD } from './maker-stay';

/**
 * apps/web/lib/maker-land.server.ts — ⚡ A SAVE POSTED FROM THE MAKER IS SHOWN
 * IN PLACE; IT NEVER REMOUNTS THE MAKER.
 *
 * Owner, 2026-09-29: *"we also want to make sure 100% that there is no slow
 * response on the maker"*. MEASURED that day (a real `next build` of the Maker,
 * 4× CPU): a Maker form's server action that ends `redirect(return_to)` —
 * even to the address the couple is already on (`lib/maker-stay.ts` makes
 * sure it is the same one) — REMOUNTED THE WHOLE MAKER, twice. The canvas and
 * every stage loaded behind it came back from nothing, blank, for a save.
 * `router.refresh()` to the same address does not; neither does an action that
 * revalidates the page and RETURNS — its response carries the fresh render and
 * React applies it in place (measured the same day on "+ Add a scene").
 *
 * So every Maker write lands here. From the Maker (the shell stamps
 * `maker_stay=1` on every form it holds, `maker-shell.tsx`) the Maker's route is
 * revalidated and this RETURNS; from anywhere else it redirects exactly as
 * `redirect(resolveReturnTo(…))` did.
 *
 * 🔒 IT RETURNS, SO THE CALLER MUST `return` IT. A write that used to stop at
 * its `redirect` would otherwise run on — a DRAFT save would go on to write the
 * LIVE page. `a-maker-save-lands-in-place.test.ts` holds every call to a
 * landing helper to be the operand of a `return`.
 */
export function landAfterWrite(formData: FormData, fallback: string, suffix = ''): void {
  if (makerStays(formData)) {
    const to = String(formData.get('return_to'));
    revalidatePath(to.split('?')[0]!);
    return;
  }
  redirect(resolveReturnTo(formData, fallback, suffix));
}

/** Was this form posted from the Maker, asking to land where it is? */
export function makerStays(formData: FormData): boolean {
  if (formData.get(MAKER_STAY_FIELD) !== '1') return false;
  const raw = formData.get('return_to');
  return typeof raw === 'string' && isSafeInternalPath(raw) && /^\/dashboard\/[^/?]+\/launch(?:\?|$)/.test(raw);
}

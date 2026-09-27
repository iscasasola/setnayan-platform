/**
 * apps/web/lib/maker-stay.ts
 *
 * 🧷 A MAKER SAVE LANDS BACK EXACTLY WHERE THE COUPLE IS — never on a new
 * address, because a new address REMOUNTS THE WHOLE MAKER.
 *
 * Owner, 2026-09-28, on the Event Hub Maker: *"a lot of times. it reloads the
 * whole page. which shouldn't"*.
 *
 * 🔑 THE MECHANISM, MEASURED IN THE CODE. Every Maker panel posts to a server
 * action that ends `redirect(resolveReturnTo(formData, …, '?saved=1'))`, with a
 * `return_to` naming the Maker (`/dashboard/<id>/launch?scene=…&chain=…`,
 * `?tool=love-story`, `?open=…`) plus a `?saved=1` suffix. The App Router keys
 * a PAGE by its search params, so a redirect to a different query is a
 * different page: the launch route's grid skeleton (`launch/loading.tsx`)
 * replaced the whole Maker, every client component under it mounted fresh (the
 * stage, the open panel and the navigator snapped back — `maker-shell.tsx`
 * patched that over with sessionStorage), and the canvas iframe loaded from
 * the top, un-buffered, because its double buffer had been unmounted too.
 *
 * The fix is not to stop redirecting — the redirect is what carries the fresh
 * render back in the same response. It is to redirect to THE ADDRESS THE
 * COUPLE IS ALREADY ON: the same page key, so React keeps every component and
 * only the data changes. The Maker's shell stamps two fields onto a Maker form
 * as it is submitted (`MakerShell`, capture phase — before React reads the
 * form): `return_to` = the current address, and `maker_stay=1`, which tells
 * `resolveReturnTo` to honour it VERBATIM (no `?saved=1` — that suffix alone
 * would change the key again).
 *
 * What was carried in the address is carried by the shell instead: the open
 * scene/panel is already its state (nothing remounts, so nothing is lost), and
 * a drag's remaining steps (`?chain=`) are held in a ref and fired on the next
 * render (`editor-shell.tsx`).
 *
 * Pure. No DOM — `maker-stay.test.ts` drives every rule.
 */

/** The field that asks `resolveReturnTo` to land on `return_to` exactly. */
export const MAKER_STAY_FIELD = 'maker_stay';

/**
 * Where a form submitted inside the Maker should land, or null to leave the
 * form exactly as it is.
 *
 *   · a form whose `return_to` already names this event's Maker → `here`;
 *   · a DRAFT form with no `return_to` (its action would fall back to a
 *     `/website/<sub>` page and bounce back in) → `here`;
 *   · anything else (a live form that returns somewhere on purpose, a form for
 *     another event, a GET form) → null, untouched.
 */
export function makerStayReturn(input: {
  eventId: string;
  /** `location.pathname + location.search` — the page key the Maker is mounted on. */
  here: string;
  /** The form's own `return_to`, or null when it carries none. */
  returnTo: string | null;
  /** The form carries the draft field (`HubDraftField`). */
  drafts: boolean;
  /** The form's `method` ATTRIBUTE, 'post' when it has none (a React action
   *  form carries none) — an explicit GET is a search, never a save. */
  method: string;
}): string | null {
  if (input.method.toLowerCase() === 'get') return null;
  const maker = `/dashboard/${input.eventId}/launch`;
  if (!isMakerAddress(input.here, maker)) return null;
  const rt = input.returnTo;
  if (rt && rt.length > 0) return isMakerAddress(rt, maker) ? input.here : null;
  return input.drafts ? input.here : null;
}

/** `/dashboard/<id>/launch` itself, or with a query — never `/launchpad` or a sub-path. */
function isMakerAddress(path: string, maker: string): boolean {
  if (!path.startsWith(maker)) return false;
  const rest = path.slice(maker.length);
  return rest === '' || rest.startsWith('?');
}

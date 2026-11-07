/**
 * The shop page's Inquire pop-up — the pieces that are not drawing (owner 2026-11-07; the sheet is
 * `app/v/[slug]/_components/inquire-sheet.tsx`).
 *
 * 🔁 COMING BACK TO IT. Two presses leave the shop page mid-ask: Sign in (OAuth leaves for Google) and Start a new
 * event (create-event, then `?next=` back here). Both return to the address the sheet wrote, and the address carries
 * the ask: `?inquire=1` reopens the sheet, `&isvc=a,b` the services already picked. Everything else in the address —
 * the arrival (`src`, `event`), so the shop's Back stays right — is kept; the hash is dropped so the return does not
 * jump to a section.
 */

/** `?inquire=1` — reopen the Inquire pop-up on arrival. */
export const INQUIRE_PARAM = 'inquire';
/** `?isvc=a,b` — the services already picked in it. */
export const INQUIRE_SERVICES_PARAM = 'isvc';
/** The Undo window before the ask is sent — the same five seconds as Check a date. */
export const INQUIRE_UNDO_MS = 5000;

/**
 * The one plain line for a shop with no active service (owner 2026-11-07: "inquire does nothing" on SetnaProd — it had
 * no card, so Inquire scrolled to a dead end). The ask still goes: a general question.
 */
export function NO_SERVICES_LINE(shopName: string): string {
  return `${shopName} has no services listed yet — ask them a general question.`;
}

/** This shop page's address with the ask in it — a relative href (path + query, no hash). */
export function inquireResumeHref(currentHref: string, serviceIds: readonly string[]): string {
  const url = new URL(currentHref, 'https://setnayan.invalid');
  url.searchParams.set(INQUIRE_PARAM, '1');
  if (serviceIds.length > 0) url.searchParams.set(INQUIRE_SERVICES_PARAM, serviceIds.join(','));
  else url.searchParams.delete(INQUIRE_SERVICES_PARAM);
  return `${url.pathname}${url.search}`;
}

/** The same address with the ask taken out again — written when the sheet closes, so a reload does not reopen it. */
export function inquireClearedHref(currentHref: string): string {
  const url = new URL(currentHref, 'https://setnayan.invalid');
  url.searchParams.delete(INQUIRE_PARAM);
  url.searchParams.delete(INQUIRE_SERVICES_PARAM);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** What the address asks for on arrival: `null` = nothing to reopen. */
export function inquireResumeOf(search: string): { serviceIds: string[] } | null {
  const q = new URLSearchParams(search);
  if (q.get(INQUIRE_PARAM) !== '1') return null;
  return { serviceIds: (q.get(INQUIRE_SERVICES_PARAM) ?? '').split(',').map((s) => s.trim()).filter(Boolean) };
}

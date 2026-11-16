/**
 * ✕ ON A CUSTOMER CARD RETURNS TO WHERE IT WAS OPENED (walk 16 Nov 2026, EB-290; owner: "Fix it").
 *
 * A card opened from a list (Clients, Chats) already closes by `router.back()` into the row it rose from
 * (`app/_components/picked/picked-motion.ts`). Anything else used to fall back to the Clients list — so a supplier who
 * opened a card from TODAY pressed ✕ and landed on Clients, a screen they never visited.
 *
 * Today's doors now say where they came from (`?from=today`), and the page hands the shell Today as its close target.
 * An allow-list of ONE value: anything else, absent or unknown, keeps the Clients list as before.
 */
export const TODAY_HREF = '/vendor-dashboard';
export const CLIENTS_LIST_HREF = '/vendor-dashboard/customers';
export const FROM_TODAY = 'today';

/** A customer-card link opened from Today: the same link, saying it came from Today. */
export function fromToday(href: string): string {
  return `${href}${href.includes('?') ? '&' : '?'}from=${FROM_TODAY}`;
}

/** Where ✕ goes when the card was not opened over a list: Today if it came from Today, else the Clients list. */
export function pickedClientCloseHref(from: unknown): string {
  return from === FROM_TODAY ? TODAY_HREF : CLIENTS_LIST_HREF;
}

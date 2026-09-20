/**
 * vendor-client-return.ts — where a supplier lands after answering about money.
 *
 * Owner, live on the payment run, 2026-09-20, from
 * `/vendor-dashboard/clients/<eventId>?tab=details`:
 * *"clicked confirmed and it just bounced to the chat page."*
 *
 * ── WHY IT BOUNCED, AND WHY IT LOOKED LIKE A REDIRECT BUG THAT ISN'T ────────
 * `vendorAcknowledgeDeposit` did redirect back to the client page. It sent the
 * supplier to
 *
 *     /vendor-dashboard/clients/<eventId>?deposit_ack=ok
 *
 * — the right page, with the right notice, and **no `?tab=`**. Since #5614 a
 * tab-less landing on that page is a landing *on the conversation*, and the
 * page forwards it to `/vendor-dashboard/messages/<threadId>` by design (see
 * its "ONE CHAT BOX" block). So the confirm worked, the database recorded it,
 * the booking fee opened — and the supplier was moved to a screen that says
 * nothing about any of it, which reads exactly like the action failing.
 *
 * 🔑 THE REPO ALREADY HAS THIS RULE AND IT IS WRITTEN DOWN: *every door off a
 * thread page carries `?tab=`*. This is the same rule pointing the other way —
 * every door BACK to the client page carries one too. A query string that is
 * not a tab (`?deposit_ack=ok`) is not a tab.
 *
 * 🔒 `return_to` IS POSTED BY THE BROWSER, SO IT IS AN ALLOW-LIST OF TWO
 * SHAPES, never a denylist and never a pass-through: this supplier's own
 * conversation, or this event's own client page on a tab that exists. Anything
 * else — an absolute URL, `//host`, a traversal, another event's id, an unknown
 * tab — falls back to the client page's Payments tab. Same construction, and
 * the same reasoning, as `lockAnswerReturnTo` in lib/lock-answer-notice.ts
 * (#5722), which accepts only `/vendor-dashboard/messages/<id>`.
 */

/** The client page's tab strip, as the page itself declares it. */
export const VENDOR_CLIENT_TABS = [
  'chat',
  'quote',
  'payments',
  'files',
  'schedule',
  'details',
] as const;
export type VendorClientTab = (typeof VENDOR_CLIENT_TABS)[number];

/**
 * Where money answers land when nothing better is known.
 *
 * ⚠ NOT `chat`. `chat` is a DOOR in that strip, not a room — landing on it is
 * the very forward-to-the-thread this file exists to stop.
 */
export const MONEY_TAB: VendorClientTab = 'payments';

const THREAD = /^\/vendor-dashboard\/messages\/[A-Za-z0-9_-]{1,80}$/;
/** A uuid-ish event id: what the client route actually carries. */
const EVENT_ID = /^[A-Za-z0-9-]{1,64}$/;

/** `/vendor-dashboard/clients/<eventId>?tab=<tab>` plus any notice params. */
export function vendorClientTabHref(
  eventId: string,
  tab: VendorClientTab,
  query: Record<string, string> = {},
): string {
  const params = new URLSearchParams({ tab, ...query });
  return `/vendor-dashboard/clients/${eventId}?${params.toString()}`;
}

/** The tab named by a client-page path, or null if it names none we know. */
export function tabOfClientPath(raw: unknown, eventId: string): VendorClientTab | null {
  if (typeof raw !== 'string' || !EVENT_ID.test(eventId)) return null;
  const [pathname, query = ''] = raw.split('?', 2);
  if (pathname !== `/vendor-dashboard/clients/${eventId}`) return null;
  const tab = new URLSearchParams(query).get('tab');
  return (VENDOR_CLIENT_TABS as readonly string[]).includes(tab ?? '')
    ? (tab as VendorClientTab)
    : null;
}

/**
 * The path a deposit answer redirects to, with its notice attached.
 *
 * `raw` is the form's `return_to`. Honoured only for the two shapes above; the
 * notice query is rebuilt here either way, so a caller can never smuggle one.
 */
export function depositAnswerReturnTo(
  raw: unknown,
  eventId: string,
  notice: Record<string, string> = {},
): string {
  if (typeof raw === 'string' && THREAD.test(raw)) {
    const params = new URLSearchParams(notice);
    const q = params.toString();
    return q ? `${raw}?${q}` : raw;
  }
  /* A client-page return_to keeps the tab the supplier was actually on.
     ⚖ EXCEPT `chat`, which is a door and not a room: `?tab=chat` is forwarded
     to the thread by the page itself, so honouring it here would rebuild the
     exact bounce this file exists to stop. Answering from the conversation is
     expressed by the THREAD path above — the one shape that really means it. */
  const tab = tabOfClientPath(raw, eventId);
  return vendorClientTabHref(eventId, tab && tab !== 'chat' ? tab : MONEY_TAB, notice);
}

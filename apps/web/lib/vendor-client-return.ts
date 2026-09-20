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
 * ── THE SECOND SHELL, AND WHY A TAB NAME ALONE IS NOT A DESTINATION ─────────
 *
 * `/vendor-dashboard/clients/<eventId>` renders TWO DIFFERENT TAB STRIPS and
 * they share only three words. Behind `NEXT_PUBLIC_RELATIONSHIP_WORKSPACE_
 * ENABLED` (measured `"true"` in production, 2026-09-20) it is the unified
 * RelationshipTabShell above; with the flag off it is the older Customer Card,
 * whose `normalizeTab` (app/.../_components/customer-card-nav.tsx) accepts only
 * the list below and silently rewrites everything else to `overview`.
 *
 *     shell ON   chat · quote · payments · files · schedule · details
 *     shell OFF  overview · quote · files · schedule · script · activity
 *                          └──────── the whole intersection ────────┘
 *
 * So `?tab=payments` is Overview on one arm, and `?tab=activity` is QUOTE on
 * the other — `RelationshipTabShell` drops an id it does not know onto its
 * first PANEL tab. Both are the owner's bug wearing a different coat: the
 * action worked and the supplier is looking at a screen that does not mention
 * it. 🔑 **NAME THE CONTENT, NOT THE TAB.** A caller asks for the SURFACE its
 * notice is rendered on; this file knows which word each shell calls it.
 */
export const VENDOR_CARD_TABS = [
  'overview',
  'quote',
  'files',
  'schedule',
  'script',
  'activity',
] as const;
export type VendorCardTab = (typeof VENDOR_CARD_TABS)[number];

/**
 * What a supplier is being sent back to LOOK AT, named by the panel that
 * actually draws the notice — verified against page.tsx, not assumed:
 *
 *  • `asks`       — the "ask them to send PHP X" panel. It sits inside
 *                   `quoteNode` on PURPOSE and is documented there: Quote &
 *                   Payments is the one money tab BOTH shells render, so the
 *                   panel is one copy reachable on either arm.
 *  • `delivery`   — `ScheduleTab`, which holds the run-of-show suggestion
 *                   notice, the "Deliver the handover" panel AND the
 *                   Change-Order Trail. All three notices render there and
 *                   nowhere else, so all three land there.
 *  • `notes`      — the activity feed + private CRM notes (`activityNode`)
 *  • `completion` — `VendorCompletionCard`
 *  • `brief`      — the rest of `OverviewTab` (Papic challenges, booth, cocktail)
 *
 * ⚠ `notes`, `completion` and `brief` are three different tabs on the OFF
 * shell and ONE tab on the ON shell, because the ON shell folds Overview and
 * Activity into Details. Keeping them as separate surfaces is what lets the
 * OFF arm stay precise instead of dumping everything on `overview`.
 */
export type VendorClientSurface = 'asks' | 'delivery' | 'notes' | 'completion' | 'brief';

export const SURFACE_TABS: Record<
  VendorClientSurface,
  { shellOn: VendorClientTab; shellOff: VendorCardTab }
> = {
  asks: { shellOn: 'quote', shellOff: 'quote' },
  delivery: { shellOn: 'schedule', shellOff: 'schedule' },
  notes: { shellOn: 'details', shellOff: 'activity' },
  completion: { shellOn: 'details', shellOff: 'overview' },
  brief: { shellOn: 'details', shellOff: 'overview' },
};

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

function clientHref(eventId: string, tab: string, query: Record<string, string>): string {
  const params = new URLSearchParams({ tab, ...query });
  return `/vendor-dashboard/clients/${eventId}?${params.toString()}`;
}

/** `/vendor-dashboard/clients/<eventId>?tab=<tab>` plus any notice params. */
export function vendorClientTabHref(
  eventId: string,
  tab: VendorClientTab,
  query: Record<string, string> = {},
): string {
  return clientHref(eventId, tab, query);
}

/**
 * The landing for a SURFACE, resolved for the shell the supplier will get.
 *
 * `shellOn` is `isRelationshipWorkspaceEnabled()` — passed in rather than read
 * here so this module stays pure and the test can execute BOTH arms. A server
 * action that hard-codes a tab string can only ever be right about one of them.
 */
export function vendorClientSurfaceHref(
  eventId: string,
  surface: VendorClientSurface,
  opts: { shellOn: boolean; query?: Record<string, string> },
): string {
  const pair = SURFACE_TABS[surface];
  return clientHref(eventId, opts.shellOn ? pair.shellOn : pair.shellOff, opts.query ?? {});
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

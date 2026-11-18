/**
 * WHERE AN "UPCOMING SCHEDULES" ROW GOES — the decision, with no I/O in it.
 *
 * ── THE REPORT THAT MADE THIS FILE (owner, 2026-09-20) ──────────────────────
 * On /vendor-dashboard (the Today page), supplier Saysay: *"pressing the
 * upcoming schedules doesn't open our customer card. where we can see updates
 * about our project on them."*
 *
 * He was right, and the DOM said so: every row was
 * `<a href="/vendor-dashboard/messages/<threadId>">`. The row shows a DATE, an
 * event name and a place — the language of a booking — and opened a chat. The
 * booking's money, brief, schedule and next steps live on the customer card,
 * `/vendor-dashboard/clients/[eventId]`, and there was no way to reach it from
 * the row at all.
 *
 * ── WHY THE CARD LINK CARRIES A `?tab=` ────────────────────────────────────
 * 🔒 A BARE `/vendor-dashboard/clients/<id>` IS A CHAT LANDING. #5614 made the
 * client page redirect to the thread when no `?tab=` is named (see
 * `clients/[eventId]/page.tsx`: `!rawTab || rawTab === 'chat' || rawTab ===
 * 'call'`). So "point the row at the customer card" and "point the row at the
 * chat" are THE SAME URL unless the section is named. `?tab=details` is the
 * idiom already shipped for exactly this — the chat rail's "Full customer
 * profile" button uses it, and `lib/every-door-off-the-frame-lands-elsewhere.test.ts`
 * holds it there. Both shells resolve it: the Relationship Workspace has a
 * `details` tab, and the flag-off card's `normalizeTab` falls through to
 * Overview, which is the same brief.
 *
 * ── WHEN THERE IS NO CARD ──────────────────────────────────────────────────
 * `get_vendor_event_brief` raises `not_booked` — and the page then bounces to
 * /vendor-dashboard/clients — unless the caller's org holds a live
 * `event_vendors` row or a live thread on that event. An Upcoming row can be
 * admitted by `fetchVendorRoomEvents` arm 1 (a schedule-pool booking) with
 * NEITHER: a manual or off-platform booking the shop put on its own pool. Such
 * a row must not be sent to a page that will bounce it, so it falls back — to
 * the conversation if there is one, and otherwise to the calendar, which is
 * where that booking's date actually lives.
 *
 * 🔑 THE FALLBACK IS A LAST RESORT, NOT A TIE-BREAK. `opensCard` is returned so
 * a guard can prove the fallback is taken ONLY when the card is unreachable —
 * the sabotage this rule invites is "fall back whenever a thread exists", which
 * is exactly the bug it was written to remove.
 */

/**
 * 🗂 THE PICKED CLIENT'S NINE PAGES (THE ONE BUILD, 8 Nov 2026 · v113) — the `?tab=` id of each, in menu order
 * (owner 11 Nov 2026): Chat · Details · Quotation · Payment · Forms · Schedule · Files · Hub · Report. The labels and the legacy-id
 * map live beside the shell (`clients/[eventId]/_components/picked-client-menu.ts`); the ids live HERE because
 * every door into a client (Today's rows, the Coming-up rows, notifications) builds its link through
 * `customerCardHref`, and a door may only name a page that exists.
 *
 * Since the chat moved INTO the client (v111), `?tab=chat` opens the Chat page in place — the old "a bare route IS
 * the chat" redirect is gone. A bare landing opens the menu's first page (Chat since 11 Nov; Details before). Doors
 * still name the page they mean.
 */
export const PICKED_CLIENT_PAGE_IDS = [
  'chat',
  'details',
  'quote',
  'payments',
  'forms',
  'schedule',
  'files',
  'hub',
  'report',
] as const;
export type PickedClientPage = (typeof PICKED_CLIENT_PAGE_IDS)[number];

/** Kept as the older name every caller already imports. */
export type CardSection = PickedClientPage;

/**
 * The section an Upcoming row opens on: the brief, the returning-client marker,
 * the activity log and the completion handshake — "updates about our project".
 */
export const UPCOMING_CARD_SECTION: CardSection = 'details';

export function customerCardHref(eventId: string, page: PickedClientPage): string {
  return `/vendor-dashboard/clients/${eventId}?tab=${page}`;
}

/**
 * 🚪 THE ONE OPEN PATH — which page a client opens on (Build 2 row #38, prototype v116 `startPage`). Every row that
 * stands for a client (the Clients list and its views, Today's Needs-you rows) asks THIS, then builds its link with
 * `customerCardHref`. A door passes what it knows; the first true fact wins, in the prototype's order:
 *
 *   an explicit page (a tile's row, a Payment line) → that page
 *   money due / overdue                             → Payment (Quotation before booking — there is no Payment yet)
 *   unread messages                                 → Chat
 *   asking (an open ask, a booking ask, a hold)     → Chat
 *   quoted / talking                                → Quotation
 *   booked and the event is today                   → Hub
 *   anything else (booked, done, an access request) → Details
 *
 * 🔑 Chat is chosen only when a thread exists (`hasChat`): a manual client has no chat, and Chat without one lands on
 * the inbox — a door may only name a page that has something on it. Pure; held by `customers/one-open-path.test.ts`.
 */
export type ClientDoorFacts = {
  page?: PickedClientPage | null;
  booked?: boolean;
  hasChat?: boolean;
  payDue?: boolean;
  unread?: boolean;
  asking?: boolean;
  quoted?: boolean;
  eventToday?: boolean;
};

export function clientLandingPage(f: ClientDoorFacts): PickedClientPage {
  const booked = f.booked === true;
  const chat = f.hasChat === true;
  if (f.page) {
    // Payment and Hub show only once booked: an unbooked Payment door lands on the Quotation (#38), a Hub door on Details.
    if (f.page === 'payments' && !booked) return 'quote';
    if (f.page === 'hub' && !booked) return 'details';
    if (f.page === 'chat' && !chat) return 'details';
    return f.page;
  }
  if (f.payDue) return booked ? 'payments' : 'quote';
  if (f.unread && chat) return 'chat';
  if (f.asking && chat) return 'chat';
  if (f.quoted) return 'quote';
  if (f.eventToday && booked) return 'hub';
  return 'details';
}

/**
 * 📅 A client's Schedule ON A DAY (owner 18 Nov 2026): Calendar › a day › a client, and a date on a chat card, open the
 * client's Schedule with that day picked in its days strip (`?tab=schedule&day=YYYY-MM-DD`). A malformed day is
 * dropped — the page then opens on its own day.
 */
export const SCHEDULE_DAY_PARAM = 'day';
/** A chat card's date asks the open Schedule strip to pick its day (`ScheduleDayDoor`) — same page, no request. */
export const SCHEDULE_DAY_EVENT = 'sn:schedule-day';
export function clientScheduleDayHref(eventId: string, day: string): string {
  const base = customerCardHref(eventId, 'schedule');
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? `${base}&${SCHEDULE_DAY_PARAM}=${day}` : base;
}

/** A client's link through the one open path: the landing page, then the one door function. */
export function openClientHref(eventId: string, f: ClientDoorFacts): string {
  return customerCardHref(eventId, clientLandingPage(f));
}

/**
 * 🚪 EVERY WAY INTO A CLIENT CONVERSATION LANDS ON THE CLIENT'S CHAT (owner 11 Nov, *"a redesign moves every way in"*;
 * owner 17 Nov on the #7901 preview: a pop-up's Reply opened the OLD full-screen thread page instead of the client).
 *
 * The full-screen thread page (`/vendor-dashboard/messages/<thread>`) is drawn for four reasons only, and a link to it
 * goes through `supplierChatHref`, `supplierThreadPaneHref` or `supplierThreadPageHref`, never a typed path
 * (🔒 lib/a-conversation-opens-the-client-chat.test.ts):
 *   1. a thread that names no event — there is no client to open (`supplierChatHref` with no event);
 *   2. the computer inbox's pane beside the list (owner 13 Nov D3) — `supplierThreadPaneHref`, marked `?pane=1`;
 *   3. a tool the page itself opens (`?view=` Decisions · `?compose=deal`) — `supplierThreadForward` keeps those;
 *   4. an older or closed chat on an event (archived, turned down, booked someone else, withdrawn): the client's Chat
 *      draws the event's NEWEST thread (`readClientChatThreadId`), so these keep the full page.
 * Everything else — stored notices already in bells, old push taps, and every return from an action inside the
 * conversation (its notice params carried along, `SUPPLIER_THREAD_NOTICE_KEYS`) — is FORWARDED by the page itself to
 * the client's Chat (`supplierThreadForward`, read in `messages/[threadId]/page.tsx`). Returns are built with
 * `supplierThreadPageHref` so the page, not the caller, decides.
 *
 * This EXACT chat, full screen — for a closed, archived or older chat the picked client's Chat does not draw.
 */
/** This EXACT chat, full screen — for a closed, archived or older chat the picked client's Chat does not draw. */
export function supplierThreadPageHref(threadId: string): string {
  return `/vendor-dashboard/messages/${threadId}`;
}

export function supplierThreadPaneHref(threadId: string): string {
  return `/vendor-dashboard/messages/${threadId}?pane=1`;
}

/**
 * The thread page's NOTICE params — what an action inside the conversation hands back so the page can say what
 * happened (`?notice=` quote outcomes · `?lock_agree=` / `?lock_decline=` with `fee` · `taken` · `free` · `competing` ·
 * the toast bridge's `?error=` / `?msg=`). They are CARRIED onto the client's Chat (owner 17 Nov: an action inside the
 * client's Chat returns to the client's Chat, its notice said there), and the client page hands them back to the one
 * thread draw (`SupplierThreadBody` `search`), which draws the same notice lines in the same chat box.
 */
export const SUPPLIER_THREAD_NOTICE_KEYS = [
  'notice',
  'lock_agree',
  'lock_decline',
  'fee',
  'taken',
  'free',
  'competing',
  'error',
  'msg',
] as const;

/** The notice params in a search, as plain strings (an array keeps its first). Never anything else. Pure. */
export function supplierThreadNoticeSearch(
  search: Readonly<Record<string, string | string[] | undefined>> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of SUPPLIER_THREAD_NOTICE_KEYS) {
    const v = search?.[k];
    const one = Array.isArray(v) ? v[0] : v;
    if (typeof one === 'string') out[k] = one;
  }
  return out;
}

/**
 * Where a request for the full-screen thread page goes instead: the client's Chat — carrying any notice params, so
 * the line that says what happened is drawn THERE — or the client's Quotation for "Update this quote"
 * (`?compose=quote`, the Quotation page opens the builder on the live quote). Null when the page must draw itself: no
 * event, the computer pane (`pane`), the Decisions view (`view`), the counter-offer panel (`compose=deal`), any param
 * this rule does not know, or a thread that is NOT the one the client's Chat draws (`clientDrawsThisThread` false —
 * an older or closed chat on the same event; forwarding it would open a different conversation). Pure.
 */
export function supplierThreadForward(
  eventId: string | null | undefined,
  search: Readonly<Record<string, string | string[] | undefined>> | undefined,
  clientDrawsThisThread: boolean,
): string | null {
  if (!eventId || !clientDrawsThisThread) return null;
  const keys = Object.keys(search ?? {}).filter((k) => search?.[k] !== undefined);
  const notice = new Set<string>(SUPPLIER_THREAD_NOTICE_KEYS);
  let page: 'chat' | 'quote' = 'chat';
  for (const k of keys) {
    if (notice.has(k)) continue;
    if (k === 'compose' && search?.compose === 'quote') {
      page = 'quote';
      continue;
    }
    return null;
  }
  const carried = new URLSearchParams(supplierThreadNoticeSearch(search)).toString();
  return carried ? `${customerCardHref(eventId, page)}&${carried}` : customerCardHref(eventId, page);
}

/**
 * 💬 Where a supplier's NOTICE about one conversation opens (owner 11 Nov — every way into a client lands in the picked
 * client: *"When that is pressed it jump to the supplie-client card that was already planned with the
 * details-chat-form-quote-files-report and more menus"*; DECISION_LOG 2026-11-08 "a row opens the picked client on its
 * Chat tab"): the picked client's Chat page, which draws this same thread. Only a thread that names no event keeps the
 * full-screen thread page. 🔒 lib/supplier-notices-open-the-picked-client.test.ts
 */
export function supplierChatHref(eventId: string | null | undefined, threadId: string): string {
  // Written out (not via `customerCardHref`) so the email-link guard can read both pages from this body.
  return eventId ? `/vendor-dashboard/clients/${eventId}?tab=chat` : supplierThreadPageHref(threadId);
}

/** What the rule needs to know about one booked date. */
export type UpcomingDoorInput = {
  eventId: string;
  /**
   * `event_vendors.vendor_id` — non-null only when the shop's OWN booked row
   * admitted this booking (`admitRoomBookings` arms 2 and 3). Non-null is a
   * guarantee, not a guess: that row carries a booked status and names this
   * shop, which is the brief RPC's first branch, so the card opens.
   */
  eventVendorId: string | null;
  /** The conversation on this event, when the shop has one. */
  threadId: string | null;
  /**
   * True when a thread on this event is one the brief RPC's 'inquiry' rung
   * admits — accepted, or pending and not archived. A declined or withdrawn
   * thread is not one of them, so it does not open the card.
   */
  briefOpensOnThread: boolean;
};

export type UpcomingDoor = {
  /** Where the row itself goes. */
  href: string;
  /** The conversation, kept reachable beside the row. Null when there is none. */
  threadHref: string | null;
  /** True when `href` is the customer card rather than a fallback. */
  opensCard: boolean;
};

/** The whole decision. Pure — every caller and the guard go through it. */
export function upcomingScheduleDoor(input: UpcomingDoorInput): UpcomingDoor {
  const opensCard = input.eventVendorId !== null || input.briefOpensOnThread;
  // The client's Chat when the card opens; with no card to open (a declined / withdrawn chat the brief refuses), the
  // client page cannot open either, so the conversation stays on its own full-screen page.
  const threadHref = input.threadId
    ? opensCard
      ? supplierChatHref(input.eventId, input.threadId)
      : supplierThreadPageHref(input.threadId)
    : null;
  return {
    href: opensCard
      ? customerCardHref(input.eventId, UPCOMING_CARD_SECTION)
      : // No card to open. The conversation is the next-best real destination;
        // the calendar is the last one, and it is never a dead link.
        (threadHref ?? '/vendor-dashboard/calendar'),
    threadHref,
    opensCard,
  };
}

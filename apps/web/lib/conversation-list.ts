import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  isCancelledInquiryStatus,
  resolveThreadStage,
  rowReadsCompleted,
  type ThreadStage,
} from '@/lib/vendor-thread-stage';

/**
 * THE CONVERSATION LIST — the rows for the column beside the thread being read
 * (owner, 2026-09-08: *"list · conversation · context"*, and *"you can rely on
 * facebook business chatbox"*). BOTH SIDES LIVE HERE.
 *
 * ── WHY ONE MODULE AND NOT TWO ──────────────────────────────────────────────
 * A supplier's column and a couple's column draw the SAME row — initials, a
 * name, a time, one line of the last thing said, a stage, small grey tags — and
 * differ in exactly three places: whose messages get the "You:" prefix, which
 * chips are offered, and which query answers "is this one booked". Splitting
 * them into two files is how the two columns come to disagree about a row that
 * is the same conversation seen from two ends.
 *
 * ⚠ THE COUPLE'S FACTS NEED NO ADMIN CLIENT, THE SUPPLIER'S DOES. Measured
 * against production 2026-09-09: `event_vendors`, `vendor_proposals` and
 * `vendor_schedule_pool_bookings` each carry a `*_couple_read` policy keyed on
 * `current_couple_event_ids()`, and every column read below is grant-readable
 * by `authenticated`. The supplier has no `event_vendors` policy at all, which
 * is why only that side is handed a service-role client.
 *
 * ── WHY THE ROWS ARE BUILT HERE AND NOT IN THE COLUMN ───────────────────────
 * A row carries four facts that already have owners elsewhere — who the couple
 * is, what the last message said, what stage the booking is at, and whether the
 * supplier still owes a reply. Three of the four are answered somewhere else in
 * this app, and the stage in particular is the one this repo has already forked
 * twice. So the ranking comes from `resolveThreadStage` and the finish line
 * from `rowReadsCompleted` — the same two the thread pill and the clients list
 * use — and nothing here re-decides either.
 *
 * ⚡ EVERY PROBE IS BATCHED. A per-row `deriveThreadStage` would be three
 * queries per conversation; these are three queries for the whole list.
 */

/** What the filter chips offer, in the order the prototype shows them. */
export const CONVERSATION_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unanswered', label: 'Unanswered' },
  { key: 'quoted', label: 'Quoted' },
  { key: 'booked', label: 'Booked' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
] as const;

export type ConversationFilter = (typeof CONVERSATION_FILTERS)[number]['key'];

/**
 * THE COUPLE'S CHIPS — a different vocabulary over the SAME ladder.
 *
 * Owner's design draws five: All · Has a quote · Booked · Waiting · Closed. Two
 * of them are not rungs, so the mapping is declared here rather than hidden in
 * an `if` chain — a chip whose name and predicate drift apart is a filter that
 * silently omits, which is worse than no filter because it is trusted.
 *
 * ⚖ WHY THE COUPLE'S WORDS DIFFER FROM THE SUPPLIER'S. "Completed" and
 * "Cancelled" are the supplier's bookkeeping; to a couple both mean the same
 * thing — *this one is done with* — so they fold into **Closed**. And a bare
 * inquiry reads to them as **Waiting**, because that is what they are doing.
 */
export const COUPLE_CONVERSATION_FILTERS = [
  { key: 'all', label: 'All', stages: null },
  { key: 'quoted', label: 'Has a quote', stages: ['quoted'] },
  { key: 'booked', label: 'Booked', stages: ['booked'] },
  { key: 'waiting', label: 'Waiting', stages: ['inquiry'] },
  { key: 'closed', label: 'Closed', stages: ['completed', 'cancelled'] },
] as const satisfies ReadonlyArray<{
  key: string;
  label: string;
  stages: readonly ThreadStage[] | null;
}>;

export type CoupleConversationFilter = (typeof COUPLE_CONVERSATION_FILTERS)[number]['key'];

/** Pure — which rows a couple's chip shows. */
export function matchesCoupleFilter(
  row: Pick<ConversationRow, 'stage'>,
  filter: CoupleConversationFilter,
): boolean {
  const chip = COUPLE_CONVERSATION_FILTERS.find((f) => f.key === filter);
  if (!chip || chip.stages === null) return true;
  return (chip.stages as readonly ThreadStage[]).includes(row.stage);
}

export type ConversationRow = {
  threadId: string;
  eventId: string;
  /** The couple, as they identified themselves. Never a raw id. */
  displayName: string;
  initials: string;
  /** One line of the last thing said, already prefixed with "You: " if it was. */
  preview: string;
  /** Relative-ish time, from the same formatter the inbox uses. */
  timeLabel: string;
  updatedAt: string;
  stage: ThreadStage;
  /**
   * The supplier owes this conversation something: a pending inquiry waiting to
   * be accepted, or a live thread whose last word was the couple's.
   */
  unanswered: boolean;
  /** Small grey tags under the preview — the service asked about, the date. */
  labels: string[];
  /**
   * Something was said here after the viewer last opened it.
   *
   * ⚠ NOT THE SAME FACT AS `unanswered`. A supplier who has replied still has
   * an unread row when the couple wrote back; a conversation the supplier owes
   * a reply to may be perfectly well read. The prototype draws both — a dot and
   * a bold preview for unread, a pill for unanswered.
   */
  unread: boolean;
};

/**
 * WHICH PILLS A ROW WEARS. Pure, and shared by both columns so the two cannot
 * disagree about a row that is one conversation seen from two ends.
 *
 * Read off the binding prototype's list pane, row by row: a booked row that
 * owes a reply wears BOTH (`Unanswered` then `Booked`); a fresh inquiry that
 * owes a reply wears only `Unanswered`, because "Inquiry" beside it says
 * nothing the first pill has not already said.
 *
 * ⚠ A ROW IS NEVER TAGLESS. An answered conversation still at `inquiry` — the
 * supplier replied but has not quoted — wears `Inquiry`. Rendering nothing
 * there reads as a row whose tag failed to load, which is the same disease as a
 * refused read drawing an empty state.
 */
export function rowPills(
  row: Pick<ConversationRow, 'stage' | 'unanswered'>,
  /**
   * Only the supplier's column offers "Unanswered" — it is the chip their whole
   * inbox is built around. The couple's column names the stage alone, as drawn.
   */
  options: { showUnanswered: boolean },
): Array<{ kind: 'unanswered' } | { kind: 'stage'; stage: ThreadStage }> {
  const pills: Array<{ kind: 'unanswered' } | { kind: 'stage'; stage: ThreadStage }> = [];
  const unanswered = options.showUnanswered && row.unanswered;
  if (unanswered) pills.push({ kind: 'unanswered' });
  if (row.stage !== 'inquiry' || !unanswered) pills.push({ kind: 'stage', stage: row.stage });
  return pills;
}

/**
 * The two initials in the avatar. Extracted here because the thread page's
 * customer rail derived them inline and the list needed the same answer — two
 * copies of "what letters stand for this couple" is how one screen comes to
 * show `CI` beside another showing `C`.
 */
export function initialsFor(displayName: string): string {
  return (
    displayName
      .split(/[\s&·]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || 'C'
  );
}

/**
 * The one line under a couple's name.
 *
 * ⚠ AN EMPTY THREAD IS NOT A SILENT ONE. A conversation with no messages yet
 * says so; rendering an empty string would leave a blank line that reads as a
 * message that failed to load.
 */
export function previewFor(
  last: { sender_role: string; body: string | null } | null | undefined,
  /**
   * Who is READING the column. The prototype prefixes the reader's own last
   * word with "You:" on both sides, so this cannot be hard-coded to 'vendor' —
   * that is how a couple comes to read their own message as the supplier's.
   */
  selfRole: 'vendor' | 'couple' = 'vendor',
): string {
  if (!last) return 'No messages yet';
  const mine = last.sender_role === selfRole;
  const body = (last.body ?? '').replace(/\s+/g, ' ').trim();
  if (!body) return mine ? 'You sent an attachment' : 'Sent an attachment';
  return mine ? `You: ${body}` : body;
}

/**
 * Does a supplier still owe this conversation a reply?
 *
 * ⚖ A PENDING INQUIRY COUNTS. It is the one that needs them most — nobody can
 * even write in it until they accept — and leaving it out of "Unanswered" would
 * hide the only conversation the whole product is waiting on.
 */
export function isUnanswered(
  inquiryStatus: string | null,
  last: { sender_role: string } | null | undefined,
): boolean {
  if (inquiryStatus === 'pending') return true;
  if (inquiryStatus !== 'accepted') return false;
  if (!last) return true;
  return last.sender_role !== 'vendor';
}

/** Pure — which rows a chip shows. `unanswered` is an axis, not a rung. */
export function matchesFilter(
  row: Pick<ConversationRow, 'stage' | 'unanswered'>,
  filter: ConversationFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'unanswered') return row.unanswered;
  return row.stage === filter;
}

/** Pure — free-text match over what the row actually shows. */
export function matchesSearch(
  row: Pick<ConversationRow, 'displayName' | 'preview' | 'labels'>,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [row.displayName, row.preview, ...row.labels]
    .join(' ')
    .toLowerCase()
    .includes(q);
}

type ThreadInput = {
  thread_id: string;
  event_id: string;
  inquiry_status: string | null;
  updated_at: string;
};

type BuildArgs = {
  /** The supplier's own session — proposals and pool bookings are theirs. */
  supabase: SupabaseClient;
  /**
   * Service role. `event_vendors` has FOUR select policies and not one admits a
   * supplier, so their own session reads zero rows there and every booking
   * would report as unfinished forever. Scoped below to this shop's id and to
   * the events it already holds threads on.
   */
  adminClient: SupabaseClient;
  vendorProfileId: string;
  threads: ThreadInput[];
  /** event_id → what the couple calls their celebration. */
  displayNames: Map<string, string | null>;
  /** event_id → extra grey tags (service asked about, the date). */
  labels: Map<string, string[]>;
  /** thread_id → the last message in it. */
  lastMessages: Map<string, { sender_role: string; body: string | null }>;
  /** Threads with something said since the viewer last opened them. */
  unreadThreadIds: Set<string>;
  /** The inbox's own formatter, injected so the list and the inbox agree. */
  formatTime: (iso: string) => string;
};

/**
 * Batched stage facts for a whole list, then the SHARED resolver per row.
 * Every probe graceful-degrades to "no", which errs toward an earlier rung —
 * a booking shown as still live is a stale label; a live one shown as finished
 * tells a supplier to stop working.
 */
export async function buildVendorConversationRows({
  supabase,
  adminClient,
  vendorProfileId,
  threads,
  displayNames,
  labels,
  lastMessages,
  unreadThreadIds,
  formatTime,
}: BuildArgs): Promise<ConversationRow[]> {
  const eventIds = [...new Set(threads.map((t) => t.event_id).filter(Boolean))];

  const quoted = new Set<string>();
  const booked = new Set<string>();
  const completed = new Set<string>();

  if (eventIds.length > 0) {
    const [quoteRes, bookRes, doneRes] = await Promise.all([
      supabase
        .from('vendor_proposals')
        .select('event_id')
        .eq('vendor_profile_id', vendorProfileId)
        .in('event_id', eventIds)
        .in('status', ['sent', 'viewed']),
      supabase
        .from('vendor_schedule_pool_bookings')
        .select('event_id')
        .eq('vendor_profile_id', vendorProfileId)
        .in('event_id', eventIds)
        .is('released_at', null),
      adminClient
        .from('event_vendors')
        .select('event_id, completion_status, customer_confirmed_received_at, status')
        .eq('marketplace_vendor_id', vendorProfileId)
        .in('event_id', eventIds),
    ]);

    if (quoteRes.error) {
      logQueryError('conversationList.quoted', quoteRes.error, { vendorProfileId }, 'graceful_degrade');
    }
    for (const r of (quoteRes.data ?? []) as { event_id: string }[]) quoted.add(r.event_id);

    if (bookRes.error) {
      logQueryError('conversationList.booked', bookRes.error, { vendorProfileId }, 'graceful_degrade');
    }
    for (const r of (bookRes.data ?? []) as { event_id: string }[]) booked.add(r.event_id);

    if (doneRes.error) {
      logQueryError('conversationList.completed', doneRes.error, { vendorProfileId }, 'graceful_degrade');
    }
    for (const r of (doneRes.data ?? []) as Array<{
      event_id: string;
      completion_status: string | null;
      customer_confirmed_received_at: string | null;
      status: string | null;
    }>) {
      if (rowReadsCompleted(r)) completed.add(r.event_id);
    }
  }

  return threads.map((t) => {
    const displayName = displayNames.get(t.event_id) || 'A Setnayan event';
    const last = lastMessages.get(t.thread_id);
    const stage = resolveThreadStage({
      completed: completed.has(t.event_id),
      booked: booked.has(t.event_id),
      quoted: quoted.has(t.event_id),
      cancelled: isCancelledInquiryStatus(t.inquiry_status),
    });
    return {
      threadId: t.thread_id,
      eventId: t.event_id,
      displayName,
      initials: initialsFor(displayName),
      preview: previewFor(last, 'vendor'),
      timeLabel: formatTime(t.updated_at),
      updatedAt: t.updated_at,
      stage,
      unanswered: isUnanswered(t.inquiry_status, last),
      labels: labels.get(t.event_id) ?? [],
      unread: unreadThreadIds.has(t.thread_id),
    };
  });
}

type CoupleThreadInput = {
  thread_id: string;
  vendor_profile_id: string;
  inquiry_status: string | null;
  updated_at: string;
};

type CoupleBuildArgs = {
  /**
   * The couple's own session. No admin client anywhere on this side: all three
   * stage tables carry a `*_couple_read` policy keyed on
   * `current_couple_event_ids()`, so their own RLS reaches every fact.
   */
  supabase: SupabaseClient;
  eventId: string;
  threads: CoupleThreadInput[];
  /**
   * vendor_profile_id → the name to draw, ALREADY resolved through
   * `resolveVendorDisplayName`.
   *
   * 🔒 IT IS RESOLVED BY THE CALLER ON PURPOSE. A free or unverified supplier's
   * real business name is masked behind a screen name until the reveal
   * predicate says otherwise, and this module has no business deciding that. It
   * receives a name that is already safe to print, and prints it.
   */
  displayNames: Map<string, string>;
  /** thread_id → the service they asked about, one grey tag. */
  labels: Map<string, string[]>;
  lastMessages: Map<string, { sender_role: string; body: string | null }>;
  unreadThreadIds: Set<string>;
  formatTime: (iso: string) => string;
};

/**
 * The couple's rows: ONE celebration, many suppliers — the mirror image of the
 * supplier's list, and the reason the batching keys on `vendor_profile_id`
 * here where the other side keys on `event_id`.
 *
 * ⚡ THREE QUERIES FOR THE WHOLE COLUMN, whatever its length. Every one
 * graceful-degrades to "no", which errs toward an EARLIER rung — a booking
 * shown as still live is a stale label a couple will correct by opening it; a
 * live one shown as Closed tells them to stop chasing a supplier who is
 * waiting on them.
 */
export async function buildCoupleConversationRows({
  supabase,
  eventId,
  threads,
  displayNames,
  labels,
  lastMessages,
  unreadThreadIds,
  formatTime,
}: CoupleBuildArgs): Promise<ConversationRow[]> {
  const quoted = new Set<string>();
  const booked = new Set<string>();
  const completed = new Set<string>();

  if (threads.length > 0) {
    const [quoteRes, bookRes, doneRes] = await Promise.all([
      supabase
        .from('vendor_proposals')
        .select('vendor_profile_id')
        .eq('event_id', eventId)
        .in('status', ['sent', 'viewed']),
      supabase
        .from('vendor_schedule_pool_bookings')
        .select('vendor_profile_id')
        .eq('event_id', eventId)
        .is('released_at', null),
      supabase
        .from('event_vendors')
        .select('marketplace_vendor_id, completion_status, customer_confirmed_received_at, status')
        .eq('event_id', eventId),
    ]);

    if (quoteRes.error) {
      logQueryError('coupleConversationList.quoted', quoteRes.error, { eventId }, 'graceful_degrade');
    }
    for (const r of (quoteRes.data ?? []) as { vendor_profile_id: string }[]) {
      quoted.add(r.vendor_profile_id);
    }

    if (bookRes.error) {
      logQueryError('coupleConversationList.booked', bookRes.error, { eventId }, 'graceful_degrade');
    }
    for (const r of (bookRes.data ?? []) as { vendor_profile_id: string }[]) {
      booked.add(r.vendor_profile_id);
    }

    if (doneRes.error) {
      logQueryError('coupleConversationList.completed', doneRes.error, { eventId }, 'graceful_degrade');
    }
    for (const r of (doneRes.data ?? []) as Array<{
      marketplace_vendor_id: string | null;
      completion_status: string | null;
      customer_confirmed_received_at: string | null;
      status: string | null;
    }>) {
      if (r.marketplace_vendor_id && rowReadsCompleted(r)) completed.add(r.marketplace_vendor_id);
    }
  }

  return threads.map((t) => {
    const displayName = displayNames.get(t.vendor_profile_id) || 'Supplier';
    const last = lastMessages.get(t.thread_id);
    const stage = resolveThreadStage({
      completed: completed.has(t.vendor_profile_id),
      booked: booked.has(t.vendor_profile_id),
      quoted: quoted.has(t.vendor_profile_id),
      cancelled: isCancelledInquiryStatus(t.inquiry_status),
    });
    return {
      threadId: t.thread_id,
      eventId,
      displayName,
      initials: initialsFor(displayName),
      preview: previewFor(last, 'couple'),
      timeLabel: formatTime(t.updated_at),
      updatedAt: t.updated_at,
      stage,
      /**
       * ⚖ ALWAYS FALSE ON THIS SIDE, DELIBERATELY. "Unanswered" is the
       * supplier's word for work they owe; the couple's column names the stage
       * alone, as drawn. Inverting it here — "they owe you a reply" — is a real
       * idea and a different feature, and inventing it silently would put a
       * sentence on the page nobody designed.
       */
      unanswered: false,
      labels: labels.get(t.thread_id) ?? [],
      unread: unreadThreadIds.has(t.thread_id),
    };
  });
}

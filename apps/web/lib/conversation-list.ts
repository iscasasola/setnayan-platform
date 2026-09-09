import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  isCancelledInquiryStatus,
  resolveThreadStage,
  rowReadsCompleted,
  type ThreadStage,
} from '@/lib/vendor-thread-stage';
import { buildSupplierStanding, type SupplierStanding } from '@/lib/supplier-standing';

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
 * WHETHER THE SERVICE TAG EARNS ITS SPOT ON THE SUPPLIER'S OWN INBOX.
 *
 * A tag that reads the same on every row of a list costs a line and says
 * nothing — a caterer's whole inbox tagging every row "Catering" is the same
 * disease as an always-shown date on a single-wedding column, just on the
 * other side. Pass the label this vendor's OWN rows would carry, across the
 * whole list being drawn; the tag is worth showing only when it varies.
 *
 * 🔑 NOT A VENDOR-PROFILE LOOKUP. What a shop *sells* and what its current
 * inbox is *about* can differ (a multi-service vendor whose live threads
 * happen to all be catering inquiries this week) — this asks the row's own
 * question, "does this tag tell the row apart from its neighbours right now",
 * not "how many categories does this business's profile list".
 */
export function serviceTagVaries(labelsAcrossInbox: ReadonlyArray<string | null | undefined>): boolean {
  const distinct = new Set(labelsAcrossInbox.filter((l): l is string => !!l));
  return distinct.size > 1;
}

/** One day, in milliseconds — the unit `isDateTagWorthShowing` measures in. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * WHETHER THE DATE TAG EARNS ITS SPOT.
 *
 * Only on the supplier's column, where every row is a different wedding —
 * the couple's own column deliberately never shows one (every row there is
 * the SAME wedding; see `buildCoupleConversationRows`'s labels contract). A
 * date sixteen months out is not live context for "who am I talking to right
 * now"; close to the day, it is. `nowMs` is injected, the same discipline
 * `buildBenchStandings` already uses, so this stays testable without a clock.
 */
export function isDateTagWorthShowing(eventDateIso: string | null | undefined, nowMs: number): boolean {
  if (!eventDateIso) return false;
  const d = new Date(eventDateIso.length === 10 ? `${eventDateIso}T00:00:00Z` : eventDateIso);
  if (Number.isNaN(d.getTime())) return false;
  return Math.abs(d.getTime() - nowMs) <= 60 * MS_PER_DAY;
}

/**
 * FACT-FIRST REPLACEMENTS FOR A BODY THIS APP WROTE.
 *
 * Measured in a browser (2026-09-09): the desktop column gives a preview
 * about 32 characters before it clips, a phone about 50. A card's `body` is
 * written for the THREAD — full sentences, a call to action — not for that
 * column, so printing it verbatim is how *"📄 Proposal — "Intimate 50" ·
 * ₱187,500. Tap to review and accept."* arrives on the row clipped mid-word.
 *
 * ⛔ ONLY messages this app authored are rewritten here. A message a PERSON
 * typed has no shorter version of their own sentence — CSS `truncate`
 * ellipsizes those correctly already (verified: the preview span is a
 * `block`, so `text-overflow: ellipsis` has a width to work against), and
 * rewriting somebody's words would be inventing what they said.
 *
 * Matched by the card's own body PREFIX rather than a new column: every
 * writer below already renders a stable, code-controlled template, so the
 * fact is already sitting in the string that was going to be truncated
 * anyway — no extra query, no schema change, no risk of a card format
 * drifting from what this list expects to see.
 *
 * ⏭ TWO EXAMPLES IN THE ORIGINAL BRIEF DO NOT EXIST AS STORED MESSAGES,
 * measured against the shipped code: "guest count changed" is a live card
 * computed straight from `event_vendors` in the thread page
 * (`vendor-dashboard/messages/[threadId]/page.tsx`), never written to
 * `chat_messages`; "deposit received" is an `emitNotification` body, not a
 * chat message either. Neither ever reaches this column, so neither needed a
 * pattern here — corrected rather than built against.
 */
const GENERATED_PREVIEW_PATTERNS: ReadonlyArray<{
  match: RegExp;
  short: (m: RegExpMatchArray) => string;
}> = [
  {
    // `lib/proposal-send.ts` → `📄 Proposal — "Intimate 50 — your event" · ₱187,500. Tap to review and accept.`
    match: /^📄 Proposal — [“"].+?[”"] · (.+?)\. Tap to review and accept\.$/,
    short: (m) => `Quote ${m[1]} sent`,
  },
  {
    // `app/_components/negotiation-actions.ts` → `📅 Meeting request: Venue walkthrough`
    // The label after the colon is what a PERSON typed into the request form —
    // only the generated wrapper shrinks; a long label still earns the ellipsis.
    match: /^📅 Meeting request: (.+)$/,
    short: (m) => `📅 Meeting: ${m[1]}`,
  },
  {
    // `lib/chat-actions.ts` → `**Setnayan Exclusive unlocked 🎁** Free engagement shoot: <perk copy…>`
    // The perk copy itself is marketing text with no length limit; the fact
    // that matters on a row is WHICH exclusive unlocked, not its pitch.
    match: /^\*\*Setnayan Exclusive unlocked 🎁\*\* (.+?): /,
    short: (m) => `🎁 Exclusive: ${m[1]}`,
  },
];

function shortenGeneratedBody(body: string): string {
  for (const { match, short } of GENERATED_PREVIEW_PATTERNS) {
    const m = body.match(match);
    if (m) return short(m);
  }
  return body;
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
  const short = shortenGeneratedBody(body);
  return mine ? `You: ${short}` : short;
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

/**
 * ── THE COUPLE'S STAGE FACTS, ONCE ──────────────────────────────────────────
 * Three probes, three queries, whatever the length of the list — and now TWO
 * consumers: the conversation column beside a thread, and the shortlist bench's
 * standing sentence. They were extracted the moment the second one appeared,
 * because a bench card and the conversation it opens disagreeing about the same
 * supplier is precisely the defect this module was written to prevent.
 *
 * 🔒 THE COUPLE'S OWN SESSION, NEVER SERVICE ROLE. All three tables carry a
 * `*_couple_read` policy keyed on `current_couple_event_ids()`.
 *
 * Every probe graceful-degrades to "no", which errs toward an EARLIER rung — a
 * booking shown as still live is a stale label the couple corrects by opening
 * it; a live one shown as finished tells them to stop chasing a supplier who is
 * waiting on them.
 */
export type CoupleStageFacts = {
  quoted: Set<string>;
  booked: Set<string>;
  completed: Set<string>;
  /**
   * vendor_profile_id → the live proposal total, IN PESOS.
   *
   * ⚠ Read off the SAME rows that decide the `quoted` rung (`sent` / `viewed`),
   * so a card can never print a number from a proposal the ladder does not
   * count. `total_centavos` is a BIGINT of centavos; the division happens here,
   * once, rather than at each render site.
   */
  quotedAmountPhp: Map<string, number>;
};

function emptyCoupleStageFacts(): CoupleStageFacts {
  return { quoted: new Set(), booked: new Set(), completed: new Set(), quotedAmountPhp: new Map() };
}

async function readCoupleStageFacts(
  supabase: SupabaseClient,
  eventId: string,
): Promise<CoupleStageFacts> {
  const facts = emptyCoupleStageFacts();

  const [quoteRes, bookRes, doneRes] = await Promise.all([
    supabase
      .from('vendor_proposals')
      .select('vendor_profile_id, total_centavos')
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
    logQueryError('coupleStageFacts.quoted', quoteRes.error, { eventId }, 'graceful_degrade');
  }
  for (const r of (quoteRes.data ?? []) as Array<{
    vendor_profile_id: string;
    total_centavos: number | string | null;
  }>) {
    facts.quoted.add(r.vendor_profile_id);
    const centavos = Number(r.total_centavos ?? 0);
    // ⚠ A ZERO TOTAL IS NOT A PRICE. Proposals default to 0 and a supplier can
    // send one before pricing it; "Quoted ₱0" would be a worse sentence than
    // "Quoted" alone, so the rung still shows and the number simply does not.
    if (Number.isFinite(centavos) && centavos > 0) {
      const php = centavos / 100;
      // Many proposals per supplier are possible (amendments supersede rather
      // than delete). The LARGEST live one is the safe one to show: it is the
      // figure a couple would be answering, and understating what somebody is
      // asking for is the costlier direction to be wrong in.
      facts.quotedAmountPhp.set(
        r.vendor_profile_id,
        Math.max(php, facts.quotedAmountPhp.get(r.vendor_profile_id) ?? 0),
      );
    }
  }

  if (bookRes.error) {
    logQueryError('coupleStageFacts.booked', bookRes.error, { eventId }, 'graceful_degrade');
  }
  for (const r of (bookRes.data ?? []) as { vendor_profile_id: string }[]) {
    facts.booked.add(r.vendor_profile_id);
  }

  if (doneRes.error) {
    logQueryError('coupleStageFacts.completed', doneRes.error, { eventId }, 'graceful_degrade');
  }
  for (const r of (doneRes.data ?? []) as Array<{
    marketplace_vendor_id: string | null;
    completion_status: string | null;
    customer_confirmed_received_at: string | null;
    status: string | null;
  }>) {
    if (r.marketplace_vendor_id && rowReadsCompleted(r)) facts.completed.add(r.marketplace_vendor_id);
  }

  return facts;
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
  const { quoted, booked, completed } =
    threads.length > 0 ? await readCoupleStageFacts(supabase, eventId) : emptyCoupleStageFacts();

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

/**
 * ── THE BENCH'S STANDINGS ───────────────────────────────────────────────────
 * The shortlist bench draws many supplier cards at once, and each one now
 * carries a sentence about where that supplier stands. The facts behind it are
 * the SAME four the conversation column already gathers — the rung, the last
 * thing said, who said it, and when — so this lives here, beside them, and
 * reuses `readCoupleStageFacts` verbatim.
 *
 * ⚡ TWO QUERIES FOR THE WHOLE BENCH, ON TOP OF THE THREE ALREADY SHARED. A
 * per-card probe is explicitly forbidden on this surface: a category rail holds
 * dozens of cards and the page holds many rails.
 *
 * 🔑 ONE DERIVATION. `buildSupplierStanding` is called here and nowhere else in
 * the app, so the bench card, the Picks column and (later) the conversation's
 * Decisions view all render the same computed answer rather than three
 * sentences that agree today.
 */
export type BenchStandingInput = {
  /**
   * The card's OWN id, which is what the returned map is keyed on. Kept
   * separate from `vendorProfileId` deliberately: the bench draws a card per
   * shortlist row, and the marketplace profile is only how its facts are found.
   * Keying the map on the profile id would make the component translate between
   * two identities at render time — a lookup that silently misses is exactly
   * how a card comes to show the standing of the supplier beside it.
   */
  key: string;
  vendorProfileId: string;
  /** Null ⇒ this supplier has never been written to. Most of the bench. */
  threadId: string | null;
  inquiryStatus: string | null;
};

export async function buildBenchStandings({
  supabase,
  eventId,
  vendors,
  nowMs,
}: {
  /** 🔒 The couple's own session, as everywhere on this side. */
  supabase: SupabaseClient;
  eventId: string;
  vendors: BenchStandingInput[];
  /** Injected so the sentence is testable and the whole page agrees on "now". */
  nowMs: number;
}): Promise<Map<string, SupplierStanding | null>> {
  const out = new Map<string, SupplierStanding | null>();
  const threadIds = vendors.map((v) => v.threadId).filter((id): id is string => id != null);

  // Nobody on this bench has a conversation — the common cold-start case, and
  // worth its own exit so a fresh event pays for no queries at all.
  if (threadIds.length === 0) {
    for (const v of vendors) out.set(v.key, null);
    return out;
  }

  const [facts, lastRes] = await Promise.all([
    readCoupleStageFacts(supabase, eventId),
    supabase
      .from('chat_messages')
      .select('thread_id, sender_role, created_at')
      .in('thread_id', threadIds)
      .order('created_at', { ascending: false })
      .limit(600),
  ]);

  if (lastRes.error) {
    logQueryError('benchStandings.lastMessages', lastRes.error, { eventId }, 'graceful_degrade');
  }
  // Ordered newest-first, so the FIRST row seen for a thread is its last word.
  const lastByThread = new Map<string, { sender_role: string; created_at: string }>();
  for (const m of (lastRes.data ?? []) as Array<{
    thread_id: string;
    sender_role: string;
    created_at: string;
  }>) {
    if (!lastByThread.has(m.thread_id)) lastByThread.set(m.thread_id, m);
  }

  for (const v of vendors) {
    const last = v.threadId == null ? undefined : lastByThread.get(v.threadId);
    const saidAt = last ? Date.parse(last.created_at) : NaN;
    out.set(
      v.key,
      buildSupplierStanding({
        // ⛔ THE RUNG COMES FROM THE SHARED RESOLVER. Deciding it here would be
        // the fourth ranking, and the bench would be the surface that disagreed
        // with the thread it opens.
        stage: resolveThreadStage({
          completed: facts.completed.has(v.vendorProfileId),
          booked: facts.booked.has(v.vendorProfileId),
          quoted: facts.quoted.has(v.vendorProfileId),
          cancelled: isCancelledInquiryStatus(v.inquiryStatus),
        }),
        hasThread: v.threadId != null,
        quotedAmountPhp: facts.quotedAmountPhp.get(v.vendorProfileId) ?? null,
        // `sender_role` is the message's own author column, the same one the
        // conversation column reads; 'vendor' is the only value that means the
        // supplier spoke, so anything else is the couple's side.
        lastSpeaker: last ? (last.sender_role === 'vendor' ? 'vendor' : 'couple') : null,
        lastSaidAtMs: Number.isFinite(saidAt) ? saidAt : null,
        nowMs,
      }),
    );
  }

  return out;
}

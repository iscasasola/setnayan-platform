/**
 * 🗓 THE HOST — OR THE COORDINATOR — ASKS A BOOKED SUPPLIER TO CHANGE THEIR TIMES (owner 2026-11-02, DECISION_LOG "A
 * SUPPLIER'S SCHEDULE BASICS FOR THIS WEEK" item 2: *"receive requests for schedules from hosts of the event and
 * coordinator?"*; supplier gate audit D2). The pure half.
 *
 * ONE FACT, ONE HOME: an ask is an `event_schedule_suggestions` row with `direction = 'to_supplier'` (migration
 * 20271303655108) — the supplier's own requests run the other way (`'to_host'`). The supplier answers on their Schedule
 * for the event (`SupplierSchedule`, "Asked of you"); a Yes goes through the ONE accept path
 * (`lib/schedule-suggestion-decide.server.ts`), so the moment changes in one place. The asker sees the state on the
 * moment (the moment sheet's "Asked of suppliers").
 *
 * Nothing here reads or writes the database. 🔒 lib/the-supplier-answers-the-hosts-ask.test.ts
 */

export type AskDirection = 'to_host' | 'to_supplier';
export type AskedAs = 'host' | 'coordinator';

/** The columns every reader of an ask selects. */
export const ASK_COLUMNS =
  'suggestion_id, block_id, vendor_profile_id, suggested_by_name, asked_as, proposed_start_at, proposed_end_at, note, status, answer_note, created_at, resolved_at';

/** One ask, as the host's moment sheet and the supplier's Schedule read it. */
export type ScheduleAsk = {
  suggestion_id: string;
  block_id: string | null;
  vendor_profile_id: string;
  /** The asker's name, written when they asked. */
  suggested_by_name: string | null;
  asked_as: AskedAs | string | null;
  proposed_start_at: string | null;
  proposed_end_at: string | null;
  note: string;
  status: 'open' | 'accepted' | 'declined' | 'withdrawn' | string;
  /** The supplier's reason on a No. */
  answer_note: string | null;
  created_at: string;
  resolved_at?: string | null;
  /** 📍 'where' = the host asks them to serve these chapters (migration 20271308641275); absent = a moment's times. */
  kind?: string | null;
  proposed_block_ids?: readonly string[] | null;
};

/** The host's read: every ask with the asked shop's name embedded (the one FK to `vendor_profiles`). */
export const HOST_ASK_COLUMNS = `${ASK_COLUMNS}, shop:vendor_profiles(business_name)`;

export type HostAsk = ScheduleAsk & {
  shop?: { business_name: string | null } | Array<{ business_name: string | null }> | null;
};

/** The asked shop's name on a host's read; an unread name is "The supplier", never blank. */
export function shopNameOf(a: HostAsk): string {
  const s = Array.isArray(a.shop) ? a.shop[0] : a.shop;
  return s?.business_name?.trim() || 'The supplier';
}

/** A row read with `direction` — split into what each side answers. A row with no direction is a supplier's request. */
export function directionOf(row: { direction?: string | null }): AskDirection {
  return row.direction === 'to_supplier' ? 'to_supplier' : 'to_host';
}

/**
 * 🔁 ONLY THE OTHER SIDE ANSWERS. A supplier's request (`to_host`) is the host's or coordinator's to decide; a host's
 * ask (`to_supplier`) is the asked supplier's. The ONE accept path refuses everything else as 'gone' — so the host can
 * never approve their own ask, nor a supplier its own request.
 */
export function sideMayDecide(row: { direction?: string | null }, side: 'host' | 'supplier'): boolean {
  return directionOf(row) === (side === 'supplier' ? 'to_supplier' : 'to_host');
}

/**
 * What an accepted change writes onto the moment: the proposed name · time · place, each only when proposed. The same
 * for both directions — a supplier's Yes to a host's ask moves the moment exactly as a host's Approve does.
 */
export function proposedPatch(s: {
  proposed_start_at: string | null;
  proposed_end_at: string | null;
  proposed_location: string | null;
  proposed_label: string | null;
}): Record<string, string | boolean | null> {
  const patch: Record<string, string | boolean | null> = {};
  if (s.proposed_start_at) patch.start_at = s.proposed_start_at;
  if (s.proposed_end_at) patch.end_at = s.proposed_end_at;
  if (s.proposed_location) patch.location = s.proposed_location;
  if (s.proposed_label) patch.label = s.proposed_label;
  return patch;
}

/** Who asked, in the supplier's words: "Ana (coordinator)" · "Ana (host)" · "The host". */
export function askerWords(a: Pick<ScheduleAsk, 'suggested_by_name' | 'asked_as'>): string {
  const role = a.asked_as === 'coordinator' ? 'coordinator' : 'host';
  const name = a.suggested_by_name?.trim();
  return name ? `${name} (${role})` : role === 'coordinator' ? 'The coordinator' : 'The host';
}

/** The supplier's answer, as the asker reads it on the moment. `shop` = the asked supplier's name. */
export function askStateWords(a: Pick<ScheduleAsk, 'status' | 'answer_note'>, shop: string): string {
  if (a.status === 'accepted') return `${shop} said yes — the moment moved.`;
  if (a.status === 'declined') return a.answer_note?.trim() ? `${shop} said no: “${a.answer_note.trim()}”` : `${shop} said no.`;
  if (a.status === 'withdrawn') return 'Taken back.';
  return `Waiting for ${shop}.`;
}

/**
 * The asks on one moment, newest first, at most one per supplier (the latest), so the sheet shows the state of each
 * supplier's ask once — never a pile of old ones.
 */
export function asksOnMoment<T extends Pick<ScheduleAsk, 'block_id' | 'vendor_profile_id' | 'created_at'>>(asks: readonly T[], blockId: string): T[] {
  const seen = new Set<string>();
  return asks
    .filter((a) => a.block_id === blockId)
    .slice()
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
    .filter((a) => {
      if (seen.has(a.vendor_profile_id)) return false;
      seen.add(a.vendor_profile_id);
      return true;
    });
}

/** What the supplier still has to answer — open asks only, oldest first (the order they arrived). */
export function askedOfYou<T extends Pick<ScheduleAsk, 'status' | 'created_at'>>(asks: readonly T[]): T[] {
  return asks
    .filter((a) => a.status === 'open')
    .slice()
    .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
}

export const ASK_NOTE_MAX = 1000;
export const ANSWER_NOTE_MAX = 500;

/** The note an ask carries: what the host typed, else the time it asks for. Never empty (the column needs 1…1000). */
export function askNote(typed: string, newClock: string): string {
  const t = typed.trim().replace(/\s+/g, ' ').slice(0, ASK_NOTE_MAX);
  return t || `Could you change your time to ${newClock}?`;
}

/** A No's reason, trimmed and cut to what the column takes; blank = no reason (null). */
export function answerNote(typed: unknown): string | null {
  if (typeof typed !== 'string') return null;
  const t = typed.trim().replace(/\s+/g, ' ').slice(0, ANSWER_NOTE_MAX);
  return t || null;
}

/** The ask's asker role, from whether the asker is one of the couple on the event. */
export function askedAsFor(isCouple: boolean): AskedAs {
  return isCouple ? 'host' : 'coordinator';
}

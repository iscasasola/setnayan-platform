/**
 * 🕵️ A SUPPLIER DISPUTES A BOOKING FEE — the words, and the database's answers made safe.
 *
 * Owner, 2026-07-27 (DECISION_LOG "FOUND-YOU DISPUTES — grace-first ladder"): *"for their first dispute, we will
 * accept but remind them that this is the power and reach of setnayan's service… second dispute will be upon review
 * of our admin"*. Owner, 2026-11-05: *"switch on booking fee. and build dispute"*.
 *
 * WHERE EACH PIECE LIVES
 *   · the record and both decisions — `booking_fee_disputes`, `booking_fee_open_dispute`,
 *     `booking_fee_decide_dispute` (migration 20271314842518);
 *   · the supplier's button — the fee bill, `/vendor-dashboard/booking-fees/[orderId]`;
 *   · the admin's queue — a section on `/admin/disputes`;
 *   · the notices — `fee_dispute_opened` (admins) and `fee_dispute_answered` (the supplier), IN-APP ONLY.
 *
 * PURE — no database, no `server-only`.
 */
import { formatLongTimestamp } from './format-date';
import { formatCount } from './format-number';

export type BookingFeeDisputeStatus = 'auto_accepted' | 'under_review' | 'accepted' | 'rejected';

const STATUSES: ReadonlySet<string> = new Set(['auto_accepted', 'under_review', 'accepted', 'rejected']);

export function asDisputeStatus(v: unknown): BookingFeeDisputeStatus | null {
  return typeof v === 'string' && STATUSES.has(v) ? (v as BookingFeeDisputeStatus) : null;
}

/** What `booking_fee_open_dispute` answered, made safe. Anything unreadable is `error` — never a success. */
export type OpenDisputeAnswer =
  | { kind: 'auto_accepted'; viewCount: number | null; firstFoundAt: string | null }
  | { kind: 'under_review' }
  | { kind: 'already'; status: BookingFeeDisputeStatus }
  | { kind: 'not_disputable' }
  | { kind: 'error' };

export function readOpenDisputeAnswer(raw: unknown): OpenDisputeAnswer {
  if (!raw || typeof raw !== 'object') return { kind: 'error' };
  const r = raw as { result?: unknown; status?: unknown; view_count?: unknown; first_found_at?: unknown };
  switch (r.result) {
    case 'auto_accepted': {
      const n = Number(r.view_count);
      return {
        kind: 'auto_accepted',
        viewCount: r.view_count != null && Number.isFinite(n) && n >= 1 ? Math.floor(n) : null,
        firstFoundAt: typeof r.first_found_at === 'string' ? r.first_found_at : null,
      };
    }
    case 'under_review':
      return { kind: 'under_review' };
    case 'already': {
      const s = asDisputeStatus(r.status);
      return s ? { kind: 'already', status: s } : { kind: 'error' };
    }
    case 'not_disputable':
      return { kind: 'not_disputable' };
    default:
      return { kind: 'error' };
  }
}

/**
 * The reminder on a FIRST dispute — the owner's own wording (Explore_Replan_BUILD_SPEC_2026-07-27 §10), with
 * "card and website" said as "page" because a page open is what we count. No count on file → said without one.
 */
export function disputeOnUsLine(viewCount: number | null): string {
  const seen =
    viewCount && viewCount >= 1
      ? `they viewed your page ${viewCount === 1 ? 'once' : `${formatCount(viewCount)} times`} before booking`
      : 'they found you here before booking';
  return (
    `This one's on us. A note though: this couple found you on Setnayan — ${seen}. ` +
    `That's the power and reach of a Setnayan presence: couples find you easier and faster here. ` +
    `Future disputes are reviewed by our team.`
  );
}

/** What the fee bill says about a dispute, by its status. */
export function disputeStateLine(status: BookingFeeDisputeStatus, viewCount: number | null, note: string | null): string {
  switch (status) {
    case 'auto_accepted':
      return disputeOnUsLine(viewCount);
    case 'under_review':
      return 'You disputed this fee. Our team is reviewing it — you will get a notice here when they decide. The fee stays open until then.';
    case 'accepted':
      return `Our team accepted your dispute. This fee is waived.${note ? ` Their note: “${note}”` : ''}`;
    case 'rejected':
      return `Our team reviewed your dispute and the fee stands.${note ? ` Their note: “${note}”` : ''}`;
  }
}

/** The supplier's notice when an admin decides. Opens the bill it is about. */
export function disputeAnsweredNotice(args: { accepted: boolean; orderPath: string }): {
  title: string;
  body: string;
  relatedUrl: string;
} {
  return args.accepted
    ? { title: 'Your fee dispute was accepted', body: 'This booking fee is waived. Nothing is owed on it.', relatedUrl: args.orderPath }
    : { title: 'Your fee dispute was reviewed', body: 'Our team reviewed it and the booking fee stands. Open it to see their note.', relatedUrl: args.orderPath };
}

/** The admins' notice when a dispute waits for review. */
export function disputeOpenedAdminNotice(shopName: string | null): { title: string; body: string; relatedUrl: string } {
  const who = (shopName ?? '').trim() || 'A supplier';
  return {
    title: `${who} disputed a booking fee`,
    body: 'This is not their first dispute, so it waits for review. The receipts are on the disputes page.',
    relatedUrl: '/admin/disputes#fee-disputes',
  };
}

/** One line of receipts for the admin: when the couple first opened the shop here, and how often. */
export function foundReceiptLine(firstFoundAt: string | null, viewCount: number | null): string {
  if (!firstFoundAt) return 'No record of the couple opening this shop on Setnayan.';
  const n = viewCount && viewCount >= 1 ? (viewCount === 1 ? 'once' : `${formatCount(viewCount)} times`) : 'an unknown number of times';
  return `The couple first opened this shop here on ${formatLongTimestamp(firstFoundAt)}, ${n} before it joined their event.`;
}

/** Longest reason or note kept (the database refuses longer). */
export const DISPUTE_TEXT_MAX = 1000;

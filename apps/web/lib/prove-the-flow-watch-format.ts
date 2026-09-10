/**
 * lib/prove-the-flow-watch-format.ts
 *
 * PURE formatting for the T1 watcher (`scripts/prove-the-flow-watch.ts`) — how a
 * raw row from the live two-sided test reads in PLAIN WORDS. Split out from the
 * script so it can be unit-tested with no network and no `server-only` import
 * (CLAUDE.md rule 4: `server-only` is not installed for `node:test`).
 *
 * The script (never this file) does the actual read-only SELECTs against
 * production. This file only turns what came back into a sentence a
 * non-engineer can compare against what the screen just showed them — the
 * whole point of `Test_Script_Live_Two_Sided_2026-09-10.md`'s starred steps.
 *
 * Every function here is total: a null/undefined field reads as "not yet",
 * never a thrown error — a watcher that crashes on an empty table is useless
 * before the first tap of the test.
 */

export type CardRow = {
  service_id: string;
  title: string | null;
  category: string | null;
  price_php: number | string | null;
  is_active: boolean | null;
  includes_setnayan_gift: boolean | null;
};

export type ThreadRow = {
  thread_id: string;
  inquiry_status: string | null;
  accepted_at: string | null;
  agreed_price_centavos: number | string | null;
  locked_at: string | null;
  locked_by_user_id: string | null;
} | null;

export type MessageCounts = { total: number; fromVendor: number };

export type ProposalRow = {
  proposal_id: string;
  status: string | null;
  total_centavos: number | string | null;
  sent_at: string | null;
} | null;

export type AmendmentRow = {
  amendment_id: string;
  status: string | null;
  base_proposal_id: string | null;
  locked_at: string | null;
} | null;

export type EventVendorRow = {
  vendor_id: string;
  status: string | null;
  total_cost_php: number | string | null;
  linked_vendor_profile_id: string | null;
  selection_match_rank: number | null;
  lock_request_state: string | null;
} | null;

export type ChangeOrderRow = {
  change_order_id: string;
  raised_by: string | null;
  delta_amount_php: number | string | null;
  status: string | null;
};

function peso(n: number | string | null | undefined): string {
  if (n == null) return '—';
  const num = typeof n === 'string' ? Number(n) : n;
  if (!Number.isFinite(num)) return '—';
  return `₱${num.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
}

function pesoFromCentavos(c: number | string | null | undefined): string {
  if (c == null) return '—';
  const num = typeof c === 'string' ? Number(c) : c;
  if (!Number.isFinite(num)) return '—';
  return peso(num / 100);
}

/** Step 1 (A1/B1): did the card publish, does it have a name, is the gift a plain yes/no? */
export function describeCard(card: CardRow | null): string {
  if (!card) return 'No card found for this shop yet.';
  const name = card.title?.trim() || `(nameless — shows as "${card.category ?? 'its category'}")`;
  const live = card.is_active ? 'published' : 'not published';
  const price = card.price_php == null ? 'no price set' : `priced at ${peso(card.price_php)}`;
  const gift =
    card.includes_setnayan_gift == null
      ? 'gift value missing (should read as "no")'
      : card.includes_setnayan_gift
        ? 'gift set to yes'
        : 'gift set to no';
  return `Card "${name}" is ${live}, ${price}, ${gift}.`;
}

/** Step 3/4: the inquiry + whether the supplier has ever replied. */
export function describeThread(thread: ThreadRow, messages: MessageCounts): string {
  if (!thread) return 'No inquiry (chat thread) exists yet between this couple and this shop.';
  const status = thread.inquiry_status ?? 'pending';
  const accepted = thread.accepted_at ? `, accepted ${thread.accepted_at}` : '';
  const reply =
    messages.fromVendor > 0
      ? `the shop has replied ${messages.fromVendor} time(s)`
      : 'the shop has never replied in this thread';
  return `Inquiry is "${status}"${accepted}. ${messages.total} message(s) total — ${reply}.`;
}

/** Step 5 (A2): a Deal struck before a quote must NOT read as locked. */
export function describeAmendment(am: AmendmentRow, thread: ThreadRow): string {
  if (!am) return 'No Deal (amendment) has been struck in this thread yet.';
  const hasBase = am.base_proposal_id != null;
  const lines: string[] = [];
  lines.push(
    `Deal is "${am.status}"${hasBase ? ', built on a sent quote' : ', struck with NO quote behind it yet'}.`,
  );
  if (am.locked_at) {
    if (!hasBase) {
      lines.push(
        '⚠ DEFECT: this Deal has no quote behind it, but it is stamped locked_at anyway — the ' +
          '"Lock this deal" bug (A2) is still live.',
      );
    } else {
      lines.push(`Locked at ${am.locked_at}.`);
    }
  }
  if (thread?.locked_at && thread.agreed_price_centavos == null) {
    lines.push(
      '⚠ DEFECT: the thread is stamped locked with NO agreed price saved — a frozen NULL price.',
    );
  } else if (thread?.locked_at) {
    lines.push(`Thread price frozen at ${pesoFromCentavos(thread.agreed_price_centavos)}.`);
  }
  return lines.join(' ');
}

/** Step 6/7: the formal quote and whether the couple has accepted it. */
export function describeProposal(p: ProposalRow): string {
  if (!p) return 'No formal quote (proposal) has been sent yet.';
  const total = pesoFromCentavos(p.total_centavos);
  const sent = p.sent_at ? `sent ${p.sent_at}` : 'not yet sent (still a draft)';
  return `Quote is "${p.status}", ${total}, ${sent}.`;
}

/** Step 8/9 (A5): the lock handshake and where the shop now sits in the couple's list. */
export function describeLock(ev: EventVendorRow): string {
  if (!ev) return 'This shop is not on the couple\'s supplier list at all yet.';
  const booked = ev.status === 'contracted';
  const state = ev.lock_request_state ? `, lock request "${ev.lock_request_state}"` : '';
  const linked =
    ev.linked_vendor_profile_id && ev.selection_match_rank === 1
      ? 'and is marked the winning pick for its category (leads the group)'
      : booked
        ? '⚠ DEFECT: booked, but not stamped as the category winner — it may still sort like a candidate'
        : 'not yet the category winner';
  const total = ev.total_cost_php == null ? 'no price saved' : `booked at ${peso(ev.total_cost_php)}`;
  return `Status is "${ev.status}"${state}. ${total}, ${linked}.`;
}

/** Step 11 (B2): a price change after lock must show BOTH numbers, never replace one. */
export function describeChangeTrail(
  ev: EventVendorRow,
  changeOrders: ChangeOrderRow[],
  originalTotalPhp: number | null,
): string {
  if (!ev) return 'No booking to check a price change against.';
  const isNegative = ev.total_cost_php != null && Number(ev.total_cost_php) < 0;
  if (changeOrders.length === 0 && originalTotalPhp == null && !isNegative) {
    return 'No price change has been recorded since the lock.';
  }
  const lines: string[] = [];
  if (originalTotalPhp != null && ev.total_cost_php != null) {
    const current = Number(ev.total_cost_php);
    if (Math.abs(current - originalTotalPhp) > 0.01 && changeOrders.length === 0) {
      lines.push(
        `⚠ DEFECT: the booked total moved from ${peso(originalTotalPhp)} to ${peso(current)} with ` +
          'no change-order row explaining it — the old number was REPLACED, not shown beside the new one.',
      );
    }
  }
  for (const c of changeOrders) {
    const sign = Number(c.delta_amount_php) >= 0 ? 'add-on' : 'credit';
    lines.push(
      `Change order (${c.status}, raised by the ${c.raised_by ?? '?'}): ${sign} of ${peso(Math.abs(Number(c.delta_amount_php ?? 0)))}.`,
    );
  }
  if (isNegative) {
    lines.push('⚠ DEFECT: the booked total is NEGATIVE.');
  }
  return lines.length > 0 ? lines.join(' ') : 'No price change recorded.';
}

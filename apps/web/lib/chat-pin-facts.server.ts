/**
 * 📌 THE PIN READS — one batch, run beside each chat page's own reads (Supplier Build 3 · lane B, round 2).
 *
 * Every read is the READER'S OWN session: the supplier's RLS, the host's RLS, or a SECURITY DEFINER reader that answers
 * only members of this conversation (`chat_call_time_for`, `chat_coordinator_agree_needed`) — so the couple-only
 * Schedule is never widened to the supplier: they learn one timestamp, never a block. A read that fails drops ITS
 * pin only (logged), never the page.
 *
 * Quote expiry has no scheduler: when the newest quote is sent / viewed and past its Valid until (Manila), the page
 * calls `expire_lapsed_quotes()` once — the database moves it to `expired` and posts the chat line.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { BookedMoney } from './booked-money-step.server';
import { fetchDueFeeBills, FEE_BILLS_UNREADABLE } from './booking-fee-disclosure.server';
import { resolveBudgetVisibility } from './budget-visibility';
import { buildPinFacts, type PinFactInputs } from './chat-pin-facts';
import type { PinFact } from './chat-pins';
import { manilaTodayIsoFor } from './quote-valid-until';
import { logQueryError } from './supabase/error-detect';

export type ChatPinRead = {
  facts: PinFact[];
  /** The money is masked for this reader ("₱ — hosts only"). */
  masked: boolean;
  /**
   * The database says this reader's amounts are hidden (`chat_money_hidden`) — the stream then reads through the
   * masking readers (`chat_thread_messages_read` · `chat_quotes_read` · `chat_amendments_read` ·
   * `chat_amendment_items_read`), so the amounts never reach the browser from those reads.
   */
  streamMasked: boolean;
  /** The newest quote expired (after this read's own expiry pass): its id, for "Send a new quotation". */
  expiredQuoteId: string | null;
};

export async function readChatPinFacts(
  supabase: SupabaseClient,
  args: {
    side: 'vendor' | 'couple';
    eventId: string;
    vendorProfileId: string;
    threadId: string;
    userId: string;
    themName: string;
    supplierName: string;
    /** The page's own `readBookedMoney` — not read twice. */
    bookedMoney: Pick<BookedMoney, 'step' | 'terms'> | null;
    nowMs?: number;
  },
): Promise<ChatPinRead> {
  const nowMs = args.nowMs ?? Date.now();
  const todayPh = manilaTodayIsoFor(nowMs);
  const booked = Boolean(args.bookedMoney && args.bookedMoney.step.kind !== 'not_booked' && args.bookedMoney.step.kind !== 'unknown');

  const quoteRead = (async () => {
    const q = await supabase
      .from('vendor_proposals')
      .select('proposal_id, status, title, valid_until, valid_until_legacy, updated_at')
      .eq('event_id', args.eventId)
      .eq('vendor_profile_id', args.vendorProfileId)
      .in('status', ['sent', 'viewed', 'accepted', 'expired'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (q.error) {
      logQueryError('chatPins.quote', q.error, { event_id: args.eventId }, 'graceful_degrade');
      return null;
    }
    const row = q.data as {
      proposal_id: string;
      status: string;
      title: string | null;
      valid_until: string | null;
      valid_until_legacy: boolean | null;
      updated_at: string | null;
    } | null;
    if (!row) return null;
    const lapsed =
      (row.status === 'sent' || row.status === 'viewed') && row.valid_until && !row.valid_until_legacy && row.valid_until < todayPh;
    if (lapsed) {
      const { error } = await supabase.rpc('expire_lapsed_quotes', {
        p_event_id: args.eventId,
        p_vendor_profile_id: args.vendorProfileId,
      });
      if (error) logQueryError('chatPins.expire', error, { event_id: args.eventId }, 'graceful_degrade');
      else row.status = 'expired';
    }
    return { proposalId: row.proposal_id, status: row.status, title: row.title, validUntil: row.valid_until, updatedAt: row.updated_at };
  })();

  const callTimeRead = booked
    ? supabase
        .rpc('chat_call_time_for', { p_event_id: args.eventId, p_vendor_profile_id: args.vendorProfileId })
        .then(({ data, error }) => {
          if (error) {
            logQueryError('chatPins.callTime', error, { event_id: args.eventId }, 'graceful_degrade');
            return null;
          }
          return { at: (data as string | null) ?? null };
        })
    : Promise.resolve(null);

  const accessRead = supabase
    .from('event_access_requests')
    .select('request_id, created_at')
    .eq('event_id', args.eventId)
    .eq('vendor_profile_id', args.vendorProfileId)
    .eq('status', 'pending')
    .then(({ data, error }) => {
      if (error) {
        logQueryError('chatPins.access', error, { event_id: args.eventId }, 'graceful_degrade');
        return null;
      }
      return ((data ?? []) as { request_id: string; created_at: string }[]).map((r) => ({ requestId: r.request_id, createdAt: r.created_at }));
    });

  const feeRead =
    args.side === 'vendor'
      ? fetchDueFeeBills(supabase, args.userId).then((bills) =>
          bills === FEE_BILLS_UNREADABLE
            ? null
            : bills.filter((b) => b.eventId === args.eventId).map((b) => ({ orderId: b.orderId, amountPhp: b.amountPhp, dueOn: b.dueOn })),
        )
      : Promise.resolve(null);

  const agreeRead = supabase
    .rpc('chat_coordinator_agree_needed', { p_event_id: args.eventId, p_vendor_profile_id: args.vendorProfileId })
    .then(({ data, error }) => {
      if (error) {
        logQueryError('chatPins.coordinatorAgree', error, { event_id: args.eventId }, 'graceful_degrade');
        return null;
      }
      return data === true ? { since: null } : null;
    });

  // 🗳 Each open topic with who opened it and its filed count (`chat_decision_messages(count)` — one FK, so the bare
  // embed is unambiguous) — the pin reads "Decision · you opened it · 2 filed ›" in ONE request.
  const decisionsRead = supabase
    .from('chat_decision_topics')
    .select('topic_id, title, opened_at, reopened_at, opened_by_user_id, chat_decision_messages(count)')
    .eq('thread_id', args.threadId)
    .is('closed_at', null)
    .order('opened_at', { ascending: true })
    .then(({ data, error }) => {
      if (error) {
        logQueryError('chatPins.decisions', error, { thread_id: args.threadId }, 'graceful_degrade');
        return null;
      }
      type Row = {
        topic_id: string;
        title: string;
        opened_at: string;
        reopened_at: string | null;
        opened_by_user_id: string | null;
        chat_decision_messages: { count: number }[] | null;
      };
      return ((data ?? []) as Row[]).map((d) => ({
        topicId: d.topic_id,
        title: d.title,
        openedAt: d.reopened_at ?? d.opened_at,
        openedByYou: d.opened_by_user_id != null && d.opened_by_user_id === args.userId,
        // A missing aggregate is "not read", never 0 — the pin then shows no number rather than a false "0 filed".
        filedCount: typeof d.chat_decision_messages?.[0]?.count === 'number' ? d.chat_decision_messages[0].count : null,
      }));
    });

  // ✋ Changes the other side asked for, waiting on THIS reader — the change-approval blocker, derived here so its key
  // (`adjustment:<amendment_id>`) is stable and its shows count server-side like every other blocker.
  const changesRead = (async () => {
    const a = await supabase
      .from('proposal_amendments')
      .select('amendment_id, created_at')
      .eq('thread_id', args.threadId)
      .eq('status', 'proposed')
      .neq('raised_by', args.side === 'vendor' ? 'vendor' : 'couple')
      .order('created_at', { ascending: true });
    if (a.error) {
      logQueryError('chatPins.changes', a.error, { thread_id: args.threadId }, 'graceful_degrade');
      return null;
    }
    const rows = (a.data ?? []) as { amendment_id: string; created_at: string }[];
    if (rows.length === 0) return [];
    const it = await supabase
      .from('proposal_amendment_items')
      .select('amendment_id, amount_php')
      .in('amendment_id', rows.map((r) => r.amendment_id));
    const sum = new Map<string, number>();
    if (it.error) logQueryError('chatPins.changeItems', it.error, { thread_id: args.threadId }, 'graceful_degrade');
    for (const r of (it.data ?? []) as { amendment_id: string; amount_php: number | string | null }[]) {
      if (r.amount_php != null) sum.set(r.amendment_id, (sum.get(r.amendment_id) ?? 0) + Number(r.amount_php));
    }
    return rows.map((r) => ({
      amendmentId: r.amendment_id,
      createdAt: r.created_at,
      // A failed line read names no figure rather than a wrong one.
      deltaPhp: it.error ? null : (sum.get(r.amendment_id) ?? null),
    }));
  })();

  // 🔒 Money for a delegate refused Budget & payments is stripped HERE (the supplier always reads its own money).
  const visibilityRead =
    args.side === 'couple' ? resolveBudgetVisibility(supabase, args.eventId, args.userId) : Promise.resolve({ mayRead: true });
  // 🔒 The database's own answer (`chat_money_hidden`) — the SAME predicate the stream's readers mask by, so the pins
  // and the stream cannot disagree about who reads "₱ — hosts only". A failed answer is not "visible": the TS rule
  // above still decides.
  const hiddenRead =
    args.side === 'couple'
      ? supabase
          .rpc('chat_money_hidden', { p_event_id: args.eventId, p_vendor_profile_id: args.vendorProfileId })
          .then(({ data, error }) => {
            if (error) {
              logQueryError('chatPins.moneyHidden', error, { event_id: args.eventId }, 'graceful_degrade');
              return null;
            }
            return data === true;
          })
      : Promise.resolve(false);

  const [quote, callTime, accessAsks, feeBills, coordinatorAgree, decisions, visibility, changes, hidden] = await Promise.all([
    quoteRead,
    callTimeRead,
    accessRead,
    feeRead,
    agreeRead,
    decisionsRead,
    visibilityRead,
    changesRead,
    hiddenRead,
  ]);
  const masked = !visibility.mayRead || hidden === true;

  const inputs: PinFactInputs = {
    side: args.side,
    themName: args.themName,
    supplierName: args.supplierName,
    nowMs,
    todayPh,
    mayReadMoney: !masked,
    money: args.bookedMoney ? { step: args.bookedMoney.step, schedule: args.bookedMoney.terms?.schedule ?? [] } : null,
    callTime,
    accessAsks,
    feeBills,
    coordinatorAgree,
    quote,
    decisions,
    changes,
  };
  return {
    facts: buildPinFacts(inputs),
    masked,
    streamMasked: hidden === true,
    expiredQuoteId: quote?.status === 'expired' ? quote.proposalId : null,
  };
}

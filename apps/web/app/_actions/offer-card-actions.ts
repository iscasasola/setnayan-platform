'use server';

/**
 * 🏷 APPLY A DROPPED OFFER — the ONE server action behind the couple's "Apply to my quote" on the offer card in the
 * chat (Quote + negotiation · Piece 1 · PR-4, owner 2026-11-12).
 *
 * 🔢 ONE EXPORT ON PURPOSE: every exported server action is a Vercel route (`scripts/lint-server-action-budget.mjs`).
 * The drop itself is NOT an action — the supplier writes it from the browser under their own session (RLS + the
 * `chat_messages_offer_is_this_suppliers` trigger), like the cards' other plain lines (`card-calls.ts`).
 *
 * WHY A SERVER ACTION AND NOT A CARD CALL: the couple cannot write a quote (only the supplier inserts one; a sent quote
 * is immutable to every session), and the PRICE must be the Offer Maker's own answer — `offersForQuote`
 * (lib/quote-offer-door.ts, via `offerVersion` in lib/offer-drop.ts) — computed HERE, never trusted from a browser. So:
 *   1 · the caller is proven in their OWN session: they can read the message (RLS = they are in this chat) and they
 *       are a couple of the event, never a limited helper;
 *   2 · the offer, the live quote, the event day and the paid plan rows are read with the service role;
 *   3 · `offerVersion` prices it on its own card(s) only and re-splits the plan with paid rows frozen;
 *   4 · `apply_dropped_offer` (migration 20271339379038, service role only) writes the version atomically and refuses
 *       again on its own — an expired drop, an ended offer, a shape that is not "old lines + one offer line".
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { refuseLimitedHelper } from '@/lib/host-gate';
import { offerFromRow, VENDOR_OFFER_SELECT, type VendorOfferRow } from '@/lib/offers';
import { applyRefusal, applyRefusalWords, offerVersion, type DropLine } from '@/lib/offer-drop';
import { manilaTodayIsoFor } from '@/lib/quote-valid-until';

export type ApplyDroppedOfferResult = { ok: true; proposalId: string } | { ok: false; message: string };

export async function applyDroppedOffer(messageId: string): Promise<ApplyDroppedOfferResult> {
  if (typeof messageId !== 'string' || !/^[0-9a-f-]{36}$/i.test(messageId)) return { ok: false, message: applyRefusalWords('') };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return { ok: false, message: 'Sign in to apply this offer.' };

  // 1 · in this chat (RLS), and a couple of the event.
  const { data: msg, error: msgErr } = await supabase
    .from('chat_messages')
    .select('message_id, event_id, vendor_profile_id, vendor_offer_id, offer_good_until, created_at')
    .eq('message_id', messageId)
    .maybeSingle();
  if (msgErr || !msg) return { ok: false, message: applyRefusalWords('') };
  const m = msg as { event_id: string | null; vendor_profile_id: string; vendor_offer_id: number | null; offer_good_until: string | null };
  if (!m.event_id) return { ok: false, message: applyRefusalWords('NO_LIVE_QUOTE') };
  try {
    await refuseLimitedHelper(m.event_id, null);
  } catch {
    return { ok: false, message: applyRefusalWords('NOT_THE_COUPLE') };
  }
  const { data: seat } = await supabase
    .from('event_members')
    .select('event_id')
    .eq('event_id', m.event_id)
    .eq('user_id', uid)
    .eq('member_type', 'couple')
    .limit(1)
    .maybeSingle();
  if (!seat) return { ok: false, message: applyRefusalWords('NOT_THE_COUPLE') };

  // 2 · the facts, read once with the service role.
  const admin = createAdminClient();
  const today = manilaTodayIsoFor(Date.now());
  const offerRow = m.vendor_offer_id == null
    ? null
    : (await admin.from('vendor_offers').select(VENDOR_OFFER_SELECT).eq('id', m.vendor_offer_id).eq('vendor_profile_id', m.vendor_profile_id).maybeSingle()).data;
  const offer = offerRow ? offerFromRow(offerRow as unknown as VendorOfferRow) : null;
  const early = applyRefusal({ offer, goodUntil: m.offer_good_until, today });
  if (early || !offer) return { ok: false, message: early ?? applyRefusalWords('OFFER_ENDED') };

  const [{ data: quote, error: qErr }, { data: ev }, paid] = await Promise.all([
    admin
      .from('vendor_proposals')
      .select('proposal_id, line_items, total_centavos, payment_schedule, service_card_ids')
      .eq('event_id', m.event_id)
      .eq('vendor_profile_id', m.vendor_profile_id)
      .in('status', ['sent', 'viewed', 'accepted'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from('events').select('event_date').eq('event_id', m.event_id).maybeSingle(),
    paidSeqs(admin, m.event_id, m.vendor_profile_id),
  ]);
  if (qErr || paid === null) return { ok: false, message: applyRefusalWords('') };
  if (!quote) return { ok: false, message: applyRefusalWords('NO_LIVE_QUOTE') };
  const q = quote as { line_items: unknown; total_centavos: number; payment_schedule: unknown; service_card_ids: unknown };
  const eventDate = (ev as { event_date?: string | null } | null)?.event_date ?? null;

  // 3 · priced by offersForQuote, on its own card(s) only; paid rows frozen.
  const built = offerVersion({
    offer,
    lines: (Array.isArray(q.line_items) ? q.line_items : []) as DropLine[],
    totalCentavos: Number(q.total_centavos) || 0,
    quoteCardIds: Array.isArray(q.service_card_ids) ? (q.service_card_ids as unknown[]).map(String) : null,
    paymentSchedule: q.payment_schedule,
    paidSeqs: new Set(paid),
    today,
    eventDate: eventDate && /^\d{4}-\d{2}-\d{2}/.test(eventDate) ? eventDate.slice(0, 10) : null,
    now: new Date(),
  });
  if (!built.ok) return { ok: false, message: built.reason };

  // 4 · the one atomic write (and its own refusals).
  const { data: newId, error: rpcErr } = await admin.rpc('apply_dropped_offer', {
    p_message_id: messageId,
    p_actor: uid,
    p_line_items: built.version.lineItems,
    p_total_centavos: built.version.totalCentavos,
    p_payment_schedule: built.version.paymentSchedule,
  });
  if (rpcErr || typeof newId !== 'string') {
    console.warn('[offer-card] apply refused:', rpcErr?.message ?? 'no id');
    return { ok: false, message: applyRefusalWords(rpcErr?.message) };
  }
  return { ok: true, proposalId: newId };
}

/** The plan rows already paid (a confirmed, unrefused payment carrying its seq); null = the read failed. */
async function paidSeqs(admin: ReturnType<typeof createAdminClient>, eventId: string, shop: string): Promise<number[] | null> {
  const { data: rows, error } = await admin
    .from('event_vendors')
    .select('vendor_id')
    .eq('event_id', eventId)
    .eq('marketplace_vendor_id', shop);
  if (error) return null;
  const ids = ((rows ?? []) as { vendor_id: string }[]).map((r) => r.vendor_id);
  if (ids.length === 0) return [];
  const { data, error: pErr } = await admin
    .from('event_vendor_payments')
    .select('schedule_instance_seq')
    .in('vendor_id', ids)
    .not('vendor_confirmed_at', 'is', null)
    .is('payment_refused_at', null);
  if (pErr) return null;
  return ((data ?? []) as { schedule_instance_seq: number | null }[])
    .map((r) => r.schedule_instance_seq)
    .filter((v): v is number => typeof v === 'number');
}

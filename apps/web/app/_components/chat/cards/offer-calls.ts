/**
 * 🏷 THE OFFER CARD'S READS AND ITS ONE PLAIN WRITE (Quote + negotiation · PR-4, owner 2026-11-12).
 *
 * CALLED FROM THE BROWSER with the reader's own session, like `card-calls.ts` (kept apart so this PR never edits a
 * file another builder owns). Reads are the caller's own RLS; the supplier's DROP is their own insert into
 * `chat_messages` (the per-column grant + `chat_messages_offer_is_this_suppliers` refuse anything else). The couple's
 * APPLY is the one server action `applyDroppedOffer` (app/_actions/offer-card-actions.ts) — it prices on the server.
 *
 * A refused read returns `{ ok: false }` and the card says "Couldn't load" — never an empty list dressed as "none".
 */
import { createClient } from '@/lib/supabase/client';
import { offerFromRow, VENDOR_OFFER_SELECT, type Offer, type VendorOfferRow } from '@/lib/offers';
import { orderQuoteVersions, QUOTE_VERSION_SELECT, type QuoteVersion, type QuoteVersionRow } from '@/lib/quote-versions';
import { appliedVersion, priceWordsFor, type DropLine } from '@/lib/offer-drop';

type Fail = { ok: false };
function refused(where: string, reason: { code?: string; message?: string } | null | undefined): Fail {
  console.warn(`[offer-card] ${where}:`, reason?.code || reason?.message || 'no row');
  return { ok: false };
}

// ── The supplier's own offers (the drop sheet) ───────────────────────────────

export type DroppableOffer = { rowId: number; offer: Offer };

/** What the drop sheet prices against: the live quote (null = none yet), the event day, and the couple's names. */
export type DropContext = {
  quote: { lines: DropLine[]; totalCentavos: number; cardIds: string[] | null; schedule: unknown } | null;
  eventDate: string | null;
  /** "Ana & Miguel" — the event's own name; '' when it cannot be read (the line then says "Your client"). */
  couple: string;
};

/**
 * The shop's own offers (RLS: the shop's team reads every one of its own, on or off) and the live quote they would
 * change. A refused QUOTE read fails the whole load — the picker must never call a worse offer pickable because the
 * quote could not be read. The couple's names are a nicety: unreadable → ''.
 */
export async function loadMyOffers(threadId: string): Promise<{ ok: true; shop: string; offers: DroppableOffer[]; context: DropContext } | Fail> {
  const supabase = createClient();
  const { data: thread, error: tErr } = await supabase.from('chat_threads').select('event_id, vendor_profile_id').eq('thread_id', threadId).maybeSingle();
  if (tErr || !thread) return refused('drop · thread', tErr);
  const { event_id: eventId, vendor_profile_id: shop } = thread as { event_id: string; vendor_profile_id: string };
  const [offersRes, quoteRes, eventRes] = await Promise.all([
    supabase.from('vendor_offers').select(`id,${VENDOR_OFFER_SELECT}`).eq('vendor_profile_id', shop).order('sort_order', { ascending: true }),
    supabase
      .from('vendor_proposals')
      .select(`${QUOTE_VERSION_SELECT}, service_card_ids`)
      .eq('event_id', eventId)
      .eq('vendor_profile_id', shop)
      .in('status', ['sent', 'viewed', 'accepted'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('events').select('display_name, event_date').eq('event_id', eventId).maybeSingle(),
  ]);
  if (offersRes.error) return refused('drop · offers', offersRes.error);
  if (quoteRes.error) return refused('drop · quote', quoteRes.error);
  if (eventRes.error) console.warn('[offer-card] drop · event:', eventRes.error.code || eventRes.error.message);
  const offers = ((offersRes.data ?? []) as unknown as (VendorOfferRow & { id: number })[]).map((r) => ({ rowId: Number(r.id), offer: offerFromRow(r) }));
  const q = quoteRes.data as { line_items: unknown; total_centavos: number; payment_schedule: unknown; service_card_ids: unknown } | null;
  const ev = eventRes.data as { display_name?: string | null; event_date?: string | null } | null;
  const day = ev?.event_date ?? null;
  return {
    ok: true,
    shop,
    offers,
    context: {
      quote: q
        ? {
            lines: (Array.isArray(q.line_items) ? q.line_items : []) as DropLine[],
            totalCentavos: Number(q.total_centavos) || 0,
            cardIds: Array.isArray(q.service_card_ids) ? (q.service_card_ids as unknown[]).map(String) : null,
            schedule: q.payment_schedule,
          }
        : null,
      eventDate: day && /^\d{4}-\d{2}-\d{2}/.test(day) ? day.slice(0, 10) : null,
      couple: (ev?.display_name ?? '').trim(),
    },
  };
}

export type DropResult = { ok: true } | { ok: false; message: string };

/** Drop one offer into the chat — the supplier's own insert; the database checks it is theirs and dated. */
export async function dropOfferIntoChat(input: { threadId: string; rowId: number; offer: Offer; goodUntil: string }): Promise<DropResult> {
  const supabase = createClient();
  const { data: thread, error: tErr } = await supabase
    .from('chat_threads')
    .select('thread_id, event_id, vendor_profile_id')
    .eq('thread_id', input.threadId)
    .maybeSingle();
  if (tErr || !thread) return { ok: false, message: 'Couldn’t drop that. Try again.' };
  const t = thread as { thread_id: string; event_id: string; vendor_profile_id: string };
  const { error } = await supabase.from('chat_messages').insert({
    thread_id: t.thread_id,
    event_id: t.event_id,
    vendor_profile_id: t.vendor_profile_id,
    body: `🏷 Offer · ${input.offer.name.trim() || 'Your offer'} — ${priceWordsFor(input.offer)}. Apply it to your quote from this card.`,
    vendor_offer_id: input.rowId,
    offer_good_until: input.goodUntil,
  });
  if (error) {
    console.warn('[offer-card] drop refused:', error.code || error.message);
    if ((error.message ?? '').includes('OFFER_NEEDS_GOOD_UNTIL')) return { ok: false, message: 'Pick a Good until day — today or later.' };
    if ((error.message ?? '').includes('OFFER_NOT_YOURS') || (error.message ?? '').includes('CARD_NOT_THIS_CONVERSATION')) {
      return { ok: false, message: 'Only your own shop’s offers can be dropped here.' };
    }
    return { ok: false, message: 'Couldn’t drop that. Try again.' };
  }
  return { ok: true };
}

// ── One dropped offer, as both sides see it ──────────────────────────────────

export type DroppedOffer = {
  messageId: string;
  droppedAt: string;
  goodUntil: string | null;
  /** The marker is still set (the offer was not deleted). */
  markerPresent: boolean;
  /** The offer, when the reader may read it (the couple reads only a switched-on offer of a published shop). */
  offer: Offer | null;
  /** The version that took it, derived from a later version's `line_items[].offer_id` — null while none has. */
  appliedIn: number | null;
  /** The live quote's lines and cards — the couple's preview of what it takes off (the server prices it again). */
  quote: { lines: DropLine[]; totalCentavos: number; cardIds: string[] | null; schedule: unknown } | null;
  eventDate: string | null;
  versions: QuoteVersion[];
};

export async function loadDroppedOffer(messageId: string): Promise<{ ok: true; drop: DroppedOffer } | Fail> {
  const supabase = createClient();
  const { data: msg, error: mErr } = await supabase
    .from('chat_messages')
    .select('message_id, event_id, vendor_profile_id, vendor_offer_id, offer_good_until, created_at')
    .eq('message_id', messageId)
    .maybeSingle();
  if (mErr || !msg) return refused('offer · message', mErr);
  const m = msg as { message_id: string; event_id: string; vendor_profile_id: string; vendor_offer_id: number | null; offer_good_until: string | null; created_at: string };

  const [offerRes, versionsRes, eventRes] = await Promise.all([
    m.vendor_offer_id == null
      ? Promise.resolve({ data: null, error: null })
      : supabase.from('vendor_offers').select(VENDOR_OFFER_SELECT).eq('id', m.vendor_offer_id).maybeSingle(),
    supabase
      .from('vendor_proposals')
      .select(`${QUOTE_VERSION_SELECT}, service_card_ids, merge_snapshot`)
      .eq('event_id', m.event_id)
      .eq('vendor_profile_id', m.vendor_profile_id)
      .neq('status', 'draft'),
    supabase.from('events').select('event_date').eq('event_id', m.event_id).maybeSingle(),
  ]);
  if (offerRes.error) return refused('offer · offer', offerRes.error);
  if (versionsRes.error) return refused('offer · versions', versionsRes.error);
  const offer = offerRes.data ? offerFromRow(offerRes.data as unknown as VendorOfferRow) : null;
  const rows = (versionsRes.data ?? []) as unknown as (QuoteVersionRow & { service_card_ids: unknown; merge_snapshot: unknown })[];
  const versions = orderQuoteVersions(rows);

  // Which offer this drop is: the readable row's public id; else (the couple can no longer read a switched-off offer)
  // the version the writer stamped with THIS message — then "applied" is still read from that version's lines.
  const stamped = rows.find((r) => (r.merge_snapshot as { applied_offer?: { message_id?: string } } | null)?.applied_offer?.message_id === m.message_id);
  const offerId = offer?.id ?? ((stamped?.merge_snapshot as { applied_offer?: { offer_id?: string } } | null)?.applied_offer?.offer_id ?? null);
  const appliedIn = offerId ? appliedVersion(versions, offerId, m.created_at) : null;

  const live = [...rows]
    .filter((r) => ['sent', 'viewed', 'accepted'].includes(r.status))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
  const ev = (eventRes.data as { event_date?: string | null } | null)?.event_date ?? null;
  return {
    ok: true,
    drop: {
      messageId: m.message_id,
      droppedAt: m.created_at,
      goodUntil: m.offer_good_until,
      markerPresent: m.vendor_offer_id != null,
      offer,
      appliedIn,
      quote: live
        ? {
            lines: (Array.isArray(live.line_items) ? live.line_items : []) as DropLine[],
            totalCentavos: Number(live.total_centavos) || 0,
            cardIds: Array.isArray(live.service_card_ids) ? (live.service_card_ids as unknown[]).map(String) : null,
            schedule: live.payment_schedule,
          }
        : null,
      eventDate: ev && /^\d{4}-\d{2}-\d{2}/.test(ev) ? ev.slice(0, 10) : null,
      versions,
    },
  };
}

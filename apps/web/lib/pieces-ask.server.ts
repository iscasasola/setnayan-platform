import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * 🪑 THE PIECES ASK (Availability plan step 4, owner ruling 2, DECISION_LOG 2026-11-19 "AVAILABILITY STEPS 3 AND 4
 * APPROVED"; owner Q2 19 Nov): when the asked-for card is Rented by the piece, the COUPLE said how many when they
 * asked; the supplier's yes shows that number and may change it (`set_booked_quantity`, all or nothing).
 *
 * Null = the card is not by the piece (or the read failed) — Agree stands exactly as before. A failed read cannot
 * let a piece booking through without a number: `vendorAgreeToLock` refuses it (`pieces_needed`) server-side.
 */
export type PiecesAsk = { cardName: string; have: number; /** The couple's own number from their ask (NULL = not said). */ asked: number | null };

export async function piecesAskOf(supabase: SupabaseClient, eventVendorId: string): Promise<PiecesAsk | null> {
  try {
    const { data: ev, error } = await supabase
      .from('event_vendors')
      .select('service_id, booked_quantity')
      .eq('vendor_id', eventVendorId)
      .maybeSingle();
    const row = ev as { service_id: string | null; booked_quantity: number | null } | null;
    const serviceId = row?.service_id ?? null;
    if (error) console.error('[piecesAskOf] booking read failed', error.message);
    if (error || !serviceId) return null;
    const { data: card, error: cardErr } = await supabase
      .from('vendor_services')
      .select('title, availability_style, daily_capacity')
      .eq('vendor_service_id', serviceId)
      .maybeSingle();
    if (cardErr) console.error('[piecesAskOf] card read failed', cardErr.message);
    if (cardErr || !card) return null;
    const c = card as { title: string | null; availability_style: string | null; daily_capacity: number | null };
    if (c.availability_style !== 'piece' || !c.daily_capacity || c.daily_capacity < 1) return null;
    return { cardName: c.title?.trim() || 'this card', have: c.daily_capacity, asked: row?.booked_quantity ?? null };
  } catch (e) {
    console.error('[piecesAskOf] read threw', e);
    return null;
  }
}

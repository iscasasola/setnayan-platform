import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * 🪑 THE PIECES ASK (Availability plan step 4, owner ruling 2, DECISION_LOG 2026-11-19 "AVAILABILITY STEPS 3 AND 4
 * APPROVED"): when the asked-for card is Rented by the piece, the supplier's yes says HOW MANY ("200"). The couple's
 * picker is step 6; until then the supplier types it at the yes, and `set_booked_quantity` takes them all or nothing.
 *
 * Null = the card is not by the piece (or the read failed) — Agree stands exactly as before. A failed read cannot
 * let a piece booking through without a number: `vendorAgreeToLock` refuses it (`pieces_needed`) server-side.
 */
export type PiecesAsk = { cardName: string; have: number };

export async function piecesAskOf(supabase: SupabaseClient, eventVendorId: string): Promise<PiecesAsk | null> {
  try {
    const { data: ev, error } = await supabase
      .from('event_vendors')
      .select('service_id')
      .eq('vendor_id', eventVendorId)
      .maybeSingle();
    const serviceId = (ev as { service_id: string | null } | null)?.service_id ?? null;
    if (error || !serviceId) return null;
    const { data: card, error: cardErr } = await supabase
      .from('vendor_services')
      .select('title, availability_style, daily_capacity')
      .eq('vendor_service_id', serviceId)
      .maybeSingle();
    if (cardErr || !card) return null;
    const c = card as { title: string | null; availability_style: string | null; daily_capacity: number | null };
    if (c.availability_style !== 'piece' || !c.daily_capacity || c.daily_capacity < 1) return null;
    return { cardName: c.title?.trim() || 'this card', have: c.daily_capacity };
  } catch {
    return null;
  }
}

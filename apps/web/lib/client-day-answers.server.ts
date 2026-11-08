import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { readDateChangeAsks, readDeletionRequests } from '@/lib/vendor-overview-desk-reads';
import { dateChangeCardOf, deleteRequestCardOf, type WhatsNewCard } from '@/lib/vendor-overview';

export type ClientDayAnswerCard = Extract<WhatsNewCard, { kind: 'date_change' | 'delete_request' }>;

/**
 * 🗓 THE TWO ANSWERS THAT LEFT TODAY, FOR ONE CLIENT (THE ONE BUILD A8, 8 Nov 2026 — owner v112 *"Jump"*): the open
 * date-change asks (Move · Unlock) and the open delete request (Agree to remove · Keep it) for THIS event, read with
 * the very readers the Today desk used (`readDateChangeAsks`, `readDeletionRequests`) and shaped by the same mappers
 * (`dateChangeCardOf`, `deleteRequestCardOf`) — so the card on Details is the card Today held.
 *
 * Admin-scoped to this shop's own rows (`vendor_profile_id` / `marketplace_vendor_id`), like the desk.
 * 🔴 `complete: false` = a read was refused or short — Details says the requests could not load, never "none".
 */
export async function readClientDayAnswers(
  admin: SupabaseClient,
  vendorProfileId: string,
  eventId: string,
  meta: { coupleName: string | null; eventDate: string | null },
): Promise<{ cards: ClientDayAnswerCard[]; complete: boolean }> {
  const [dates, deletions] = await Promise.all([
    readDateChangeAsks(admin, vendorProfileId).catch((e: unknown) => ({ rows: [], error: String(e), complete: false })),
    readDeletionRequests(admin, vendorProfileId).catch((e: unknown) => ({ rows: [], error: String(e), complete: false })),
  ]);
  if (dates.error) logQueryError('client-day-answers: date changes', { message: dates.error }, { event_id: eventId }, 'graceful_degrade');
  if (deletions.error) logQueryError('client-day-answers: delete requests', { message: deletions.error }, { event_id: eventId }, 'graceful_degrade');
  const cards: ClientDayAnswerCard[] = [
    ...dates.rows.filter((r) => r.event_id === eventId).map((r) => dateChangeCardOf(r, meta.coupleName)),
    ...deletions.rows
      .filter((r) => r.event_id === eventId)
      .map((r) => deleteRequestCardOf({ eventId: r.event_id, eventVendorId: r.vendor_id, requestedAt: r.delete_requested_at }, meta)),
  ];
  return { cards, complete: dates.complete && deletions.complete };
}

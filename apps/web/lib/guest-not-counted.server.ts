import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { notCountedAfterSave, notCountedWords, type BookedService } from '@/lib/guest-not-counted';
import { readEventServiceCounts } from '@/lib/supplier-count.server';

/**
 * 🍽 "NOT COUNTED FOR ▾" — the reads and the one write (owner 2026-11-02; `lib/guest-not-counted.ts` for the rule).
 *
 * Every read here is MEASURED: a refused read returns `null`, and its caller then draws nothing it did not read — the
 * card offers no dropdown (so a refusal can never untick a guest the couple left out), the list carries no note. A
 * failure is never drawn as "Counted for all".
 */

/**
 * The event's PER-HEAD services — every supplier on the event in any status, not archived, whose service card is priced
 * per head (owner 2026-11-04) — in a steady order (trade, then shop), each with its count. Null = refused. ONE ask per
 * render, shared with the Suppliers page's rule rows (`readEventServiceCounts` › `askedOnce`).
 */
export async function readBookedServices(supabase: SupabaseClient, eventId: string): Promise<BookedService[] | null> {
  const counts = await readEventServiceCounts(supabase, eventId);
  if (!counts) return null;
  return [...counts.services].sort(
    (a, b) => a.label.localeCompare(b.label) || (a.shop ?? '').localeCompare(b.shop ?? '') || a.id.localeCompare(b.id),
  );
}

/** The card's dropdown: the booked services and the ones this guest is left out of. Null = either read refused. */
export async function readGuestNotCounted(
  supabase: SupabaseClient,
  eventId: string,
  guestId: string,
): Promise<{ services: BookedService[]; picked: string[] } | null> {
  const [services, { data, error }] = await Promise.all([
    readBookedServices(supabase, eventId),
    supabase.from('guest_not_counted_for').select('event_vendor_id').eq('guest_id', guestId),
  ]);
  if (error) {
    logQueryError('guestNotCounted.guestRows', error, { eventId, guestId }, 'graceful_degrade');
    return null;
  }
  if (!services) return null;
  const booked = new Set(services.map((s) => s.id));
  const picked = ((data ?? []) as { event_vendor_id: string }[]).map((r) => r.event_vendor_id).filter((id) => booked.has(id));
  // In the dropdown's own order, so the posted value never depends on what the database read first.
  return { services, picked: services.map((s) => s.id).filter((id) => picked.includes(id)) };
}

/** The Guest List's quiet note per guest — "Not counted for Catering". Null = refused (no notes drawn). */
export async function readNotCountedNotes(supabase: SupabaseClient, eventId: string): Promise<Record<string, string> | null> {
  const [services, { data, error }] = await Promise.all([
    readBookedServices(supabase, eventId),
    supabase.from('guest_not_counted_for').select('guest_id, event_vendor_id').eq('event_id', eventId),
  ]);
  if (error) {
    logQueryError('guestNotCounted.eventRows', error, { eventId }, 'graceful_degrade');
    return null;
  }
  if (!services) return null;
  const order = new Map(services.map((s, i) => [s.id, i] as const));
  const byGuest = new Map<string, string[]>();
  for (const r of (data ?? []) as { guest_id: string; event_vendor_id: string }[]) {
    if (!order.has(r.event_vendor_id)) continue; // a booking no longer booked counts nobody out
    byGuest.set(r.guest_id, [...(byGuest.get(r.guest_id) ?? []), r.event_vendor_id]);
  }
  const out: Record<string, string> = {};
  for (const [guestId, ids] of byGuest) {
    const words = notCountedWords(
      ids.sort((a, b) => order.get(a)! - order.get(b)!).map((id) => services[order.get(id)!]!.label),
    );
    if (words) out[guestId] = words;
  }
  return out;
}

/**
 * The card's save (`updateGuest`): this guest's ticks → `guest_not_counted_for`, as a DIFF (`notCountedAfterSave`) on the
 * user's own session — RLS decides who may (the couple, a helper with the guest list at edit). Best-effort, like the
 * card's Groups: the rest of the save has already landed; a refusal is logged and changes nothing.
 */
export async function syncCardNotCounted(
  supabase: SupabaseClient,
  eventId: string,
  guestId: string,
  picked: string[],
  base?: string[],
): Promise<void> {
  const services = await readBookedServices(supabase, eventId);
  if (!services) return;
  const { data, error } = await supabase.from('guest_not_counted_for').select('event_vendor_id').eq('guest_id', guestId);
  if (error) {
    logQueryError('guestNotCounted.sync', error, { eventId, guestId }, 'graceful_degrade');
    return;
  }
  const { add, drop } = notCountedAfterSave(
    ((data ?? []) as { event_vendor_id: string }[]).map((r) => r.event_vendor_id),
    picked,
    new Set(services.map((s) => s.id)),
    base,
  );
  if (add.length > 0) {
    const { error: addError } = await supabase
      .from('guest_not_counted_for')
      .upsert(
        add.map((event_vendor_id) => ({ guest_id: guestId, event_vendor_id, event_id: eventId })),
        { onConflict: 'guest_id,event_vendor_id', ignoreDuplicates: true },
      );
    if (addError) console.error('updateGuest: not-counted add failed', eventId, guestId, addError.message);
  }
  if (drop.length > 0) {
    const { error: dropError } = await supabase
      .from('guest_not_counted_for')
      .delete()
      .eq('guest_id', guestId)
      .in('event_vendor_id', drop);
    if (dropError) console.error('updateGuest: not-counted remove failed', eventId, guestId, dropError.message);
  }
}

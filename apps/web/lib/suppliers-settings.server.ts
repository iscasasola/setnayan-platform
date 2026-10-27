import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readSupplierShots } from '@/lib/event-memories.server';
import { fetchUpcomingItems } from '@/lib/upcoming-items';
import { sheetDate } from '@/lib/event-details-sheet';
import { formatPhp } from '@/lib/php';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { SuppliersSettingsView } from '@/lib/suppliers-settings';

/**
 * suppliers-settings.server.ts — the reads behind Suppliers ⚙ (owner 2026-10-27, DECISION_LOG "SUPPLIERS GETS ITS ⚙ —
 * THE SUPPLIER SETTINGS MOVE THERE"; verbatim *"what are the settings for suppliers?"* · *"and move them to
 * suppliers"*). The SAME reads Event Details made for these rows before they moved — each measured: a refused read
 * reaches the sheet as "We couldn’t read it just now", never as an empty row.
 *
 *   · costs    — `events.adaptive_pricing_mode` + the stored `guest_list_edit_deadline` (the writer, `updatePaxSettings`,
 *                writes both columns on every save, so the date must ride along — `lib/pax-settings-form.ts`).
 *   · payments — the next two supplier payments (`fetchUpcomingItems`, `vendor_payment`), as Event Details drew them.
 *   · photos   — the booked suppliers who shot here (`readSupplierShots`) with their names; the couple's only.
 */
export async function loadSuppliersSettings(
  supabase: SupabaseClient,
  eventId: string,
  opts: { isCouple: boolean; eventDate: string | null; ceremonyType: string | null },
): Promise<SuppliersSettingsView> {
  const [costsRead, upcoming, shots] = await Promise.all([
    supabase.from('events').select('adaptive_pricing_mode, guest_list_edit_deadline').eq('event_id', eventId).maybeSingle(),
    fetchUpcomingItems({
      supabase,
      eventId,
      eventDate: opts.eventDate,
      ceremonyType: opts.ceremonyType,
      now: new Date(),
      remindersEnabled: false,
      statutory: false,
      limit: 50,
    }).catch(() => null),
    opts.isCouple ? readSupplierShots(supabase, eventId).catch(() => null) : Promise.resolve(null),
  ]);

  if (costsRead.error) logQueryError('loadSuppliersSettings.costs', costsRead.error, { event_id: eventId }, 'graceful_degrade');
  const c = costsRead.data as { adaptive_pricing_mode: string | null; guest_list_edit_deadline: string | null } | null;
  const costs = costsRead.error || !c ? null : { mode: c.adaptive_pricing_mode === 'final_only' ? ('final_only' as const) : ('realtime' as const), deadline: c.guest_list_edit_deadline };

  const payments =
    !upcoming || upcoming.unreadableSources.includes('vendor_payment')
      ? null
      : upcoming.items
          .filter((i) => i.source === 'vendor_payment')
          .slice(0, 2)
          .map((p) => ({
            id: p.id,
            when: sheetDate(p.date.toISOString(), false) ?? '—',
            words: `${p.vendorBusinessName ?? p.subtitle} · ${p.title}${p.amountCentavos != null ? ` ${formatPhp(p.amountCentavos / 100)}` : ''}`,
          }));

  let photos: SuppliersSettingsView['photos'] = null;
  if (opts.isCouple && shots) {
    const ids = Object.keys(shots);
    if (ids.length === 0) photos = [];
    else {
      const names = await supabase.from('event_vendors').select('vendor_id, vendor_name').eq('event_id', eventId).in('vendor_id', ids);
      if (names.error) logQueryError('loadSuppliersSettings.names', names.error, { event_id: eventId }, 'graceful_degrade');
      const byId = new Map(((names.data ?? []) as { vendor_id: string; vendor_name: string | null }[]).map((r) => [r.vendor_id, r.vendor_name]));
      photos = ids.map((id) => ({ vendorRowId: id, name: byId.get(id) ?? 'Your supplier', hidden: shots[id]?.hidden === true }));
    }
  }
  return { costs, payments, photos, photosRead: !opts.isCouple || shots !== null };
}

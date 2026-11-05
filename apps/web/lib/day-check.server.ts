import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { parseDayCheck, type DayCheckRead } from './day-check';

/**
 * ONE READ FOR THE DAY UNDER A BOOKING ASK (`vendor_day_check`, migration 20271306441834) — plus, in parallel, the
 * hall check the yes already runs first (`vendor_card_halls_on`, `vendorAgreeToLock`), so a venue sees a taken hall
 * before the tap too. Two requests, both on the page's existing render, none per row.
 *
 * 🔒 HONEST: a refused or unreadable answer is `failed` — the line says "Couldn't check this day" — never a checked
 * day with zero bookings (apps/web/app/vendor-dashboard/reads-are-honest.test.ts's rule). A hall read that fails is
 * simply not drawn: it only ever ADDS a warning, and Agree still checks the halls itself.
 */
export async function readDayCheck(
  supabase: SupabaseClient,
  eventVendorId: string,
): Promise<DayCheckRead & { halls?: { taken: string[]; free: string[] } | null }> {
  const [dayRes, hallsRes] = await Promise.all([
    supabase.rpc('vendor_day_check', { p_event_vendor_id: eventVendorId }),
    supabase.rpc('vendor_card_halls_on', { p_event_vendor_id: eventVendorId }),
  ]);
  if (dayRes.error) {
    logQueryError('readDayCheck.vendor_day_check', dayRes.error, { eventVendorId });
    return { kind: 'failed' };
  }
  const raw = dayRes.data as { status?: unknown } | null;
  if (raw && raw.status === 'no_date') return { kind: 'no_date' };
  const check = parseDayCheck(raw);
  if (!check) {
    logQueryError('readDayCheck.parse', { message: `unreadable day check: ${JSON.stringify(raw)?.slice(0, 200)}` }, { eventVendorId });
    return { kind: 'failed' };
  }
  const h = (hallsRes.error ? null : hallsRes.data) as { status?: string; taken?: unknown; free?: unknown } | null;
  const names = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const halls = h?.status === 'hall_taken' ? { taken: names(h.taken), free: names(h.free) } : null;
  return { kind: 'ok', check, halls };
}

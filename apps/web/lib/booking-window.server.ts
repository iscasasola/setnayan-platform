import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { bookingWindowMessage, outsideBookingWindow, windowToday } from '@/lib/booking-window';
import { readBookingWindow } from '@/lib/check-a-date.server';

/**
 * 📅 THE SHOP'S BOOKING WINDOW, ASKED BY EVERY DOOR THAT ASKS OR BOOKS (walk 22 Nov 2026).
 *
 * The rule is the shop's "At least · At most" (`lib/booking-window.ts`, owner 2026-11-19). Check a date and Find grey
 * the days outside it, but until this file only the supplier-page ask (`finalizeVendor`) refused them. The chat's
 * "Lock this deal" (`bookVendorAtChatLock`), a package lock (`lockPackage`) and the wizard's [Lock this vendor] asked
 * the supplier for a day the couple had been shown as Not bookable. ONE helper now, beside `closedDayRefusal`, so the
 * four doors cannot drift again (`lib/every-booking-door-asks-the-window.test.ts`).
 *
 * Returns the couple's words when `day` is outside the window, else `null`. Day-precise events only: the caller passes
 * the day only when `event_date_precision === 'day'`.
 *
 * ⚖ FAILS OPEN, LOGGED, like the closed-day check and every capacity read on these doors: a read the couple cannot act
 * on must not block their ask. `readBookingWindow` logs a refused read; a thrown one is logged here.
 */
export async function bookingWindowRefusal(args: {
  vendorProfileId: string | null | undefined;
  day: unknown;
  admin?: SupabaseClient;
  now?: Date;
}): Promise<string | null> {
  const day = typeof args.day === 'string' ? args.day.slice(0, 10) : null;
  if (!args.vendorProfileId || !day) return null;
  try {
    const window = await readBookingWindow(args.admin ?? createAdminClient(), args.vendorProfileId);
    if (!window) return null;
    const outside = outsideBookingWindow(day, windowToday(args.now), window);
    return outside ? bookingWindowMessage(outside, window) : null;
  } catch (e) {
    console.error('[bookingWindowRefusal] the window could not be read — not refused here', {
      vendor_profile_id: args.vendorProfileId,
      day,
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

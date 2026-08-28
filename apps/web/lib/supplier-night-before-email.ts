import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { formatEventDate } from '@/lib/events';
import { deriveCallTime, type LensBlock } from '@/lib/vendor-timeline';
import { addDaysToIso } from '@/lib/anniversary-dates';
import { isSupplierNightBeforeEmailEnabled } from '@/lib/supplier-night-before-email-flag';
import {
  buildSupplierNightBeforeEmail,
  formatVenueClock,
  manilaTodayIso,
} from '@/lib/supplier-night-before-email-core';

/**
 * The night-before supplier email (S5 — cron-free, ships OFF).
 * WHATS_NEXT_Suppliers_Room_SESSIONS_2026-08-27.md § S5.
 *
 * 🔴 SHIPS SWITCHED OFF. `isSupplierNightBeforeEmailEnabled()` is the ONLY
 * gate — the owner has not yet ruled on emailing a supplier automatically at
 * an address they never gave us. The `after()` mount that calls this stays
 * permanently present (mirrors `papic-fullres-drop.ts`'s own kill-switch
 * shape); only the flag governs whether it ever does anything.
 *
 * ⛔ NOT hung on the `isScheduledLaunchDue()` branch already on `/{slug}` —
 * that branch is true for approximately no page loads (a private event with a
 * FUTURE `scheduled_launch_at` that has just passed), so a job that piggybacks
 * on it would ship dead with every test green. Wired into `runDailyEmailJobs`
 * instead, the same traffic-driven runner every other cron-free email uses.
 *
 * 🔑 EMAIL ONLY, TO A REGISTERED ACCOUNT ONLY. Reads `linked_vendor_profile_id`
 * (the canonical "this booking is a real vendor account" column), never
 * `event_vendors.contact_email` — 44 of 45 prod supplier rows are a name the
 * COUPLE typed with no account behind it, and the vendor tree writes no push
 * subscription at all. The address used is the one on the vendor's OWN
 * account (`users.email` via `vendor_profiles.user_id`) — the address they
 * gave US at signup, never one a couple supplied on their behalf.
 *
 * 🔑 DATE-GRANULAR, NOT HOUR-GRANULAR. The daily claim gap is ~20 hours
 * (`DAILY_GAP_MS`), so on a 24-hour clock the fire time drifts ~4h earlier
 * every day and settles at no fixed hour — a job aimed at a specific hour
 * "the night before" would eventually fire after the ceremony. This job asks
 * only "is a booked supplier's event TOMORROW (Manila calendar date)", which
 * is true for the whole day before regardless of what hour the claim lands.
 *
 * Single-day events only (`events.event_date`) — a multi-day celebration's
 * later days are out of this build's scope, same as the rest of the vendor
 * call-time surface (`vendor-dayof-countdown.ts`).
 */

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/+$/, '');

/** `event_vendors.status` values that mean "this is a real booking", not a
 * couple still shopping around. Mirrors `lib/ghosting.ts`'s own booked set. */
const BOOKED_STATUSES = ['contracted', 'deposit_paid', 'delivered', 'complete'] as const;

const NIGHT_BEFORE_MAX_BATCH = 500;

export async function runSupplierNightBeforeEmailReminders(): Promise<{ scanned: number; sent: number }> {
  if (!isSupplierNightBeforeEmailEnabled()) return { scanned: 0, sent: 0 };

  const admin = createAdminClient();
  const tomorrow = addDaysToIso(manilaTodayIso(), 1);

  const { data: events, error: eventsError } = await admin
    .from('events')
    .select('event_id, display_name, event_date')
    .eq('event_date', tomorrow)
    .limit(NIGHT_BEFORE_MAX_BATCH);
  if (eventsError || !events || events.length === 0) return { scanned: 0, sent: 0 };

  const eventIds = events.map((e) => e.event_id as string);
  const eventById = new Map(events.map((e) => [e.event_id as string, e]));

  const { data: bookings, error: bookingsError } = await admin
    .from('event_vendors')
    .select('vendor_id, event_id, category, linked_vendor_profile_id')
    .in('event_id', eventIds)
    .in('status', BOOKED_STATUSES as unknown as string[])
    .not('linked_vendor_profile_id', 'is', null)
    .limit(NIGHT_BEFORE_MAX_BATCH);
  if (bookingsError || !bookings || bookings.length === 0) return { scanned: 0, sent: 0 };

  const vendorProfileIds = [...new Set(bookings.map((b) => b.linked_vendor_profile_id as string))];
  const { data: vendorProfiles } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name, user_id')
    .in('vendor_profile_id', vendorProfileIds);
  const vendorProfileById = new Map((vendorProfiles ?? []).map((v) => [v.vendor_profile_id as string, v]));

  const userIds = [...new Set((vendorProfiles ?? []).map((v) => v.user_id as string))];
  const { data: users } = await admin.from('users').select('user_id, email').in('user_id', userIds);
  const emailByUserId = new Map((users ?? []).map((u) => [u.user_id as string, u.email as string | null]));

  let sent = 0;
  for (const booking of bookings) {
    try {
      const event = eventById.get(booking.event_id as string);
      const vp = vendorProfileById.get(booking.linked_vendor_profile_id as string);
      if (!event || !vp) continue;

      const to = (emailByUserId.get(vp.user_id as string) ?? '').trim();
      if (!to) continue;

      // Insert-first claim, BEFORE the send — mirrors anniversary_headsup_log.
      // A unique-violation on the (event_vendor_id, event_date) PK means this
      // exact booking's night-before email for this exact date already went.
      const { error: lockErr } = await admin
        .from('supplier_night_before_email_log')
        .insert({ event_vendor_id: booking.vendor_id, event_date: tomorrow });
      if (lockErr) continue;

      const { data: blocksRaw } = await admin
        .from('event_schedule_blocks')
        .select('label, block_type, start_at')
        .eq('event_id', booking.event_id);
      const blocks = (blocksRaw ?? []) as LensBlock[];
      // Same pure lens the vendor Brief page uses (vendor-timeline.ts) — a
      // single-category booking, so no separate relevance ranking is needed.
      const suggestion = deriveCallTime(blocks, [booking.category as string]);
      const callTimeLabel = suggestion ? formatVenueClock(suggestion.call_time) : null;

      const built = buildSupplierNightBeforeEmail({
        businessName: (vp.business_name as string | null) ?? '',
        eventDisplayName: (event.display_name as string | null) ?? '',
        eventDayLabel: formatEventDate(event.event_date as string),
        callTimeLabel,
        ctaHref: `${APP_URL}/vendor-dashboard/clients/${booking.event_id}`,
      });

      const result = await sendEmail({ to, subject: built.subject, text: built.text, html: built.html });
      if (result.ok) {
        sent += 1;
        await admin
          .from('supplier_night_before_email_log')
          .update({ resend_id: result.id })
          .eq('event_vendor_id', booking.vendor_id)
          .eq('event_date', tomorrow);
      } else {
        // Send failed / Resend unconfigured — release the lock so a later
        // run retries. A possible duplicate beats a silently-dropped notice.
        await admin
          .from('supplier_night_before_email_log')
          .delete()
          .eq('event_vendor_id', booking.vendor_id)
          .eq('event_date', tomorrow);
      }
    } catch (e) {
      console.error('[supplier-night-before-email] booking failed:', booking.vendor_id, e);
    }
  }
  return { scanned: bookings.length, sent };
}

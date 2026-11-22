import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { dayMonthWords, clientAgenda } from './client-agenda';
import { clientScheduleDays, scheduleDaysUnread, unreadDaysLine } from './schedule-days';
import { resolveAppointmentLabel } from './appointments';
import { fetchPlanProgressForCouple } from './vendor-service-payment-schedules.server';
import { buildSupplierDay, type SupplierBlockRow } from './supplier-schedule';
import { VENUE_CATEGORIES } from './supplier-where';
import { manilaTodayIso } from './supplier-night-before-email-core';
import type { HostAsk } from './schedule-ask';
import type { WholeDay } from './hosts-whole-day';

/**
 * 📅 THE WHOLE DAY, RISEN FROM THE HOSTS' CHAT (Unichat part F, drawing `unichat_live_v3_2026-11-20.html`
 * `riseBody('next')`, hosts' side). The supplier's chat raises "Your part of the day"; the hosts' chat with that shop
 * raises the same dated list — what is dated with THIS shop (meetings, payments) — then the event day: the venue's
 * hours and "The whole day", every moment, this shop's own ones marked and askable (a new time goes through the shipped
 * ask, `updateScheduleBlock` moment_op `ask_supplier`).
 *
 * Read on the HOSTS' session (their RLS), only when the ⋯ menu's Schedule is pressed (`?day=1`), never on every chat
 * load. Every read that is refused is said, never drawn as an empty day:
 *   · the meetings or the payments → the shipped "couldn't load" line (`unreadDaysLine`);
 *   · the blocks or the bookings → `day: null` ("Couldn't load the day just now").
 * ⏰ Every block is read, Time-TBA chapters included (`time_tba` — never a 12:00 AM, `buildSupplierDay` says "Time TBA").
 */

const BLOCK_SELECT =
  'block_id, label, start_at, end_at, location, parent_block_id, spot, time_tba, follows_block_id, sort_order, time_shape, time_or_minutes, is_optional, responsible_vendor_ids, created_at, updated_at, ingress_minutes_before, egress_minutes_after, hours_vendor_id';

export async function loadHostsWholeDay(
  supabase: SupabaseClient,
  args: { eventId: string; vendorProfileId: string; eventDate: string | null; shopName: string },
): Promise<WholeDay> {
  const { eventId, vendorProfileId, eventDate, shopName } = args;
  const [bookingsRes, blocksRes, catalogRes, apptRes, asksRes] = await Promise.all([
    supabase.from('event_vendors').select('vendor_id, vendor_name, category, marketplace_vendor_id').eq('event_id', eventId),
    supabase
      .from('event_schedule_blocks')
      .select(BLOCK_SELECT)
      .eq('event_id', eventId)
      .order('start_at', { ascending: true })
      .order('sort_order', { ascending: true }),
    supabase.from('appointment_type_catalog').select('type, label').eq('is_active', true),
    supabase
      .from('event_appointments')
      .select('appointment_id, type, custom_label, scheduled_at, status')
      .eq('event_id', eventId)
      .eq('vendor_profile_id', vendorProfileId),
    supabase
      .from('event_schedule_suggestions')
      .select('suggestion_id, block_id, vendor_profile_id, suggested_by_name, asked_as, proposed_start_at, proposed_end_at, note, status, answer_note, created_at, kind')
      .eq('event_id', eventId)
      .eq('vendor_profile_id', vendorProfileId)
      .eq('direction', 'to_supplier')
      .order('created_at', { ascending: false })
      .limit(60),
  ]);

  const bookings = (bookingsRes.data ?? []) as { vendor_id: string; vendor_name: string | null; category: string | null; marketplace_vendor_id: string | null }[];
  const shopBookingIds = bookings.filter((b) => b.marketplace_vendor_id === vendorProfileId).map((b) => b.vendor_id);

  // 💳 The payment plan of each of this shop's bookings (usually one) — a refused read is "couldn't load", never ₱0.
  const plans = await Promise.all(shopBookingIds.map((id) => fetchPlanProgressForCouple({ authedClient: supabase, eventId, eventVendorId: id })));
  const paymentsRead = !bookingsRes.error && plans.every((p) => p.readComplete);

  const typeLabels: Record<string, string> = {};
  for (const r of (catalogRes.data ?? []) as { type: string; label: string }[]) typeLabels[r.type] = r.label;
  const meetings = ((apptRes.data ?? []) as { appointment_id: string; type: string; custom_label: string | null; scheduled_at: string | null; status: string }[]).map((a) => ({
    appointment_id: a.appointment_id,
    scheduled_at: a.scheduled_at,
    status: a.status,
    label: resolveAppointmentLabel(a, typeLabels),
  }));

  const agenda = clientAgenda({
    todayIso: manilaTodayIso(),
    eventDate,
    days: clientScheduleDays({ eventDate, chapters: [], meetings, payments: plans.flatMap((p) => p.steps ?? []) }),
    quote: null,
  });

  const day =
    blocksRes.error || bookingsRes.error
      ? null
      : buildSupplierDay({
          blocks: ((blocksRes.data ?? []) as (SupplierBlockRow & { time_tba: boolean | null; is_optional: boolean | null })[]).map((b) => ({
            ...b,
            time_tba: b.time_tba === true,
            is_optional: b.is_optional === true,
            sort_order: b.sort_order ?? 0,
            time_shape: b.time_shape ?? 'at',
            responsible_vendor_ids: b.responsible_vendor_ids ?? [],
          })),
          myBookingIds: shopBookingIds,
          venueBookingIds: bookings.filter((b) => VENUE_CATEGORIES.has(b.category ?? '')).map((b) => b.vendor_id),
          venueNames: bookings.filter((b) => VENUE_CATEGORIES.has(b.category ?? '')).map((b) => ({ vendor_id: b.vendor_id, vendor_name: b.vendor_name })),
          tasks: [],
          requests: [],
        });

  const asks = asksRes.error
    ? null
    : ((asksRes.data ?? []) as HostAsk[]).filter((a) => a.kind !== 'where').map((a) => ({ ...a, shop: { business_name: shopName } }));

  return {
    eventId,
    shopName,
    agenda,
    eventDate,
    eventDayWords: dayMonthWords(eventDate),
    unreadLine: unreadDaysLine(scheduleDaysUnread({ meetingsRead: !apptRes.error, paymentsRead })),
    day,
    shopBookingIds,
    asks,
  };
}

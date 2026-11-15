'use server';

/**
 * openFactSheet — the ONE read behind the date sheet and the place sheet on the Suppliers page (PR5). It runs when a
 * sheet OPENS (never with the page): the page's first paint pays nothing for two sheets most visits never open.
 *
 * 🔒 READ-ONLY. Every write the sheets make goes through the doors that already exist — the event's one date door
 * (`updateEventDate`, which refuses a day a booked supplier cannot do and names them; owner 2026-11-05), the Event Hub
 * draft for the place (`hubDraftAction` intent `save`) and the date-change request (intent `date_change`). Nothing here
 * writes.
 *
 * Who: the couple only, on an event whose type has an Event Hub — the same rule as the Event Details record's sheet
 * (`record-field-slot.tsx`): the venues are Event Hub publications that wait for Apply.
 *
 * The date is the EVENT'S own (owner 2026-11-05, "it shouldn't rely on the hub": it is never drafted) — and Help me choose compares a
 * month's Saturdays through the ONE calendar truth (`lib/calendar-truth.ts`), offering only the days every PRICED
 * pick can take (owner 2026-10-10 answer 8). `priced` comes from the page that drew the build; it only narrows what
 * is SHOWN, and is checked to be this event's own suppliers before it is used.
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchEventViewer } from '@/lib/event-viewer.server';
import { resolveProfileByEvent, surfaceEnabled } from '@/lib/event-type-profile';
import { resolveWeddingOnlyParts } from '@/lib/wedding-only-parts';
import { readHubDraft } from '@/lib/hub-draft-store';
import { readOpenDateChange } from '@/lib/date-change.server';
import { readLiveCeremonyTime } from '@/lib/ceremony-time.server';
import { fetchEventVendors } from '@/lib/vendors';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';
import { buildScheduleMatrix, schedulePicksFromVendors } from '@/lib/schedule-matrix';
import { fittingDates } from '@/lib/date-fits-booked';
import { readCalendarTruth } from '@/lib/calendar-truth.server';
import { daysFreeForPricedPicks, helpMonthOf } from '@/lib/help-me-choose';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { DateSheetData, FactSheetData, FactSheetKey, PlaceSheetData } from '@/lib/suppliers-fact-sheets';
import { loadYourEvent } from '../../launch/_components/details-your-event-load';
import { eventDateFloorExempt } from '@/lib/event-date-floor.server';
import { regionLabel } from '@/lib/region-source';

const NOT_OPENED = 'This could not be opened just now. Nothing was changed — close it and try again in a moment.';
const PRECISIONS = new Set(['day', 'month', 'year']);

export async function openFactSheet(
  eventId: string,
  input: { which: FactSheetKey; month?: string | null; priced?: readonly string[] },
): Promise<FactSheetData> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'Please sign in again.' };
    const [viewer, profile] = await Promise.all([fetchEventViewer(supabase, eventId, user.id), resolveProfileByEvent(eventId)]);
    if (!viewer.isCouple || !surfaceEnabled(profile, 'website')) return { ok: false, error: 'Only the couple can change the date and the place.' };

    const draft = await readHubDraft(supabase, eventId).catch(() => null);
    const drafted = (draft?.events ?? {}) as Record<string, unknown>;

    if (input.which === 'place') {
      const admin = createAdminClient();
      const yours = await loadYourEvent({
        supabase,
        admin,
        eventId,
        mayShowStdFilm: resolveWeddingOnlyParts(profile).save_the_date_film,
        parentCount: 0,
        hostCount: 0,
        drafted,
        draftedVenue: draft?.widgets.venue_map?.venue ?? null,
      });
      if (!yours) return { ok: false, error: NOT_OPENED };
      /* 📍 No reception city line (a non-wedding) → City or area is the event's Region, one value (owner 2026-11-13). */
      let region: PlaceSheetData['region'] = null;
      if (yours.venues.city === null) {
        const r = await supabase.from('events_host').select('region').eq('event_id', eventId).maybeSingle();
        if (r.error || !r.data) {
          if (r.error) logQueryError('suppliers fact sheet: region', r.error, { event_id: eventId }, 'graceful_degrade');
          return { ok: false, error: NOT_OPENED };
        }
        const value = ((r.data as { region: string | null }).region ?? null) || null;
        region = { value, label: value ? (regionLabel(value) ?? value) : null };
      }
      const place: PlaceSheetData = {
        city: yours.venues.city,
        region,
        slots: yours.venues.slots.map((s) => ({
          slot: s.slot,
          label: s.label,
          booked: s.booked
            ? {
                name: s.booked.name,
                address: s.booked.address,
                pinned: s.booked.pin != null,
                pinFrom: s.booked.pinFrom ?? null,
                vendorId: s.booked.vendorId ?? null,
                pin: s.booked.pin,
              }
            : null,
          choice: s.choice,
          typed: s.typed,
          address: s.address,
          pin: s.pin,
          columns: s.columns,
        })),
      };
      return { ok: true, which: 'place', place };
    }

    // ── THE DATE ──────────────────────────────────────────────────────────────
    const [row, vendors, liveTime, change, dateExempt] = await Promise.all([
      supabase
        .from('events_host')
        .select('event_date, event_date_precision, event_end_date, event_days, date_mode, date_candidates, date_window_start, date_window_end')
        .eq('event_id', eventId)
        .maybeSingle(),
      fetchEventVendors(supabase, eventId),
      readLiveCeremonyTime(supabase, eventId).catch(() => null),
      readOpenDateChange(supabase, eventId),
      eventDateFloorExempt(supabase, { eventId }).catch(() => false),
    ]);
    if (row.error || !row.data) {
      if (row.error) logQueryError('suppliers fact sheet: event', row.error, { event_id: eventId }, 'graceful_degrade');
      return { ok: false, error: NOT_OPENED };
    }
    // 🗓 The event's own date — never a drafted one (owner 2026-11-05, "it shouldn't rely on the hub").
    const live = row.data as {
      event_date: string | null;
      event_date_precision: string | null;
      event_end_date: string | null;
      event_days: number | null;
      date_mode: string | null;
      date_candidates: string[] | null;
      date_window_start: string | null;
      date_window_end: string | null;
    };
    const date = live.event_date ?? null;
    const rawPrecision = String(live.event_date_precision ?? 'day');
    const precision = date ? ((PRECISIONS.has(rawPrecision) ? rawPrecision : 'day') as DateSheetData['precision']) : null;
    const ceremonyTime = typeof drafted.ceremony_time === 'string' ? drafted.ceremony_time : liveTime;
    const confirmed = new Set<string>(CONFIRMED_VENDOR_STATUSES as readonly string[]);
    const bookedNames = vendors.filter((v) => confirmed.has(v.status)).map((v) => v.vendor_name);

    // ── HELP ME CHOOSE — one month's Saturdays, through the calendar truth ─────
    const month = helpMonthOf(input.month, date, precision);
    let help: DateSheetData['help'] = null;
    if (month) {
      const own = new Set(vendors.map((v) => v.vendor_id));
      const priced = new Set((input.priced ?? []).filter((id) => own.has(id)));
      for (const v of vendors) if (confirmed.has(v.status)) priced.add(v.vendor_id);
      const admin = createAdminClient();
      try {
        const m = await buildScheduleMatrix(
          { admin, eventDate: `${month}-01`, precision: 'month', picks: schedulePicksFromVendors(vendors) },
          { truth: (days, ids) => readCalendarTruth({ admin, supplierIds: ids, days }) },
        );
        const days = fittingDates(daysFreeForPricedPicks(m.dates, priced)).map((d, i) => ({ ...d, isBest: i === 0 && d.totalCategories > 0 }));
        help = { month, days, pricedCount: priced.size, offPlatformCount: m.offPlatformCount };
      } catch (e) {
        console.error('[suppliers fact sheet] help me choose could not be read:', e instanceof Error ? e.message : e);
        help = 'unread';
      }
    }

    return {
      ok: true,
      which: 'date',
      date: {
        date,
        precision,
        ceremonyTime,
        bookedNames,
        // The day the bookings hold — the event's date when it is one day.
        bookedDay: bookedNames.length > 0 && live.event_date && (live.event_date_precision ?? 'day') === 'day' ? live.event_date : null,
        change: change.ok ? change.view : null,
        help,
        // 📅 The span, the day count, the type's cap and the options (owner 2026-11-13).
        endDate: live.event_end_date ?? null,
        days: Math.max(1, Number(live.event_days ?? 1) || 1),
        maxDays: profile.maxDays,
        options: {
          mode: live.date_mode === 'window' ? 'window' : 'specific',
          candidates: Array.isArray(live.date_candidates) ? live.date_candidates.filter((d): d is string => typeof d === 'string') : [],
          windowStart: live.date_window_start ?? null,
          windowEnd: live.date_window_end ?? null,
        },
        dateExempt,
      },
    };
  } catch (e) {
    console.error('[suppliers fact sheet] could not be opened:', e instanceof Error ? e.message : e);
    return { ok: false, error: NOT_OPENED };
  }
}

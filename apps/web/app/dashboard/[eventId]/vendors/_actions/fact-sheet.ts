'use server';

/**
 * openFactSheet — the ONE read behind the date sheet and the place sheet on the Suppliers page (PR5). It runs when a
 * sheet OPENS (never with the page): the page's first paint pays nothing for two sheets most visits never open.
 *
 * 🔒 READ-ONLY. Every write the sheets make goes through the doors that already exist — the Event Hub draft
 * (`hubDraftAction` intent `save`, which refuses a day a booked supplier cannot do and names them) and the date-change
 * request (intent `date_change`). Nothing here writes.
 *
 * Who: the couple only, on an event whose type has an Event Hub — the same rule as the Event Details record's sheet
 * (`record-field-slot.tsx`): the date and the venues are Event Hub publications that wait for Apply.
 *
 * The date is shown AS THE COUPLE IS WORKING ON IT — the draft over the live row — and Help me choose compares a
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
      const place: PlaceSheetData = {
        city: yours.venues.city,
        slots: yours.venues.slots.map((s) => ({
          slot: s.slot,
          label: s.label,
          booked: s.booked ? { name: s.booked.name, address: s.booked.address, pinned: s.booked.pin != null } : null,
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
    const [row, vendors, liveTime, change] = await Promise.all([
      supabase.from('events_host').select('event_date, event_date_precision').eq('event_id', eventId).maybeSingle(),
      fetchEventVendors(supabase, eventId),
      readLiveCeremonyTime(supabase, eventId).catch(() => null),
      readOpenDateChange(supabase, eventId),
    ]);
    if (row.error || !row.data) {
      if (row.error) logQueryError('suppliers fact sheet: event', row.error, { event_id: eventId }, 'graceful_degrade');
      return { ok: false, error: NOT_OPENED };
    }
    const live = row.data as { event_date: string | null; event_date_precision: string | null };
    const hasDraftDate = 'event_date' in drafted || 'event_date_precision' in drafted;
    const date = (hasDraftDate ? (drafted.event_date as string | null) : live.event_date) ?? null;
    const rawPrecision = String((hasDraftDate ? drafted.event_date_precision : live.event_date_precision) ?? 'day');
    const precision = date ? ((PRECISIONS.has(rawPrecision) ? rawPrecision : 'day') as DateSheetData['precision']) : null;
    const isDrafted = hasDraftDate && (date !== live.event_date || precision !== (live.event_date_precision ?? 'day'));
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
        drafted: isDrafted,
        ceremonyTime,
        bookedNames,
        // The day the bookings hold: the LIVE date (a draft books nobody).
        bookedDay: bookedNames.length > 0 && live.event_date && (live.event_date_precision ?? 'day') === 'day' ? live.event_date : null,
        change: change.ok ? change.view : null,
        help,
      },
    };
  } catch (e) {
    console.error('[suppliers fact sheet] could not be opened:', e instanceof Error ? e.message : e);
    return { ok: false, error: NOT_OPENED };
  }
}

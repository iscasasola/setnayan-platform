import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { namedCalendarsEnabled } from '@/lib/schedule-pools';
import { bookingWindowOf, windowRefusals, windowToday, type BookingWindow } from '@/lib/booking-window';
import {
  isAccommodationCategory,
  UNBOOKABLE_MAX_CARDS,
  UNBOOKABLE_MAX_DAYS,
  fitDateScope,
  fitDaysToAsk,
  fitOptions,
  inBatches,
  needsEveryDay,
  refusalKey,
  suppliersWithNoBookingLeft,
  supplierDayFits,
  type CardOptions,
  type DayFit,
  type EventFitDates,
} from '@/lib/bench-bookable-days';

/**
 * bench-bookable-days.server — reads the refusals for the bench search (H6).
 *
 * The cards judged are the ones the search itself prices a supplier from: in
 * the searched categories, active, and bookable on their own (a linked-only
 * card is a component of another card, never booked alone). The refusals are
 * asked with the ADMIN client: the function is server-only (service_role), so a
 * signed-in browser can never read another supplier's full days — the caller
 * only ever returns which suppliers stay on the list. The same Named Calendars
 * switch the lock reads is passed, so the search and the lock resolve the same
 * pools. The caller must have already checked the couple is on the event.
 *
 * FAILS OPEN — BUT SAYS SO. Any error → `null` ("could not check"), never an
 * empty set: an empty set means "checked, everybody is free", and a page that
 * cannot tell the two apart passes an unfiltered list off as a filtered one
 * (audit of #7556, 2026-11-13). The caller hides nobody on `null` AND tells the
 * couple the date could not be checked. A supplier wrongly left on the list
 * costs the couple a message; a supplier wrongly hidden costs them a supplier
 * who could have said yes.
 */
export async function readSuppliersWithNoBookingLeft(args: {
  admin: SupabaseClient;
  supplierIds: readonly string[];
  /** The categories whose cards are judged. `null` = every category the supplier sells in — Discover's supplier
   *  view with no category picked (2026-11-13): a supplier leaves only when EVERY bookable card is refused. */
  canonicals: readonly string[] | null;
  /** The event's date columns (`EventFitDates`): the main span once the date is set, else the candidates or the
   *  window (owner 2026-11-13 — a supplier free on ANY ONE candidate stays). */
  dates: EventFitDates;
  /** Optional: filled with each judged supplier's best per-option fit (`DayFit` — free on ALL / SOME of a block's
   *  days; `null` = none fits) — the shape the coming "Free N of your M days" line and the all-days-first rank read. */
  fitsOut?: Map<string, DayFit | null>;
}): Promise<Set<string> | null> {
  const scope = fitDateScope(args.dates);
  if (!scope || args.supplierIds.length === 0 || (args.canonicals !== null && args.canonicals.length === 0)) return new Set();

  try {
    let cardQuery = args.admin
      .from('vendor_services')
      .select('vendor_service_id, vendor_profile_id, category')
      .in('vendor_profile_id', args.supplierIds as string[])
      .eq('is_active', true)
      .eq('is_linked_only', false);
    if (args.canonicals !== null) cardQuery = cardQuery.in('category', args.canonicals as string[]);
    const { data: cardRows, error: cardErr } = await cardQuery;
    if (cardErr) {
      logQueryError('bench-bookable-days: cards', cardErr);
      return null;
    }
    const cardsBySupplier = new Map<string, string[]>();
    const categoryOf = new Map<string, string | null>();
    for (const r of (cardRows ?? []) as { vendor_service_id: string; vendor_profile_id: string; category: string | null }[]) {
      const list = cardsBySupplier.get(r.vendor_profile_id) ?? [];
      list.push(r.vendor_service_id);
      cardsBySupplier.set(r.vendor_profile_id, list);
      categoryOf.set(r.vendor_service_id, r.category ?? null);
    }
    const cards = [...cardsBySupplier.values()].flat();
    if (cards.length === 0) return new Set();

    // Accommodation is judged on every night of the span ±1, so those nights are asked about too.
    const withAccommodation = [...categoryOf.values()].some(isAccommodationCategory);
    const days = fitDaysToAsk(scope, withAccommodation);
    const optionsByCategory = new Map<string | null, CardOptions>();
    const optionsOf = (card: string): CardOptions => {
      const category = categoryOf.get(card) ?? null;
      let options = optionsByCategory.get(category);
      if (!options) {
        options = { options: fitOptions(scope, category), everyDay: needsEveryDay(category) };
        optionsByCategory.set(category, options);
      }
      return options;
    };

    const refused = new Set<string>();
    const calls = inBatches(cards, UNBOOKABLE_MAX_CARDS).flatMap((cardBatch) =>
      inBatches(days, UNBOOKABLE_MAX_DAYS).map((dayBatch) =>
        args.admin.rpc('service_cards_unbookable_on', {
          p_service_ids: cardBatch,
          p_dates: dayBatch,
          p_named_calendars: namedCalendarsEnabled(),
        }),
      ),
    );
    for (const { data, error } of await Promise.all(calls)) {
      if (error) {
        logQueryError('bench-bookable-days: service_cards_unbookable_on', error);
        return null;
      }
      for (const r of (data ?? []) as { service_id: string | null; refused_on: string | null }[]) {
        if (r.service_id && r.refused_on) refused.add(refusalKey(r.service_id, r.refused_on));
      }
    }
    // 📅 The shop's own window (owner 2026-11-19, "HOW FAR AWAY A SHOP TAKES BOOKINGS"): a day before its At least or
    // after its At most is refused like a closed one. A refused read is "could not check", never "free".
    const windows = await readBookingWindows(args.admin, [...cardsBySupplier.keys()]);
    if (windows === null) return null;
    for (const r of windowRefusals(cardsBySupplier, windows, days, windowToday())) refused.add(refusalKey(r.card, r.day));
    if (args.fitsOut) for (const [id, fit] of supplierDayFits(cardsBySupplier, refused, optionsOf)) args.fitsOut.set(id, fit);
    return suppliersWithNoBookingLeft(cardsBySupplier, refused, optionsOf);
  } catch {
    return null;
  }
}

/**
 * Find's bench search (`category-search.ts`, `hideUnbookable`): the same read, an unreadable answer folded to
 * "hide nobody". Discover reads `readSuppliersWithNoBookingLeft` itself so it can SAY the date was not checked.
 */
export async function findSuppliersWithNoBookingLeft(
  args: Parameters<typeof readSuppliersWithNoBookingLeft>[0],
): Promise<Set<string>> {
  return (await readSuppliersWithNoBookingLeft(args)) ?? new Set();
}

/**
 * THE CARDS' OWN REFUSALS (owner 2026-10-29, Find v4: *"we never show service cards not available for their date"*) —
 * `service_cards_unbookable_on` asked about exactly these cards on exactly these days, batched under the function's
 * caps (`UNBOOKABLE_MAX_CARDS` cards × `UNBOOKABLE_MAX_DAYS` days per call), the calls started together. Returns the
 * set of `refusalKey(card, day)` the booking path would refuse.
 *
 * 🔑 UNLIKE `findSuppliersWithNoBookingLeft` IT DOES NOT FAIL OPEN SILENTLY: any error → `null`, and the caller
 * SAYS the dates could not be checked (`lib/find-service-cards.ts` `keepFreeCards` → `unread`). Hiding on a failed
 * read would empty the list; showing everyone without saying so would pass a busy card off as free.
 */
export async function readCardRefusals(args: {
  admin: SupabaseClient;
  serviceIds: readonly string[];
  days: readonly string[];
}): Promise<Set<string> | null> {
  const cards = [...new Set(args.serviceIds)].filter(Boolean);
  const days = [...new Set(args.days)];
  if (cards.length === 0 || days.length === 0) return new Set();
  try {
    const calls = inBatches(cards, UNBOOKABLE_MAX_CARDS).flatMap((cardBatch) =>
      inBatches(days, UNBOOKABLE_MAX_DAYS).map((dayBatch) =>
        args.admin.rpc('service_cards_unbookable_on', {
          p_service_ids: cardBatch,
          p_dates: dayBatch,
          p_named_calendars: namedCalendarsEnabled(),
        }),
      ),
    );
    // 📅 Which shop each card belongs to, for its window — asked alongside the refusals, never after them.
    const ownersRead = args.admin.from('vendor_services').select('vendor_service_id, vendor_profile_id').in('vendor_service_id', cards);
    const [results, owners] = await Promise.all([Promise.all(calls), ownersRead]);
    const refused = new Set<string>();
    for (const { data, error } of results) {
      if (error) {
        logQueryError('bench-bookable-days: card refusals', error);
        return null;
      }
      for (const r of (data ?? []) as { service_id: string | null; refused_on: string | null }[]) {
        if (r.service_id && r.refused_on) refused.add(refusalKey(r.service_id, r.refused_on));
      }
    }
    if (owners.error) {
      logQueryError('bench-bookable-days: card shops', owners.error);
      return null;
    }
    const cardsBySupplier = new Map<string, string[]>();
    for (const r of (owners.data ?? []) as { vendor_service_id: string; vendor_profile_id: string }[]) {
      cardsBySupplier.set(r.vendor_profile_id, [...(cardsBySupplier.get(r.vendor_profile_id) ?? []), r.vendor_service_id]);
    }
    const windows = await readBookingWindows(args.admin, [...cardsBySupplier.keys()]);
    if (windows === null) return null;
    for (const r of windowRefusals(cardsBySupplier, windows, days, windowToday())) refused.add(refusalKey(r.card, r.day));
    return refused;
  } catch {
    return null;
  }
}

/**
 * 📅 Each shop's "How far away you take bookings" (`lib/booking-window.ts`), ONE read for every shop judged. A refused
 * read is `null` — the caller then says the dates could not be checked, as for any other refusal it could not read.
 */
async function readBookingWindows(admin: SupabaseClient, supplierIds: readonly string[]): Promise<Map<string, BookingWindow> | null> {
  if (supplierIds.length === 0) return new Map();
  const { data, error } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, booking_min_days, booking_max_months')
    .in('vendor_profile_id', supplierIds as string[]);
  if (error) {
    logQueryError('bench-bookable-days: booking windows', error);
    return null;
  }
  return new Map(
    ((data ?? []) as { vendor_profile_id: string; booking_min_days: number | null; booking_max_months: number | null }[]).map((r) => [
      r.vendor_profile_id,
      bookingWindowOf(r),
    ]),
  );
}

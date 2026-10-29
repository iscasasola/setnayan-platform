'use server';

/**
 * fetchInlineMoreRow — the data behind the bench's inline "More in {category}"
 * row (owner 2026-09-06 · "we do not want to leave the page").
 *
 * ── IT WRITES NO RANKING ─────────────────────────────────────────────────────
 * Row 2 shows the SAME vendors, in the SAME order, as the full sheet: this
 * action calls `searchCategoryVendors` and hands the result straight back. The
 * owner-locked ladder (favorites → boosted by ad_rank → top-10 by reviews →
 * nearest) and the hybrid-anonymity name resolution therefore cannot drift
 * between the row and the sheet, because there is only one of each. Auth and
 * membership are inherited from that action too — a non-member gets its EMPTY.
 *
 * ── THE ONE THING IT ADDS: THE CANDIDATES' CALENDARS ─────────────────────────
 * Constraint 2 of the ruling — *"a row that offers vendors the row above just
 * ruled out is worse than no row"* — needs each candidate's free days inside
 * the build's probe window. Row 1 gets those on the server page from
 * `getBatchVendorAvailableDays` keyed by `event_vendors.vendor_id`; a row-2
 * candidate has no `event_vendors` row at all, so the same primitive is asked
 * the same question keyed by MARKETPLACE PROFILE id.
 *
 * 🔑 **The verdict is not computed here, and deliberately so.** The build window
 * and the team calendar are already resolved once per page load in
 * `vendors/page.tsx` and passed down to `ShortlistCategories`; recomputing them
 * in this action would be a second copy of ~80 lines of window logic, free to
 * drift from the one the row above is drawn from. So this action returns the
 * candidates plus their raw free days, and the pure, unit-tested
 * `classifyInlineMoreRow` does the deciding against the window the bench is
 * ALREADY holding. One window, one classifier, two rows.
 *
 * Fail-open end to end: an unreadable calendar yields no entry for that vendor,
 * `classifyInlineMoreRow` then returns no verdict for it, and it shows normally.
 * A vendor is never sunk because a read flaked.
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getBatchVendorAvailableDays } from '@/lib/vendor-availability';
import { resolveProbeWindow } from '@/lib/build-date-window';
import { getCanonicalBuckets, servicesInTile } from '@/lib/vendor-counts';
import { fetchMarketCategoryCards, firstCardPerSupplier } from '@/lib/bench-service-cards';
import { withholdCardNames, type BenchServiceCard } from '@/lib/bench-service-card';
import { readCardRefusals } from '@/lib/bench-bookable-days.server';
import { readServiceLabels, serviceLabelOf } from '@/lib/service-labels';
import {
  keepFreeCards,
  legacyServiceFor,
  type FindAvailability,
  type FindCardRow,
  type FindService,
} from '@/lib/find-service-cards';
import { searchCategoryVendors, type CategoryVendorResult } from './category-search';
import { readSupplierSheet } from '@/lib/supplier-sheet-read';
import type { SupplierSheetData } from '@/lib/supplier-sheet';
import { after } from 'next/server';
import { recordVendorProfileView } from '@/lib/record-vendor-view';
import { FIND_SHEET_VIEW_SOURCE } from '@/lib/booking-fee-gate';

export type InlineMoreRowResult = {
  results: CategoryVendorResult[];
  /**
   * marketplace profile id → day keys free inside the probe window. A profile
   * ABSENT from this record has no calendar signal — that is not the same fact
   * as an empty array (which means "read fine, free on nothing in the window"),
   * and `classifyInlineMoreRow` treats the two differently.
   *
   * A plain Record rather than a Map: this crosses the server-action boundary.
   */
  freeDaysByProfileId: Record<string, string[]>;
  /** TRUE when the couple's dates are settled or unknowable, so there is no
   *  probe window to read calendars over. The row still renders — it simply
   *  sinks nothing, exactly as row 1 does in the same state. */
  noProbeWindow: boolean;
  /**
   * marketplace profile id → that supplier's own service card for THIS
   * category (owner 2026-10-07: a card in the list is the service card).
   * `null` = the cards could not be read — the list then says nothing about a
   * price, rather than "Price on request". A supplier absent from the record
   * simply has no card in this category.
   */
  serviceCardByProfileId: Record<string, BenchServiceCard> | null;
  /**
   * Present ONLY on a `sheetFor` call — the supplier sheet's one request
   * (their reviews, finished events, published photos, other categories and
   * whether the couple follows them). `null` = it could not be read.
   */
  sheet?: SupplierSheetData | null;
  /**
   * EVERY CARD OF THE CATEGORY (owner 2026-10-29, Find v4) — one row per service card of the suppliers in `results`,
   * each under its ONE home service, already cut to the cards free on at least one of the event's dates (see
   * `availability`). `null` = the cards could not be read (the list says so). Absent on a `sheetFor` call.
   */
  cards?: FindCardRow[] | null;
  /** The category's services in its own order, each with its admin-managed label (`lib/service-labels.ts`). */
  services?: FindService[];
  /** Whether `cards` were checked against the event's dates — `lib/find-service-cards.ts` `FindAvailability`. */
  availability?: FindAvailability;
  /** The event's dates the cards were checked against (one day, a month, or the couple's date choices). */
  availabilityDays?: string[];
  /**
   * PERFORMERS — the suppliers in `results` with a proven track record: at least one VETTED completed Setnayan event
   * (`vendor_public_completed_events_stats`, the anti-fraud count the Most Booked badge ranks by — self-dealt and
   * off-platform events excluded). "Best for your event" draws only these (owner 2026-10-29: "#1–#10 match must be
   * performers only. we will not show if there are no performers yet"). `null` = the count could not be read.
   */
  performers?: string[] | null;
};

const EMPTY: InlineMoreRowResult = {
  results: [],
  freeDaysByProfileId: {},
  noProbeWindow: true,
  serviceCardByProfileId: {},
};

export async function fetchInlineMoreRow(input: {
  eventId: string;
  /** Plan group scope, or '' when the tile is finer than every plan group. */
  groupId: string;
  /** The bench row's own tile — always set. See `lib/bench-category-search.ts`. */
  tile: string;
  /** The row's live search text. Empty = the category's default page. */
  query?: string;
  /**
   * THE SUPPLIER SHEET'S ONE REQUEST (owner 2026-10-08 · the minimum-request
   * rules). With this set, nothing is searched: the call returns only `sheet`
   * for that one supplier. It rides this action — not a new one — because the
   * app is at its server-action ceiling (`lint-server-action-budget.mjs`).
   */
  sheetFor?: string;
}): Promise<InlineMoreRowResult> {
  const eventId = String(input.eventId ?? '').trim();
  if (!eventId) return EMPTY;

  const sheetFor = String(input.sheetFor ?? '').trim();
  if (sheetFor) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { ...EMPTY, sheet: null };
      const sheet = await readSupplierSheet(createAdminClient(), supabase, {
        vendorProfileId: sheetFor,
        userId: user.id,
        tile: String(input.tile ?? '') || null,
      });
      // A SUPPLIER OPENED IN FIND IS A SHOP SETNAYAN SHOWED THIS COUPLE (owner
      // 2026-10-12, "fix the problems"): one profile view for THIS event, with
      // Find's source, recorded AFTER the answer is sent (never on the request's
      // path, never a second request). Only for an event this signed-in person
      // can read — the read is the membership check, under their own RLS.
      if (sheet) {
        const { data: ownEvent } = await supabase.from('events').select('event_id').eq('event_id', eventId).maybeSingle();
        if (ownEvent) {
          after(() =>
            recordVendorProfileView({ vendorProfileId: sheetFor, eventId, source: FIND_SHEET_VIEW_SOURCE }),
          );
        }
      }
      return { ...EMPTY, sheet };
    } catch (err) {
      console.error('[inline-more-row] the supplier sheet read threw', err);
      return { ...EMPTY, sheet: null };
    }
  }

  // ONE call, the shipped one. Everything about WHO is shown and IN WHAT ORDER
  // is decided in there, including the membership gate.
  const search = await searchCategoryVendors({
    eventId,
    groupId: String(input.groupId ?? ''),
    tile: String(input.tile ?? ''),
    query: input.query,
    // H6 — the row shows what the sheet shows, so it hides what the sheet hides.
    hideUnbookable: true,
  });
  if (search.results.length === 0) {
    // Nobody in the category at all — no card to check against a date, so nothing is claimed about one.
    return { results: [], freeDaysByProfileId: {}, noProbeWindow: true, serviceCardByProfileId: {}, cards: [], services: [], availability: 'checked', availabilityDays: [] };
  }

  // EVERY CARD of the suppliers the search ALREADY returned — it has refused a non-member above, and these are the
  // cards those suppliers publish on their own shop pages — under every service of THIS category (owner 2026-10-29:
  // "all service cards of all services inside a category will share the same spot"). The category is the row's own
  // tile, read through the same accessor the search widens from. The labels are the admin's (never a code map).
  const tile = String(input.tile ?? '');
  const categoryServices = [...new Set([...servicesInTile(await getCanonicalBuckets(), tile), tile])];
  const admin = createAdminClient();
  const profileIds = search.results.map((r) => r.vendorProfileId);
  const [read, labels] = await Promise.all([
    fetchMarketCategoryCards(admin, profileIds, categoryServices, new Date()),
    readServiceLabels(),
  ]);
  let allCards: FindCardRow[] | null = read;
  if (allCards) {
    // A LEGACY SHOP (matched by `vendor_profiles.services`, no card row here) is filed under its known service —
    // never a "Service not set" choice (owner 2026-10-29). Read only when there is one.
    const withCard = new Set(allCards.map((c) => c.profileId));
    const legacy = profileIds.filter((id) => !withCard.has(id));
    if (legacy.length > 0) {
      const { data: profs } = await admin.from('vendor_profiles').select('vendor_profile_id, services').in('vendor_profile_id', legacy);
      const stored = new Map(
        ((profs ?? []) as { vendor_profile_id: string; services: string[] | null }[]).map((p) => [p.vendor_profile_id, p.services]),
      );
      for (const id of legacy) {
        const service = legacyServiceFor(stored.get(id), categoryServices);
        if (service) allCards.push({ serviceId: null, profileId: id, service, card: null, fromPhp: null });
      }
    }
    // A supplier whose name is still withheld is not named by their card's title (`withholdCardNames`, per card).
    const withheld = new Set(search.results.filter((r) => r.nameAnonymized).map((r) => r.vendorProfileId));
    allCards = allCards.map((c) => (c.card && withheld.has(c.profileId) ? { ...c, card: { ...c.card, name: '' } } : c));
  }
  const listed = new Set((allCards ?? []).map((c) => c.service));
  const services: FindService[] = categoryServices
    .filter((k) => k !== tile || listed.has(k))
    .map((key) => ({ key, label: serviceLabelOf(labels, key) }));
  const firstCards = firstCardPerSupplier(allCards);
  const serviceCardByProfileId = firstCards
    ? withholdCardNames(
        firstCards,
        search.results.filter((r) => r.nameAnonymized).map((r) => r.vendorProfileId),
      )
    : null;

  // The probe window. Read through the couple's OWN client so a non-member
  // cannot use this action to reach an event's dates — `searchCategoryVendors`
  // has already refused them above, and this refuses them again independently.
  let probe: ReturnType<typeof resolveProbeWindow> = null;
  let datesRead = true;
  try {
    const supabase = await createClient();
    const { data: ev, error: evErr } = await supabase
      .from('events')
      .select('event_date, event_date_precision, date_candidates')
      .eq('event_id', eventId)
      .maybeSingle();
    if (evErr || !ev) datesRead = false;
    else {
      const row = ev as {
        event_date: string | null;
        event_date_precision: string | null;
        date_candidates: string[] | null;
      };
      probe = resolveProbeWindow({
        eventDate: row.event_date,
        precision: row.event_date_precision,
        candidates: row.date_candidates,
      });
    }
  } catch {
    datesRead = false;
  }

  // NEVER A CARD THAT IS NOT FREE ON THEIR DATE (owner 2026-10-29): one date → free that day; a month or date
  // choices → free on at least one. The booking path's own refusals, per card (`readCardRefusals`); unreadable →
  // the list says so (`unread`), never a silent "everyone" or "no one".
  const days = probe?.dayKeys ?? [];
  const refused =
    !datesRead || allCards === null
      ? null
      : await readCardRefusals({
          admin,
          serviceIds: allCards.map((c) => c.serviceId).filter((id): id is string => Boolean(id)),
          days,
        });
  const kept = allCards ? keepFreeCards(allCards, refused, datesRead ? days : ['?']) : null;
  const cards = kept ? kept.cards : null;
  const availability: FindAvailability = !datesRead ? 'unread' : (kept?.availability ?? (days.length ? 'unread' : 'no_date'));
  // A supplier left with no card free on the dates leaves the list with them.
  const freeShops = cards ? new Set(cards.map((c) => c.profileId)) : null;
  const results = freeShops ? search.results.filter((r) => freeShops.has(r.vendorProfileId)) : search.results;
  let performers: string[] | null = [];
  if (results.length > 0) {
    const { data: done, error: doneErr } = await admin
      .from('vendor_public_completed_events_stats')
      .select('vendor_profile_id, public_completed_count')
      .in('vendor_profile_id', results.map((r) => r.vendorProfileId));
    performers = doneErr
      ? null
      : ((done ?? []) as { vendor_profile_id: string | null; public_completed_count: number | string | null }[])
          .filter((r) => r.vendor_profile_id && Number(r.public_completed_count ?? 0) >= 1)
          .map((r) => r.vendor_profile_id as string);
  }
  const cardsOut = { cards, services, availability, availabilityDays: days, performers };

  // An ANCHORED window costs nothing to read and can sink nothing: the soft
  // tier stands down for the committed-date tier, exactly as the page does.
  if (!probe || probe.anchored || results.length === 0) {
    return { results, freeDaysByProfileId: {}, noProbeWindow: true, serviceCardByProfileId, ...cardsOut };
  }
  try {
    const [ys, ms, ds] = probe.rangeStart.split('-').map(Number);
    const [ye, me, de] = probe.rangeEnd.split('-').map(Number);
    const avail = await getBatchVendorAvailableDays(
      admin,
      [...new Set(results.map((r) => r.vendorProfileId))],
      new Date(ys ?? 1970, (ms ?? 1) - 1, ds ?? 1),
      new Date(ye ?? 1970, (me ?? 1) - 1, de ?? 1),
    );

    const freeDaysByProfileId: Record<string, string[]> = {};
    for (const [profileId, availDays] of avail) {
      freeDaysByProfileId[profileId] = probe.dayKeys.filter((k) => availDays.has(k));
    }
    return { results, freeDaysByProfileId, noProbeWindow: false, serviceCardByProfileId, ...cardsOut };
  } catch {
    // Fail open — the vendors still show, nothing sinks. A calendar read must
    // never cost the couple a vendor, and it must never cost them the row.
    return { results, freeDaysByProfileId: {}, noProbeWindow: true, serviceCardByProfileId, ...cardsOut };
  }
}

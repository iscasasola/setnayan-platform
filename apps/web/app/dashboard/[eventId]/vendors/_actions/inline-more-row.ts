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
import { canonicalServicesForTile } from '@/lib/vendor-counts';
import type { WeddingTile } from '@/lib/taxonomy';
import { fetchMarketServiceCards } from '@/lib/bench-service-cards';
import { withholdCardNames, type BenchServiceCard } from '@/lib/bench-service-card';
import { searchCategoryVendors, type CategoryVendorResult } from './category-search';
import { readSupplierSheet } from '@/lib/supplier-sheet-read';
import type { SupplierSheetData } from '@/lib/supplier-sheet';

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
    return { results: [], freeDaysByProfileId: {}, noProbeWindow: true, serviceCardByProfileId: {} };
  }

  // The service cards of the suppliers the search ALREADY returned — it has
  // refused a non-member above, and these are the cards those suppliers
  // publish on their own shop pages. The category is the row's own tile, read
  // through the same accessor the search widens from.
  const tile = String(input.tile ?? '');
  const marketCards = await fetchMarketServiceCards(
    createAdminClient(),
    search.results.map((r) => r.vendorProfileId),
    [...new Set([...canonicalServicesForTile(tile as WeddingTile), tile])],
    new Date(),
  );
  // A supplier whose name is still withheld is not named by their card's title.
  const serviceCardByProfileId = marketCards
    ? withholdCardNames(
        marketCards,
        search.results.filter((r) => r.nameAnonymized).map((r) => r.vendorProfileId),
      )
    : null;

  // The probe window. Read through the couple's OWN client so a non-member
  // cannot use this action to reach an event's dates — `searchCategoryVendors`
  // has already refused them above, and this refuses them again independently.
  try {
    const supabase = await createClient();
    const { data: ev } = await supabase
      .from('events')
      .select('event_date, event_date_precision, date_candidates')
      .eq('event_id', eventId)
      .maybeSingle();
    if (!ev) return { results: search.results, freeDaysByProfileId: {}, noProbeWindow: true, serviceCardByProfileId };

    const row = ev as {
      event_date: string | null;
      event_date_precision: string | null;
      date_candidates: string[] | null;
    };
    const probe = resolveProbeWindow({
      eventDate: row.event_date,
      precision: row.event_date_precision,
      candidates: row.date_candidates,
    });
    // An ANCHORED window costs nothing to read and can sink nothing: the soft
    // tier stands down for the committed-date tier, exactly as the page does.
    if (!probe || probe.anchored) {
      return { results: search.results, freeDaysByProfileId: {}, noProbeWindow: true, serviceCardByProfileId };
    }

    const [ys, ms, ds] = probe.rangeStart.split('-').map(Number);
    const [ye, me, de] = probe.rangeEnd.split('-').map(Number);
    const avail = await getBatchVendorAvailableDays(
      createAdminClient(),
      [...new Set(search.results.map((r) => r.vendorProfileId))],
      new Date(ys ?? 1970, (ms ?? 1) - 1, ds ?? 1),
      new Date(ye ?? 1970, (me ?? 1) - 1, de ?? 1),
    );

    const freeDaysByProfileId: Record<string, string[]> = {};
    for (const [profileId, days] of avail) {
      freeDaysByProfileId[profileId] = probe.dayKeys.filter((k) => days.has(k));
    }
    return { results: search.results, freeDaysByProfileId, noProbeWindow: false, serviceCardByProfileId };
  } catch {
    // Fail open — the vendors still show, nothing sinks. A calendar read must
    // never cost the couple a vendor, and it must never cost them the row.
    return { results: search.results, freeDaysByProfileId: {}, noProbeWindow: true, serviceCardByProfileId };
  }
}

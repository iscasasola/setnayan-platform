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
import { searchCategoryVendors, type CategoryVendorResult } from './category-search';

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
};

const EMPTY: InlineMoreRowResult = {
  results: [],
  freeDaysByProfileId: {},
  noProbeWindow: true,
};

export async function fetchInlineMoreRow(input: {
  eventId: string;
  /** Plan group scope, or '' when the tile is finer than every plan group. */
  groupId: string;
  /** The bench row's own tile — always set. See `lib/bench-category-search.ts`. */
  tile: string;
  /** The row's live search text. Empty = the category's default page. */
  query?: string;
}): Promise<InlineMoreRowResult> {
  const eventId = String(input.eventId ?? '').trim();
  if (!eventId) return EMPTY;

  // ONE call, the shipped one. Everything about WHO is shown and IN WHAT ORDER
  // is decided in there, including the membership gate.
  const search = await searchCategoryVendors({
    eventId,
    groupId: String(input.groupId ?? ''),
    tile: String(input.tile ?? ''),
    query: input.query,
  });
  if (search.results.length === 0) {
    return { results: [], freeDaysByProfileId: {}, noProbeWindow: true };
  }

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
    if (!ev) return { results: search.results, freeDaysByProfileId: {}, noProbeWindow: true };

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
      return { results: search.results, freeDaysByProfileId: {}, noProbeWindow: true };
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
    return { results: search.results, freeDaysByProfileId, noProbeWindow: false };
  } catch {
    // Fail open — the vendors still show, nothing sinks. A calendar read must
    // never cost the couple a vendor, and it must never cost them the row.
    return { results: search.results, freeDaysByProfileId: {}, noProbeWindow: true };
  }
}

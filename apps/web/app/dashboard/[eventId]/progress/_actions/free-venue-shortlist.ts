'use server';

/**
 * buildFirstVenueShortlist — the FREE first-venue-shortlist action
 * (owner-locked 2026-07-09 · Pricing.md § 00 free-venue-assist carve-out).
 *
 * Suri assembles the couple's FIRST reception-venue shortlist, free, once:
 * up to FIRST_VENUE_SHORTLIST_CAP compatible reception venues from REAL
 * marketplace data. Deliberately NOT AI-gated — this is the free taste that
 * introduces the full Suri subscription; every other category keeps the
 * normal gate.
 *
 * Reuse over reinvention (owner refinement 2026-07-09):
 *   • Candidates come from `searchCategoryVendors` — the SAME ranked,
 *     compat-filtered, RLS-gated query the Category Search overlay uses
 *     (faith/event-type scoping, service-radius reach, boosted → reviews →
 *     nearest ordering, demo-vendor exclusion). No new matching logic here.
 *   • Writes go through `attachMarketplaceVendorToCategory` — the shipped
 *     attach path (idempotent per vendor, `status='considering'`,
 *     `source='host_marketplace_search'` — no new enum value, no migration).
 *
 * "First" semantics — NO schema: the offer/action is live ONLY while the
 * event's venue-category shortlist is EMPTY. Any venue pick (Suri-built or
 * manual) consumes it, so re-invocation is a no-op ('already_has_shortlist').
 * Fail-soft throughout: candidate-level failures are logged and skipped; the
 * action never throws at the page.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  FIRST_VENUE_SHORTLIST_CAP,
  SURI_FREE_ASSIST_CATEGORIES,
  SURI_FREE_ASSIST_PLAN_GROUP_IDS,
  isFirstVenueShortlistOfferAvailable,
} from '@/lib/setnayan-ai-free-assist';
import { searchCategoryVendors } from '@/app/dashboard/[eventId]/vendors/_actions/category-search';
import { attachMarketplaceVendorToCategory } from '@/app/dashboard/[eventId]/vendors/actions';

export type FirstVenueShortlistResult =
  | { status: 'ok'; added: number }
  /** Idempotent no-op — the venue shortlist already has entries. */
  | { status: 'already_has_shortlist' }
  | { status: 'not_signed_in' }
  /** No compatible marketplace venues found — send the couple to browse. */
  | { status: 'no_matches' }
  | { status: 'error'; message: string };

const FRIENDLY_ERROR =
  'Suri could not build your shortlist just now — please try again in a moment.';

export async function buildFirstVenueShortlist(
  eventIdRaw: string,
): Promise<FirstVenueShortlistResult> {
  const eventId = String(eventIdRaw ?? '').trim();
  if (!eventId) return { status: 'error', message: FRIENDLY_ERROR };

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { status: 'not_signed_in' };

    // Membership gate — events RLS restricts to members, so a non-member
    // reads null and we bail BEFORE the emptiness check (an RLS-empty
    // event_vendors read must never look like an available offer).
    const { data: ev, error: evErr } = await supabase
      .from('events')
      .select('event_id')
      .eq('event_id', eventId)
      .maybeSingle();
    if (evErr || !ev) return { status: 'error', message: FRIENDLY_ERROR };

    // "First" gate: the venue shortlist must be EMPTY. The shortlist state
    // itself records consumption — no column, no table.
    const { data: venueRows, error: venueErr } = await supabase
      .from('event_vendors')
      .select('vendor_id, category')
      .eq('event_id', eventId)
      .in('category', [...SURI_FREE_ASSIST_CATEGORIES])
      .is('archived_at', null);
    if (venueErr) {
      logQueryError(
        'buildFirstVenueShortlist (venue emptiness read)',
        new Error(venueErr.message),
        { event_id: eventId, user_id: user.id },
        'graceful_degrade',
      );
      return { status: 'error', message: FRIENDLY_ERROR };
    }
    if (
      !isFirstVenueShortlistOfferAvailable(
        (venueRows ?? []) as Array<{ category: string }>,
      )
    ) {
      return { status: 'already_has_shortlist' };
    }

    // Candidates — the shipped category-search machinery, hard-scoped to the
    // reception-venue plan group. Works with Setnayan AI OFF (it only drops
    // the compat pill + proximity sort), so free accounts get real results.
    const groupId = SURI_FREE_ASSIST_PLAN_GROUP_IDS[0] ?? 'reception_venue';
    const search = await searchCategoryVendors({ eventId, groupId });
    const candidates = search.results
      .filter((r) => !r.alreadyAdded)
      .slice(0, FIRST_VENUE_SHORTLIST_CAP);
    if (candidates.length === 0) return { status: 'no_matches' };

    // Attach through the shipped path — one per candidate, fail-soft each.
    let added = 0;
    for (const candidate of candidates) {
      try {
        const fd = new FormData();
        fd.set('event_id', eventId);
        fd.set('marketplace_vendor_id', candidate.vendorProfileId);
        fd.set('category', 'venue');
        const res = await attachMarketplaceVendorToCategory(fd);
        if (res.status === 'ok' || res.status === 'already_attached') {
          added += 1;
        } else {
          logQueryError(
            'buildFirstVenueShortlist (attach skipped)',
            new Error(`attach status: ${res.status}`),
            {
              event_id: eventId,
              user_id: user.id,
              marketplace_vendor_id: candidate.vendorProfileId,
            },
            'graceful_degrade',
          );
        }
      } catch (caught) {
        logQueryError(
          'buildFirstVenueShortlist (attach threw)',
          caught instanceof Error ? caught : new Error(String(caught)),
          {
            event_id: eventId,
            user_id: user.id,
            marketplace_vendor_id: candidate.vendorProfileId,
          },
          'graceful_degrade',
        );
      }
    }
    if (added === 0) return { status: 'error', message: FRIENDLY_ERROR };

    // The attach path already revalidates the dashboard + vendors layouts;
    // add the event Home (which now hosts the decisions board via
    // <EventDashboard>, formerly the /progress route) so its decisions board
    // reflects the new picks.
    revalidatePath(`/dashboard/${eventId}`, 'layout');
    return { status: 'ok', added };
  } catch (caught) {
    logQueryError(
      'buildFirstVenueShortlist (threw)',
      caught instanceof Error ? caught : new Error(String(caught)),
      { event_id: eventId },
      'graceful_degrade',
    );
    return { status: 'error', message: FRIENDLY_ERROR };
  }
}

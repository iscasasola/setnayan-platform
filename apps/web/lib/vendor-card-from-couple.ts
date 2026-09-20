import 'server-only';

/**
 * buildCanvasInitialFromCoupleCard — THE COUPLE ALREADY DESCRIBED THIS
 * SERVICE; the supplier should not have to type it again. (2026-09-20)
 *
 * Owner: *"when a vendor gets this lock, the service card will be the one
 * registering for that portfolio. and the price as well."*
 *
 * ── The loop this closes ──────────────────────────────────────────────────
 * A couple adds a supplier themselves, records what they agreed — the price,
 * the transport, the crew meals, the inclusions — and sends the claim QR. The
 * supplier scans it, signs up, and is routed into `/vendor-dashboard/
 * services/new/[category]?claim=<token>`, which until now opened **blank**.
 * `registerClaimedServiceToCouple` then linked whatever they built back to the
 * booking, so the loop closed on the LINK but never on the CONTENT: the one
 * description that already existed was thrown away, and the supplier retyped
 * a price the couple had agreed with them.
 *
 * ── EXTENDS, NEVER RE-DRAWS ───────────────────────────────────────────────
 * The maker already accepts a seed: `CanvasInitial`, built by
 * `buildCanvasInitialFromCard` for the "Start from one of your cards"
 * (`?from=`) doorway. This is a SECOND SOURCE for the SAME seed type, not a
 * second seeding mechanism — the page picks one builder and hands the result
 * to the same `initial` prop, so the canvas cannot tell where it came from and
 * every field-parity guarantee that already covers `?from=` covers this too.
 *
 * ── WHAT IS DELIBERATELY NOT CARRIED ──────────────────────────────────────
 *  · `title` — the couple named a SUPPLIER ("Seda Vertis North"); a service
 *    card's title names the SERVICE. Seeding the business name would put the
 *    wrong noun in the most visible field on the card, and a wrong value is
 *    worse than a blank one the supplier fills in.
 *  · `covers_plan_groups` → `linkedCategories`. They are different
 *    vocabularies: covers are PLAN GROUP ids (`reception_venue`) and
 *    linkedCategories are canonical services. There is no total mapping
 *    between them, and inventing one here would silently bundle a card with
 *    categories its owner never chose. The couple's grouping stays the
 *    couple's; the supplier picks their own bundle.
 *  · The payment notes and the address. Those are the COUPLE's private record
 *    of an off-platform arrangement (see the 2026-09-20 ruling); a supplier's
 *    published card is a different artefact with its own moderated payment
 *    methods. Copying a couple's note into a public listing would publish
 *    something nobody agreed to publish.
 *
 * ── WHAT IS CARRIED, AND WHY IT IS SAFE ───────────────────────────────────
 * Only facts the couple recorded ABOUT THIS BOOKING: the agreed total as the
 * starting price, transport, crew meals, crew size, and the inclusion lines.
 * Every one is a DEFAULT in an uncontrolled input — the supplier sees it, can
 * change any of it, and nothing is saved until they submit. The card is
 * theirs; this only stops it opening empty.
 *
 * ⚠ THE PRICE IS A STARTING POINT, NOT A CONTRACT. `total_cost_php` is what
 * the couple recorded, which may be a negotiated one-off. It seeds
 * `starting_price_php` because that is the field a `fixed`-basis card leads
 * with, and the supplier is looking straight at it.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CanvasInitial } from './canvas-initial';
import {
  coupleCardToCanvasInitial,
  isEventVendorId,
  type CoupleCardRow,
} from './couple-card-to-canvas';
import { agreedTotalNow, fetchChangeLinesByVendor } from './agreed-total-and-its-changes';

/**
 * Read the couple's booking and hand it to the mapping.
 *
 * ⚠ THE JUDGEMENT IS NOT HERE. Everything that can be got wrong — what is
 * copied, what is withheld, when to open blank — lives in
 * `./couple-card-to-canvas`, which has no `server-only` and is executed by
 * `vendor-card-from-couple.test.ts`. This half is the one-row fetch and
 * nothing else, because `server-only` would make anything living here
 * untestable.
 *
 * Returns `null` — the maker then opens blank, exactly as before — when the
 * booking cannot be read or there is nothing worth seeding.
 *
 * ⚠ ADMIN CLIENT ON PURPOSE, AND THE CALLER MUST HAVE PROVEN THE CLAIM. The
 * row is COUPLE-owned; a freshly signed-up supplier holds no RLS read on it.
 * The security chain lives in the caller (`resolveClaimContextForService` plus
 * the page's four-way check that the claim is `claimed`, belongs to this user,
 * resolved to this vendor profile, and matches this route's category) — the
 * same chain `registerClaimedServiceToCouple` already requires before it
 * writes. This function verifies none of that and must never be called with an
 * unproven id.
 */
export async function buildCanvasInitialFromCoupleCard(
  admin: SupabaseClient,
  eventVendorId: string,
  category: string,
): Promise<CanvasInitial | null> {
  if (!eventVendorId || !isEventVendorId(eventVendorId)) return null;

  const { data, error } = await admin
    .from('event_vendors')
    .select(
      'event_id,vendor_name,category,total_cost_php,transport_php,food_allowance_php,crew_size,crew_meal_covered,host_inclusions,marketplace_vendor_id',
    )
    .eq('vendor_id', eventVendorId)
    .maybeSingle();
  if (error || !data) {
    if (error) {
      console.error(
        '[supabase-error] lib/vendor-card-from-couple.ts · event_vendors.select',
        error,
      );
    }
    return null;
  }

  const row = data as CoupleCardRow & { event_id: string; total_cost_php: number | string | null };

  // 🔑 THE AGREED TOTAL NOW, NOT THE HEADLINE AT LOCK. Any change the couple
  // and supplier settled since sits in `event_vendor_line_items` as a delta,
  // so `total_cost_php` alone can be stale by the most recent renegotiation —
  // and this number is about to be seeded into a card the supplier publishes.
  // Owner 2026-09-11, "Show the total now".
  //
  // ⚠ A FAILED READ MUST NOT BECOME A PRICE. `fetchChangeLinesByVendor`
  // reports its own error; on one we seed NO price rather than the possibly
  // stale headline. The supplier types the figure themselves, which is the
  // pre-2026-09-20 behaviour — strictly better than publishing a wrong one.
  const { byVendor, error: linesError } = await fetchChangeLinesByVendor(admin, row.event_id);
  const agreed = linesError
    ? null
    : agreedTotalNow(row.total_cost_php, byVendor.get(eventVendorId) ?? []);

  return coupleCardToCanvasInitial(row, eventVendorId, category, agreed);
}

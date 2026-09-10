/**
 * service-card-view-model.ts — ONE row → the card a couple actually sees.
 *
 * ── WHY IT LEFT `app/v/[slug]/page.tsx` (owner, 2026-09-08) ────────────────
 * *"there is already a template of how a service card looks like. all we want
 * is for that to show instead of this."* The template is real and it shipped
 * long ago — it was simply unreachable. `toServiceCard` sat 3,300 lines into
 * the public profile page, so the ONLY surface that could draw a couple's card
 * was the couple's own page. The vendor looking at their own shop got a grey
 * wrench glyph and a line of text.
 *
 * Moved verbatim. It depends on no local helper in that file — every call it
 * makes (`displayServiceLabel`, `formatPhp`, `pickBestDiscount`,
 * `cardRecordHasSomethingToSay`) already came from a lib — so this is a move,
 * not a rewrite, and the public profile keeps calling the same function.
 *
 * 🔑 THE ALTERNATIVE WAS A SECOND BUILDER FOR THE VENDOR SIDE, and it would
 * have been wrong within a week. A card is a promise about what a couple sees;
 * two implementations of "from ₱X", of which discount wins, of what counts as
 * included, agree the day they are written and drift at the first pricing
 * change — and the vendor would be the last to know, because their copy would
 * keep looking right to them.
 *
 * Pure: no React, no I/O. Server components on both sides import it.
 */

import type { CardRecordRating } from '@/app/_components/card-record-section';
import { cardRecordHasSomethingToSay, type CompiledCardRecord } from '@/lib/service-card-record';
import { displayServiceLabel, formatPhp } from '@/lib/vendors';
import {
  pickBestDiscount,
  type VendorServiceInclusion,
} from '@/lib/vendor-service-public';
import type { VendorServiceRow, VendorServiceDiscount } from '@/lib/vendor-services';

/** Max inclusions listed before we collapse the rest into "+N more included". */
const SERVICE_CARD_INCLUSION_LIMIT = 3;

/** Resolved showcase display URLs for one card (photos ≤5 + optional clip). */
export type ServiceShowcaseMedia = { photos: string[]; videoUrl: string | null };

export type ServiceCard = {
  id: string;
  /**
   * `vendor_services.public_id` (S89…) — the deep-link handle for `?service=`.
   * The internal uuid stays out of the URL bar.
   *
   * OPTIONAL, and ABSENT (not `''`, not null) when `serviceDetailsEnabled()` is
   * off: the flag's contract is that the flag-OFF card is byte-identical to
   * today, and that has to include the serialized RSC payload, not just the
   * rendered DOM. Pinned by `service-details-dark.test.ts`.
   */
  publicId?: string;
  label: string;
  priceLabel: string;
  /** Crew / meal line, pre-joined server-side. null → no second line. */
  meta: string | null;
  // ── Service-card redesign · Phase 4 (couple-facing enrichment) ────────────
  /** Best applicable discount badge copy (e.g. "20% off · early booking"),
   *  chosen server-side by pickBestDiscount. null → no discount to show. */
  discountLabel: string | null;
  /** FREE inclusions with a stated worth, pre-formatted server-side
   *  ("Photo booth · ₱8,000 free"). Trimmed to a few; `inclusionsMore` counts
   *  the overflow. Empty → the Includes row is hidden. */
  inclusions: string[];
  /** How many inclusions were trimmed off `inclusions` (drives "+N more"). */
  inclusionsMore: number;
  /** The UNTRIMMED inclusion list, for the details sheet — the "+N more" tail is
   *  exactly what a couple opens the sheet to read. Present ONLY when
   *  `serviceDetailsEnabled()`; with the flag off the key is ABSENT, so the
   *  card's serialized payload is byte-for-byte what it is today. */
  inclusionsFull?: string[];
  /** "Not included" expectation flags, pre-formatted server-side
   *  ("Crew meal not included", "Transport: ₱1,500"). Empty → row hidden. */
  notIncluded: string[];
  // ── Couple-side serves payoff (2026-07-03) ─────────────────────────────────
  /** Pricing-basis detail under the "from ₱X" anchor, pre-formatted server-side
   *  ("₱350 / guest · min 50 guests", "₱15,000 for 4 hrs · +₱2,000/extra hr").
   *  null → fixed basis / nothing extra to explain. */
  priceDetail: string | null;
  /** Who this service serves, pre-formatted server-side from the coverage row
   *  ("Wedding · Debut — All faiths"). null → no coverage declared → no line. */
  serves: string | null;
  /** Showcase photo display URLs (≤5, presigned server-side). Empty → no strip. */
  photos: string[];
  /** Showcase clip display URL (presigned server-side). null → no video. */
  videoUrl: string | null;
  // ── Card Record (2026-07-28, flag NEXT_PUBLIC_CARD_RECORD_ENABLED) ────────
  /** Compiled history of THIS card — booked count, event-type mix, anonymized
   *  ledger, milestone medals. Compiled server-side by compileCardRecord(); the
   *  underlying reader emits only de-identified aggregates. null when the flag
   *  is off OR the card has never been booked — a zero-history card shows
   *  nothing new. */
  record: CompiledCardRecord | null;
  /** Vendor-level trusted rating shown inside the record block. SHOP-wide, not
   *  per-card: reviews carry no service dimension. null → no stars. */
  recordRating: CardRecordRating | null;
};

export function toServiceCard(
  row: VendorServiceRow,
  inclusions: VendorServiceInclusion[] | undefined,
  discounts: VendorServiceDiscount[] | undefined,
  serves: string | undefined,
  showcase: ServiceShowcaseMedia | undefined,
  /** Council #6: when true the vendor opted to hide public prices — every peso
   *  amount below is suppressed (labels/inclusions still show; only figures go). */
  hidePrices: boolean,
  /** Viewing couple's event date (ISO YYYY-MM-DD) or null — picks the
   *  early-booking ladder tier (owner-locked 2026-07-27). */
  coupleEventDate: string | null,
  /** The render's single clock (injected — never Date.now() down here). */
  now: Date,
  /** This card's compiled record, or null when the flag is off. */
  cardRecord: CompiledCardRecord | null,
  /** Shop-wide trusted rating for the record block, or null. */
  cardRecordRating: CardRecordRating | null,
  /** `serviceDetailsEnabled()` — gates the details-sheet-only payload below, so
   *  the flag-OFF card ships exactly the bytes it ships today. */
  detailsEnabled: boolean,
  /**
   * C2 (2026-09-11): the card's cover photo (`primary_photo_r2_key`),
   * already resolved to a display URL by the caller — this stays a PURE
   * function, so it cannot sign/resolve the ref itself. Optional and
   * defaulted so the two callers that don't pass it (the vendor's own
   * services list, the shop's own page — D2 owns that file) render
   * byte-identical to today. Only used when `showcase` carries no photos,
   * so a card with real showcase photos never loses them to the cover.
   */
  coverPhotoUrl?: string | null,
): ServiceCard {
  // ⚠ MUST read the vendor's own title first. This card is what the
  // maker's live preview promises "exactly what couples see" — a card
  // authored with a name (or the maker's own kind-derived default) must
  // show that name, not silently fall back to the bare category. And for
  // a CUSTOM category the fallback must go through `displayServiceLabel`,
  // never the raw stored key — see its own docblock on why a couple must
  // never be shown a database key on this exact card.
  const label = row.title?.trim() || displayServiceLabel(row.category);
  const priceLabel =
    !hidePrices && row.starting_price_php !== null && row.starting_price_php > 0
      ? `from ${formatPhp(row.starting_price_php)}`
      : 'Inquire';

  // Pricing-basis detail — HOW the "from ₱X" anchor is computed. Per-pax shows
  // the per-guest rate (+ the min floor when set); per-hour shows the base
  // block (+ the extra-hour rate when set). Fixed = nothing extra to explain
  // (the pax brackets stay a vendor-side quoting tool in V1). The anchor line
  // above is untouched.
  const isCrewMeals = row.category === 'crew_meals';
  const perPaxUnit = isCrewMeals ? 'meal' : 'guest';
  let priceDetail: string | null = null;
  if (hidePrices) {
    // Vendor hid prices — no per-pax/per-hour rate breakdown.
    priceDetail = null;
  } else if (
    row.pricing_basis === 'per_pax' &&
    row.per_pax_price_php !== null &&
    row.per_pax_price_php > 0
  ) {
    const minPart =
      row.min_pax !== null && row.min_pax > 0 ? ` · min ${row.min_pax} ${perPaxUnit}s` : '';
    priceDetail = `${formatPhp(row.per_pax_price_php)} / ${perPaxUnit}${minPart}`;
  } else if (
    row.pricing_basis === 'per_hour' &&
    row.hour_base_php !== null &&
    row.hour_base_php > 0
  ) {
    const base =
      row.min_hours !== null && row.min_hours > 0
        ? `${formatPhp(row.hour_base_php)} for ${row.min_hours} hr${row.min_hours === 1 ? '' : 's'}`
        : formatPhp(row.hour_base_php);
    const extra =
      row.extra_hour_php !== null && row.extra_hour_php > 0
        ? ` · +${formatPhp(row.extra_hour_php)}/extra hr`
        : '';
    priceDetail = `${base}${extra}`;
  }

  // Best applicable discount → a single badge (pickBestDiscount ranks by peso
  // savings on the anchor, dropping expired offers). Suppressed when the vendor
  // hid prices — a "Save ₱X" / "N% off" badge reveals the underlying figure.
  //
  // Early-booking LADDER (owner-locked 2026-07-27): when the viewer is a couple
  // with an event date, that date picks the tier and the badge names it
  // ("Booked 6+ months ahead · −10%"); rungs they are too late for are dropped.
  // Anonymous viewers see the ladder advertised as "Save up to 15% booking
  // early". Display only — the quote still happens in chat.
  const best = hidePrices
    ? null
    : pickBestDiscount(discounts, row.starting_price_php, {
        eventDate: coupleEventDate,
        now,
      });

  // FREE inclusions — "<label> · ₱X free" (worth omitted when the vendor left
  // it blank, OR when the vendor hid prices — keep the inclusion label, drop the
  // peso worth). Trim to a few; the overflow surfaces as "+N more".
  const allInclusions = (inclusions ?? []).map((inc) =>
    !hidePrices && inc.worth_php !== null && inc.worth_php > 0
      ? `${inc.label} · ${formatPhp(inc.worth_php)} free`
      : inc.label,
  );
  const shownInclusions = allInclusions.slice(0, SERVICE_CARD_INCLUSION_LIMIT);
  const inclusionsMore = Math.max(0, allInclusions.length - shownInclusions.length);

  // Crew / meta line (unchanged behaviour).
  const crewParts: string[] = [];
  if (row.crew_size !== null && row.crew_size > 0) {
    crewParts.push(`${row.crew_size} crew on-site`);
  }
  if (row.crew_meal_required && !isCrewMeals) {
    crewParts.push('crew meal required');
  }

  // "Not included" expectation flags — feed the couple's budget + set
  // expectations before the quote (0007 budget line items).
  const notIncluded: string[] = [];
  if (!row.crew_meal_included && !isCrewMeals) notIncluded.push('Crew meal not included');
  if (!row.transport_included) {
    notIncluded.push(
      !hidePrices && row.transport_flat_fee_php !== null && row.transport_flat_fee_php > 0
        ? `Transport: ${formatPhp(row.transport_flat_fee_php)}`
        : 'Transport not included',
    );
  }

  return {
    id: row.vendor_service_id,
    label,
    priceLabel,
    meta: crewParts.length > 0 ? crewParts.join(' · ') : null,
    discountLabel: best?.label ?? null,
    inclusions: shownInclusions,
    inclusionsMore,
    // ── Details-sheet-only payload ────────────────────────────────────────
    // A CONDITIONAL SPREAD, not `: []` / `: null` defaults. "Flag off ⇒
    // byte-identical" has to cover the serialized RSC payload the browser
    // downloads, not just the rendered DOM — shipping two extra keys per card
    // to every anonymous visitor would quietly break that contract. With the
    // flag off these keys are ABSENT, so the card streams exactly the bytes it
    // streams today. Pinned by `service-details-dark.test.ts`.
    ...(detailsEnabled
      ? {
          publicId: row.public_id,
          // The sheet is the one place the "+N more included" tail is readable.
          inclusionsFull: allInclusions,
        }
      : {}),
    notIncluded,
    priceDetail,
    serves: serves ?? null,
    // C2: no showcase photos → fall back to the card's own cover so the
    // grid never draws a card with nothing to look at. A showcase with real
    // photos always wins; an EMPTY showcase array (not just `undefined`)
    // still falls back — a card that was given no gallery is not a card
    // that opted out of a picture.
    photos:
      showcase?.photos && showcase.photos.length > 0
        ? showcase.photos
        : coverPhotoUrl
          ? [coverPhotoUrl]
          : [],
    videoUrl: showcase?.videoUrl ?? null,
    // A card with no history shows NOTHING new — the record only exists once
    // this card has actually been booked (owner: a zero-history card must not
    // advertise its emptiness).
    record: cardRecordHasSomethingToSay(cardRecord) ? cardRecord : null,
    recordRating: cardRecordHasSomethingToSay(cardRecord) ? cardRecordRating : null,
  };
}

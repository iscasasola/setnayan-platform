/**
 * bench-service-card.ts — WHAT A SUPPLIER'S SERVICE CARD SAYS ON THE COUPLE'S
 * SUPPLIERS PAGE (owner 2026-10-07; corpus `SUPPLIERS_BUILD_PLAN_2026-10-07_
 * fable.md` § PR2: "the couple's cards … `ServiceCardFace` shape: 80×112 cover,
 * name + discount pill, leaf line, priceText, includes, Not included").
 *
 * Pure. The page reads the rows (`lib/bench-service-cards.ts`); this decides
 * what a couple may be shown from them.
 *
 * 🔑 THE PRICE IS NOT COMPUTED HERE. `snapshotFromService` is the one
 * derivation of "from ₱X", of which discount wins and of what counts as not
 * included — the supplier's own list, their editor and the card offered in a
 * conversation all read it. This module only WITHHOLDS:
 *
 *   · a shop that hides its prices publicly (`hide_prices_publicly`) shows no
 *     peso figure here either — no price, no discount pill (a "10% off" gives
 *     the figure away), no "₱X free" on the includes line, no transport fee.
 *     A couple who has merely saved a supplier is the public, not a party to a
 *     quote. What the supplier quotes them is the couple's own recorded price,
 *     which the bench card already prints.
 *   · an offer that has ended is not advertised.
 *   · a card with no price set says nothing rather than "from ₱—".
 *
 * ⚠ THE NAME DOES NOT COME FROM THE SNAPSHOT. `readSnapshot` falls back to
 * "Untitled service" when `title` is null, and `title` is null on live services
 * (measured on production 2026-09-09, see `lib/offered-service-card.ts`). The
 * name resolves the way every couple-facing card resolves it: the supplier's
 * own title, else the category's label.
 */
import { displayServiceLabel } from '@/lib/vendors';
import {
  snapshotFromService,
  type StoredBracket,
  type StoredDiscount,
  type StoredInclusion,
  type StoredServiceCard,
} from '@/lib/service-card-snapshot';

/** One supplier's service card as the couple's page draws it. Crosses the
 *  server → client boundary, so it is plain data. */
export type BenchServiceCard = {
  /** The service's name — the supplier's title, else the category label. */
  name: string;
  /** "from ₱X …" — null when the shop withholds prices or none is set. */
  priceText: string | null;
  /** The best running offer, e.g. "Early booking · 10% off" — null when none,
   *  or when the shop withholds prices. */
  discountBadge: string | null;
  /** "Includes: a · b · c" — null when the card lists nothing. */
  includesLine: string | null;
  /** What the price does not cover ("crew meal", "transport (+₱1,500)"). */
  notIncluded: string[];
  /** The supplier said yes to the Setnayan gift. Never a number. */
  givesSetnayanGift: boolean;
  /** The card's cover photograph, already a display URL — null when none. */
  coverUrl: string | null;
};

export type BenchServiceDiscount = StoredDiscount & { expires_at?: string | null };

/** The snapshot's own placeholder for "no price typed yet". */
const NO_PRICE = 'from ₱—';

/** An offer whose end date has passed is not an offer. An unreadable date is
 *  treated as no date at all — the supplier's list still shows it, so a couple
 *  is told what the supplier is told. */
function stillRunning(d: BenchServiceDiscount, now: Date): boolean {
  if (!d.expires_at) return true;
  const end = Date.parse(d.expires_at);
  if (Number.isNaN(end)) return true;
  return end >= now.getTime();
}

export function benchServiceCard(input: {
  service: StoredServiceCard;
  discounts?: readonly BenchServiceDiscount[];
  inclusions?: readonly StoredInclusion[];
  brackets?: readonly StoredBracket[];
  /** The shop's own "hide my prices publicly" switch. */
  hidePrices: boolean;
  /** The cover, already resolved to a display URL by the caller. */
  coverUrl: string | null;
  /** The render's clock — injected, never read here. */
  now: Date;
}): BenchServiceCard {
  const { service, hidePrices, now } = input;
  const snap = snapshotFromService(
    service,
    {
      discounts: hidePrices ? [] : (input.discounts ?? []).filter((d) => stillRunning(d, now)),
      inclusions: hidePrices
        ? (input.inclusions ?? []).map((i) => ({ label: i.label, worth_php: null }))
        : input.inclusions,
      brackets: input.brackets,
    },
  );
  const title = service.title?.trim();
  const category = service.category?.trim();
  return {
    name: title || (category ? displayServiceLabel(category) : '') || 'Service',
    priceText: hidePrices || snap.priceText === NO_PRICE ? null : snap.priceText,
    discountBadge: hidePrices ? null : snap.discountBadge,
    includesLine: snap.includesLine,
    // The snapshot words transport as "(+₱1,500)" or "(by distance)" — a
    // figure, or a claim about how they charge. A hidden shop says neither.
    notIncluded: hidePrices
      ? snap.notIncluded.map((n) => (n.startsWith('transport') ? 'transport' : n))
      : snap.notIncluded,
    givesSetnayanGift: snap.givesSetnayanGift,
    coverUrl: input.coverUrl,
  };
}

/** The words on a card whose service card states no price the couple may see. */
export const PRICE_ON_REQUEST = 'Price on request';

/**
 * A supplier whose real name is still withheld (hybrid anonymity — "Real name
 * shown after they reply") must not be named by their own service card either:
 * a title is free text and routinely carries the business name. Their card
 * keeps everything else and leaves the name EMPTY, which the list fills with
 * the category's label.
 *
 * Applied on the SERVER, to the record that crosses to the browser — hiding it
 * in the markup would still ship the title in the payload.
 */
export function withholdCardNames(
  cards: Readonly<Record<string, BenchServiceCard>>,
  anonymizedIds: Iterable<string>,
): Record<string, BenchServiceCard> {
  const out: Record<string, BenchServiceCard> = { ...cards };
  for (const id of anonymizedIds) {
    const card = out[id];
    if (card) out[id] = { ...card, name: '' };
  }
  return out;
}

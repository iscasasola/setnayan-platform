/**
 * THE SETNAYAN GIFT — how many free Papic photos a supplier's "yes" buys a
 * couple, and what that costs the supplier. Pure: no I/O, no `server-only`, so
 * every rule below is unit-testable and mutation-testable.
 *
 * ⚖ OWNER RULINGS (DECISION_LOG 2026-09-09 — all closed, none to re-ask):
 *   • the gift budget is 40% OF THE BOOKING FEE, and 40% is a CEILING
 *     ("no. just max to 40%. nothing more.");
 *   • the fee itself comes from lib/booking-fee.ts — never a re-typed rate;
 *   • credits are PROPORTIONAL — the budget is spent continuously along the LIVE
 *     Papic rung ladder, interpolating between rungs, never "the biggest whole
 *     bundles that fit" ("it will be proportionally computed to the value");
 *   • CAPPED AT 50,000 CREDITS — the 100,000 rung is off the gift ladder
 *     ("max up to the 50000 papic credits. only."). The cap is implemented on
 *     CREDITS and then PRICED from the live 50,000 rung, so repricing that rung
 *     can never turn the cap into a different number of photographs;
 *   • the supplier is charged FOR the gift, on top of the fee, so the charge
 *     caps with it: above the cap they pay fee + the 50,000 rung's price;
 *   • no gift below the smallest rung — derived, not typed: at a ₱3,500 booking
 *     the fee is ₱175, 40% is ₱70, and ₱70 is exactly the 100-credit rung;
 *   • SAID IN PHOTOGRAPHS, never pesos, to the couple.
 *
 * ⚠ NEVER RE-TYPE A RUNG. The ladder is `platform_retail_catalog_v2`'s REGULAR
 * `retail_price_php` (never `onboarding_price_php` — "all regular price will
 * always be the price") joined to `papic_pass_tiers.points`, read at runtime by
 * the caller and handed in here. The database computes the SAME answer in
 * `public.setnayan_gift_for_fee` (the bill is priced there);
 * tests/db/the-gift-reaches-the-couple.db.test.ts asserts the two agree.
 *
 * ARITHMETIC IS IN WHOLE CENTAVOS so this and the SQL mirror round identically:
 * every product below is an exact integer (max ~1.5M centavos × 50,000 credits
 * ≈ 7.5e10, far inside 2^53), and "round half up" on a positive integer ratio is
 * floor((2n + d) / 2d) — the same result as Postgres `round(numeric)`.
 */

/**
 * 40% of the booking fee — the gift's CEILING (owner 2026-09-09). A whole
 * percent, applied in integer centavos and FLOORED, so the charge can never
 * exceed 40% by even a centavo (a float `× 0.4` can land on 6999.9999…).
 */
export const GIFT_SHARE_OF_FEE_PCT = 40;

/** The gift stops at the 50,000-credit rung (owner 2026-09-09). CREDITS, not pesos. */
export const GIFT_CAP_CREDITS = 50_000;

/** One rung of the live Papic ladder, as the gift reads it. */
export type GiftRung = {
  credits: number;
  /** The rung's REGULAR retail price, in whole centavos. */
  priceCentavos: number;
};

/** The gift for one fee. `credits` 0 ⇒ no gift at all, and `chargeCentavos` 0. */
export type SetnayanGift = {
  /** Free Papic credits (= photos) the couple receives when the money clears. */
  credits: number;
  /** What the supplier pays for them, in whole centavos, ON TOP of the fee. */
  chargeCentavos: number;
  /** True when the 50,000-credit cap bound (the charge stopped growing). */
  capped: boolean;
};

const NO_GIFT: SetnayanGift = Object.freeze({ credits: 0, chargeCentavos: 0, capped: false });

/** A catalog row, as `platform_retail_catalog_v2` returns it. */
export type GiftCatalogRow = {
  service_code?: string | null;
  retail_price_php?: number | string | null;
  is_active?: boolean | null;
  retired_at?: string | null;
};

/** A tier row, as `papic_pass_tiers` returns it. */
export type GiftTierRow = {
  service_code?: string | null;
  points?: number | string | null;
  is_active?: boolean | null;
  is_topup?: boolean | null;
};

/**
 * Build the GIFT ladder from the two live tables: every active, unretired
 * PAPIC_GUEST* rung that has an active, non-top-up tier row, at or below the
 * 50,000-credit cap, cheapest first.
 *
 * A rung whose price does not rise with its credits would make interpolation
 * meaningless, so the ladder is returned EMPTY (⇒ no gift promised, nothing
 * billed) rather than guessed at. Fail closed: a supplier is never charged by
 * a malformed catalog.
 */
export function giftLadderFrom(
  catalog: readonly GiftCatalogRow[],
  tiers: readonly GiftTierRow[],
): GiftRung[] {
  const points = new Map<string, number>();
  for (const t of tiers) {
    const code = typeof t.service_code === 'string' ? t.service_code : '';
    const n = Number(t.points);
    if (!code.startsWith('PAPIC_GUEST') || t.is_active !== true || t.is_topup === true) continue;
    if (!Number.isInteger(n) || n <= 0) continue;
    points.set(code, n);
  }

  const rungs: GiftRung[] = [];
  for (const c of catalog) {
    const code = typeof c.service_code === 'string' ? c.service_code : '';
    if (!code.startsWith('PAPIC_GUEST') || c.is_active !== true || c.retired_at) continue;
    const credits = points.get(code);
    const php = Number(c.retail_price_php);
    if (credits === undefined || !Number.isFinite(php) || php <= 0) continue;
    if (credits > GIFT_CAP_CREDITS) continue; // the 100,000 rung is off the gift ladder
    rungs.push({ credits, priceCentavos: Math.round(php * 100) });
  }
  rungs.sort((a, b) => a.credits - b.credits);

  for (let i = 1; i < rungs.length; i += 1) {
    if (
      rungs[i]!.credits === rungs[i - 1]!.credits ||
      rungs[i]!.priceCentavos <= rungs[i - 1]!.priceCentavos
    ) {
      return [];
    }
  }
  return rungs;
}

/** Round-half-up of n/d for non-negative integers n and positive integer d. */
function roundRatio(n: number, d: number): number {
  return Math.floor((2 * n + d) / (2 * d));
}

/**
 * The gift a given booking fee buys.
 *
 * @param feeCentavos the booking fee in whole centavos — from `bookingFeePhp`
 *   (× 100) or the SQL mirror `booking_fee_centavos`, never re-derived here.
 * @param ladder the LIVE gift ladder (`giftLadderFrom`).
 */
export function setnayanGiftForFee(
  feeCentavos: number,
  ladder: readonly GiftRung[],
): SetnayanGift {
  if (!Number.isFinite(feeCentavos) || feeCentavos <= 0) return NO_GIFT;
  if (ladder.length === 0) return NO_GIFT;

  // The cap is a number of CREDITS; its price is read off the live rung. No
  // 50,000 rung on the ladder ⇒ no way to price the cap ⇒ no gift, rather than
  // an uncapped one.
  const capRung = ladder.find((r) => r.credits === GIFT_CAP_CREDITS);
  if (!capRung) return NO_GIFT;

  const budget = Math.floor((Math.round(feeCentavos) * GIFT_SHARE_OF_FEE_PCT) / 100);
  const capped = budget >= capRung.priceCentavos;
  const charge = capped ? capRung.priceCentavos : budget;

  // THE FLOOR — below the smallest rung the promise would produce nothing.
  const first = ladder[0]!;
  if (charge < first.priceCentavos) return NO_GIFT;
  if (capped) return { credits: GIFT_CAP_CREDITS, chargeCentavos: charge, capped: true };

  for (let i = 0; i < ladder.length; i += 1) {
    const lo = ladder[i]!;
    const hi = ladder[i + 1];
    if (charge === lo.priceCentavos || !hi) {
      return { credits: lo.credits, chargeCentavos: charge, capped: false };
    }
    if (charge < hi.priceCentavos) {
      const credits =
        lo.credits +
        roundRatio(
          (charge - lo.priceCentavos) * (hi.credits - lo.credits),
          hi.priceCentavos - lo.priceCentavos,
        );
      return { credits, chargeCentavos: charge, capped: false };
    }
  }
  return NO_GIFT; // unreachable — the cap rung is on the ladder and bounds `charge`
}

/** "1,429" — the count as a couple reads it. */
export function formatGiftPhotos(credits: number): string {
  return new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 }).format(credits);
}

/**
 * The line on the QUOTE. In PHOTOGRAPHS, never pesos (owner 2026-09-09:
 * *"give your couple 1,400 photos", not "₱1,000 of credits"*). Returns null
 * when there is no gift to name — the caller then says nothing, rather than
 * promising zero.
 */
export function giftQuoteLine(
  gift: Pick<SetnayanGift, 'credits'>,
  audience: 'couple' | 'supplier',
): string | null {
  if (!gift || !Number.isFinite(gift.credits) || gift.credits <= 0) return null;
  const n = formatGiftPhotos(gift.credits);
  return audience === 'couple'
    ? `Includes a Setnayan gift — you get ${n} free Papic photos for your celebration.`
    : `Includes your Setnayan gift — your couple gets ${n} free Papic photos.`;
}

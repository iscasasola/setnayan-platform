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

import { bookingFeePhp, type BookingFeeSchedule } from './booking-fee';

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

/** ₱ + thousands, 0 decimals when whole — mirror of SQL `booking_fee_php_text`. */
function pesoText(centavos: number): string {
  const php = Math.round(centavos) / 100;
  const whole = Number.isInteger(php);
  return (
    '₱' +
    new Intl.NumberFormat('en-US', {
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    }).format(php)
  );
}

/**
 * The clause a SUPPLIER reads on their booking-fee bill when it carries the
 * gift — appended right after "Setnayan booking fee (<schedule>)". Pesos are
 * right HERE: it is the supplier's own bill, and they are paying the gift. The
 * couple is only ever told photographs.
 *
 *   " ₱2,500 + your Setnayan gift for your couple: 1,429 free Papic photos, ₱1,000"
 *
 * Mirror of SQL `setnayan_gift_bill_clause` (the amended-order minter); the db
 * test asserts the two produce the same text.
 */
export function setnayanGiftBillClause(
  feeCentavos: number,
  giftCredits: number,
  giftCentavos: number,
): string {
  const photos = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(giftCredits);
  return (
    ` ${pesoText(feeCentavos)} + your Setnayan gift for your couple: ` +
    `${photos} free Papic photos, ${pesoText(giftCentavos)}`
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * THE QUOTE BEING WRITTEN — the gift while the supplier is still typing.
 *
 * ⚖ Owner 2026-09-09: *"the NUMBER appears on the QUOTE, not the card … the
 * moment a price exists — the proposal or the agreed figure — the exact photo
 * count is known and is the strongest line on it."* Until now that number
 * existed only on the SENT quote. A supplier deciding what to charge could not
 * see what their own price was buying, and — the half that matters — could not
 * see WHAT IT COST THEM.
 *
 * ⚖ Owner 2026-09-15, asked whether the composer should show the upside only:
 * **"show both."** So the supplier-facing copy names the photographs AND the
 * peso charge, because they are the one paying it (owner 2026-09-09: "the
 * supplier is CHARGED for the gift"). The couple is still told photographs and
 * never pesos — that rule is untouched.
 *
 * 🔑 WHY THE PREVIEW IS COMPUTED FROM THE SAME TWO PURE FUNCTIONS AS THE BILL.
 * A composer that estimated its own number would be a SECOND source of truth
 * for one fact, and the two would drift the first time a rung or the fee
 * schedule moved — with the supplier having agreed to the wrong one. This runs
 * `bookingFeePhp` then `setnayanGiftForFee`, byte for byte what
 * `quoteSetnayanGift` runs on the server and what the SQL prices the bill with.
 * `the-quote-preview-is-the-bill.test.ts` asserts the two agree across a range
 * of totals, so an "optimisation" here fails rather than mis-sells.
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Everything the gift needs EXCEPT the amount — resolved once on the server and
 * handed to the composer so the browser can re-price as the supplier types.
 *
 * `null` is the honest answer to every doubt, exactly as `quoteSetnayanGift`
 * treats it: the fee is off, the card said no, the client is not
 * Setnayan-sourced, this is one of the first five free bookings, or a read
 * failed. The composer then says NOTHING — never "0 photos", which would
 * advertise an absence.
 */
export type GiftQuoteBasis = {
  /** The LIVE owner-set fee schedule. Never a re-typed rate. */
  schedule: BookingFeeSchedule;
  /** The live credit ladder, read from the catalogue. */
  ladder: GiftRung[];
};

/**
 * The gift a quote of `totalCentavos` would carry, or null for "say nothing".
 *
 * ⚠ `totalCentavos` MUST be the figure the server will re-sum to — in
 * ProposalMaker that is `netPayable`, the same number its line items add up to.
 * Previewing against a subtotal would quote a gift the bill will not match.
 */
export function previewGiftForTotal(
  totalCentavos: number,
  basis: GiftQuoteBasis | null,
): SetnayanGift | null {
  if (!basis || !Number.isFinite(totalCentavos) || totalCentavos <= 0) return null;
  const feeCentavos = Math.round(bookingFeePhp(totalCentavos / 100, basis.schedule) * 100);
  const gift = setnayanGiftForFee(feeCentavos, basis.ladder);
  return gift.credits > 0 ? gift : null;
}

/** Both lines of the gift block, for one audience. `null` ⇒ render nothing. */
export type GiftQuoteCopy = { headline: string; detail: string };

/**
 * THE ONE COPY OF THE GIFT SENTENCE, for every surface that shows it.
 *
 * 🔴 IT WAS TWO. `giftQuoteLine` shipped here with a `'supplier'` branch and was
 * imported by NOTHING but its own test, while the sent quote page rendered its
 * own inline strings — so the guard faced the dead copy and the live one was
 * unguarded. Adding a third at compose time would have made it three. This
 * replaces both; `giftQuoteLine` is gone.
 *
 * The supplier's `detail` carries pesos and the couple's never does — that
 * asymmetry is the owner's ruling, not a formatting choice, so it lives in one
 * function where it cannot be half-applied.
 */
export function giftQuoteCopy(
  gift: Pick<SetnayanGift, 'credits' | 'chargeCentavos'> | null | undefined,
  audience: 'couple' | 'supplier',
  opts: { businessName?: string | null } = {},
): GiftQuoteCopy | null {
  if (!gift || !Number.isFinite(gift.credits) || gift.credits <= 0) return null;
  const photos = formatGiftPhotos(gift.credits);
  if (audience === 'supplier') {
    return {
      headline: `Includes your Setnayan gift — your couple gets ${photos} free Papic photos`,
      detail:
        `Added to your booking fee bill: ${pesoText(gift.chargeCentavos)}. ` +
        `The photos reach your couple's Papic once that bill is paid.`,
    };
  }
  const from = opts.businessName?.trim();
  return {
    headline: `Includes a Setnayan gift — you get ${photos} free Papic photos`,
    detail: from
      ? `For your celebration, from ${from}. They arrive in your Papic once the booking is confirmed.`
      : `For your celebration. They arrive in your Papic once the booking is confirmed.`,
  };
}

/**
 * Vendor Papic CREDITS — a supplier's own shots, per event, priced by the owner
 * on 2026-09-05. PURE and unit-tested; the database layer (the ledger read, the
 * pack price) lives in lib/vendor-papic-grants.ts, and the grants themselves are
 * written by lib/sku-activation.ts on admin payment approval.
 *
 * ── THE RULE, IN THE OWNER'S WORDS (2026-09-05, DECISION_LOG) ─────────────────
 * *"vendors get 5% of the amount they paid for on booking fee. so if they paid
 * 1000 pesos for the booking fee, they get 50 papic credits for that event. if
 * they import a user and get to sync with them for free. they pay 500 pesos for
 * 25 papic credits. since they did not pay for booking fee, they only pay for
 * the photo importation fee for their portfolio."*
 *
 *   • CAP — asked "1,000 or 2,000?" he said *"minimum of 1000"*, and confirmed
 *     the same day that he meant the MAXIMUM: *"yes. that is the maximum from
 *     booking fee."* So `floor(fee × 5%)`, never more than 1,000 per event.
 *   • NO FLOOR — a ₱0 fee earns 0. The crumbs still land (₱20 → 1 credit,
 *     Fable: *"grant the crumbs, sell the loaf next to them"*); the ₱500/100
 *     pack is the CTA beside a grant under a pack's worth. That surface is
 *     G3's; `offerPack`
 *     below is the one rule it needs.
 *   • WHEN — *"when we approve the payment."* Credits land on admin approval of
 *     the order, never at submission and never self-reported. For a booked
 *     event that is the booking-fee order; an IMPORT carries no booking fee by
 *     design (`BookingFeeAttribution = 'import'` → `waived_import`,
 *     lib/booking-fee-gate.ts), so for an import the approved payment IS the
 *     ₱500/100 purchase.
 *
 * ── WHAT THIS REPLACES ─────────────────────────────────────────────────────────
 * Owner 2026-09-05: *"replace it."* The 2026-08-26 supplier-lane rate — one
 * shot per ₱5 of fee, floor 50, ceiling 2,000 (`VENDOR_PAPIC_PHP_PER_POINT`,
 * `VENDOR_PAPIC_BASE_GIFT_POINTS`, `VENDOR_PAPIC_MAX_POINTS`,
 * `vendorPapicPointsForBookingFee`) — is RETIRED in the same PR that added this
 * file. That is a reversal of an owner lock and is recorded as one in
 * DECISION_LOG, the way the 2026-08-26 row recorded its own reversal of
 * 2026-07-18.
 *
 * ── ONE METER, THE SUPPLIER'S ─────────────────────────────────────────────────
 * Asked whether the host-visible lane of the 2026-08-26 ruling survives on the
 * new credits or is retired with the rate, the owner said (2026-09-05): *"base
 * it all from the supplier's shots per event not from what the host gives
 * them."* Read as: there is ONE credit meter per (vendor, event) and it is the
 * supplier's own — fed by this rule and by the pack, never by anything the host
 * hands out (the couple's pool, `papic_event_point_grants`, is a different
 * ledger and a db test proves the two cannot see each other). The on-the-day
 * capture allowance (`allowancePointsFor` in lib/vendor-papic-tier.ts) therefore
 * reads THIS ledger where it used to read the booking fee. Nothing host-side
 * changed: host approval and per-photo guest consent are a data-protection
 * ruling, not a rate.
 *
 * ── WHERE THE NUMBERS COME FROM ────────────────────────────────────────────────
 * The pack PRICE is not here — read `vendor_billing_catalog` (admin-managed;
 * `fetchVendorPapicPortfolioCredits` does). The only money-shaped constants in
 * code are the two the owner spoke aloud: 5% of the booking fee (implemented as
 * ₱20 of fee per credit) and the credits per pack.
 *
 * ⚠ THOSE TWO NO LONGER IMPLY THE SAME RATE, AND THAT IS DELIBERATE. They once
 * did — ₱500 ÷ 25 was also ₱20 — and the coincidence read like a design. It was
 * not: the 5% is a REBATE on money already paid to us, while the pack is a
 * PURCHASE, and a purchase has to be worth making. Since 2026-09-06 the pack is
 * ₱500 ÷ 100 = ₱5/credit while the rebate stays 5%. Nobody can arbitrage the
 * gap — a supplier cannot choose to pay more booking fees to mint credits.
 */

/**
 * ₱20 of booking fee per credit — that is the owner's 5%, expressed as a
 * divisor. NOT the pack's rate: since 2026-09-06 a ₱500 pack grants 100
 * credits (₱5 each). The rebate and the purchase are priced differently on
 * purpose — see VENDOR_PAPIC_PORTFOLIO_PACK_CREDITS.
 */
export const VENDOR_PAPIC_PHP_PER_CREDIT = 20;

/** The most credits one booking fee can earn for one event (owner: "the maximum"). */
export const VENDOR_PAPIC_FEE_CREDITS_CAP = 1000;

/**
 * The flat pack — the `vendor_billing_catalog.sku_code`, which is also the
 * `orders.service_key` the activation hook dispatches on. Lowercase `vendor_*`
 * like every vendor SKU. Seeded by migration
 * `vendor_papic_portfolio_credits_ledger_and_pack_sku`; its ₱ price is read from
 * the table, never from here.
 */
export const VENDOR_PAPIC_PORTFOLIO_PACK_SKU_CODE = 'vendor_papic_portfolio_pack';

/**
 * Credits one ₱500 pack grants.
 *
 * Owner said 25 on 2026-09-05 ("they pay 500 pesos for 25 papic credits"), and
 * RAISED IT TO 100 on 2026-09-06 after the arithmetic was put in front of him.
 * The price did not move; what one ₱500 buys did.
 *
 * ── WHY, IN THE NUMBERS THAT DECIDED IT ────────────────────────────────────
 * A credit is 1 photo, or 1/8th of a ten-second clip (papic-cameras-pure.ts).
 * Read from `platform_retail_catalog_v2`, a COUPLE pays ₱0.70/credit at the
 * small packs and our own `saas_overhead_cost_php` is ₱0.024/credit, flat at
 * every tier. At 25 credits a supplier was paying ₱20/credit — **29× the
 * couple's price and 833× our cost** — so ₱500 bought them 25 photos, or
 * THREE ten-second clips. A pack nobody buys earns nothing, whatever its
 * margin.
 *
 * At 100 the supplier pays ₱5/credit: still 7× what a couple pays, which is
 * the premium the owner wanted ("vendors make money from their events, users
 * do not"), still a 99.5% margin, and ₱500 now buys 100 photos or 12 clips —
 * enough that documenting a job is worth buying.
 *
 * 🔑 IT ALSO PUTS THE VIDEO THRESHOLD BACK WHERE IT WAS PRICED. 800 credits
 * was set on 2026-08-26 against the retired ₱5/point rate — a ₱4,000 spend. At
 * ₱20/credit it had silently become ₱16,000. At ₱5/credit it is ₱4,000 again,
 * exactly. The threshold in lib/vendor-papic-tier.ts was never wrong; the
 * credit under it got four times dearer. That is why 800 is UNCHANGED.
 */
export const VENDOR_PAPIC_PORTFOLIO_PACK_CREDITS = 100;

/**
 * Credits a booking fee earns: `floor(fee × 5%)`, capped, NO floor.
 *
 * `null` / `undefined` / NaN / ≤ 0 → 0. A caller that could not READ the fee
 * must not call this with a made-up number — the activation hook grants nothing
 * on a failed read (see `grantVendorPapicCreditsForBookingFee`), which is the
 * same posture as the retired `fetchVendorBookingFeePaidPhp`: null is a failed
 * read, never ₱0.
 *
 * Divides by ₱20 rather than multiplying by 0.05 so a fee of ₱20 is exactly one
 * credit and no floating-point residue can round a whole credit away.
 */
export function vendorPortfolioCreditsForFee(feePhp: number | null | undefined): number {
  if (feePhp == null) return 0;
  const fee = Number(feePhp);
  if (!Number.isFinite(fee) || fee <= 0) return 0;
  return Math.min(VENDOR_PAPIC_FEE_CREDITS_CAP, Math.floor(fee / VENDOR_PAPIC_PHP_PER_CREDIT));
}

/**
 * Should the pack be offered beside this grant? Owner + Fable, 2026-09-05: the
 * pack is the CTA beside a grant UNDER a pack's worth. A supplier who already
 * earned that much does not need selling to; one who earned less is shown the
 * loaf beside the crumbs. G3 renders it; this is the rule, so both sides agree
 * on what "under" means — and it follows the pack size rather than a literal,
 * so the 2026-09-06 re-price (25 → 100) moved it without a second edit.
 */
export function offerPack(creditsGranted: number): boolean {
  const n = Number(creditsGranted);
  if (!Number.isFinite(n)) return true; // an unreadable grant is treated as none
  return n < VENDOR_PAPIC_PORTFOLIO_PACK_CREDITS;
}

/**
 * What G3 reads with ONE call (`fetchVendorPapicPortfolioCredits`).
 *
 *   credits      — the supplier's credits for this event, summed from the
 *                  ledger (booking fee + packs + admin/comp). 0 when nothing has
 *                  been granted; `null` when the ledger could not be read, which
 *                  is NOT zero and must not render as zero.
 *   spent        — points already spent by this supplier on this event
 *                  (`vendor_papic_captures`, 1 per photo, 8 per clip — the same
 *                  meter the capture route charges). Assume-exhausted on a
 *                  failed read, like the route.
 *   left         — what the on-the-day allowance says remains (tier floor
 *                  included, so it is the SAME number the capture screen shows).
 *                  `null` = unlimited (an admin-comped Unli tier).
 *   packSkuCode  — the SKU to mint an order for.
 *   packPricePhp — its price, read from `vendor_billing_catalog`; `null` when
 *                  the row is missing or inactive — render "unavailable", never
 *                  a remembered number.
 *   packCredits  — 100.
 *   offerPack    — `offerPack(credits)`, so the CTA rule is not re-derived.
 */
export type VendorPapicPortfolioCredits = {
  credits: number | null;
  spent: number;
  left: number | null;
  packSkuCode: string;
  packPricePhp: number | null;
  packCredits: number;
  offerPack: boolean;
};

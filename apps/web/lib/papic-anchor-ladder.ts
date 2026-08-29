/**
 * THE PAPIC LADDER AS FIVE NUMBERS INSTEAD OF SIXTEEN — pure, no I/O.
 *
 * ⚖ OWNER RULING 2026-08-28: he sets FIVE prices; ELEVEN compute from them.
 *
 *     100 → ₱50 · 3,000 → ₱1,200 · 10,000 → ₱3,200 · 20,000 → ₱5,000 ·
 *     50,000 → ₱11,200
 *
 * THE RULE: an anchor fixes a PRICE PER CREDIT, and that rate carries forward
 * to every rung below the next anchor. So the ladder is a step function of
 * per-credit rates — 0.50 · 0.40 · 0.32 · 0.25 · 0.224 — and a rung's price is
 * simply its credit count times the rate in force at that rung.
 *
 * 🔑 NOT ONE PRICE MOVES. Verified against the sixteen live prod prices before
 * a line of this was written: all sixteen reproduce EXACTLY, to the peso.
 * `papic-anchor-ladder.test.ts` re-derives that against
 * `tests/db/papic-ladder.expected.ts` rather than against a list retyped here,
 * so this file can never become a second opinion about what the ladder costs.
 *
 * ⚠ THE FIFTH ANCHOR (20,000) IS LOAD-BEARING, NOT DECORATION. The owner's
 * first cut had four. Without 20,000 the 0.25 band spanning 20,000 and 30,000
 * cannot be expressed: both would inherit 10,000's 0.32 and rise by ₱1,400 and
 * ₱2,100 — and 20,000 would then cost exactly what two 10,000s cost, which
 * deletes the reason to buy the bigger rung at all. He accepted the fifth
 * anchor for that reason. Do not "simplify" back to four.
 *
 * ⚠ WHAT THIS IS NOT: a billing source. Price is ALWAYS read from
 * `platform_retail_catalog_v2.retail_price_php` by `service_code`
 * (`resolveRetailChargeCentavos`), and that does not change. This module is a
 * SAVE-TIME derivation: the admin screen computes the eleven and writes them
 * into their own catalog rows, so after a save there is still exactly ONE price
 * per rung, in the catalog, exactly as today. The anchors are an INPUT DEVICE
 * and are deliberately NOT stored anywhere — storing them would be the second
 * source of truth this codebase keeps paying for.
 */

/** The credit counts of the five rungs the owner types a price into. */
export const PAPIC_ANCHOR_SHOTS: readonly number[] = [
  // ⚖ 100,000 IS AN ANCHOR, NOT A COMPUTED RUNG (owner 2026-08-29: *"place an
  //   editable row like 50,000 and make the value 24000 php"*). Computed, it
  //   would have inherited the 50,000 rate and landed at exactly two lots of
  //   50,000 — the same reason he removed 40,000. An anchor is the only shape
  //   that lets it be worth buying.
  100, 3_000, 10_000, 20_000, 50_000, 100_000,
] as const;

/** `[shots, pesos]` — the anchor prices as they stand today (the seed, not a rule). */
export const PAPIC_ANCHORS_DEFAULT: readonly (readonly [number, number])[] = [
  // ⚠ THESE ARE PRODUCTION'S ANCHOR PRICES, RE-READ 2026-08-29, and they had
  // drifted badly from what used to be here. The admin pricing screen writes
  // STRAIGHT to the catalog, so prod was repriced with no migration behind it
  // while this seed still described the 2026-08-26 ladder (100 → ₱50,
  // 50,000 → ₱11,200). Harmless while nothing new was added; the moment a
  // 100,000 rung arrived, "₱24,000" was correct against prod's ₱0.30 a credit
  // and a RISE against the stale seed's ₱0.224 — a right price that the
  // never-rises guard would have refused.
  //
  // Migration 20271182141904 un-drifts the catalog seed and this list follows
  // it, so the anchors reproduce the ladder that is actually charged. The
  // catalog stays the source of truth; this is a fallback, never a price.
  [100, 70],
  [3_000, 1_680],
  [10_000, 4_500],
  [20_000, 7_200],
  [50_000, 15_000],
  // ⚖ Owner 2026-08-29: *"place an editable row like 50,000 and make the value
  // 24000 php."* ₱0.24 a credit — a real saving on 50,000's ₱0.30, where a
  // COMPUTED rung would have inherited ₱0.30 and cost exactly two 50,000s.
  [100_000, 24_000],
] as const;

/** True when this rung is one the owner types into rather than one that computes. */
export function isPapicAnchor(shots: number): boolean {
  return PAPIC_ANCHOR_SHOTS.includes(shots);
}

/**
 * The price-per-credit in force at `shots` — the deepest anchor at or below it.
 *
 * Returns `null` when `shots` sits below the lowest anchor, because there is no
 * rate to inherit. A caller must treat that as "cannot compute", never as free.
 */
export function papicRateAt(
  shots: number,
  anchors: readonly (readonly [number, number])[] = PAPIC_ANCHORS_DEFAULT,
): number | null {
  let rate: number | null = null;
  // Sorted ascending so the LAST anchor at or below `shots` wins — that is what
  // "carries forward to every rung below the next anchor" means, expressed
  // without needing to know where the next anchor is.
  for (const [anchorShots, anchorPhp] of [...anchors].sort((a, b) => a[0] - b[0])) {
    if (!Number.isFinite(anchorShots) || anchorShots <= 0) continue;
    if (!Number.isFinite(anchorPhp) || anchorPhp < 0) continue;
    if (shots >= anchorShots) rate = anchorPhp / anchorShots;
  }
  return rate;
}

/**
 * The peso price of a rung, derived from the anchors. `null` when no rate
 * applies (see `papicRateAt`).
 *
 * Rounded to the centavo, matching how every other price in this catalog is
 * stored. At the real anchor values every rung lands on a whole peso.
 */
export function papicPriceAt(
  shots: number,
  anchors: readonly (readonly [number, number])[] = PAPIC_ANCHORS_DEFAULT,
): number | null {
  const rate = papicRateAt(shots, anchors);
  if (rate == null) return null;
  return Math.round(rate * shots * 100) / 100;
}

/** One rung as the admin screen shows it. */
export type PapicRung = {
  shots: number;
  /** The peso price — typed when `isAnchor`, computed otherwise. */
  php: number | null;
  /** Price per credit at this rung — the thing the anchors actually control. */
  ratePerCredit: number | null;
  /** Anchors are editable; the rest are results and must READ as results. */
  isAnchor: boolean;
};

/**
 * The whole ladder, in order, each rung marked as typed or computed.
 *
 * `allShots` is passed in rather than hardcoded so the rung SET comes from the
 * catalog (the thing that actually decides which rungs exist) and this module
 * never becomes a second opinion about that either.
 */
export function buildPapicLadder(
  allShots: readonly number[],
  anchors: readonly (readonly [number, number])[] = PAPIC_ANCHORS_DEFAULT,
): PapicRung[] {
  const anchorPhp = new Map(anchors.map(([s, p]) => [s, p]));
  return [...allShots]
    .sort((a, b) => a - b)
    .map((shots) => {
      const isAnchor = anchorPhp.has(shots);
      const php = isAnchor ? (anchorPhp.get(shots) ?? null) : papicPriceAt(shots, anchors);
      const ratePerCredit =
        php != null && shots > 0 ? php / shots : papicRateAt(shots, anchors);
      return { shots, php, ratePerCredit, isAnchor };
    });
}

/** What is wrong with a ladder, in words an admin can act on. Empty = fine. */
export type LadderComplaint = {
  kind: 'total_not_rising' | 'rate_rising' | 'uncomputable';
  message: string;
};

/**
 * THE TWO RULES THAT MAKE A LADDER HONEST, checked in both senses.
 *
 *   1. The TOTAL must rise with credits. A bigger rung that costs less is free
 *      money.
 *   2. The PRICE PER CREDIT must never rise. A rung dearer per credit than a
 *      smaller one is a rung nobody should ever buy — they would rationally buy
 *      the smaller one twice — so it is a defect even though the total rises.
 *
 * ⚠ Rule 2 is the one an anchor edit breaks quietly: raising a middle anchor
 * leaves both totals rising while inverting the rate, so a check on totals
 * alone reports a clean ladder. Both are checked, and the screen says which.
 */
export function ladderComplaints(rungs: readonly PapicRung[]): LadderComplaint[] {
  const out: LadderComplaint[] = [];
  const ordered = [...rungs].sort((a, b) => a.shots - b.shots);

  for (const r of ordered) {
    if (r.php == null || !Number.isFinite(r.php)) {
      out.push({
        kind: 'uncomputable',
        message: `${r.shots.toLocaleString('en-PH')} shots has no price — it sits below the lowest anchor.`,
      });
    }
  }

  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1]!;
    const cur = ordered[i]!;
    if (prev.php == null || cur.php == null) continue;

    if (cur.php <= prev.php) {
      out.push({
        kind: 'total_not_rising',
        message:
          `${cur.shots.toLocaleString('en-PH')} shots costs ₱${cur.php.toLocaleString('en-PH')}, ` +
          `which is not more than ${prev.shots.toLocaleString('en-PH')} shots at ₱${prev.php.toLocaleString('en-PH')}.`,
      });
    }

    const prevRate = prev.ratePerCredit;
    const curRate = cur.ratePerCredit;
    // 1e-9 absorbs float noise only — it is far below a centavo per credit.
    if (prevRate != null && curRate != null && curRate > prevRate + 1e-9) {
      out.push({
        kind: 'rate_rising',
        message:
          `${cur.shots.toLocaleString('en-PH')} shots costs ₱${curRate.toFixed(3)} a shot, ` +
          `dearer than ${prev.shots.toLocaleString('en-PH')} at ₱${prevRate.toFixed(3)} — ` +
          `nobody would buy it.`,
      });
    }
  }
  return out;
}

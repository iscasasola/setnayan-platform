/**
 * vendor-free-transport.ts — the PURE server-side enforcement of the vendor's
 * own inner-ring free-travel promise.
 *
 * Spec: `Explore_Replan_BUILD_SPEC_2026-07-27.md` §17 · DECISION_LOG 2026-07-27.
 * Completes PR #3816, which shipped the two rings, the vendor's settings UI and
 * the couple's three-state badge — the promise — but left it a PROMISE ONLY.
 *
 * ── WHAT THIS FILE IS FOR, IN ONE SENTENCE ──────────────────────────────────
 * PR #3816 lets a vendor tell couples "no travel fee within 15 km of our HQ",
 * and renders that as a badge on the couple's bench; this file is what stops the
 * same vendor from then sending that couple a quote with ₱15,000 of
 * "Transportation" on it.
 *
 * ── WHY IT HAS TO BE THE SERVER ─────────────────────────────────────────────
 * The Proposal Maker composes its line items IN THE BROWSER and POSTs them as
 * JSON. Anything the client does about the transportation field — hiding it,
 * disabling it, zeroing it — is a UX affordance, not an enforcement boundary. A
 * crafted request reaches `sendCustomProposalCore` with whatever line items its
 * author wants. So the rewrite lives at that one server chokepoint, and this
 * module is the pure half of it (see `vendor-free-transport.server.ts` for the
 * DB half and `lib/proposal-send.ts` for the call site).
 *
 * ── THE INVARIANT THIS FILE EXISTS TO HOLD ──────────────────────────────────
 *   THE BADGE THE COUPLE SEES AND THE RULE THE VENDOR IS HELD TO
 *   MUST READ THE SAME NUMBER.
 *
 * Both go through `resolveDeclaredRings` + `resolveTravelFeeVerdict` in
 * `lib/vendor-service-radius.ts` — the CLAMPED rings, never the raw declared
 * columns. That matters because the clamp is what shrinks a vendor's rings when
 * their subscription lapses: someone who declared 30 km of free travel on Pro
 * and dropped to Verified (cap 20) shows couples a 20 km free ring. Enforcing on
 * the raw 30 would force free travel they no longer advertise — the platform
 * confiscating a fee on the strength of a promise it stopped showing. Enforcing
 * on the clamped 20 is simply the badge, made true.
 *
 * `vendor-free-transport.test.ts` pins the biconditional directly: badge says
 * "No travel fee" ⟺ the transportation line is zeroed, for the same vendor at
 * the same venue. If they ever disagree, that test goes red.
 *
 * Zero I/O, zero env, zero React — this is a money boundary, so it has to be
 * exercisable under `tsx --test` with plain numbers.
 */

import {
  resolveDeclaredRings,
  resolveTravelFeeVerdict,
  type TravelFeeVerdict,
} from '@/lib/vendor-service-radius';

/** The minimum shape of a composed proposal line (mirrors `ProposalLineItem`). */
export type TransportEnforceableLine = {
  label: string;
  detail?: string | null;
  amount_centavos: number | null;
};

/**
 * The decision, narrowed to what the send path is allowed to carry.
 *
 * ⚠ It carries NO distance and NO coordinates, on purpose — see invariant 3 in
 * `vendor-free-transport.server.ts`. `verdict` is inert to
 * `applyFreeTransportToQuote`, which reads only `transportLocked`; it is kept so
 * a caller can tell "we looked and it was a travel-fee venue" apart from "we
 * couldn't tell", which are very different things to log.
 */
export type FreeTransportDecision = {
  verdict: TravelFeeVerdict;
  /** TRUE only for a confidently-resolved `free_travel`. */
  transportLocked: boolean;
};

/**
 * Resolve whether this vendor owes this venue free travel, from the RAW stored
 * columns + tier + the already-computed distance.
 *
 * Identical composition to the couple's bench (`vendors/page.tsx` →
 * `resolveDeclaredRings`), so the answer here IS the badge's answer.
 *
 * Returns `transportLocked: false` for every uncertain case — undeclared rings,
 * unknown distance, no HQ pin, a free-tier vendor whose cap collapses the ring
 * to nothing. UNDECLARED MEANS NO ENFORCEMENT: we never invent a free ring for a
 * vendor who drew none, because the failure direction matters. Wrongly NOT
 * enforcing leaves today's fully-editable transportation line, which is exactly
 * the status quo; wrongly enforcing silently confiscates a fee the vendor
 * legitimately quoted, and neither party would ever see why.
 */
export function resolveFreeTransportDecision(input: {
  distanceKm: number | null | undefined;
  declaredInnerKm: number | null | undefined;
  declaredOuterKm: number | null | undefined;
  tier: string | null | undefined;
}): FreeTransportDecision {
  const verdict = resolveTravelFeeVerdict({
    distanceKm: input.distanceKm,
    ...resolveDeclaredRings(input),
  });
  return { verdict, transportLocked: verdict === 'free_travel' };
}

/** The label the Proposal Maker composer uses for the transportation line. */
const TRANSPORT_LABEL = 'transportation';

/** Free-travel detail copy, kept in one place so UI and server agree verbatim. */
export const FREE_TRANSPORT_DETAIL =
  'No travel fee — your venue is inside our free-travel range';

/**
 * Re-assert the free-travel promise over an itemization that arrived from a
 * client.
 *
 * Pure and total: given a locked ring it replaces every transportation line with
 * the ₱0 free-travel line (ADDING one if the client omitted it, so the couple
 * can see the promise was applied rather than inferring it from an absence);
 * given anything else it returns the input unchanged, so it is safe to call
 * unconditionally.
 *
 * Matching is on the trimmed, case-folded label, and DUPLICATES COLLAPSE — two
 * "Transportation" lines at ₱9,000 each must not survive as one free line plus
 * one charged one.
 *
 * ⚠ Prefer `applyFreeTransportToQuote`. This function alone rewrites lines
 * without re-summing the total; see the note there for why that is a defect and
 * not a caller's choice.
 */
export function enforceFreeTransport<T extends TransportEnforceableLine>(
  lines: readonly T[],
  ring: { transportLocked: boolean } | null | undefined,
): Array<T | TransportEnforceableLine> {
  if (!ring?.transportLocked) return [...lines];
  const isTransport = (l: T) => String(l.label ?? '').trim().toLowerCase() === TRANSPORT_LABEL;
  const free: TransportEnforceableLine = {
    label: 'Transportation',
    detail: FREE_TRANSPORT_DETAIL,
    amount_centavos: 0,
  };
  const out: Array<T | TransportEnforceableLine> = [];
  let replaced = false;
  for (const l of lines) {
    if (isTransport(l)) {
      if (!replaced) {
        out.push(free);
        replaced = true;
      }
      continue; // drop any additional transportation lines outright
    }
    out.push(l);
  }
  if (!replaced) out.push(free);
  return out;
}

/**
 * `enforceFreeTransport` + a RE-SUM, as one indivisible step.
 *
 * The re-sum is the half that is easy to forget and impossible to see: zeroing a
 * ₱15,000 transportation line without re-totalling persists `total_centavos =
 * 15000_00` against an itemization that adds up to ₱15,000 LESS. The couple then
 * accepts a quote whose lines and headline disagree — and the headline is the
 * number the booking-fee and payment-schedule maths read, so the couple pays the
 * travel fee anyway, just without a line item naming it. Keeping the rewrite and
 * the re-sum inside one pure function means a caller cannot do one without the
 * other.
 *
 * `ring == null` (always, while the flag is dark) → the lines pass through and
 * the total is the plain sum, i.e. exactly what `sanitizeCustomLineItems` already
 * produced. Negative lines (discounts, crew-meal offsets) still floor the total
 * at 0, matching `sanitizeCustomLineItems`.
 */
export function applyFreeTransportToQuote<T extends TransportEnforceableLine>(
  lines: readonly T[],
  ring: { transportLocked: boolean } | null | undefined,
): { lineItems: TransportEnforceableLine[]; totalCentavos: number } {
  const lineItems = enforceFreeTransport(lines, ring).map((li) => ({
    label: li.label,
    detail: li.detail ?? null,
    amount_centavos: li.amount_centavos,
  }));
  const totalCentavos = Math.max(
    0,
    lineItems.reduce((s, li) => s + (li.amount_centavos ?? 0), 0),
  );
  return { lineItems, totalCentavos };
}

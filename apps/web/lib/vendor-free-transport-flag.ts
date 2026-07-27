/**
 * vendor-free-transport-flag.ts — the flag that ARMS server-side enforcement of
 * the inner-ring free-travel promise (spec `Explore_Replan_BUILD_SPEC_2026-07-27.md`
 * §17 · migration `20271013561924` · PR #3816).
 *
 * OFF (the default) → byte-identical to today: `resolveThreadFreeTransport`
 * returns null BEFORE issuing a single query, `applyFreeTransportToQuote` passes
 * the vendor's line items through untouched, and the quote total is exactly the
 * one `sanitizeCustomLineItems` already produced. The couple-facing badge is
 * unaffected either way — it has always been live and is not gated here.
 *
 * ON → a quote sent for a venue inside the vendor's OWN declared inner ring has
 * its "Transportation" line rewritten to ₱0 and the total re-summed from the
 * enforced lines.
 *
 * ── WHY ITS OWN FLAG, NOT `NEXT_PUBLIC_EXPLORE_REPLAN_ENABLED` ──────────────
 * That flag gates layout and discovery surfaces. This one changes what a couple
 * is CHARGED. Sharing a switch would mean a UI rollout silently starts rewriting
 * money on the proposal path, and a money rollback would have to drag the whole
 * Explore/Replan surface back with it. Separate concerns get separate switches.
 *
 * NEXT_PUBLIC so a future client affordance (disabling the transportation field
 * in the Proposal Maker when the ring is locked) can read the SAME value the
 * server enforces on. Note what is deliberately NOT public: the flag says only
 * "enforcement is armed globally", never anything about a particular couple's
 * venue — see the trilateration invariant in `vendor-free-transport.server.ts`.
 *
 * Kept in its own module so the resolver stays env-free and runs under
 * `tsx --test`. Mirrors `vendor-addon-tiered-pricing-flag.ts`.
 */
export function isFreeTransportEnforcementEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_VENDOR_FREE_TRANSPORT_ENFORCED;
  return v === '1' || v === 'true';
}

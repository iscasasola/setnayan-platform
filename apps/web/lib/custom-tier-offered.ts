/**
 * custom-tier-offered.ts — is the Custom tier SHOWN to customers?
 *
 * ⚖ OWNER RULING 2026-08-27: *"hide customized first. let's stay with the 3
 * first."* Four paid tiers were on the public pricing pages; he wants three.
 * Custom comes off the **customer-facing** surfaces.
 *
 * 🔑 THIS IS A HIDE, NOT A RETIREMENT, AND HE CHOSE IT WITH THE CAVEAT IN FRONT
 * OF HIM. A supplier who already knows the way in — the link on their own
 * subscription page, or the configurator URL — can still reach it and buy one.
 * The route is deliberately NOT gated: a vendor's own dashboard is not the
 * public side. Record it as deliberate; it is not an oversight.
 *
 * ⛔ WHY THIS IS A FLAG AND NOT `is_active = false` ON THE SIX CATALOG ROWS.
 * Deactivating them would hide the public figure too — that reader has no peso
 * fallback — but `fetchCustomUnitPrices` would then fall through to
 * `CUSTOM_UNIT_PRICE_FALLBACK`, the HARDCODED prices, permanently. From that
 * moment the owner could edit Custom's price on the admin pricing screen and
 * **nothing would change for a vendor**, silently. That is the hidden-copy trap
 * this codebase spent 2026-08-27 closing everywhere else, and flipping those
 * flags would have manufactured a fresh one on purpose. All six rows stay
 * ACTIVE and authoritative; only the render sites go.
 *
 * ⚠ SOMEBODY WILL TRY TO "SIMPLIFY" THIS LATER BY FLIPPING is_active. Don't.
 *
 * ── TO REVERSE IT ──────────────────────────────────────────────────────────
 * Set this to `true`. That is the whole undo — the four public render sites and
 * the homepage benefit count all read it, so Custom reappears everywhere at
 * once, priced from the live catalog exactly as before. Nothing was deleted.
 */
export const CUSTOM_TIER_OFFERED_PUBLICLY = false;

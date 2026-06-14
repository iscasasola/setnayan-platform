/**
 * Setnayan AI — the single governing gate for the whole app.
 *
 * `isSetnayanAiActive(event)` is the ONE place the app asks "is Setnayan AI on
 * for this event?" Every personalization / matchmaking surface gates on it:
 * vendor ranking + the "% match" pill, the reception-proximity sort, recommended
 * + statutory deadlines, the "👀 eyeing your date" nudge, best-match auto-inquiry.
 *
 * When it returns FALSE the experience is the GENERIC search — region-scoped
 * browse, no proximity ranking, no scores, no nudges. The free floor stays on
 * regardless (region filter + anti-double-book availability).
 *
 * Two sources, selected by the `SETNAYAN_AI_PAYWALL_ENABLED` flag (owner
 * 2026-06-08, "govern now free, monetize next" — build behind a flag):
 *   • Paywall OFF (default) — the free Assisted↔Manual toggle (`planning_mode`).
 *     Nothing about the live experience changes.
 *   • Paywall ON — AI also requires a PURCHASED per-event entitlement
 *     (`events.setnayan_ai_active`, stamped when a paid SETNAYAN_AI order is
 *     confirmed). Flip deliberately, coordinated with /pricing + homepage copy.
 *
 * Swapping the source is this one file — every call site is untouched.
 */

/** `events.planning_mode` value that means the couple manually turned AI OFF. */
export const PLANNING_MODE_MANUAL = 'manual';

/**
 * Is the per-event PAID paywall enforced? Default OFF. When off, Setnayan AI is
 * the free Assisted↔Manual toggle (PR-1 behavior, unchanged). When on, AI also
 * requires a purchased entitlement. Env-driven so the flip is a config change,
 * not a deploy.
 */
export function isSetnayanAiPaywallEnabled(): boolean {
  return process.env.SETNAYAN_AI_PAYWALL_ENABLED === 'true';
}

/**
 * The governing gate. `true` = Setnayan AI active (full intelligence);
 * `false` = generic region-scoped search.
 *
 * - Paywall OFF (default): active unless the couple toggled to Manual.
 * - Paywall ON: active only when the event has PURCHASED Setnayan AI
 *   (`setnayan_ai_active`) AND hasn't toggled to Manual.
 */
export function isSetnayanAiActive(
  event:
    | { planning_mode?: string | null; setnayan_ai_active?: boolean | null }
    | null
    | undefined,
): boolean {
  const notManuallyOff = event?.planning_mode !== PLANNING_MODE_MANUAL;
  if (!isSetnayanAiPaywallEnabled()) return notManuallyOff;
  return notManuallyOff && event?.setnayan_ai_active === true;
}

/**
 * Should this event be offered the PAID "Unlock Setnayan AI" purchase?
 *
 * True only when the paywall is enforced AND the event has not purchased the
 * entitlement (`setnayan_ai_active`). Deliberately keyed on the entitlement
 * boolean, NOT `isSetnayanAiActive` — a couple who bought it but toggled to
 * Manual still OWNS it and must never see the buy CTA again (double-charge
 * guard). When the paywall is OFF this is always false (AI is free → nothing to
 * sell). Drives the `/add-ons/setnayan-ai` buy surface + the soft-paywall CTA on
 * the match surface; both stay dormant until `SETNAYAN_AI_PAYWALL_ENABLED=true`.
 */
export function shouldOfferSetnayanAiPurchase(
  event: { setnayan_ai_active?: boolean | null } | null | undefined,
): boolean {
  return isSetnayanAiPaywallEnabled() && event?.setnayan_ai_active !== true;
}

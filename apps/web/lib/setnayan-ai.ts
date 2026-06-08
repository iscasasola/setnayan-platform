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
 * V1 source = the free Assisted↔Manual toggle (`events.planning_mode`). The
 * locked design (owner 2026-06-08) is a PAID, per-event entitlement — a later PR
 * swaps the BODY of this function to read that entitlement without touching any
 * call site. Centralizing the gate here is what makes that a one-file change.
 *
 * Owner-locked 2026-06-08: "govern now (free), monetize next."
 */

/** `events.planning_mode` value that means Setnayan AI is OFF (Manual mode). */
export const PLANNING_MODE_MANUAL = 'manual';

/**
 * The governing gate. `true` = Setnayan AI active (full intelligence);
 * `false` = generic region-scoped search. Defaults ON for any non-'manual'
 * value (including `null`/unknown) — Assisted is the default.
 */
export function isSetnayanAiActive(
  event: { planning_mode?: string | null } | null | undefined,
): boolean {
  return event?.planning_mode !== PLANNING_MODE_MANUAL;
}

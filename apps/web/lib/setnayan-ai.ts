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
 * Two sources, selected by the Setnayan-AI paywall flag (owner 2026-06-08,
 * "govern now free, monetize next" — build behind a flag):
 *   • Paywall OFF (default) — the free Assisted↔Manual toggle (`planning_mode`).
 *     Nothing about the live experience changes.
 *   • Paywall ON — AI also requires a PURCHASED per-event entitlement
 *     (`events.setnayan_ai_active`, stamped when a paid SETNAYAN_AI order is
 *     confirmed). Flip deliberately, coordinated with /pricing + homepage copy.
 *
 * The flag itself is now DB-first / env-fallback (Integration Activation Console
 * — owner flips it from /admin/integrations, no redeploy). To keep this leaf
 * SYNCHRONOUS, the gate functions take the resolved paywall boolean as an
 * OPTIONAL argument: server callers `await resolveSetnayanAiPaywallEnabled()`
 * (lib/integration-config.ts) once and thread it in; when omitted it defaults to
 * the env-only read (`isSetnayanAiPaywallEnabled()`), byte-identical to before.
 */

/** `events.planning_mode` value that means the couple manually turned AI OFF. */
export const PLANNING_MODE_MANUAL = 'manual';

/**
 * Is the per-event PAID paywall enforced? Default OFF. When off, Setnayan AI is
 * the free Assisted↔Manual toggle (PR-1 behavior, unchanged). When on, AI also
 * requires a purchased entitlement.
 *
 * ⚠ ENV-ONLY read — the synchronous fallback used as the default for the gate
 * functions below. The DB-aware source of truth is the async
 * `resolveSetnayanAiPaywallEnabled()` in lib/integration-config.ts (the
 * Integration Activation Console toggle); server code should prefer it and pass
 * the result into the gates. This stays for the no-arg call sites (e.g. the
 * synthetic tour) and so the leaf predicates can default without going async.
 */
export function isSetnayanAiPaywallEnabled(): boolean {
  return process.env.SETNAYAN_AI_PAYWALL_ENABLED === 'true';
}

/**
 * Free MATCH-PREVIEW floor (Gap 2 · Eventchy-parity, owner 2026-07-11).
 *
 * The basic "% match" pill + compat ranking + reception-proximity sort are
 * TABLE-STAKES against the free-AI rival — they must stay on for EVERY couple,
 * even after the paywall flips ON and the deeper intelligence (whole-plan fit,
 * auto-build, the nudge/eyeing stream, deadlines) goes behind the entitlement.
 *
 * So this floor is deliberately keyed ONLY on the couple's own Assisted↔Manual
 * toggle (`planning_mode`), NEVER on the paywall or the purchased entitlement:
 *   • Not Manual → the match signal shows (free), regardless of paywall/purchase.
 *   • Manual     → the couple chose "I'm driving"; the signal hides (unchanged).
 *
 * Behavior-preservation: while the paywall is OFF, `isSetnayanAiActive` already
 * equals `planning_mode !== 'manual'`, so this predicate is byte-identical to the
 * gate it replaces on the match surfaces. Only when the paywall flips ON do they
 * diverge — and the divergence is the fix: the match preview survives.
 */
export function isMatchPreviewFree(
  event: { planning_mode?: string | null } | null | undefined,
): boolean {
  return event?.planning_mode !== PLANNING_MODE_MANUAL;
}

/**
 * The governing gate. `true` = Setnayan AI active (full intelligence);
 * `false` = generic region-scoped search.
 *
 * - Paywall OFF (default): active unless the couple toggled to Manual.
 * - Paywall ON: active only when the event has PURCHASED Setnayan AI
 *   (`setnayan_ai_active`) AND hasn't toggled to Manual.
 *
 * `paywallEnabled` defaults to the env-only read; server callers that honor the
 * DB toggle pass `await resolveSetnayanAiPaywallEnabled()`.
 */
export function isSetnayanAiActive(
  event:
    | { planning_mode?: string | null; setnayan_ai_active?: boolean | null }
    | null
    | undefined,
  paywallEnabled: boolean = isSetnayanAiPaywallEnabled(),
): boolean {
  const notManuallyOff = event?.planning_mode !== PLANNING_MODE_MANUAL;
  if (!paywallEnabled) return notManuallyOff;
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
 * sell). Drives the `/studio/setnayan-ai` buy surface + the soft-paywall CTA on
 * the match surface; both stay dormant while the paywall is off.
 *
 * `paywallEnabled` defaults to the env-only read; server callers that honor the
 * DB toggle pass `await resolveSetnayanAiPaywallEnabled()`.
 */
export function shouldOfferSetnayanAiPurchase(
  event: { setnayan_ai_active?: boolean | null } | null | undefined,
  paywallEnabled: boolean = isSetnayanAiPaywallEnabled(),
): boolean {
  return paywallEnabled && event?.setnayan_ai_active !== true;
}

// ============================================================================
// PER-USER subscription (foundation, INERT until setnayan_ai_per_user_enabled).
//
// The brainstorm 2026-06-29 reframed Setnayan AI to a per-USER subscription that
// covers ALL of a user's events at once. The entitlement is a single window
// (`user_ai_subscription.active_until`); while it's in the future, AI is on for
// every event the user hosts/co-hosts — the "fan-out", computed here read-side
// (no DB trigger). A NEW tri-state flag `platform_settings.setnayan_ai_per_user_
// enabled` gates it; default OFF → these helpers are inert and the per-event
// gate above is byte-identical to today. Term-pass SKUs + the trigger engine +
// consent-gated activation land in later PRs.
// ============================================================================

/** A read of the user's subscription window (NULL/absent = no subscription). */
export type UserAiSubscription = {
  active_until?: string | Date | null;
} | null | undefined;

/**
 * Is the user's subscription window currently active? `active_until` in the
 * future = on. Lazily evaluated (no cron) — the read itself is the expiry check.
 */
export function userAiSubscriptionActive(
  sub: UserAiSubscription,
  now: Date = new Date(),
): boolean {
  if (!sub?.active_until) return false;
  const until =
    sub.active_until instanceof Date ? sub.active_until : new Date(sub.active_until);
  if (Number.isNaN(until.getTime())) return false;
  return until.getTime() > now.getTime();
}

/**
 * Per-EVENT window-aware entitlement (owner 2026-07-02). Under per-event
 * pricing an event owns Setnayan AI only while its 28-day window
 * (`setnayan_ai_active_until`) is unexpired; a NULL window is a grandfathered
 * PERMANENT unlock (pre-per-event buyers, whose access never lapses). Lazily
 * evaluated (no cron): the read IS the expiry check, mirroring
 * `userAiSubscriptionActive`.
 *
 * ⚠ BUG FIX 2026-07-09 (verified 2026-07-08, corpus DECISION_LOG): the window
 * check used to be gated on `opts.perEventPricingEnabled` — but NO read gate in
 * the app threads that flag in (they resolve paywall/per-user only), so the
 * early-return meant a lapsed ₱799 window would NEVER lock even after the owner
 * flips `setnayan_ai_per_event_pricing_enabled` on. The window is now
 * AUTHORITATIVE whenever it is present: `setnayan_ai_active_until` is only ever
 * written by the per-event-pricing buy flow (which itself only runs behind the
 * flag), so a non-NULL window always means "sold under the windowed model" and
 * must be honored by every reader, threaded flag or not. Rows without a window
 * (all pre-per-event buyers — every prod row while the flag has been off)
 * behave byte-identically to the old `setnayan_ai_active === true` check.
 *
 * `opts.perEventPricingEnabled` is retained for signature compatibility but no
 * longer changes the result — the stored window decides.
 */
export function eventOwnsSetnayanAi(
  event:
    | { setnayan_ai_active?: boolean | null; setnayan_ai_active_until?: string | Date | null }
    | null
    | undefined,
  opts: { perEventPricingEnabled?: boolean; now?: Date } = {},
): boolean {
  if (event?.setnayan_ai_active !== true) return false;
  const until = event?.setnayan_ai_active_until;
  if (!until) return true; // no window → permanent unlock (incl. all pre-per-event buyers)
  const d = until instanceof Date ? until : new Date(until);
  if (Number.isNaN(d.getTime())) return true; // unparseable → don't lock the couple out
  return d.getTime() > (opts.now ?? new Date()).getTime();
}

/**
 * The per-USER-aware governing gate. Mirrors `isSetnayanAiActive` and falls back
 * to it exactly when the per-user flag is off.
 *
 * - `perUserEnabled` OFF (default): byte-identical to `isSetnayanAiActive(event,
 *   paywallEnabled)` — the per-event behavior, unchanged.
 * - `perUserEnabled` ON: AI is active when the couple hasn't toggled Manual AND
 *   the event is entitled by EITHER the per-event flag (`setnayan_ai_active`) OR
 *   the user's active subscription window (the fan-out). Covering an event by
 *   either co-host's subscription is the never-double-charge guarantee.
 */
export function isSetnayanAiActiveForUser(
  event:
    | {
        planning_mode?: string | null;
        setnayan_ai_active?: boolean | null;
        setnayan_ai_active_until?: string | Date | null;
      }
    | null
    | undefined,
  opts: {
    paywallEnabled?: boolean;
    perUserEnabled?: boolean;
    /** Per-EVENT ₱499/₱799 window enforcement (owner 2026-07-02). Default OFF. */
    perEventPricingEnabled?: boolean;
    subscription?: UserAiSubscription;
    now?: Date;
  } = {},
): boolean {
  const {
    paywallEnabled = isSetnayanAiPaywallEnabled(),
    perUserEnabled = false,
    perEventPricingEnabled = false,
    subscription = null,
    now,
  } = opts;

  const notManuallyOff = event?.planning_mode !== PLANNING_MODE_MANUAL;
  // Per-event ownership is window-aware whenever a window is stored (2026-07-09
  // fix — see eventOwnsSetnayanAi). For rows without a window this is exactly
  // `setnayan_ai_active === true`, so both branches below stay byte-identical
  // to before for every event sold outside the windowed model.
  const ownsPerEvent = eventOwnsSetnayanAi(event, { perEventPricingEnabled, now });

  if (!perUserEnabled) {
    if (!paywallEnabled) return notManuallyOff;
    return notManuallyOff && ownsPerEvent;
  }

  const entitled = ownsPerEvent || userAiSubscriptionActive(subscription, now);
  return notManuallyOff && entitled;
}

/**
 * Per-USER-aware sibling of `shouldOfferSetnayanAiPurchase`. Decides whether to
 * show the PAID "Unlock Setnayan AI" CTA, accounting for the per-user fan-out.
 *
 * - `perUserEnabled` OFF (default): byte-identical to
 *   `shouldOfferSetnayanAiPurchase(event, paywallEnabled)` — the per-event CTA,
 *   unchanged.
 * - `perUserEnabled` ON: offer only when the paywall is enforced AND the event
 *   hasn't bought the per-event entitlement AND no host has an active
 *   subscription window. A subscriber must never be re-offered a per-event
 *   purchase (the never-double-charge guarantee), mirroring how the per-event
 *   form excludes an event that already owns `setnayan_ai_active`.
 */
export function shouldOfferSetnayanAiPurchaseForUser(
  event:
    | { setnayan_ai_active?: boolean | null; setnayan_ai_active_until?: string | Date | null }
    | null
    | undefined,
  opts: {
    paywallEnabled?: boolean;
    perUserEnabled?: boolean;
    /** Per-EVENT ₱499/₱799 window enforcement (owner 2026-07-02). Default OFF. */
    perEventPricingEnabled?: boolean;
    subscription?: UserAiSubscription;
    now?: Date;
  } = {},
): boolean {
  const {
    paywallEnabled = isSetnayanAiPaywallEnabled(),
    perUserEnabled = false,
    perEventPricingEnabled = false,
    subscription = null,
    now,
  } = opts;

  // Re-offer once the per-event window lapses (owner 2026-07-02): the event no
  // longer OWNS AI, so the ₱799 renewal CTA returns. Window-authoritative since
  // the 2026-07-09 fix (see eventOwnsSetnayanAi) — byte-identical to the old
  // `setnayan_ai_active !== true` check for every event without a stored window.
  const ownsPerEvent = eventOwnsSetnayanAi(event, { perEventPricingEnabled, now });

  if (!perUserEnabled) {
    if (!paywallEnabled) return false;
    return !ownsPerEvent;
  }

  return paywallEnabled && !ownsPerEvent && !userAiSubscriptionActive(subscription, now);
}

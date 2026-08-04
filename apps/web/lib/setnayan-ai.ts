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
// 🔒 SETNAYAN AI IS PER EVENT. There is no per-USER entitlement.
//
// OWNER DECISION 2026-08-01, asked whether one purchase should ever unlock a
// person's other events: **"it is per event"**.
//
// A per-USER subscription foundation used to live here — a single window
// (`user_ai_subscription.active_until`) that fanned AI out to every event a
// user hosted, gated by the tri-state flag
// `platform_settings.setnayan_ai_per_user_enabled`. It was fully built and
// permanently inert (the flag was never TRUE; the table never held a row). It
// has been REMOVED — table, column, flag resolver, helpers, reads and writers —
// so that "per event" is no longer a setting somebody could flip, but the only
// thing this module can express.
//
// ⚠ Do NOT reintroduce a user-scoped window here. If cross-event access is ever
// wanted again it is a new product decision, not a restoration.
// ============================================================================

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
 * The WINDOW-AWARE governing gate — the one every surface should call.
 *
 * Differs from `isSetnayanAiActive` only in that per-event ownership is resolved
 * through `eventOwnsSetnayanAi`, so a lapsed `setnayan_ai_active_until` window
 * correctly turns AI off. For rows without a stored window (every prod row) the
 * two are identical.
 *
 * - Paywall OFF (default): active unless the couple toggled to Manual.
 * - Paywall ON: active only when the EVENT owns Setnayan AI and hasn't toggled
 *   to Manual.
 *
 * Renamed from `isSetnayanAiActiveForUser` on 2026-08-01: with the per-user
 * fan-out retired there is no user dimension left, and a name that says
 * otherwise invites someone to add one back.
 */
export function isSetnayanAiActiveForEvent(
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
    /** Per-EVENT ₱499/₱799 window enforcement (owner 2026-07-02). Default OFF. */
    perEventPricingEnabled?: boolean;
    now?: Date;
  } = {},
): boolean {
  const {
    paywallEnabled = isSetnayanAiPaywallEnabled(),
    perEventPricingEnabled = false,
    now,
  } = opts;

  const notManuallyOff = event?.planning_mode !== PLANNING_MODE_MANUAL;
  // Per-event ownership is window-aware whenever a window is stored (2026-07-09
  // fix — see eventOwnsSetnayanAi). For rows without a window this is exactly
  // `setnayan_ai_active === true`.
  const ownsPerEvent = eventOwnsSetnayanAi(event, { perEventPricingEnabled, now });

  if (!paywallEnabled) return notManuallyOff;
  return notManuallyOff && ownsPerEvent;
}

/**
 * Window-aware sibling of `shouldOfferSetnayanAiPurchase`. Decides whether to
 * show the PAID "Unlock Setnayan AI" CTA for THIS EVENT.
 *
 * Offer only when the paywall is enforced AND the event does not currently own
 * the entitlement. Nothing about any OTHER event the host owns can suppress or
 * trigger this — Setnayan AI is per event (owner 2026-08-01).
 *
 * Renamed from `shouldOfferSetnayanAiPurchaseForUser` on 2026-08-01 for the same
 * reason as the gate above.
 */
export function shouldOfferSetnayanAiPurchaseForEvent(
  event:
    | { setnayan_ai_active?: boolean | null; setnayan_ai_active_until?: string | Date | null }
    | null
    | undefined,
  opts: {
    paywallEnabled?: boolean;
    /** Per-EVENT ₱499/₱799 window enforcement (owner 2026-07-02). Default OFF. */
    perEventPricingEnabled?: boolean;
    now?: Date;
  } = {},
): boolean {
  const {
    paywallEnabled = isSetnayanAiPaywallEnabled(),
    perEventPricingEnabled = false,
    now,
  } = opts;

  // Re-offer once the per-event window lapses (owner 2026-07-02): the event no
  // longer OWNS AI, so the renewal CTA returns. Window-authoritative since the
  // 2026-07-09 fix (see eventOwnsSetnayanAi).
  const ownsPerEvent = eventOwnsSetnayanAi(event, { perEventPricingEnabled, now });

  if (!paywallEnabled) return false;
  return !ownsPerEvent;
}

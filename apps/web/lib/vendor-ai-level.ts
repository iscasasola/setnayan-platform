import type { VendorAddonSku } from './vendor-addon-tier-pricing';

/**
 * vendor-ai-level.ts — the Vendor AI ladder LEVEL (owner-locked 2026-07-25).
 *
 * The AI Chatbot is sold at two levels sharing ONE entitlement window
 * (`vendor_profiles.ai_addon_expires_at`). Which level that window currently
 * grants lives in the server-written marker `vendor_profiles.ai_addon_level`
 * (migration `20271003111715`).
 *
 * THE CAPABILITY LINE is not defined here — it is owner-locked in the corpus at
 * `Vendor_Front_Desk_Chatbot_Build_Plan_2026-07-18.md` § 8 and mirrored in the
 * shipped auto-reply schema (`20270822679405`):
 *   BASIC    — deterministic front desk (price / availability / inclusions /
 *              coverage / discount / reviews), neutral house-voice templates,
 *              customization → handoff, ~30/day cap, reply log.
 *   ADVANCED — `vendor_bot_config.mode='smart'`: voice-match (`voice_profile`),
 *              natural phrasing (`vendor_reply_templates` — PRECOMPUTED per
 *              voice/catalog edit, so per-reply cost stays ₱0 and the locked
 *              "Setnayan AI is deterministic and free" rule holds), reply in the
 *              couple's language, lead analytics, higher/uncapped daily cap.
 *
 * ── WHY A SEPARATE MARKER AND NOT `vendor_bot_config.mode` ──────────────────
 * `mode` is VENDOR-WRITABLE under policy `vendor_bot_config_write`. It is a
 * PREFERENCE ("I want smart replies"), never an entitlement. Trusting it would
 * let any vendor switch themselves to Advanced for free. `mode` must be GATED BY
 * this level; the level itself is written only by the service-role client and is
 * blocked for vendor self-writes by `trg_guard_vendor_profiles_entitlement`.
 *
 * ── WHY ONE WINDOW AND NOT TWO ─────────────────────────────────────────────
 * `lib/sku-activation.ts` hardcodes the union
 * `expiryColumn: 'ai_addon_expires_at' | 'booth_addon_expires_at'`, so a
 * per-variant expiry column would not typecheck. Both levels stack into the same
 * window; buying Advanced PROMOTES the level rather than opening a second one.
 *
 * PURE: no I/O, no clock, no env — the flag lives in `vendor-ai-ladder-flag.ts`.
 */

/** The two rungs. Ordered least → most privileged. */
export const VENDOR_AI_LEVELS = ['basic', 'advanced'] as const;
export type VendorAiLevel = (typeof VENDOR_AI_LEVELS)[number];

/** The catalog `sku_code` for each rung. Basic keeps the ORIGINAL flat code so
 *  every historical order and the frozen `EXACT_HOOKS` key stay valid — nothing
 *  is renamed, ever. Advanced is additive and MUST keep the `vendor_` prefix
 *  (`lib/orders.ts` `isVatInclusiveServiceKey` keys off it; without it the admin
 *  payment shortfall guard strands the order). */
export const VENDOR_AI_ADVANCED_SKU_CODE = 'vendor_ai_addon_advanced';

/** The tier-band pricing key for each rung (`vendor-addon-tier-pricing.ts`). */
export const VENDOR_AI_LEVEL_PRICING_SKU: Record<VendorAiLevel, VendorAddonSku> = {
  basic: 'ai_chatbot_basic', // ₱2,000 entry · ₱1,500 growth
  advanced: 'ai_chatbot_advanced', // ₱3,000 entry · ₱2,500 growth
};

/**
 * Coerce a stored `ai_addon_level` to a known rung. PURE.
 *
 * Defaults to `'basic'` — LEAST PRIVILEGE, and the same default the column
 * carries. Reading code must default here too, not only in SQL: a row fetched
 * before the migration reached a given environment, an older cached payload, or
 * a `select` that omits the column all yield `undefined`, and every one of those
 * must mean "Basic", never "Advanced".
 */
export function coerceVendorAiLevel(raw: string | null | undefined): VendorAiLevel {
  return raw === 'advanced' ? 'advanced' : 'basic';
}

/** Does `level` include Advanced capabilities? PURE. */
export function isVendorAiAdvanced(raw: string | null | undefined): boolean {
  return coerceVendorAiLevel(raw) === 'advanced';
}

export type VendorAiEntitlement = {
  /** `vendor_profiles.ai_addon_level`, as stored. */
  level: string | null | undefined;
  /** `isVendorAiAddonActive(ai_addon_expires_at)` — the ONE shared window. */
  windowActive: boolean;
};

/**
 * THE gate for an ADVANCED capability: the shared window must be LIVE **and**
 * the level must be Advanced. PURE.
 *
 * Both halves are required, and neither is negotiable. A lapsed window means the
 * vendor is paying for nothing, whatever their level marker still says — the
 * level is not cleared on lapse (lapse is automatic at read time, there is no
 * cron), so checking the level alone would grant Advanced forever after a single
 * paid cycle.
 */
export function vendorAiAdvancedActive(e: VendorAiEntitlement): boolean {
  return e.windowActive && isVendorAiAdvanced(e.level);
}

/**
 * THE gate for a BASIC capability: any live window grants it, at either level —
 * Advanced is a superset, never a swap. PURE. Keeps "upgrading must not remove a
 * feature" true by construction.
 */
export function vendorAiBasicActive(e: VendorAiEntitlement): boolean {
  return e.windowActive;
}

/**
 * The level a paid order's `service_key` grants. PURE.
 *
 * Anything that is not explicitly the Advanced SKU resolves to `'basic'`, so an
 * unknown or tampered key can never promote. Used by the activation hook to
 * stamp the marker.
 */
export function vendorAiLevelForServiceKey(serviceKey: string | null | undefined): VendorAiLevel {
  return serviceKey === VENDOR_AI_ADVANCED_SKU_CODE ? 'advanced' : 'basic';
}

/**
 * The level to STORE when a vendor on `current` buys `purchased`. PURE.
 *
 * Takes the HIGHER rung, because both levels share one window: buying Advanced
 * mid-cycle must promote, and buying Basic while already Advanced must NOT
 * silently demote a vendor who has paid more (their remaining Advanced time is
 * theirs). A demotion is therefore only ever the lapse of the window itself, or
 * an explicit admin/refund action.
 */
export function nextVendorAiLevel(
  current: string | null | undefined,
  purchased: VendorAiLevel,
): VendorAiLevel {
  return isVendorAiAdvanced(current) || purchased === 'advanced' ? 'advanced' : 'basic';
}

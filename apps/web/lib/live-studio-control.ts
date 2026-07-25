/**
 * apps/web/lib/live-studio-control.ts
 *
 * Pure helpers for the UNIFIED **Live Studio control** surface (owner 2026-07-25;
 * Live_Studio_Unified_Spec_2026-07-25.md + the refined "one shared single-screen
 * controller" design). This is the ONE controller opened by BOTH the free
 * single-camera livestreamer AND the paid multi-camera (LIVE_STUDIO) host:
 *
 *   • The free single-camera livestream is ALWAYS available (never gated).
 *   • The multi-camera extras — camera strip, add-camera-via-QR, cut-to-Main-Stage,
 *     guest-pick — are ALWAYS VISIBLE on the controller but LOCKED for a host who
 *     has not purchased LIVE_STUDIO, shown greyed/disabled with an inline
 *     "Unlock · <price>" call-to-action that routes to the LIVE_STUDIO buy.
 *     Purchasing unlocks them in place.
 *
 * The customer-facing ROUTE is `live-studio-control` (renamed from the internal
 * `live-studio-roam` substrate — the data key / SKU wiring is unchanged; only the
 * URL moved, with a redirect from the old path so nothing 404s). These helpers are
 * PURE (no I/O) so the controller, its server actions, and the unit tests share one
 * source of truth for the route paths and the lock decision.
 */

/** Unified customer-facing SKU that unlocks the multi-camera controller. */
export const LIVE_STUDIO_SKU = 'LIVE_STUDIO';

/**
 * Internal catalog/data key for the Live Studio tile. UNCHANGED by the route
 * rename — reviews/stats/state (add-on-stats.ts, add-ons-detail.ts,
 * studio-recommendations.ts) all key off this string, so it stays stable exactly
 * the way "Live Studio Cast" keeps the internal `panood` name. Only the URL moved.
 */
export const LIVE_STUDIO_FEATURE_KEY = 'live-studio-roam';

/** New customer-facing route segment (was `live-studio-roam`). */
export const LIVE_STUDIO_CONTROL_SEGMENT = 'live-studio-control';
/** Old route segment kept only for the redirect that prevents 404s on old links. */
export const LIVE_STUDIO_LEGACY_SEGMENT = 'live-studio-roam';

/** The Live Studio detail/buy surface (the App Store page that mounts the buy drawer). */
export function liveStudioDetailPath(eventId: string): string {
  return `/dashboard/${eventId}/studio/${LIVE_STUDIO_CONTROL_SEGMENT}`;
}

/** The unified controller (the single-screen operating surface). */
export function liveStudioControlPath(eventId: string): string {
  return `/dashboard/${eventId}/studio/${LIVE_STUDIO_CONTROL_SEGMENT}/setup`;
}

/**
 * The multi-camera lock decision for the controller. `owned` is the resolved
 * LIVE_STUDIO entitlement (eventSkuActive). `priceLabel` is the live catalog
 * price string (formatV2Sku → formatPhp), or null on a catalog miss.
 *
 *   • multiCamUnlocked — render the camera strip / cut / guest-pick as LIVE
 *     controls when true; greyed/disabled with the unlock CTA when false.
 *   • unlockCtaLabel   — the inline CTA text ("Unlock · ₱2,999"); falls back to a
 *     bare "Unlock" when the catalog price is unavailable (never a hardcoded
 *     number — the owner rule is prices come from the admin catalog).
 */
export type ControlLockState = {
  multiCamUnlocked: boolean;
  unlockCtaLabel: string;
};

export function liveStudioControlLock(
  owned: boolean,
  priceLabel: string | null,
): ControlLockState {
  return {
    multiCamUnlocked: owned,
    unlockCtaLabel: priceLabel ? `Unlock · ${priceLabel}` : 'Unlock',
  };
}

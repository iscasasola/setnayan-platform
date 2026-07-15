/**
 * Feature flags for the COUNSEL-GATED On-the-Day modules.
 *
 * The vendor Papic capture tier and the per-guest delivery tracker both collect
 * guest PI through a vendor (a third-party controller). The owner overrode the
 * council's cut (2026-07-16) and owns that exposure, but the standing counsel
 * item stands: the DPO/NPC consent-chain ruling GOVERNS GO-LIVE. Their surfaces
 * ship dark behind these flags (default OFF) and their migrations are marked
 * `_COUNSEL_GATED` — do not `supabase db push` them until counsel signs off.
 *
 * Until a flag flips, the module renders a locked "Needs setup" state in the
 * configurator (see lib/vendor-dayof-modules.ts `counselGated`) and never
 * activates a capture/delivery surface.
 */

/** Vendor free Papic capture (10 photos / 3 clips + Ltd/Unli upsell). */
export function isVendorPapicCaptureEnabled(): boolean {
  return process.env.VENDOR_PAPIC_CAPTURE_ENABLED === '1';
}

/** Per-guest vendor delivery tracker ("who hasn't received theirs"). */
export function isVendorGuestDeliveryEnabled(): boolean {
  return process.env.VENDOR_GUEST_DELIVERY_ENABLED === '1';
}

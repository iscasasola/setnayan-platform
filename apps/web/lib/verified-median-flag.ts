/**
 * Verified-Median Pricing feature flag.
 *
 * The "verified median" turns a vendor's DECLARED prices from their LOCKED
 * bookings (couple-confirmed `event_vendors` rows keyed to the marketplace
 * vendor via `linked_vendor_profile_id`, status ≥ 'contracted') into a single
 * median that becomes their verified market price — shown to the vendor on
 * their own dashboard and, as a "typical price" signal, on their public page.
 *
 * ACTIVATION — public flag `NEXT_PUBLIC_VERIFIED_MEDIAN_ENABLED`, default OFF.
 * This is a LAUNCH flag (opt-in), not a kill-switch: only the exact string
 * 'true' turns it on. While OFF there is NO couple- or vendor-facing change —
 * neither the vendor dashboard card nor the public "typical price" card renders,
 * and no median is computed on any request path. Ship dark; flip to 'true' only
 * once the positioning bet is owner-approved (see the changelog fragment's
 * SPEC IMPACT note).
 *
 * NEXT_PUBLIC_ so the vendor-dashboard server surface and the public vendor
 * page (both server components) agree on one value with any future client
 * reader.
 *
 * Pure + secret-free on purpose (mirrors seating-3d-flag.ts): unit-testable
 * under `tsx --test`, callable from server or client.
 */
import { envFlagEnabled } from '@/lib/env-flag';

export function verifiedMedianEnabled(): boolean {
  return envFlagEnabled(process.env.NEXT_PUBLIC_VERIFIED_MEDIAN_ENABLED);
}

/**
 * Feature gates for the privacy-sensitive On-the-Day modules.
 *
 * Activation is controlled from the admin Data Privacy board
 * (/admin/data-privacy → `data_privacy_controls`), NOT env flags — the owner
 * approves each capability in-app and the approval is recorded as the RA 10173
 * audit trail. These helpers read `status='active'` from that board (fail-closed
 * → false when off / unseeded). An env flag can still force-enable in local dev.
 *
 * Until a control is approved, the vendor Papic capture + per-guest delivery
 * modules render locked ("Needs setup") and no capture/delivery surface runs.
 */

import { isDataPrivacyControlActive } from '@/lib/data-privacy-controls';

/** Vendor free Papic capture (10 photos / 3 clips + Ltd/Unli upsell). */
export async function isVendorPapicCaptureEnabled(): Promise<boolean> {
  if (process.env.VENDOR_PAPIC_CAPTURE_ENABLED === '1') return true;
  return isDataPrivacyControlActive('vendor_papic_capture');
}

/** Per-guest vendor delivery tracker ("who hasn't received theirs"). */
export async function isVendorGuestDeliveryEnabled(): Promise<boolean> {
  if (process.env.VENDOR_GUEST_DELIVERY_ENABLED === '1') return true;
  return isDataPrivacyControlActive('vendor_guest_delivery');
}

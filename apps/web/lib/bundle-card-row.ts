/**
 * lib/bundle-card-row.ts — the bundle card row's two words (Build 6 · Lane D; owner 11 Nov 2026: a bundle card wears the
 * service card row — "off/delete refused while any booking of it is open", and the delete warning first).
 * PURE: no I/O. 🔒 app/vendor-dashboard/shop/bundle-cards-wear-the-card-row.test.ts
 */
import { formatCount } from './format-number';

/** The house warning's lines — what deleting a bundle does (its cards are untouched; nothing booked can be deleted). */
export const BUNDLE_DELETE_WARNING = ['The bundle leaves your shop and couples stop seeing it.', 'Its service cards stay as they are.'] as const;

/** Why this bundle may not go offline or be deleted right now — null when it may. An unread count is never "none". */
export function bundleHoldLine(openBookings: number | null): string | null {
  if (openBookings === null) return 'Couldn’t check this bundle’s bookings — try again in a moment.';
  if (openBookings > 0) return `${formatCount(openBookings)} open ${openBookings === 1 ? 'booking' : 'bookings'} — it stays online until ${openBookings === 1 ? 'it is' : 'they are'} complete.`;
  return null;
}

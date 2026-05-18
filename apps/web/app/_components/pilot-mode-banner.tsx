/**
 * Sitewide banner shown when pilot mode is active.
 *
 * Active when `NEXT_PUBLIC_PILOT_MODE_FREE_UNTIL` is set to an ISO 8601
 * timestamp in the future. Removes itself automatically once the
 * timestamp passes. Renders nothing when pilot mode is off.
 *
 * Server component — the env var is read at build time on the server and
 * passed down. No client interactivity needed; the banner only needs to
 * reflect the build's pilot configuration.
 */

import {
  formatPromoEndDateShort,
  getPilotFreeUntil,
  isPilotFreeMode,
} from '@/lib/sku-catalog';

export function PilotModeBanner() {
  if (!isPilotFreeMode()) return null;

  const until = getPilotFreeUntil();
  if (!until) return null;

  const formatted = formatPromoEndDateShort(until);

  return (
    <aside
      role="status"
      aria-live="polite"
      className="border-b border-terracotta/20 bg-terracotta/5 px-4 py-2 text-center text-[12px] text-terracotta"
    >
      <span className="font-medium">Pilot mode</span>{' '}
      <span className="text-terracotta/80">
        — every add-on and subscription is free for testing through {formatted}.
      </span>
    </aside>
  );
}

/**
 * Sitewide banner shown when pilot mode is active.
 *
 * Active when `NEXT_PUBLIC_PILOT_MODE_FREE_UNTIL` is set to an ISO 8601
 * timestamp in the future. Removes itself automatically once the
 * timestamp passes. Renders nothing when pilot mode is off.
 *
 * Server component — the env var is read at build time on the server and
 * passed down. Deliberately STAYS a server component so `@/lib/sku-catalog`
 * (~19 KB of SKU + pricing data, server-only today) is not pulled into the
 * client bundle of every route; only the tiny route gate below is client-side.
 *
 * ROUTE GATE (2026-07-26): this banner renders in normal flow ABOVE {children},
 * so on `/panood/program/[eventId]` — the chrome-less window a couple's OBS
 * window-captures — an active pilot window would push the program surface down
 * and put a terracotta "Pilot mode … free for testing" bar into the live
 * broadcast. Same class of bug as <CookieConsentBanner> (#3721) and
 * <DemoModeBanner>; same predicate. The gate lives in the client child because
 * `usePathname()` is client-only — see pilot-mode-banner-client.tsx for why the
 * split falls where it does and why there is no first-paint flash.
 */

import {
  formatPromoEndDateShort,
  getPilotFreeUntil,
  isPilotFreeMode,
} from '@/lib/sku-catalog';
import { PilotModeBannerClient } from './pilot-mode-banner-client';

export function PilotModeBanner() {
  if (!isPilotFreeMode()) return null;

  const until = getPilotFreeUntil();
  if (!until) return null;

  return <PilotModeBannerClient formatted={formatPromoEndDateShort(until)} />;
}

/**
 * Test fixture: v84 print badges as `resolvePrintBadgeArt` hands them over, with STAND-IN art (a plain rect at the
 * picture's real box), for the tests that check WHERE a print places them. The real art is held by
 * `lib/print-badges-v84.test.ts`. Imported by tests only.
 */
import { verifiedV84Svg, VERIFIED_V84_SIDE } from '@/lib/verified-v84-art';
import type { PrintBadge, PrintBadgeArt } from '@/lib/print-badges-v84';

export function standInArt(badge: PrintBadge): PrintBadgeArt {
  if (badge.kind === 'verified') return { badge, w: VERIFIED_V84_SIDE, h: VERIFIED_V84_SIDE, svg: verifiedV84Svg({ uid: 'fx', size: VERIFIED_V84_SIDE, word: false }), png: null };
  const [w, h] = badge.kind === 'seal' ? [320, 304] : [300, 286];
  return { badge, w, h, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#888"/></svg>`, png: null };
}

/** The busiest a print gets: a seal, Verified, and two tiers. */
export const BUSY_PRINT_BADGES: PrintBadgeArt[] = [
  standInArt({ kind: 'seal', key: 'top10', label: 'Top 10 Supplier', year: 2026 }),
  standInArt({ kind: 'verified', key: 'verified', label: 'Setnayan Verified' }),
  standInArt({ kind: 'tier', key: 'completed_bookings', label: 'Completed bookings (Ruby)', family: 'calendar', tier: 4 }),
  standInArt({ kind: 'tier', key: 'five_star_reviews', label: 'Five-star reviews (Silver)', family: 'bubble', tier: 2 }),
];

/**
 * area-supplier-counts.ts — 📍 "AREAS THAT FIT · BY SUPPLIERS WE HAVE THERE" (owner 2026-11-17, drawing v15 Where ·
 * "Not sure yet"; the controller accepted the definition on PR #7920).
 *
 * A supplier is "here" when it is a LIVE shop (verified + publicly visible — the one definition) whose OWN reach covers
 * the area's centre. Reach is the shop's verification, never its plan (owner 2026-11-19, #8014): the one clamp
 * `effectiveOuterRadiusKm` — not verified → 0 (counted nowhere), verified with a ring → that ring, verified and blank →
 * no limit of its own. An unpinned shop is counted nowhere: it cannot be said to serve an area. Real counts only — never
 * "most popular on Setnayan".
 *
 * PURE: the read lives in `area-supplier-counts.server.ts`, which hands the rows here.
 */
import { haversineKm } from './geo';
import { effectiveOuterRadiusKm } from './vendor-service-radius';

export type AreaShop = {
  lat: number | null;
  lon: number | null;
  /** `isVerifiedForReach(verification_state)` — the shop's verification, never its plan. */
  verified: boolean;
  innerKm: number | null;
  outerKm: number | null;
};

export type AreaPoint = { key: string; lat: number; lon: number };

/** How far this shop reaches, in km — Infinity when verified with no ring of its own, null when it reaches nowhere. */
export function shopReachKm(s: AreaShop): number | null {
  const km = effectiveOuterRadiusKm(s.outerKm, s.verified);
  return km > 0 ? km : null;
}

/** area key → how many shops reach it. Every area is present (0 is a measured zero, not a missing read). */
export function countSuppliersByArea(shops: readonly AreaShop[], areas: readonly AreaPoint[]): Map<string, number> {
  const out = new Map<string, number>(areas.map((a) => [a.key, 0]));
  for (const s of shops) {
    if (s.lat == null || s.lon == null) continue;
    const reach = shopReachKm(s);
    if (reach == null) continue;
    for (const a of areas) {
      if (haversineKm(a.lat, a.lon, s.lat, s.lon) <= reach) out.set(a.key, (out.get(a.key) ?? 0) + 1);
    }
  }
  return out;
}

/**
 * The areas that fit, best first: most suppliers there, then nearest the guests' home (when they said one). Areas
 * with nobody are left out — an area with no supplier is not a suggestion.
 */
export function rankAreas(
  counts: ReadonlyMap<string, number>,
  areas: readonly AreaPoint[],
  home: { lat: number; lon: number } | null,
  limit = 3,
): Array<{ key: string; count: number; km: number | null }> {
  return areas
    .map((a) => ({
      key: a.key,
      count: counts.get(a.key) ?? 0,
      km: home ? Math.round(haversineKm(home.lat, home.lon, a.lat, a.lon)) : null,
    }))
    .filter((a) => a.count > 0)
    .sort((x, y) => y.count - x.count || (x.km ?? 0) - (y.km ?? 0))
    .slice(0, limit);
}

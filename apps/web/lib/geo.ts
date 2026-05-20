/**
 * Geo helpers — haversine distance + Nominatim geocoder.
 *
 * V1 design notes:
 *   - Distance math runs in app code (haversine on numeric pairs). We
 *     deliberately don't pull PostGIS for this — the columns are plain
 *     NUMERIC, and reads stay cheap because distance is only computed
 *     in-process for the visible vendor cards (<= PAGE_SIZE 24 per request).
 *
 *   - Geocoder is Nominatim (OpenStreetMap, free, no API key). Owner picked
 *     this 2026-05-21 to ship without provisioning a paid key. PH coverage
 *     is good at the city/landmark level — adequate for "vendor HQ in
 *     Quezon City" → coords near a known centroid. Quality degrades at
 *     barangay level. Vendor/admin can override hq_latitude/longitude
 *     manually if Nominatim mis-locates.
 *
 *   - Nominatim's usage policy requires a meaningful User-Agent string and
 *     no more than 1 req/sec from any one client. Our calls happen on
 *     vendor-profile save (rare, low volume), so we just send a polite UA
 *     and let the runtime queue handle the 1 RPS naturally. If we ever
 *     batch-geocode (e.g., admin tool to back-fill), introduce a real
 *     queue then.
 */

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';

const EARTH_RADIUS_KM = 6371.0088;

/**
 * Great-circle distance between two lat/lng pairs in kilometers.
 * Returns a non-negative number; never NaN as long as inputs are finite.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Format a kilometer distance for the marketplace chip. Sub-1km rounds to
 * one decimal place, 1km+ rounds to whole numbers — matches how people
 * naturally talk about distances ("700m" feels different from "0.7km").
 */
export function formatDistanceKm(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '';
  if (km < 1) return `${(km * 1000).toFixed(0)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export type GeocodeResult = {
  latitude: number;
  longitude: number;
  /** Provider's best display name for the resolved location — useful for
   *  debugging in admin tools but never shown to couples. */
  displayName: string;
};

/**
 * Geocode a free-text address via Nominatim. Returns `null` on miss
 * (no result, ambiguous, network error, etc.) — callers should treat
 * geocoding as best-effort. We pin the search to the Philippines via
 * the `countrycodes=ph` param.
 */
export async function geocodeNominatim(query: string): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return null;

  const url = new URL(NOMINATIM_ENDPOINT);
  url.searchParams.set('q', trimmed);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'ph');
  url.searchParams.set('addressdetails', '0');

  try {
    const res = await fetch(url, {
      headers: {
        // Nominatim usage policy requires a real UA naming the app and an
        // email contact. Setnayan team contact is the owner's address.
        'User-Agent': 'Setnayan/1.0 (https://www.setnayan.com; iscasasolaii@gmail.com)',
        Accept: 'application/json',
      },
      // 5-second cap so a slow Nominatim never blocks a vendor's save.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const json: unknown = await res.json();
    if (!Array.isArray(json) || json.length === 0) return null;

    const first = json[0] as {
      lat?: string;
      lon?: string;
      display_name?: string;
    };
    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

    return {
      latitude: lat,
      longitude: lng,
      displayName: typeof first.display_name === 'string' ? first.display_name : trimmed,
    };
  } catch {
    // Network failure, timeout, JSON parse error — all degrade to "no
    // geocode this time". The vendor's save still succeeds; their card
    // just won't show a distance chip until coords land.
    return null;
  }
}

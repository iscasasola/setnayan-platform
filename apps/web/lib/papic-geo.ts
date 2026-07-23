/**
 * Papic capture geolocation — the fail-closed field builder (RA 10173).
 *
 * Location is personal information. Whether a Papic photo/clip is geo-stamped is
 * governed by the `papic_geo_metadata` data-privacy control at /admin/data-privacy.
 * This pure helper turns (control-active?, the client's last-known fix) into the
 * exact geo columns to write on the `papic_photos` insert — so the decision is
 * unit-testable and the server action stays thin.
 *
 * Invariants:
 *  - Control OFF  → return {} : never write ANY geo column (the photo still lands,
 *    just geo-free). This is the fail-closed default and matches the pre-build
 *    behavior (no path ever stamped geo).
 *  - Control ON, geo === undefined → return {} : this capture path carried NO
 *    location info (an offline-queue drain or a DSLR camera-bridge capture — the
 *    bridge has no phone GPS). "Not recorded" — NOT the same as attempted-and-
 *    failed, so we must not assert geo_unavailable here.
 *  - Control ON, an explicit fix that has no usable coordinates ({unavailable:true}
 *    or NaN lat/lon) → { geo_unavailable: true } : the capture CLIENT tried but got
 *    no fix (permission denied / no signal).
 *  - Control ON, a usable fix → the coordinates + accuracy, geo_unavailable = false.
 *
 * The stored coordinates never leave the server: no share/gallery/download DTO
 * selects geo_lat/geo_lon (see lib/guest-live-gallery.ts et al.), and full-res
 * originals are EXIF-stripped on the way out (lib/papic-derivatives.ts).
 */

export type PapicGeoInput = {
  lat?: number | null;
  lon?: number | null;
  /** Horizontal accuracy in metres, from the Geolocation API. */
  accuracyM?: number | null;
  /** The client tried but got no fix (permission denied / timeout / no signal). */
  unavailable?: boolean;
};

const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * The geo columns to spread into a `papic_photos` insert. Empty object when the
 * control is off (fail-closed) — spreading it writes nothing, leaving geo NULL.
 */
export function buildPapicGeoFields(
  geoEnabled: boolean,
  geo: PapicGeoInput | null | undefined,
): Record<string, number | boolean | null> {
  // Fail-closed: control off → never stamp geo, whatever the client sent.
  if (!geoEnabled) return {};

  // No location info from this capture path (offline drain / DSLR bridge) → not
  // recorded. Distinct from attempted-and-failed, so we don't set geo_unavailable.
  if (geo === undefined || geo === null) return {};

  // The client had geo on but produced no usable fix → record the failed attempt.
  if (geo.unavailable || !isFiniteNum(geo.lat) || !isFiniteNum(geo.lon)) {
    return { geo_unavailable: true };
  }

  return {
    geo_lat: geo.lat,
    geo_lon: geo.lon,
    geo_accuracy_m: isFiniteNum(geo.accuracyM) ? geo.accuracyM : null,
    geo_unavailable: false,
  };
}

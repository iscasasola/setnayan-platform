/**
 * VendorLocationMap — a visual map with a marker pin for a vendor's HQ.
 *
 * WHY: the public vendor profile already ships Google Maps / Waze / Apple Maps
 * "Get directions" deep-link chips (<NavLinksRow>), but no *visible* map. This
 * adds the picture-of-the-map a couple expects when locating a business
 * (owner 2026-06-28 "do the visual map image").
 *
 * Provider choice: the OFFICIAL OpenStreetMap embed iframe
 * (openstreetmap.org/export/embed.html) — free, NO API key, NO paid dependency,
 * and sanctioned by OSM (it's their own embed feature, not bulk tile scraping,
 * so it sidesteps the tile-usage-policy concern that raw Leaflet+OSM tiles
 * raise). Per [[project_setnayan_vendor_no_2307_no_maps]] +
 * [[feedback_setnayan_oss_self_host_preference]] — open, key-free default; a
 * paid static-map API was deliberately NOT used (would need owner price
 * sign-off). CSP ships only `frame-ancestors 'self'`, so this external iframe
 * embeds without a config change.
 *
 * Self-guards: renders nothing without coordinates (a marker needs lat/lng).
 * Address-only vendors keep just the <NavLinksRow> search fallback.
 */

type Props = {
  /** Latitude in decimal degrees. NULL → render nothing. */
  latitude: number | null;
  /** Longitude in decimal degrees. NULL → render nothing. */
  longitude: number | null;
  /**
   * A non-identifying place label (e.g. location_city) for the iframe title /
   * a11y. Never pass a hidden vendor's business name — keep the name-reveal
   * contract intact.
   */
  label?: string | null;
};

export function VendorLocationMap({ latitude, longitude, label }: Props) {
  if (latitude == null || longitude == null) return null;

  const lat = Number(latitude.toFixed(6));
  const lng = Number(longitude.toFixed(6));

  // ~1.3km box around the point so the marker sits in a readable neighbourhood
  // view rather than zoomed to the whole country.
  const d = 0.008;
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;
  const embedSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
    bbox,
  )}&layer=mapnik&marker=${lat},${lng}`;
  const largerMap = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
  const title = label ? `Map showing ${label}` : 'Map showing the vendor location';

  return (
    <div className="overflow-hidden rounded-xl border border-ink/10">
      <iframe
        title={title}
        src={embedSrc}
        loading="lazy"
        className="block h-[220px] w-full"
        style={{ border: 0 }}
      />
      <a
        href={largerMap}
        target="_blank"
        rel="noopener noreferrer"
        className="block border-t border-ink/10 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55 hover:text-ink"
      >
        View larger map →
      </a>
    </div>
  );
}

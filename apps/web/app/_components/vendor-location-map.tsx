/**
 * VendorLocationMap — a visual map with a marker pin for a location.
 *
 * WHY: the public vendor profile already ships Google Maps / Waze / Apple Maps
 * "Get directions" deep-link chips (<NavLinksRow>), but no *visible* map. This
 * adds the picture-of-the-map a couple expects when locating a business
 * (owner 2026-06-28 "do the visual map image").
 *
 * ⚠ THE NAME IS NOW NARROWER THAN THE COMPONENT. Since 2026-08-24 the guest
 * invitation's venue section renders this too (H-4) — a wedding venue, not a
 * vendor HQ. It is deliberately NOT renamed: the file has shipped for months
 * and a rename is churn across surfaces that are fine. Read "vendor" here as
 * "whoever this pin belongs to".
 *
 * Provider choice: the OFFICIAL OpenStreetMap embed iframe
 * (openstreetmap.org/export/embed.html) — free, NO API key, NO paid dependency,
 * and sanctioned by OSM (it's their own embed feature, not bulk tile scraping,
 * so it sidesteps the tile-usage-policy concern that raw Leaflet+OSM tiles
 * raise). Per [[project_setnayan_vendor_no_2307_no_maps]] +
 * [[feedback_setnayan_oss_self_host_preference]] — open, key-free default; a
 * paid static-map API was deliberately NOT used (would need owner price
 * sign-off).
 *
 * 🔴 THIS DOCBLOCK USED TO SAY: "CSP ships only `frame-ancestors 'self'`, so
 * this external iframe embeds without a config change." THAT WAS FALSE, AND IT
 * IS THE SENTENCE THAT COST THE MAP ITS FIRST TWO MONTHS. The enforced policy
 * DOES carry a `frame-src`, openstreetmap.org was missing from it, and every
 * shop page with coordinates rendered an empty grey panel — no error, no log, a
 * blocked iframe failing exactly like a missing one. Fixed 2026-08-08 by adding
 * the origin; `lib/csp-embeds-are-allowed.test.ts` now pins it. **Do not delete
 * the host from next.config.ts, and do not restore the claim above.**
 *
 * Self-guards: renders nothing without coordinates (a marker needs lat/lng).
 * Address-only callers keep just the <NavLinksRow> search fallback.
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
  /**
   * Seat the map FLUSH against whatever sits directly beneath it — square
   * bottom corners and no bottom border, so it reads as the top of one block
   * rather than a rounded card floating on a square plate. Used by the guest
   * invitation's venue section, where the map is the head of a `pahina-plate`.
   * Default `false` keeps every existing caller byte-identical.
   */
  flush?: boolean;
};

export function VendorLocationMap({ latitude, longitude, label, flush = false }: Props) {
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
  const title = label ? `Map showing ${label}` : 'Map showing the location';

  return (
    <div
      className={`overflow-hidden border border-ink/10 ${
        flush ? 'rounded-t-xl border-b-0' : 'rounded-xl'
      }`}
    >
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

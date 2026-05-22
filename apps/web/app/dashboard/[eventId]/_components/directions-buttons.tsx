import {
  appleMapsUrl,
  googleMapsNavUrl,
  googleMapsSearchByQuery,
  wazeNavUrl,
} from '@/lib/geo';

/**
 * Brand-icon directions row — owner directive 2026-05-22:
 *
 *   "for the directions. show icons of google maps, waze and apple maps."
 *
 * Replaces the prior generic-pin row (NavLinksRow shipped earlier) on
 * the Reception venue + Ceremony venue cards. Each button is a 44px-min
 * tap target with the source app's brand mark inline-SVG'd so the host
 * recognizes the destination at a glance — same pattern Filipino map
 * users see on every mobile share sheet (Maps · Waze · Apple Maps).
 *
 * Server component — no client JS. Each `<a>` opens in a new tab with
 * `target="_blank" rel="noopener noreferrer"`. On mobile, the OS hands
 * off to the native app per its URL handler. Desktop falls back to the
 * web version of each map service.
 *
 * Brand-icon SVGs are inline (no icon package added). Path data is the
 * canonical Simple Icons (https://simpleicons.org · CC0) glyph for each
 * service: googlemaps · waze · apple (used to represent Apple Maps,
 * since Simple Icons doesn't ship a dedicated applemaps glyph, and the
 * Apple wordmark reads unambiguously when paired with the "Apple Maps"
 * label text — avoids replicating the trademarked Maps app icon).
 *
 * Monochrome inheritance — every glyph uses `fill="currentColor"` so it
 * picks up the chip's `text-ink/80 hover:text-terracotta` palette. Per
 * Setnayan's icon-button convention (cream + ink + terracotta), the row
 * reads as one cohesive control surface rather than three primary-color
 * stickers. Brand recognition comes from the silhouette + the label
 * text; brand color is reserved for moments where Setnayan wants the
 * accent (logos on vendor cards, palette swatches, etc.).
 *
 * Coordinates-first design — when lat/lng are set on the event, we use
 * the coordinate-anchored URL builders from `@/lib/geo`. When only an
 * address string is available, we fall back to a single Google Maps
 * text-search button (matches NavLinksRow's existing behavior so the
 * call sites swap cleanly).
 */

type Props = {
  /** Latitude in decimal degrees. NULL = fall back to addressFallback. */
  latitude: number | null;
  /** Longitude in decimal degrees. NULL = fall back to addressFallback. */
  longitude: number | null;
  /**
   * Free-text address fallback for surfaces where lat/lng isn't geocoded
   * yet. When `latitude`/`longitude` are NULL we still render a single
   * Google Maps text-search button. Pass `null` to suppress the row
   * entirely when nothing's pointable at.
   */
  addressFallback?: string | null;
  /** Eyebrow label (uppercase font-mono). Empty string suppresses it. */
  label?: string;
};

export function DirectionsButtons({
  latitude,
  longitude,
  addressFallback,
  label = 'Directions',
}: Props) {
  const hasCoords =
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  if (!hasCoords && !addressFallback?.trim()) return null;

  const chipBase =
    'inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/80 transition-colors hover:border-terracotta/50 hover:text-terracotta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta';

  if (!hasCoords) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {label ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            {label}
          </p>
        ) : null}
        <a
          href={googleMapsSearchByQuery(addressFallback!.trim())}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open in Google Maps"
          className={chipBase}
        >
          <GoogleMapsIcon />
          Google Maps
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {label ? (
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          {label}
        </p>
      ) : null}
      <a
        href={googleMapsNavUrl(latitude!, longitude!)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open in Google Maps"
        className={chipBase}
      >
        <GoogleMapsIcon />
        Google Maps
      </a>
      <a
        href={wazeNavUrl(latitude!, longitude!)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open in Waze"
        className={chipBase}
      >
        <WazeIcon />
        Waze
      </a>
      <a
        href={appleMapsUrl(latitude!, longitude!)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open in Apple Maps"
        className={chipBase}
      >
        <AppleMapsIcon />
        Apple Maps
      </a>
    </div>
  );
}

/**
 * Google Maps brand mark — canonical Simple Icons (CC0) `googlemaps`
 * glyph. Single-path silhouette of the Maps pin shape; `currentColor`
 * inherits the chip's text-ink/80 → hover:terracotta palette so the row
 * reads as one cohesive control surface (see header comment).
 */
function GoogleMapsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      aria-hidden
      role="img"
      focusable={false}
      fill="currentColor"
    >
      <path d="M19.527 4.799c1.212 2.608.937 5.678-.405 8.173-1.101 2.047-2.744 3.74-4.098 5.614-.619.858-1.244 1.75-1.669 2.727-.141.325-.263.658-.383.992-.121.333-.224.673-.34 1.008-.109.314-.236.684-.627.687h-.007c-.466-.001-.579-.53-.695-.887-.284-.874-.581-1.713-1.019-2.525-.51-.944-1.145-1.817-1.79-2.671L19.527 4.799zM8.545 7.705l-3.959 4.707c.724 1.54 1.821 2.863 2.871 4.18.247.31.494.622.737.936l4.984-5.925-.029.01c-1.741.601-3.691-.291-4.392-1.987a3.377 3.377 0 0 1-.209-.716c-.063-.437-.077-.761-.004-1.198l.001-.007zM5.492 3.149l-.003.004c-1.947 2.466-2.281 5.88-1.117 8.77l4.785-5.689-.058-.05-3.607-3.035zM14.661.436l-3.838 4.563a.295.295 0 0 1 .027-.01c1.6-.551 3.403.15 4.22 1.626.176.319.323.683.377 1.045.068.446.085.773.012 1.22l-.003.016 3.836-4.561A8.382 8.382 0 0 0 14.67.439l-.009-.003zM9.466 5.868L14.162.285l-.047-.012A8.31 8.31 0 0 0 11.986 0a8.439 8.439 0 0 0-6.169 2.766l-.016.018 3.665 3.084z" />
    </svg>
  );
}

/**
 * Waze brand mark — canonical Simple Icons (CC0) `waze` glyph. The
 * single-path speech-bubble silhouette with the two-dot eyes is
 * unmistakable at any size; `currentColor` keeps it on-palette.
 */
function WazeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      aria-hidden
      role="img"
      focusable={false}
      fill="currentColor"
    >
      <path d="M13.218 0C9.915 0 6.835 1.49 4.723 4.148c-1.515 1.913-2.31 4.272-2.31 6.706v1.739c0 .894-.62 1.738-1.862 1.813-.298.025-.547.224-.547.522-.05.82.82 2.31 2.012 3.502.82.844 1.788 1.515 2.832 2.036a3 3 0 0 0 2.955 3.528 2.966 2.966 0 0 0 2.931-2.385h2.509c.323 1.689 2.086 2.856 3.974 2.21 1.64-.546 2.36-2.409 1.763-3.924a12.84 12.84 0 0 0 1.838-1.465 10.73 10.73 0 0 0 3.18-7.65c0-2.882-1.118-5.589-3.155-7.625A10.899 10.899 0 0 0 13.218 0zm0 1.217c2.558 0 4.967.994 6.78 2.807a9.525 9.525 0 0 1 2.807 6.78A9.526 9.526 0 0 1 20 17.585a9.647 9.647 0 0 1-6.78 2.807h-2.46a3.008 3.008 0 0 0-2.93-2.41 3.03 3.03 0 0 0-2.534 1.367v.024a8.945 8.945 0 0 1-2.41-1.788c-.844-.844-1.316-1.614-1.515-2.11a2.858 2.858 0 0 0 1.441-.846 2.959 2.959 0 0 0 .795-2.036v-1.789c0-2.11.696-4.197 2.012-5.861 1.863-2.385 4.62-3.726 7.6-3.726zm-2.41 5.986a1.192 1.192 0 0 0-1.191 1.192 1.192 1.192 0 0 0 1.192 1.193A1.192 1.192 0 0 0 12 8.395a1.192 1.192 0 0 0-1.192-1.192zm7.204 0a1.192 1.192 0 0 0-1.192 1.192 1.192 1.192 0 0 0 1.192 1.193 1.192 1.192 0 0 0 1.192-1.193 1.192 1.192 0 0 0-1.192-1.192zm-7.377 4.769a.596.596 0 0 0-.546.845 4.813 4.813 0 0 0 4.346 2.757 4.77 4.77 0 0 0 4.347-2.757.596.596 0 0 0-.547-.845h-.025a.561.561 0 0 0-.521.348 3.59 3.59 0 0 1-3.254 2.061 3.591 3.591 0 0 1-3.254-2.061.64.64 0 0 0-.546-.348z" />
    </svg>
  );
}

/**
 * Apple Maps brand mark — canonical Simple Icons (CC0) `apple` wordmark
 * glyph. Simple Icons doesn't publish a dedicated applemaps glyph, and
 * the trademarked Maps app icon (tilted-arrow-on-colored-grid) is not
 * something we want to replicate visually. The Apple silhouette + the
 * "Apple Maps" label text is unambiguous on every Filipino host's share
 * sheet. `currentColor` keeps the row monochrome on-palette.
 */
function AppleMapsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      aria-hidden
      role="img"
      focusable={false}
      fill="currentColor"
    >
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

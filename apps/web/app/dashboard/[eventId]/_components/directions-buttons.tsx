import {
  appleMapsUrl,
  googleMapsNavUrl,
  googleMapsSearchByQuery,
  wazeNavUrl,
} from '@/lib/geo';

/**
 * Brand-icon directions row — owner directive 2026-05-22 (refresh):
 *
 *   "for the directions. show icons of google maps, waze and apple maps."
 *   → Follow-up: owner provided the actual brand-mark assets. Replace
 *     PR #371's monochrome Simple Icons silhouettes with full-color
 *     brand marks so the chips read at a glance the same way Filipino
 *     hosts see them on their phone's share sheet (Maps · Waze · Apple
 *     Maps), not as three cream-colored monochrome blobs that all look
 *     the same.
 *
 * Brand-mark sources:
 *   - WazeIcon — verbatim from the owner-supplied SVG asset on disk
 *     (`~/Downloads/waze-app-icon-vector-logo-seeklogo/...`). Faithful
 *     to the official Waze app icon (teal #3cf rounded square + white
 *     face + dark eyes/mouth).
 *   - GoogleMapsIcon — stylized red Maps pin (Google red #EA4335) with
 *     a white dot center. Recognizable as the iconic Google Maps
 *     location marker; intentionally NOT a verbatim copy of the full
 *     trademarked app icon (the green + map + G + red pin composition).
 *   - AppleMapsIcon — stylized blue navigation arrow (iOS blue #007AFF
 *     circle + white compass-style triangle). Recognizable as the
 *     Apple Maps navigation glyph; NOT a verbatim copy of the full
 *     trademarked rainbow-quadrant app icon.
 *
 * The chip background stays cream + the text label still reads "Google
 * Maps" / "Waze" / "Apple Maps" so the brand-icon + label pairing is
 * unambiguous nominative use for deep-linking into each map service.
 *
 * Server component — no client JS. Each `<a>` opens in a new tab with
 * `target="_blank" rel="noopener noreferrer"`. On mobile, the OS hands
 * off to the native app per its URL handler. Desktop falls back to the
 * web version of each map service.
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
 * Google Maps brand mark — stylized red location pin in Google's
 * brand red (#EA4335) with a white dot center. The iconic teardrop +
 * inner dot is the standard "this is a Google Maps location" affordance
 * Filipino hosts recognize at a glance. Intentionally NOT a verbatim
 * copy of the full trademarked Google Maps app icon (green + map +
 * white G + red pin composition); this is the brand-color pin shape
 * used universally for nominative deep-link purposes.
 */
function GoogleMapsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      aria-hidden
      role="img"
      focusable={false}
    >
      <path
        d="M12 2.5c-3.87 0-7 3.13-7 7 0 5.25 7 12 7 12s7-6.75 7-12c0-3.87-3.13-7-7-7z"
        fill="#EA4335"
      />
      <circle cx="12" cy="9.5" r="2.5" fill="#fff" />
    </svg>
  );
}

/**
 * Waze brand mark — verbatim from the owner-supplied Waze app-icon
 * SVG asset (teal #3cf rounded square + white face + dark eyes &
 * smile). Faithful to the official Waze app icon so the chip reads as
 * Waze at the same glance Filipino hosts give the share sheet on
 * their phones. fill-rule:evenodd on the inner face paths recreates
 * the "ring" effect the original SVG file uses.
 */
function WazeIcon() {
  return (
    <svg
      viewBox="0 0 52 52"
      className="h-4 w-4"
      aria-hidden
      role="img"
      focusable={false}
    >
      <path
        d="M52,8.6v34.9c0,4.7-3.8,8.6-8.6,8.6H8.6c-4.7,0-8.6-3.8-8.6-8.6V8.6C0,3.8,3.8,0,8.6,0h34.9c4.7,0,8.6,3.8,8.6,8.6h0Z"
        fill="#3cf"
        fillRule="evenodd"
      />
      <path
        d="M27.5,36.9h-3.2c-.4-1.8-2-3.1-3.8-3.1s-2.6.7-3.3,1.8h0c-1.2-.6-2.2-1.4-3.1-2.3-1.1-1.1-1.7-2.1-2-2.8.7-.2,1.4-.5,1.9-1.1.7-.7,1-1.7,1-2.7v-2.3c0-2.8.9-5.5,2.6-7.6,2.4-3.1,6-4.9,9.8-4.9s6.4,1.3,8.8,3.7c2.3,2.3,3.7,5.5,3.6,8.8,0,3.3-1.3,6.5-3.6,8.8-2.3,2.3-5.4,3.7-8.8,3.7"
        fill="#fff"
        fillRule="evenodd"
      />
      <path
        d="M27.5,36.9h-3.2c-.4-1.8-2-3.1-3.8-3.1s-2.6.7-3.3,1.8h0c-1.2-.6-2.2-1.4-3.1-2.3-1.1-1.1-1.7-2.1-2-2.8.7-.2,1.4-.5,1.9-1.1.7-.7,1-1.7,1-2.7v-2.3c0-2.8.9-5.5,2.6-7.6,2.4-3.1,6-4.9,9.8-4.9s6.4,1.3,8.8,3.7c2.3,2.3,3.7,5.5,3.6,8.8,0,3.3-1.3,6.5-3.6,8.8-2.3,2.3-5.4,3.7-8.8,3.7M41.5,24.5c0-3.7-1.5-7.3-4.1-9.9-2.6-2.6-6.1-4.1-9.9-4.1s-8.2,1.9-11,5.3c-2,2.5-3,5.6-3,8.7v2.3c0,1.2-.9,2.4-2.5,2.4s-.5.2-.6.4c-.3,1,.9,3.1,2.6,4.8,1.1,1.1,2.3,2,3.7,2.7-.4,2.1,1,4.1,3.2,4.5.2,0,.4,0,.7,0,1.9,0,3.5-1.3,3.8-3.1h3.3c.4,2.2,2.7,3.7,5.2,2.9,1.1-.4,1.9-1.2,2.3-2.2.4-1,.3-2,0-2.8.9-.5,1.7-1.2,2.4-1.9,2.6-2.6,4.1-6.2,4.1-9.9"
        fill="#1a1a2e"
        fillRule="evenodd"
      />
      <path
        d="M35.3,21.3c0-.9-.7-1.6-1.5-1.6s-1.5.7-1.5,1.6.7,1.6,1.5,1.6,1.5-.7,1.5-1.6M26,21.3c0-.9-.7-1.6-1.5-1.6s-1.5.7-1.5,1.6.7,1.6,1.5,1.6,1.5-.7,1.5-1.6M24.9,26.4c-.1-.3-.4-.4-.7-.4-.4,0-.8.4-.8.8,0,.1,0,.2,0,.3,1,2.2,3.2,3.6,5.6,3.6,2.4,0,4.6-1.4,5.6-3.6.2-.4,0-.9-.4-1,0,0-.2,0-.3,0h0c-.3,0-.6.2-.7.4-.8,1.6-2.4,2.7-4.2,2.7s-3.4-1-4.2-2.7"
        fill="#1a1a2e"
        fillRule="evenodd"
      />
    </svg>
  );
}

/**
 * Apple Maps brand mark — stylized blue navigation arrow in iOS blue
 * (#007AFF circle + white compass-triangle inset). Recognizable as
 * the Apple Maps navigation glyph that hosts see when they open Maps
 * on their iPhone or Macbook share sheet. Intentionally NOT a
 * verbatim copy of the full trademarked Apple Maps app icon (rainbow
 * quadrants + roads + center arrow); this is the brand-color
 * navigation arrow used universally for nominative deep-link
 * purposes.
 */
function AppleMapsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      aria-hidden
      role="img"
      focusable={false}
    >
      <circle cx="12" cy="12" r="11" fill="#007AFF" />
      <path
        d="M12 5.5l-4.2 11 4.2-2.2 4.2 2.2L12 5.5z"
        fill="#fff"
      />
    </svg>
  );
}

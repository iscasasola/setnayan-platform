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
 * Brand-icon SVGs are inline (no icon package added). Paths sourced
 * from Simple Icons (https://simpleicons.org · CC0 logo data) with
 * brand-canonical colors baked into the `fill` attribute so the chip
 * stays recognizable on the cream-bg planning card.
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
 * Google Maps brand mark — red teardrop pin with white "G".
 * Path data adapted from Simple Icons (CC0) `googlemaps` glyph.
 * Brand color: #EA4335 (Google Maps red pin · matches the canonical
 * Maps pin in Google's own brand guidance).
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
        d="M19.527 4.799c1.212 2.608.937 5.678-.405 8.173-1.101 2.047-2.744 3.74-4.098 5.614-.619.858-1.244 1.75-1.669 2.727-.141.325-.263.658-.383.992-.121.333-.224.673-.34 1.008-.109.31-.236.63-.508.831-.443.328-1.092.305-1.514-.046-.366-.302-.408-.65-.471-1.087-.094-.66-.198-1.337-.426-1.964-.448-1.224-1.097-2.327-1.745-3.434-.62-1.058-1.215-2.114-1.71-3.243-.275-.628-.503-1.276-.7-1.93-.215-.722-.366-1.465-.499-2.21-.099-.561-.198-1.122-.273-1.685-.087-.673-.197-1.395-.022-2.07.16-.61.515-1.155.954-1.6.493-.5 1.099-.881 1.762-1.082 1.42-.428 3.013-.087 4.187.823.92.711 1.594 1.797 1.819 2.95.215 1.092.046 2.237-.358 3.265-.456 1.16-1.234 2.176-2.166 3.005-.926.824-1.969 1.547-3.011 2.18.348 1.061.881 2.043 1.476 2.974.586.916 1.213 1.792 1.842 2.681.343.485.654.99.94 1.513.286-.522.598-1.027.94-1.512.628-.889 1.256-1.764 1.842-2.681.595-.93 1.128-1.913 1.476-2.974-1.042-.633-2.085-1.356-3.011-2.18-.932-.83-1.71-1.845-2.166-3.005-.404-1.028-.573-2.173-.358-3.265.225-1.153.9-2.239 1.819-2.95 1.174-.91 2.767-1.252 4.187-.823.71.215 1.354.633 1.872 1.182.49.519.851 1.166 1.014 1.864.06.262.083.531.122.795z"
        fill="#EA4335"
      />
      <circle cx="12" cy="9" r="2.75" fill="#FFFFFF" />
      <text
        x="12"
        y="11.4"
        textAnchor="middle"
        fontFamily="Helvetica,Arial,sans-serif"
        fontWeight="700"
        fontSize="4.2"
        fill="#1A73E8"
      >
        G
      </text>
    </svg>
  );
}

/**
 * Waze brand mark — speech-bubble logo. Path data adapted from Simple
 * Icons (CC0) `waze` glyph. Brand color: #33CCFF (Waze cyan).
 */
function WazeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      aria-hidden
      role="img"
      focusable={false}
    >
      <path
        d="M20.54 6.63c1.16 2.18 1.27 4.93.61 7.3a8.34 8.34 0 0 1-3.05 4.45c-2.07 1.55-4.7 2.21-7.27 2.1.07.5.04 1.04-.2 1.5-.4.77-1.27 1.25-2.13 1.16-.84-.08-1.6-.7-1.9-1.5-.16-.43-.18-.91-.06-1.36-.83-.34-1.61-.79-2.31-1.36C2.27 16.42 1.18 13.5 1.4 10.69c.2-2.74 1.78-5.34 4.13-6.76C7.86 2.5 10.85 2.05 13.7 2.6c2.81.55 5.4 2.32 6.84 4.03zm-1.66 5.55c.66-2.16.39-4.6-.91-6.41a7.27 7.27 0 0 0-5.51-2.94c-2.06-.09-4.13.51-5.74 1.79-1.62 1.28-2.74 3.2-2.94 5.27-.2 2.06.47 4.18 1.78 5.76 1.31 1.59 3.21 2.6 5.22 2.9 2.03.3 4.15-.13 5.93-1.17a6.93 6.93 0 0 0 2.17-2.04c.57-.83.99-1.78 1.21-2.77 0-.13.04-.26.07-.39h-.28zM8.92 9.34a1.18 1.18 0 1 1-2.36 0 1.18 1.18 0 0 1 2.36 0zm6.51 0a1.18 1.18 0 1 1-2.36 0 1.18 1.18 0 0 1 2.36 0zm-7.81 4.18c.36-.06.7.18.77.53.27 1.27 1.36 2.21 2.65 2.34 1.38.14 2.71-.65 3.18-1.94.13-.34.5-.52.84-.4.34.12.52.5.4.84a4.16 4.16 0 0 1-3.64 2.81c-.16.01-.32.02-.48.02-1.91 0-3.58-1.34-3.96-3.22a.66.66 0 0 1 .51-.77c.02 0 .02 0 .04-.01l-.31-.2z"
        fill="#33CCFF"
      />
    </svg>
  );
}

/**
 * Apple Maps brand mark — abstract route-arrow on rounded square. We
 * render a calm representation rather than the trademarked Maps app
 * icon: a tilted blue arrow on a white-rounded card with red pin
 * accent — visually anchors "Apple Maps" without infringing on the
 * exact icon trademark. Brand-canonical hues: #007AFF (iOS blue),
 * #FF3B30 (iOS red).
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
      <rect x="2" y="2" width="20" height="20" rx="4.5" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth="0.5" />
      <path
        d="M6.5 16.5L11 5l1.6 4.4L17.5 7.5 13 19l-1.6-4.4z"
        fill="#007AFF"
      />
      <path
        d="M11 5l1.6 4.4L11 9.8z"
        fill="#FF3B30"
      />
    </svg>
  );
}

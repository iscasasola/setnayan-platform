import { Navigation, MapPin } from 'lucide-react';
import {
  appleMapsUrl,
  googleMapsNavUrl,
  googleMapsSearchByQuery,
  wazeNavUrl,
} from '@/lib/geo';

type Props = {
  /** Latitude in decimal degrees. NULL = fall back to addressFallback. */
  latitude: number | null;
  /** Longitude in decimal degrees. NULL = fall back to addressFallback. */
  longitude: number | null;
  /**
   * Free-text address fallback for surfaces that have not been geocoded
   * yet. When latitude/longitude are NULL we still render a single
   * "Open in Google Maps" link that runs a text search. Pass `null` to
   * suppress the row entirely when there's nothing to point at.
   */
  addressFallback?: string | null;
  /** Optional eyebrow label (e.g. "Get directions"). Hidden when empty. */
  label?: string;
  /** Compact variant — smaller chips for cramped contexts. */
  compact?: boolean;
};

/**
 * Shared map / nav deep-link row. Renders three icon chips for Google Maps,
 * Waze, and Apple Maps when coordinates are available; falls back to a
 * single Google Maps text-search link when only a free-text address is
 * supplied. Pure server component — every link is just an `<a>` with
 * `target="_blank" rel="noreferrer"`.
 */
export function NavLinksRow({
  latitude,
  longitude,
  addressFallback,
  label = 'Get directions',
  compact = false,
}: Props) {
  const hasCoords =
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  if (!hasCoords && !addressFallback?.trim()) return null;

  const chipBase = compact
    ? 'inline-flex items-center gap-1 rounded-md border border-ink/15 bg-cream px-2.5 py-1 text-xs font-medium text-ink/75 transition-colors hover:border-terracotta/50 hover:text-terracotta'
    : 'inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-sm font-medium text-ink/80 transition-colors hover:border-terracotta/50 hover:text-terracotta';

  if (!hasCoords) {
    // Text-search fallback — single Google Maps chip.
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
          rel="noreferrer"
          className={chipBase}
        >
          <MapPin
            aria-hidden
            className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}
            strokeWidth={1.75}
          />
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
        rel="noreferrer"
        title="Open in Google Maps"
        className={chipBase}
      >
        <MapPin
          aria-hidden
          className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}
          strokeWidth={1.75}
        />
        Google Maps
      </a>
      <a
        href={wazeNavUrl(latitude!, longitude!)}
        target="_blank"
        rel="noreferrer"
        title="Open in Waze"
        className={chipBase}
      >
        <Navigation
          aria-hidden
          className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}
          strokeWidth={1.75}
        />
        Waze
      </a>
      <a
        href={appleMapsUrl(latitude!, longitude!)}
        target="_blank"
        rel="noreferrer"
        title="Open in Apple Maps"
        className={chipBase}
      >
        <MapPin
          aria-hidden
          className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}
          strokeWidth={1.75}
        />
        Apple Maps
      </a>
    </div>
  );
}

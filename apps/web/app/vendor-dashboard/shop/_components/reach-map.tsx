'use client';

/**
 * ReachMap — a dependency-free "how far you cover from your HQ" map.
 *
 * WHY no map library: adding leaflet/react-leaflet would pull two runtime deps
 * + a client-only SSR dance + a lockfile change, for one static, non-interactive
 * coverage picture behind vendor auth. Instead we render OpenStreetMap raster
 * tiles as plain <img> in a Web-Mercator grid centred on the HQ, and overlay an
 * SVG reach ring whose pixel radius is derived from metres-per-pixel at the HQ
 * latitude. The site CSP is only `frame-ancestors 'self'` (no img-src), so the
 * tiles load without a policy change.
 *
 * Tiles come from OSM's public tile server. That's fine at this volume (one
 * static map, behind vendor auth), and it honours the owner's OSS / no-paid-key
 * geocoder choice (lib/geo.ts). If tile volume ever grows, swap TILE_URL to a
 * hosted provider — the math here is provider-agnostic. OSM attribution is
 * required by their tile-usage policy and is rendered in-corner.
 *
 * The radius shown is the vendor's TIER reach (vendor-tier-caps · serviceRadiusKm)
 * — the same number the couple's Services search gates on. Read-only here; a
 * follow-up makes it vendor-settable up to the tier ceiling.
 */

import { useEffect, useRef, useState } from 'react';

const TILE = 256;
const HEIGHT = 240;
/** Equatorial metres-per-pixel at zoom 0 (Web-Mercator, 256px tiles). */
const MPP_Z0 = 156543.03392;

const tileUrl = (z: number, x: number, y: number) =>
  `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Longitude → absolute world-pixel X at the given zoom. */
function worldX(lng: number, z: number): number {
  return ((lng + 180) / 360) * TILE * 2 ** z;
}
/** Latitude → absolute world-pixel Y at the given zoom (Web-Mercator). */
function worldY(lat: number, z: number): number {
  const s = Math.min(0.9999, Math.max(-0.9999, Math.sin(rad(lat))));
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE * 2 ** z;
}
/** Ground metres per screen pixel at a latitude + zoom. */
function metresPerPixel(lat: number, z: number): number {
  return (MPP_Z0 * Math.cos(rad(lat))) / 2 ** z;
}

type Props = {
  lat: number;
  lng: number;
  /** Tier reach in km. 0 = unscoped (no ring drawn). */
  radiusKm: number;
};

export function ReachMap({ lat, lng, radiusKm }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(e.contentRect.width);
    });
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const W = width;
  const H = HEIGHT;
  const hasRing = Number.isFinite(radiusKm) && radiusKm > 0;

  // Pick an integer zoom so the ring fills ~62% of the smaller viewport edge.
  // No ring (Free/unscoped) → a city-level default so the HQ is still shown.
  let zoom = 11;
  if (hasRing && W > 0) {
    const target = 0.62 * Math.min(W, H);
    const n = (target * MPP_Z0 * Math.cos(rad(lat))) / (2 * radiusKm * 1000);
    zoom = Math.round(Math.log2(Math.max(1e-9, n)));
  }
  zoom = Math.max(3, Math.min(15, zoom));

  const n2 = 2 ** zoom;
  const centreX = worldX(lng, zoom);
  const centreY = worldY(lat, zoom);
  const left = centreX - W / 2;
  const top = centreY - H / 2;

  const tiles: Array<{ key: string; url: string; x: number; y: number }> = [];
  if (W > 0) {
    const minTx = Math.floor(left / TILE);
    const maxTx = Math.floor((left + W) / TILE);
    const minTy = Math.floor(top / TILE);
    const maxTy = Math.floor((top + H) / TILE);
    for (let tx = minTx; tx <= maxTx; tx++) {
      for (let ty = minTy; ty <= maxTy; ty++) {
        if (ty < 0 || ty >= n2) continue; // no vertical wrap at the poles
        const wrappedX = ((tx % n2) + n2) % n2; // horizontal wrap
        tiles.push({
          key: `${tx}_${ty}`,
          url: tileUrl(zoom, wrappedX, ty),
          x: Math.round(tx * TILE - left),
          y: Math.round(ty * TILE - top),
        });
      }
    }
  }

  const ringPx = hasRing ? (radiusKm * 1000) / metresPerPixel(lat, zoom) : 0;

  return (
    <div
      ref={ref}
      className="relative w-full overflow-hidden rounded-xl border"
      style={{ height: H, borderColor: 'var(--m-line)', background: '#e6ebed' }}
      role="img"
      aria-label={
        hasRing
          ? `Map showing your service coverage of about ${radiusKm} kilometres around your headquarters`
          : 'Map showing your headquarters location'
      }
    >
      {tiles.map((t) => (
        // eslint-disable-next-line @next/next/no-img-element -- raw <img> is deliberate: absolutely-positioned OSM tile grid, next/image can't lay this out
        <img
          key={t.key}
          src={t.url}
          alt=""
          width={TILE}
          height={TILE}
          loading="lazy"
          draggable={false}
          className="pointer-events-none absolute select-none"
          style={{ left: t.x, top: t.y, width: TILE, height: TILE }}
        />
      ))}

      {W > 0 && (
        <svg
          width={W}
          height={H}
          className="pointer-events-none absolute inset-0"
          aria-hidden
        >
          {ringPx > 0 && (
            <circle
              cx={W / 2}
              cy={H / 2}
              r={ringPx}
              style={{ fill: 'var(--m-terracotta, #b65d3c)', fillOpacity: 0.14 }}
              stroke="var(--m-terracotta, #b65d3c)"
              strokeWidth={2}
              strokeOpacity={0.9}
            />
          )}
          {/* HQ marker */}
          <circle
            cx={W / 2}
            cy={H / 2}
            r={6}
            style={{ fill: 'var(--m-terracotta, #b65d3c)' }}
            stroke="#fff"
            strokeWidth={2}
          />
        </svg>
      )}

      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-0 right-0 bg-white/75 px-1 text-[10px] leading-tight text-ink/60 hover:underline"
      >
        © OpenStreetMap
      </a>
    </div>
  );
}

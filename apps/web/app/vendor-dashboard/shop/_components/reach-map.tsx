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
 *
 * 📍 TWO RINGS AND THE PIN (owner 2026-10-29, Supplier dashboard v13 note 3 — *"where is the map locator?"*): when the
 * supplier has said how far they go, the map draws THEIR two distances — the inner ring (green) is "Free transpo", the
 * outer ring (dashed terracotta) is how far they cover — each labelled, around a map pin at the HQ. Undeclared, it is
 * the plan's one ring exactly as before. `muted` greys the whole map: the rings are not live yet (an unverified shop
 * reaches 0 km — `GetVerifiedLine` above it says why).
 */

import { useEffect, useRef, useState } from 'react';
import { MapCredit } from '@/app/_components/map-card-chrome';
// 🗺 ONE WEB-MERCATOR (map card approved 2026-11-14): the tile math is the pinned map's (`lib/scene-map-tiles.ts`), not
// a second copy here — the two maps cannot drift apart on where a coordinate lands.
import { TILE, tileUrl, worldX, worldY } from '@/lib/scene-map-tiles';

const HEIGHT = 240;
/** The reach ring's colour — its fill, its stroke and its "N km" tag share this one value. */
const RING_COLOUR = 'rgb(var(--color-terracotta))';
/**
 * 🗺 THE MAP'S OWN WHITE — the halo behind a ring's words and the "N km" tag's chip sit on OpenStreetMap's tiles, which
 * are drawn light whatever the app's theme, so this white is the tiles' colour, not a theme colour: a token would turn
 * dark in dark mode and the words would vanish into the halo. Kept literal on purpose (template rule 14's map case).
 */
const ON_TILES = 'white';
/** Equatorial metres-per-pixel at zoom 0 (Web-Mercator, 256px tiles). */
const MPP_Z0 = 156543.03392;

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Ground metres per screen pixel at a latitude + zoom. */
function metresPerPixel(lat: number, z: number): number {
  return (MPP_Z0 * Math.cos(rad(lat))) / 2 ** z;
}

type Props = {
  lat: number;
  lng: number;
  /** Tier reach in km. 0 = unscoped (no ring drawn). */
  radiusKm: number;
  /** The supplier's own free-transport distance (already clamped to the plan). Null = not said. */
  innerKm?: number | null;
  /** The supplier's own farthest distance (already clamped to the plan). Null = not said → the plan's ring. */
  outerKm?: number | null;
  /** Grey the map: the rings are not live yet (an unverified shop). */
  muted?: boolean;
  /**
   * The map's spoken label for a reader who is NOT the supplier — the public shop page (supplier website by plan,
   * 2026-10-30) draws the plan's ring for couples, where "your headquarters" would be the wrong voice. Default: the
   * supplier's own wording below, unchanged.
   */
  ariaLabel?: string;
  /**
   * 🏷 THE "N km" TAG (prototype public_pages_three_2026-11-13 motion 8 — the public shop page only): a small label at
   * the plan ring's upper right, `data-reach-km`, so the page's CSS can fade it in after the ring draws. The plan ring
   * itself always carries `data-reach-ring` + `pathLength=1` (complete at rest, so this map is unchanged everywhere).
   */
  kmTag?: boolean;
  /** The credit is a link (false on the sample shop page, which must lead nowhere — RW-81). Default true. */
  credit?: boolean;
  /**
   * 🗺 THE MAP CARD'S SHAPE (map card follow-up, 2026-11-14 live re-walk): 9 : 5 and never taller than 250 px, like the
   * one-pin map card (`MapCard`), instead of the dashboard's fixed 240 px height (which drew 3 : 2 on a phone). The
   * public shop page passes it; the supplier's own Where you work map keeps its 240 px. Default false.
   */
  card?: boolean;
};

export function ReachMap({ lat, lng, radiusKm, innerKm = null, outerKm = null, muted = false, ariaLabel, kmTag = false, credit = true, card = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [boxHeight, setBoxHeight] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setWidth(e.contentRect.width);
        setBoxHeight(e.contentRect.height);
      }
    });
    ro.observe(el);
    const box = el.getBoundingClientRect();
    setWidth(box.width);
    setBoxHeight(box.height);
    return () => ro.disconnect();
  }, []);

  const W = width;
  // The card's height comes from its CSS box (9 : 5, capped at 250 px); before the first measure, the 9 : 5 of the width.
  const H = card ? boxHeight || Math.min(250, Math.round((W * 5) / 9)) : HEIGHT;
  const hasRing = Number.isFinite(radiusKm) && radiusKm > 0;
  const outer = outerKm !== null && Number.isFinite(outerKm) && outerKm > 0 ? outerKm : null;
  const inner = innerKm !== null && Number.isFinite(innerKm) && innerKm > 0 ? Math.min(innerKm, outer ?? innerKm) : null;
  // The widest ring on the map sets the zoom: their own outer ring once they have said one, else the plan's.
  const fitKm = outer ?? (hasRing ? radiusKm : inner);

  // Pick an integer zoom so the ring fills ~62% of the smaller viewport edge.
  // No ring (Free/unscoped) → a city-level default so the HQ is still shown.
  let zoom = 11;
  if (fitKm && W > 0) {
    const target = 0.62 * Math.min(W, H);
    const n = (target * MPP_Z0 * Math.cos(rad(lat))) / (2 * fitKm * 1000);
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

  const mpp = metresPerPixel(lat, zoom);
  // The plan's ring only while they have not drawn their own outer ring.
  const ringPx = hasRing && outer === null ? (radiusKm * 1000) / mpp : 0;
  const outerPx = outer !== null ? (outer * 1000) / mpp : 0;
  const innerPx = inner !== null ? (inner * 1000) / mpp : 0;
  const label = (text: string, y: number, colour: string) => (
    <text
      x={W / 2}
      y={Math.max(14, y)}
      textAnchor="middle"
      className="text-xs font-semibold"
      style={{ fill: colour, paintOrder: 'stroke', stroke: ON_TILES, strokeOpacity: 0.9, strokeWidth: 3 }}
    >
      {text}
    </text>
  );

  return (
    <div
      ref={ref}
      className={`relative w-full overflow-hidden ${card ? 'aspect-[9/5] max-h-[250px]' : 'rounded-xl'}`}
      style={{
        height: card ? undefined : H,
        background: 'var(--m-paper-2)',
        filter: muted ? 'grayscale(1)' : undefined,
        opacity: muted ? 0.45 : undefined,
      }}
      data-reach-map={muted ? 'muted' : ''}
      role="img"
      aria-label={
        ariaLabel ??
        (outer !== null
          ? `Map of your headquarters: free transport within ${inner ?? 0} kilometres, you cover up to ${outer} kilometres`
          : hasRing
            ? `Map showing your service coverage of about ${radiusKm} kilometres around your headquarters`
            : 'Map showing your headquarters location')
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
              style={{ fill: RING_COLOUR, fillOpacity: 0.14 }}
              stroke={RING_COLOUR}
              strokeWidth={2}
              strokeOpacity={0.9}
              pathLength={1}
              strokeDasharray="1"
              transform={`rotate(-90 ${W / 2} ${H / 2})`}
              data-reach-ring=""
            />
          )}
          {kmTag && ringPx > 0 ? (
            <g data-reach-km="">
              <rect
                x={Math.min(W - 62, W / 2 + ringPx * 0.7 - 4)}
                y={Math.max(8, H / 2 - ringPx * 0.7 - 22)}
                width={58}
                height={22}
                rx={11}
                fill={ON_TILES}
                fillOpacity={0.92}
              />
              <text
                x={Math.min(W - 62, W / 2 + ringPx * 0.7 - 4) + 29}
                y={Math.max(8, H / 2 - ringPx * 0.7 - 22) + 15}
                textAnchor="middle"
                className="text-xs font-semibold"
                style={{ fill: RING_COLOUR }}
              >
                {`${radiusKm} km`}
              </text>
            </g>
          ) : null}
          {outerPx > 0 && (
            <circle
              cx={W / 2}
              cy={H / 2}
              r={outerPx}
              style={{ fill: 'rgb(var(--sn-accent))', fillOpacity: 0.08 }}
              stroke="rgb(var(--sn-accent))"
              strokeWidth={2}
              strokeDasharray="6 5"
              data-ring="outer"
            />
          )}
          {innerPx > 0 && (
            <circle
              cx={W / 2}
              cy={H / 2}
              r={innerPx}
              style={{ fill: 'var(--m-sage-deep)', fillOpacity: 0.16 }}
              stroke="var(--m-sage-deep)"
              strokeWidth={2}
              data-ring="inner"
            />
          )}
          {outerPx > 0 ? label(`Covers · ${outer} km`, H / 2 - outerPx + 16, 'rgb(var(--sn-accent))') : null}
          {innerPx > 0 ? label(`Free transpo · ${inner} km`, H / 2 - innerPx - 6, 'var(--m-sage-deep)') : null}
          {/* HQ — a map pin, its point on the spot */}
          <g transform={`translate(${W / 2 - 11} ${H / 2 - 30})`}>
            <g data-reach-pin="">
            <path
              d="M11 0C4.9 0 0 4.9 0 11c0 8.2 11 19 11 19s11-10.8 11-19C22 4.9 17.1 0 11 0z"
              style={{ fill: 'rgb(var(--sn-accent))' }}
              stroke="rgb(var(--sn-on-accent))"
              strokeWidth={1.5}
            />
            <circle cx={11} cy={11} r={4} style={{ fill: 'rgb(var(--sn-on-accent))' }} />
            </g>
          </g>
        </svg>
      )}

      {/* The map card's own credit tag (map card approved 2026-11-14): small, in the corner, a 44 px press. */}
      <MapCredit link={credit} />
    </div>
  );
}

'use client';

/**
 * BranchPinMap — a dependency-free "drop a pin" map for placing a branch.
 *
 * Center-crosshair pattern (like Grab/Uber): the pin is ALWAYS the viewport
 * centre. The vendor pans the map so the crosshair sits on their location; on
 * pointer-up we report the new centre. No click-vs-drag disambiguation, no
 * marker-drag hit-testing — just pan + zoom. The parent reverse-geocodes the
 * reported coords to auto-detect the city.
 *
 * Same rationale as ReachMap: OpenStreetMap raster tiles as <img> in a
 * Web-Mercator grid, no leaflet dep, CSP (`frame-ancestors 'self'`) already
 * allows the tiles. Attribution rendered in-corner per OSM's tile policy.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

const TILE = 256;
const HEIGHT = 260;
const MIN_ZOOM = 4;
const MAX_ZOOM = 18;

const tileUrl = (z: number, x: number, y: number) =>
  `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

function worldX(lng: number, z: number): number {
  return ((lng + 180) / 360) * TILE * 2 ** z;
}
function worldY(lat: number, z: number): number {
  const s = Math.min(0.9999, Math.max(-0.9999, Math.sin(rad(lat))));
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE * 2 ** z;
}
/** World-pixel X → longitude. */
function xToLng(px: number, z: number): number {
  return (px / (TILE * 2 ** z)) * 360 - 180;
}
/** World-pixel Y → latitude (inverse Web-Mercator). */
function yToLat(py: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * py) / (TILE * 2 ** z);
  return deg(Math.atan(Math.sinh(n)));
}

export type LatLng = { lat: number; lng: number };

type Props = {
  value: LatLng | null;
  onChange: (v: LatLng) => void;
  /** Where to centre the map before a pin is placed (HQ, or a PH fallback). */
  initialCenter: LatLng;
};

export function BranchPinMap({ value, onChange, initialCenter }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [center, setCenter] = useState<LatLng>(value ?? initialCenter);
  const [zoom, setZoom] = useState(13);
  // Live drag offset (px) applied to the tile layer while panning.
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
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

  const commitCenter = useCallback(
    (next: LatLng) => {
      setCenter(next);
      onChange(next);
    },
    [onChange],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY };
    setDrag({ dx: 0, dy: 0 });
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    setDrag({
      dx: e.clientX - dragStart.current.x,
      dy: e.clientY - dragStart.current.y,
    });
  };
  const endDrag = () => {
    if (!dragStart.current || !drag) {
      dragStart.current = null;
      setDrag(null);
      return;
    }
    // Panning the map right (dx>0) moves the geographic centre LEFT.
    const cx = worldX(center.lng, zoom) - drag.dx;
    const cy = worldY(center.lat, zoom) - drag.dy;
    const nextLat = Math.min(85, Math.max(-85, yToLat(cy, zoom)));
    let nextLng = xToLng(cx, zoom);
    nextLng = ((((nextLng + 180) % 360) + 360) % 360) - 180; // wrap to [-180,180)
    dragStart.current = null;
    setDrag(null);
    commitCenter({ lat: nextLat, lng: nextLng });
  };

  const bumpZoom = (delta: number) => {
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta)));
  };

  // Tile grid for the current centre (+ live drag offset).
  const n2 = 2 ** zoom;
  const offX = drag?.dx ?? 0;
  const offY = drag?.dy ?? 0;
  const left = worldX(center.lng, zoom) - W / 2 - offX;
  const top = worldY(center.lat, zoom) - H / 2 - offY;

  const tiles: Array<{ key: string; url: string; x: number; y: number }> = [];
  if (W > 0) {
    const minTx = Math.floor(left / TILE);
    const maxTx = Math.floor((left + W) / TILE);
    const minTy = Math.floor(top / TILE);
    const maxTy = Math.floor((top + H) / TILE);
    for (let tx = minTx; tx <= maxTx; tx++) {
      for (let ty = minTy; ty <= maxTy; ty++) {
        if (ty < 0 || ty >= n2) continue;
        const wrappedX = ((tx % n2) + n2) % n2;
        tiles.push({
          key: `${tx}_${ty}`,
          url: tileUrl(zoom, wrappedX, ty),
          x: Math.round(tx * TILE - left),
          y: Math.round(ty * TILE - top),
        });
      }
    }
  }

  return (
    <div
      ref={wrapRef}
      className="relative w-full touch-none overflow-hidden rounded-xl border"
      style={{
        height: H,
        borderColor: 'var(--m-line)',
        background: '#e6ebed',
        cursor: drag ? 'grabbing' : 'grab',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      role="application"
      aria-label="Drag the map to place your branch pin"
    >
      {tiles.map((t) => (
        // eslint-disable-next-line @next/next/no-img-element -- absolutely-positioned OSM tile grid; next/image can't lay this out
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

      {/* Fixed centre pin (the "dropped" pin is always the viewport centre). */}
      <svg
        width={W || 1}
        height={H}
        className="pointer-events-none absolute inset-0"
        aria-hidden
      >
        <circle
          cx={(W || 2) / 2}
          cy={H / 2 - 9}
          r={8}
          style={{ fill: 'var(--m-terracotta, #b65d3c)' }}
          stroke="#fff"
          strokeWidth={2}
        />
        <path
          d={`M ${(W || 2) / 2 - 7} ${H / 2 - 5} L ${(W || 2) / 2} ${H / 2 + 6} L ${(W || 2) / 2 + 7} ${H / 2 - 5} Z`}
          style={{ fill: 'var(--m-terracotta, #b65d3c)' }}
        />
        <circle cx={(W || 2) / 2} cy={H / 2 - 9} r={2.5} fill="#fff" />
      </svg>

      {/* Zoom controls */}
      <div className="absolute right-2 top-2 flex flex-col overflow-hidden rounded-lg border bg-white shadow-sm" style={{ borderColor: 'var(--m-line)' }}>
        <button
          type="button"
          onClick={() => bumpZoom(1)}
          aria-label="Zoom in"
          className="flex h-8 w-8 items-center justify-center text-ink/70 hover:bg-ink/5"
        >
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
        <span className="h-px w-full" style={{ background: 'var(--m-line)' }} aria-hidden />
        <button
          type="button"
          onClick={() => bumpZoom(-1)}
          aria-label="Zoom out"
          className="flex h-8 w-8 items-center justify-center text-ink/70 hover:bg-ink/5"
        >
          <Minus className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
      </div>

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

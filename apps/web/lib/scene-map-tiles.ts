/**
 * ONE MAP, SEVERAL PINS — the pure layout behind the Venue map's "One map, two
 * pins" and "Full map" styles.
 *
 * 🔑 RULE 0 — NO MAP LIBRARY AND NO NEW HOST. The venue plate's map is the
 * official OpenStreetMap embed, and its `marker=` takes ONE pin, so two
 * venues on one embed would draw one of them unmarked. The supplier's reach
 * map (`vendor-dashboard/shop/_components/reach-map.tsx`) already draws the
 * standard OSM tiles as plain images, and `https://tile.openstreetmap.org` is
 * already in the enforced `img-src` (next.config.ts) — so this draws the same
 * tiles and places the pins itself, in percentages, so the frame can take any
 * width without a resize listener.
 *
 * Web-Mercator, 256-px tiles. Pure: the same pins always give the same frame.
 */

export type MapPin = { latitude: number; longitude: number };

export type TileImage = { key: string; src: string; leftPct: number; topPct: number; widthPct: number; heightPct: number };
export type PinSpot = { leftPct: number; topPct: number };

const TILE = 256;
const MIN_ZOOM = 3;
const MAX_ZOOM = 16;

const clampLat = (lat: number) => Math.max(-85.05112878, Math.min(85.05112878, lat));

function worldX(lng: number, z: number): number {
  return ((lng + 180) / 360) * TILE * 2 ** z;
}

function worldY(lat: number, z: number): number {
  const s = Math.sin((clampLat(lat) * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE * 2 ** z;
}

export function tileUrl(z: number, x: number, y: number): string {
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

/**
 * The frame for `pins` in a `width` × `height` logical box: the highest zoom
 * at which every pin sits inside the box with `pad` pixels to spare, the tiles
 * that cover it, and each pin's spot — all in percent of the box.
 * Returns null when there is no usable pin.
 */
export function mapFrame(
  pins: readonly MapPin[],
  { width = 360, height = 220, pad = 36 }: { width?: number; height?: number; pad?: number } = {},
): { zoom: number; tiles: TileImage[]; spots: PinSpot[] } | null {
  const usable = pins.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
  if (usable.length === 0 || usable.length !== pins.length) return null;

  let zoom = MAX_ZOOM;
  for (; zoom > MIN_ZOOM; zoom--) {
    const xs = usable.map((p) => worldX(p.longitude, zoom));
    const ys = usable.map((p) => worldY(p.latitude, zoom));
    if (Math.max(...xs) - Math.min(...xs) <= width - 2 * pad && Math.max(...ys) - Math.min(...ys) <= height - 2 * pad) break;
  }
  const xs = usable.map((p) => worldX(p.longitude, zoom));
  const ys = usable.map((p) => worldY(p.latitude, zoom));
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const left = cx - width / 2;
  const top = cy - height / 2;

  const n = 2 ** zoom;
  const tiles: TileImage[] = [];
  for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + height) / TILE); ty++) {
    if (ty < 0 || ty >= n) continue;
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + width) / TILE); tx++) {
      const wrapped = ((tx % n) + n) % n;
      tiles.push({
        key: `${zoom}-${tx}-${ty}`,
        src: tileUrl(zoom, wrapped, ty),
        leftPct: ((tx * TILE - left) / width) * 100,
        topPct: ((ty * TILE - top) / height) * 100,
        widthPct: (TILE / width) * 100,
        heightPct: (TILE / height) * 100,
      });
    }
  }
  const spots = usable.map((p) => ({
    leftPct: ((worldX(p.longitude, zoom) - left) / width) * 100,
    topPct: ((worldY(p.latitude, zoom) - top) / height) * 100,
  }));
  return { zoom, tiles, spots };
}

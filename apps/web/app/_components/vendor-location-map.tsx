import type { ReactNode } from 'react';
import { NearViewport } from '@/app/_components/near-viewport';
import { BiggerMapButton, MAP_CARD_FRAME, MapCredit, MapPinMark } from '@/app/_components/map-card-chrome';
import { mapFrame, openStreetMapUrl, type TileImage } from '@/lib/scene-map-tiles';

/**
 * VendorLocationMap — THE MAP CARD: a picture of the streets with a pin on the place.
 *
 * WHY: the public supplier page offered the map apps but no *visible* map (owner 2026-06-28 "do the visual map
 * image"); since 2026-08-24 the guest invitation's venue section draws it too (H-4) — a wedding venue, not a supplier
 * HQ. ⚠ The name is narrower than the component and deliberately NOT renamed (it has shipped for months; read
 * "vendor" here as "whoever this pin belongs to").
 *
 * 🗺 MAP CARD, APPROVED 2026-11-14 (owner: "Yes, approved", on `prototypes/map_card_open_in_maps_2026-11-14_fable.html`).
 * The map is drawn OUR way — OpenStreetMap's standard tiles as plain pictures, the pattern the supplier's reach map
 * (`ReachMap`) and the Event Hub's one-map-for-every-venue (`PinnedMap`) already used — instead of OSM's embed
 * iframe. That retires the embed's sprawling credit bar ("Report a problem · © OpenStreetMap contributors · Make a
 * Donation…") and its + / − buttons hanging outside the frame: the card is a clean picture with a small
 * "© OpenStreetMap" tag in the corner (the credit OSM's licence requires) and ONE round button, top-right, that opens
 * the map you can move on openstreetmap.org ("View larger map →" became that button). Still OSM, still no API key,
 * no paid dependency.
 *
 * ⛔ CSP: tiles are images from `https://tile.openstreetmap.org`. The ENFORCED policy is frame-only (no `img-src`),
 * and the report-only draft's `img-src` already carries the host for the reach map and the pinned map (next.config.ts;
 * held by `the-venue-shows-real-streets.test.ts`). The embed's `frame-src` origin is no longer used by this card. (History, kept
 * because it cost two months: the embed once rendered as an empty grey panel on every shop page because its origin
 * was missing from `frame-src`; a blocked resource fails exactly like a missing one.)
 *
 * Self-guards: renders nothing without coordinates (a pin needs lat/lng). Address-only callers keep just the
 * "Get directions" button (`DirectionsMenu`), whose sheet searches Google Maps for the address.
 */

/** The tile layer's logical box: 9 : 5, the card's own shape. Percentages, so it fits any width without a listener. */
export const MAP_CARD_BOX = { width: 480, height: 267 } as const;

/**
 * THE ONE MAP CARD FRAME — the tiles, whatever is drawn on them, the corner credit and the bigger-map button. Used by
 * `VendorLocationMap` (one pin) and `PinnedMap` (venue-styles.tsx — every venue, numbered).
 *
 * The frame is 9 : 5 and never taller than 250 px; where 250 px clamps it (a wide column), the 9 : 5 tile layer stays
 * centred and only its top and bottom edges are cut, so every pin keeps its place.
 */
export function MapCard({
  tiles,
  label,
  deferUntilNear = false,
  flush = false,
  biggerHref,
  credit = true,
  attrs,
  overlay,
  children,
}: {
  tiles: readonly TileImage[];
  /** What the map shows, for a screen reader (the tile layer is the picture). */
  label: string;
  /** Load the tiles only when the card nears the screen (`NearViewport`, 300 px) — the guest's one-page Invitation. */
  deferUntilNear?: boolean;
  /** Square bottom corners, no bottom border: the head of a plate below it. */
  flush?: boolean;
  /** The bigger map; null = the sample page, which draws no door. */
  biggerHref: string | null;
  /** The credit is a link (false on the sample page). */
  credit?: boolean;
  /** `data-*` hooks on the frame. */
  attrs?: Record<`data-${string}`, string | number | undefined>;
  /** Drawn over the frame's corner, outside the tile layer (the pinned map's "not on the map" list). */
  overlay?: ReactNode;
  /** Pins and lines, placed in percent of the tile layer. */
  children?: ReactNode;
}) {
  const imgs = tiles.map((t) => (
    // eslint-disable-next-line @next/next/no-img-element -- absolutely-positioned OSM tile grid; next/image cannot lay this out
    <img
      key={t.key}
      src={t.src}
      alt=""
      aria-hidden
      loading="lazy"
      draggable={false}
      className="absolute max-w-none select-none"
      style={{ left: `${t.leftPct}%`, top: `${t.topPct}%`, width: `${t.widthPct}%`, height: `${t.heightPct}%` }}
    />
  ));
  return (
    <figure
      {...attrs}
      className={`${MAP_CARD_FRAME} m-0 aspect-[9/5] max-h-[250px] ${flush ? 'rounded-t-[18px] border-b-0' : 'rounded-[18px]'}`}
    >
      <div role="img" aria-label={label} data-map-tiles="" className="absolute inset-x-0 top-1/2 aspect-[9/5] -translate-y-1/2">
        {deferUntilNear ? <NearViewport className="absolute inset-0">{imgs}</NearViewport> : imgs}
        {children}
      </div>
      {overlay}
      {biggerHref ? <BiggerMapButton href={biggerHref} /> : null}
      <MapCredit link={credit} />
    </figure>
  );
}

type Props = {
  /**
   * 🔗 RW-81 (walk 13 Nov 2026): `null` = the sample page — no bigger-map button and the credit drawn as words, so the
   * sample shop on /for-suppliers leads nowhere. Absent = the OpenStreetMap link, as shipped.
   */
  mapHref?: null;
  /** Latitude in decimal degrees. NULL → render nothing. */
  latitude: number | null;
  /** Longitude in decimal degrees. NULL → render nothing. */
  longitude: number | null;
  /**
   * A non-identifying place label (e.g. location_city) for the map's spoken label. Never pass a hidden supplier's
   * business name — keep the name-reveal contract intact.
   */
  label?: string | null;
  /**
   * 🗺 Load the tiles only when the map nears the screen (`NearViewport`, 300 px) — the guest's one-page Invitation,
   * where the map sits far below the cover and every landing would otherwise fetch it (Batch 9 walk W2).
   */
  deferUntilNear?: boolean;
  /**
   * Seat the map FLUSH against whatever sits directly beneath it — square bottom corners and no bottom border, so it
   * reads as the top of one block (the guest invitation's venue plate). Default `false`.
   */
  flush?: boolean;
};

export function VendorLocationMap({ latitude, longitude, label, flush = false, deferUntilNear = false, mapHref }: Props) {
  if (latitude == null || longitude == null) return null;

  const lat = Number(latitude.toFixed(6));
  const lng = Number(longitude.toFixed(6));
  // A neighbourhood around the pin (zoom 15 ≈ 2 km across the card) — the readable view the embed's ±0.008° box gave.
  const frame = mapFrame([{ latitude: lat, longitude: lng }], { ...MAP_CARD_BOX, maxZoom: 15 });
  if (!frame) return null;
  const spot = frame.spots[0]!;
  const title = label ? `Map showing ${label}` : 'Map showing the location';

  return (
    <MapCard
      tiles={frame.tiles}
      label={title}
      deferUntilNear={deferUntilNear}
      flush={flush}
      biggerHref={mapHref === null ? null : openStreetMapUrl(lat, lng, 16)}
      credit={mapHref !== null}
      // `data-osm-embed` names the one-place map card (tests and the walk read it); it is no longer an iframe embed.
      attrs={{ 'data-osm-embed': '', 'data-map-link': mapHref === null ? 'none' : undefined }}
    >
      <MapPinMark leftPct={spot.leftPct} topPct={spot.topPct} />
    </MapCard>
  );
}

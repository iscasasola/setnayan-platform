import { MapPin } from 'lucide-react';
import { ReachMap } from '@/app/vendor-dashboard/shop/_components/reach-map';
import { VendorLocationMap } from '@/app/_components/vendor-location-map';
import { BiggerMapButton } from '@/app/_components/map-card-chrome';
import { openStreetMapUrl } from '@/lib/scene-map-tiles';
import { shopReachLine, type ShopReach } from '@/lib/shop-page-plan';

/**
 * The shop page's reach, by plan (supplier website by plan, owner-approved 2026-10-30; numbers 2026-10-23 / 10-29):
 * the city fact line now carries the plan's reach — "Serves up to 20 km around Tagaytay", or for a shop Setnayan has
 * not verified yet "Tagaytay · distance search opens once verified" — and the map draws that ring.
 *
 * The ring is the SHIPPED `ReachMap` (the supplier's own Where you work map — one drawing of one number), with a
 * couple-voiced label; a shop with no ring keeps the shipped pin map (`VendorLocationMap`) exactly as before.
 */
export function ShopReachLine({ reach, city }: { reach: ShopReach; city: string | null }) {
  const line = shopReachLine(reach, city);
  if (!line) return null;
  return (
    <span data-shop-reach={reach.kind} className="inline-flex items-center gap-1">
      <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
      {line}
    </span>
  );
}

export function ShopReachMap({
  reach,
  latitude,
  longitude,
  city,
  mapHref,
}: {
  reach: ShopReach;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  /** RW-81: `null` = the sample's map — no bigger-map button and no credit link (`VendorLocationMap`'s `mapHref`). */
  mapHref?: null;
}) {
  if (latitude == null || longitude == null) return null;
  if (reach.kind !== 'ring') return <VendorLocationMap latitude={latitude} longitude={longitude} label={city} mapHref={mapHref} />;
  const lat = Number(latitude.toFixed(6));
  const lng = Number(longitude.toFixed(6));
  // 🗺 THE SAME MAP CARD (approved 2026-11-14): the ring map gets the card's frame, its corner credit and the round
  // bigger-map button where "View larger map →" was. `mapHref === null` (the sample) draws neither door.
  return (
    <div data-shop-reach-map="" className="relative overflow-hidden rounded-card border border-ink/15">
      <ReachMap
        lat={lat}
        lng={lng}
        radiusKm={reach.km}
        ariaLabel={`Map: serves up to ${reach.km} kilometres around ${city ?? 'the shop'}`}
        kmTag
        credit={mapHref !== null}
      />
      {mapHref === null ? null : <BiggerMapButton href={openStreetMapUrl(lat, lng, 11)} />}
    </div>
  );
}

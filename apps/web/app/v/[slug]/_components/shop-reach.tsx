import { MapPin } from 'lucide-react';
import { ReachMap } from '@/app/vendor-dashboard/shop/_components/reach-map';
import { VendorLocationMap } from '@/app/_components/vendor-location-map';
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
}: {
  reach: ShopReach;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
}) {
  if (latitude == null || longitude == null) return null;
  if (reach.kind !== 'ring') return <VendorLocationMap latitude={latitude} longitude={longitude} label={city} />;
  const lat = Number(latitude.toFixed(6));
  const lng = Number(longitude.toFixed(6));
  return (
    <div data-shop-reach-map="" className="space-y-0">
      <ReachMap
        lat={lat}
        lng={lng}
        radiusKm={reach.km}
        ariaLabel={`Map: serves up to ${reach.km} kilometres around ${city ?? 'the shop'}`}
      />
      <a
        href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=11/${lat}/${lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-[44px] items-center px-1 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55 hover:text-ink"
      >
        View larger map →
      </a>
    </div>
  );
}

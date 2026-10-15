import { PillLink, PillTrack } from '@/app/_components/pill-track';

/**
 * SHOP › Services · Page · How it is going — the one segmented control (simpler supplier dashboard; prototype
 * `shopSeg`, plan § "Shop = Services · Page · Insights"). The Customers shape (`customers-segments.tsx`): each
 * segment is a link with its own address, so a bookmark, a back press and a link from anywhere land on the same view.
 *
 * Page is lit on Your page AND on the two screens it opens — Your details and Your collections — exactly as the
 * prototype's sub-menu lights it (`['details','collections'].includes(screen)`).
 */
export type ShopSegment = 'services' | 'page' | 'insights';

export const SHOP_SEGMENT_HREF: Readonly<Record<ShopSegment, string>> = {
  services: '/vendor-dashboard/shop',
  page: '/vendor-dashboard/website',
  insights: '/vendor-dashboard/performance',
};

export const SHOP_SEGMENT_LABEL: Readonly<Record<ShopSegment, string>> = {
  services: 'Services',
  page: 'Page',
  insights: 'How it is going',
};

const ORDER: readonly ShopSegment[] = ['services', 'page', 'insights'];

export function ShopSegments({ on }: { on: ShopSegment }) {
  return (
    <PillTrack as="nav" grow aria-label="Shop views" data-shop-segmented="" className="w-full">
      {ORDER.map((s) => (
        <PillLink
          key={s}
          on={s === on}
          href={SHOP_SEGMENT_HREF[s]}
          scroll={false}
          aria-current={s === on ? 'page' : undefined}
          data-shop-seg={s}
          className="h-11 min-h-11 text-[13.5px]"
        >
          {SHOP_SEGMENT_LABEL[s]}
        </PillLink>
      ))}
    </PillTrack>
  );
}

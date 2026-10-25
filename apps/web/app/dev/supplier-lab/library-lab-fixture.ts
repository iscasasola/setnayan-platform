/**
 * 🧪 /dev/supplier-lab?s=library — the lab shop for the inspiration library round trip (DEV-ONLY).
 *
 * A stylist who also does flowers (the trades that dress most of the couple's parts), with a made-up name, phone,
 * email and site — so the shipped content screen has the shop's OWN details to look for — and four photos "on its
 * page" taken from the repo's own sample pictures (`public/realstories`). Nothing here is a real supplier.
 */
import { canonicalServicesForTile } from '@/lib/vendor-counts';

export const LAB_LIBRARY_SHOP = {
  vendor_profile_id: 'S89V-LABSHOP001',
  business_name: 'Bloom & Vine Styling',
  business_slug: 'bloom-and-vine-lab',
  contact_phone: '0917 555 0142',
  contact_email: 'hello@bloomandvine.example',
  website: 'https://bloomandvine.example',
  services: [...canonicalServicesForTile('stylist_decorator'), ...canonicalServicesForTile('florist')],
};

/** The shop's "page" photos — refs exactly as a legacy-URL portfolio entry is stored (a path the app serves). */
export const LAB_SHOP_PHOTOS: ReadonlyArray<{ ref: string; url: string; from: 'page' | 'card' }> = [
  { ref: '/realstories/jack-jill-g1.jpg', url: '/realstories/jack-jill-g1.jpg', from: 'page' },
  { ref: '/realstories/john-jane-g2.jpg', url: '/realstories/john-jane-g2.jpg', from: 'page' },
  { ref: '/realstories/maria-juan-g1.jpg', url: '/realstories/maria-juan-g1.jpg', from: 'page' },
  { ref: '/realstories/sofia-reyes-c2.jpg', url: '/realstories/sofia-reyes-c2.jpg', from: 'card' },
];

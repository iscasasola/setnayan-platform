/**
 * 🧪 /dev/shop-preview-lab?view=inspiration — the shop page's Inspiration section and a service card's looks strip on
 * made-up data (owner 2026-10-30, "CONNECTED FOUR WAYS" items 3 + 5). The cards and looks are shaped EXACTLY as the page
 * builds them (`withInspirationLooks`, `InspirationTile`), from the repo's own sample pictures (`public/realstories`).
 * No real shop, no database. DEV-ONLY.
 */
import { cardAnchorId, withInspirationLooks, type ServiceCard } from '@/lib/service-card-view-model';
import { formatPhpRounded } from '@/lib/php';
import type { InspirationTile } from '@/app/v/[slug]/_components/shop-inspiration-section';

const card = (id: string, publicId: string, label: string, priceLabel: string, inclusions: string[]): ServiceCard => ({
  id,
  publicId,
  label,
  priceLabel,
  meta: null,
  discountLabel: null,
  inclusions,
  inclusionsMore: 0,
  notIncluded: ['Transport not included'],
  priceDetail: null,
  serves: 'Wedding · Debut — All faiths',
  photos: [],
  videoUrl: null,
  record: null,
  recordRating: null,
  givesSetnayanGift: false,
});

const LOOKS = {
  bouquets: [
    { id: 'l1', url: '/realstories/jack-jill-g1.jpg', part: 'Bridal bouquet' },
    { id: 'l2', url: '/realstories/john-jane-g2.jpg', part: 'Entourage bouquets' },
    { id: 'l3', url: '/realstories/maria-juan-g1.jpg', part: 'Bridal bouquet' },
    { id: 'l4', url: '/realstories/jack-rose-g2.jpg', part: 'Corsages' },
  ],
  styling: [{ id: 'l5', url: '/realstories/sofia-reyes-c2.jpg', part: 'Stage' }],
};

export const LAB_INSPIRATION_CARDS: ServiceCard[] = [
  withInspirationLooks(card('svc-1', 'S89S-LABBOUQ01', 'Bridal bouquets', `from ${formatPhpRounded(8_500)}`, ['Bride’s bouquet', 'Groom’s boutonnière']), LOOKS.bouquets, cardAnchorId('S89S-LABBOUQ01', 'svc-1')),
  withInspirationLooks(card('svc-2', 'S89S-LABSTYL01', 'Reception styling', `from ${formatPhpRounded(65_000)}`, ['Stage backdrop', 'Table centrepieces']), LOOKS.styling, cardAnchorId('S89S-LABSTYL01', 'svc-2')),
  withInspirationLooks(card('svc-3', 'S89S-LABCERE01', 'Ceremony flowers', `from ${formatPhpRounded(18_000)}`, ['Aisle arrangements']), [], cardAnchorId('S89S-LABCERE01', 'svc-3')),
];

export const LAB_INSPIRATION_TILES: InspirationTile[] = [
  ...LOOKS.bouquets.map((l) => ({ ...l, card: { label: 'Bridal bouquets', priceLabel: `from ${formatPhpRounded(8_500)}`, anchorId: cardAnchorId('S89S-LABBOUQ01', 'svc-1') } })),
  ...LOOKS.styling.map((l) => ({ ...l, card: { label: 'Reception styling', priceLabel: `from ${formatPhpRounded(65_000)}`, anchorId: cardAnchorId('S89S-LABSTYL01', 'svc-2') } })),
  { id: 'l6', url: '/realstories/john-jane-g3.jpg', part: 'Centrepieces', card: null },
];

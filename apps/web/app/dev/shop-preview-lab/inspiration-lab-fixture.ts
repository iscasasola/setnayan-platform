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

/**
 * 🃏 /dev/shop-preview-lab?view=card — the SERVICE CARD GROWN (Build 5 Lane C) on one full card: every section the grown
 * card draws (the whole inclusion list + crew, not included + serves, the record, its reviews, nine photos so the "+N"
 * tile shows, a couple's photo, the clip, inspiration). Made-up names; the repo's own sample pictures. DEV-ONLY.
 */
export const LAB_GROWN_CARD: ServiceCard = withInspirationLooks(
  {
    ...card('svc-g1', 'S89S-LABGROW01', 'Signature Wedding Bar', `from ${formatPhpRounded(94_000)}`, [
      'Signature drinks menu',
      'Two bartenders',
      'Mobile bar',
    ]),
    inclusionsFull: [
      'Signature drinks menu, made with you',
      'Two bartenders and one bar back',
      'Mobile bar with lights',
      'Glassware for 150 guests',
      'Ice, garnish and mixers',
      'Five hours of service',
    ],
    inclusionsMore: 3,
    meta: 'Crew of 3 · crew meal not included',
    discountLabel: '10% off · early booking',
    priceDetail: `${formatPhpRounded(620)} / guest · min 150 guests`,
    notIncluded: ['Crew meal not included', `Transport: ${formatPhpRounded(1500)}`],
    photos: [
      '/realstories/jack-jill-g1.jpg',
      '/realstories/jack-jill-g2.jpg',
      '/realstories/jack-jill-g3.jpg',
      '/realstories/jack-rose-g1.jpg',
      '/realstories/jack-rose-g2.jpg',
      '/realstories/jack-rose-g3.jpg',
      '/realstories/john-jane-g1.jpg',
      '/realstories/john-jane-g2.jpg',
      '/realstories/john-jane-g3.jpg',
    ],
    videoUrl: '/realstories/jack-jill-vclip.mp4',
    // 🃏 Hide per card (ruling 5970): the lab's stand-in refs behind the photos and the clip.
    photoRefs: ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9'].map((k) => `r2://lab/${k}.jpg`),
    clipRef: 'r2://lab/clip.mp4',
    record: {
      bookedCount: 12,
      mix: [
        { eventType: 'wedding', label: 'Wedding', n: 8, pct: 67 },
        { eventType: 'debut', label: 'Debut', n: 4, pct: 33 },
      ],
      ledger: [
        { label: 'Wedding', month: 'Oct 2026', pax: '100–199 pax' },
        { label: 'Debut', month: 'Aug 2026', pax: '100–199 pax' },
      ],
      milestones: { earned: [10], next: 25 },
      optionSampleN: 0,
      optionPicks: [],
      documentedEvents: 3,
    },
    recordRating: { avg: 4.8, count: 12 },
    givesSetnayanGift: true,
    coupleLooks: [{ id: 'cl1', url: '/realstories/maria-juan-g1.jpg', credit: 'Ana & Ben · Feb 2027', verifiedBooking: true }],
    reviews: {
      hosts: {
        count: 12,
        average: 4.8,
        quote: 'The signature drinks were the talk of the night.',
        by: 'P. & M. · Oct 2026',
        verifiedBooking: true,
      },
      guests: null,
    },
  },
  LOOKS.bouquets,
  cardAnchorId('S89S-LABGROW01', 'svc-g1'),
);

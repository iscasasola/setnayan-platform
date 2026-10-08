/**
 * /dev/suppliers-lab fixtures — a wedding mid-planning, shaped like the approved
 * prototype's "mid" seed (`prototypes/suppliers_page_2026-10-07_fable.html`):
 * a booked reception the couple added themselves (a payment due), a booked
 * ceremony with no price, Cake holding three suppliers the couple added
 * (nothing booked — the controller's walk case), Catering mid-conversation and
 * a photo quote waiting on the couple. Nothing here is read from a database.
 */
import type { EventVendorRowInput } from '@/lib/wedding-plan-groups';
import type { VendorEnrichment } from '@/lib/vendors-plan-budget';
import type { BenchServiceCard } from '@/lib/bench-service-card';
import type { SupplierStanding } from '@/lib/supplier-standing';
import { formatPhp } from '@/lib/orders';
import type { CategoryVendorResult } from '@/app/dashboard/[eventId]/vendors/_actions/category-search';

export const LAB_EVENT = '00000000-0000-4000-8000-000000000000';

const row = (r: Partial<EventVendorRowInput> & Pick<EventVendorRowInput, 'vendor_id' | 'vendor_name' | 'category'>): EventVendorRowInput => ({
  status: 'considering',
  ...r,
});

export const LAB_ROWS: EventVendorRowInput[] = [
  row({ vendor_id: 'v-seda', vendor_name: 'Seda Vertis North', category: 'venue', status: 'contracted', total_cost_php: 1_056_000, manual_vendor_id: 'm-seda' }),
  row({ vendor_id: 'v-santuario', vendor_name: 'Santuario de San Vicente de Paul', category: 'religious_venue', status: 'contracted', marketplace_vendor_id: 'p-santuario' }),
  row({ vendor_id: 'v-tinapay', vendor_name: 'Tinapay & Co.', category: 'cake_maker', total_cost_php: 12_000, manual_vendor_id: 'm-tinapay' }),
  row({ vendor_id: 'v-asukal', vendor_name: 'Asukal Cakes', category: 'cake_maker', manual_vendor_id: 'm-asukal' }),
  row({ vendor_id: 'v-bibingka', vendor_name: 'Bibingka Bakehouse', category: 'cake_maker', manual_vendor_id: 'm-bibingka' }),
  row({ vendor_id: 'v-bituin', vendor_name: 'Bituin Catering', category: 'catering', marketplace_vendor_id: 'p-bituin' }),
  row({ vendor_id: 'v-hiraya', vendor_name: 'Hiraya Table', category: 'catering', marketplace_vendor_id: 'p-hiraya' }),
  row({ vendor_id: 'v-lola', vendor_name: 'Kusina ni Lola', category: 'catering', marketplace_vendor_id: 'p-lola' }),
  row({ vendor_id: 'v-lumina', vendor_name: 'Lumina Studio', category: 'photographer', marketplace_vendor_id: 'p-lumina' }),
];

export const LAB_ENRICHMENT = new Map<string, VendorEnrichment>([
  ['v-santuario', { rating: 4.9, review_count: 41, is_verified: true }],
  ['v-bituin', { rating: 4.7, review_count: 18, is_verified: true, thread_id: 't-bituin', inquiry_status: 'pending' }],
  ['v-hiraya', { rating: 4.8, review_count: 9, is_verified: true }],
  ['v-lola', { rating: 4.8, review_count: 63, is_verified: true, thread_id: 't-lola', inquiry_status: 'accepted' }],
  ['v-lumina', { rating: 4.9, review_count: 52, is_verified: true, thread_id: 't-lumina', inquiry_status: 'accepted' }],
]);

const card = (c: Partial<BenchServiceCard> & Pick<BenchServiceCard, 'name'>): BenchServiceCard => ({
  priceText: null,
  discountBadge: null,
  includesLine: null,
  notIncluded: [],
  givesSetnayanGift: false,
  coverUrl: null,
  ...c,
});

export const LAB_CARDS: Record<string, BenchServiceCard> = {
  'v-bituin': card({ name: 'Wedding buffet · 150–250 pax', priceText: `from ${formatPhp(950)} / head`, includesLine: 'Tasting for 4 · crew meals · 2 live stations', notIncluded: ['corkage'] }),
  'v-hiraya': card({ name: 'Plated dinner · 100–200 pax', priceText: `from ${formatPhp(1200)} / head`, includesLine: 'Tasting for 2 · table styling' }),
  'v-lola': card({ name: 'Heirloom Filipino buffet · 100–250 pax', priceText: `from ${formatPhp(1100)} / head`, includesLine: 'Tasting for 2 · lechon carving station' }),
  'v-lumina': card({ name: 'Full day photo & video · 2 shooters', priceText: `from ${formatPhp(85000)}`, includesLine: 'Same-day edit · 10-day gallery' }),
  'v-santuario': card({ name: 'Church ceremony · 3 pm slot', includesLine: 'Choir · coordinator for the rite' }),
};

export const LAB_STANDINGS: Record<string, SupplierStanding> = {
  'v-lola': { segments: [{ kind: 'need', text: 'waiting on you' }], replied: true, needsYou: true },
  'v-lumina': { segments: [{ kind: 'need', text: 'waiting on you' }], replied: true, needsYou: true },
  'v-bituin': { segments: [{ kind: 'quiet', text: 'No reply · 3 days' }], replied: false, needsYou: false },
};

const market = (r: Pick<CategoryVendorResult, 'vendorProfileId' | 'name'> & Partial<CategoryVendorResult>): CategoryVendorResult =>
  ({
    nameAnonymized: false,
    city: 'Quezon City',
    logoUrl: null,
    photoUrl: null,
    rating: null,
    reviewCount: 0,
    distanceKm: null,
    verified: true,
    boosted: false,
    compatScore: null,
    compatTier: null,
    respondsFast: false,
    lastMinuteAvailable: false,
    lastMinuteSurchargePct: null,
    alreadyAdded: false,
    relationshipDepth: 0,
    withinRadius: true,
    serviceRadiusKm: null,
    facetMatchCount: null,
    ...r,
  }) as CategoryVendorResult;

/** "More to compare", per category — what the marketplace read would return. */
export const LAB_MARKET: Record<string, { rows: CategoryVendorResult[]; cards: Record<string, BenchServiceCard> }> = {
  catering: {
    rows: [
      market({ vendorProfileId: 'p-luntian', name: 'Luntian Buffet', city: 'Makati', rating: 4.9, reviewCount: 120 }),
      market({ vendorProfileId: 'p-mesa', name: 'Mesa Kusina', city: 'Pasig', rating: 4.6, reviewCount: 12 }),
      market({ vendorProfileId: 'p-sarap', name: 'Sarap Events', city: 'Taguig', rating: 4.7, reviewCount: 60 }),
    ],
    cards: {
      'p-luntian': card({ name: 'Garden buffet · 120–300 pax', priceText: `from ${formatPhp(1500)} / head`, includesLine: 'Tasting for 4 · dessert bar · crew meals' }),
      'p-mesa': card({ name: 'Filipino buffet · up to 200 pax', priceText: `from ${formatPhp(850)} / head`, includesLine: 'Tasting for 2', discountBadge: 'Early booking · 10%' }),
      'p-sarap': card({ name: 'Plated 5-course · 80–180 pax', priceText: `from ${formatPhp(1800)} / head`, includesLine: 'Tasting for 2 · wine pairing' }),
    },
  },
  cake: {
    rows: [
      market({ vendorProfileId: 'p-tamis', name: 'Tamis Patisserie', city: 'Makati', rating: 4.8, reviewCount: 34 }),
      market({ vendorProfileId: 'p-hurno', name: 'Hurno Cakes', city: 'Marikina', rating: 4.6, reviewCount: 8 }),
    ],
    cards: {
      'p-tamis': card({ name: 'Three-tier wedding cake', priceText: `from ${formatPhp(18000)}`, includesLine: 'Tasting for 2 · delivery and set-up' }),
    },
  },
};

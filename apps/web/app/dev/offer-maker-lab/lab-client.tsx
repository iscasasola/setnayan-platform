'use client';

import { OffersScreen } from '@/app/vendor-dashboard/offers/_components/offer-maker';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';
import { blankOffer, type Offer } from '@/lib/offers';
import { shopGiftPacksFrom } from '@/lib/shop-gifts';
import type { OfferMakerData } from '@/lib/offer-maker.server';

/* The prototype's sample shop (data.js) — a drawing, never a price anything charges. Today is fixed at Nov 9, 2026. */
const TODAY = '2026-11-09';
const o = (p: Partial<Offer>): Offer => ({ ...blankOffer(), ...p });
const CARDS = [
  { id: 'c1', name: 'Mobile Bar by SetnaProd', pricePhp: 110000, leaf: 'Mobile Bar · Booths, carts & bars' },
  { id: 'c2', name: 'Signature cocktail bar · 4 hrs', pricePhp: 45000, leaf: 'Mobile Bar · Booths, carts & bars' },
  { id: 'c3', name: 'Beer & sangria station', pricePhp: 22000, leaf: 'Mobile Bar · Booths, carts & bars' },
  { id: 'c4', name: 'Mocktail station', pricePhp: 38000, leaf: 'Mocktail · Booths, carts & bars' },
];
const OFFERS: Offer[] = [
  o({ id: 'd1', name: 'Shop-wide 10%', pctOff: 10, sortOrder: 0 }),
  o({ id: 'd2', name: 'First couples', phpOff: 5000, who: 'first_n', firstNCap: 5, firstNTaken: 2, sortOrder: 1 }),
  o({ id: 'd3', name: 'Ber-months season', pctOff: 10, phpOff: 5000, reachesAll: false, cards: ['c2', 'c4'], who: 'season', seasonFrom: '2026-09-01', seasonTo: '2026-12-31', sortOrder: 2 }),
  o({ id: 'd4', name: 'Early bird · a year ahead', pctOff: 10, gifts: [{ kind: 'addon', addonId: 1 }, { kind: 'sn', code: 'PAPIC_GUEST_1K' }], who: 'early_bird', minLeadMonths: 12, untilDate: '2027-03-31', sortOrder: 3 }),
  o({ id: 'd5', name: 'Returning client', phpOff: 3000, who: 'returning', untilDate: '2026-10-31', sortOrder: 4 }),
  o({ id: 'd6', name: 'Reserve for less', firstPayment: 5000, untilDate: '2026-11-30', sortOrder: 5 }),
];

function data(empty: boolean): OfferMakerData {
  return {
    today: TODAY,
    offers: empty ? [] : OFFERS,
    cards: CARDS,
    gifts: {
      packs: shopGiftPacksFrom([
        { code: 'PAPIC_GUEST_150', title: 'Papic 150', credits: 150, pricePhp: 99, giftPricePhp: 90 },
        { code: 'PAPIC_GUEST_1K', title: 'Papic 1000', credits: 1000, pricePhp: 499, giftPricePhp: 449 },
        { code: 'PAPIC_GUEST', title: 'Papic 3000', credits: 3000, pricePhp: 999, giftPricePhp: 899 },
      ]),
      schedule: { rate: 0.05, tailRate: 0.01, tier1LimitPhp: 100000, minPhp: 50 },
      limitPct: 40,
      paysGiftPrice: true,
      free: { papic: 7800, event_plus: 0, event_pro: 0 },
      addons: [
        { id: 1, cardId: 'c1', label: 'Extra hour', fromPhp: 8000 },
        { id: 2, cardId: 'c1', label: '50 more cocktails', fromPhp: 6500 },
        { id: 3, cardId: 'c4', label: '50 more cups', fromPhp: 2000 },
      ],
    },
    season: { from: '2027-06-01', to: '2027-08-31', monthsLabel: 'June, July, and August', source: 'ph_default' },
  };
}

export function OfferMakerLabClient({ open, empty, newSeason }: { open: string | null; empty: boolean; newSeason: boolean }) {
  return (
    <main className="min-h-[100dvh] bg-cream">
      <OffersScreen data={data(empty)} onClose={() => undefined} start={newSeason ? { who: 'season', part: 'pct' } : null} openId={open} />
      <UndoToastHost />
    </main>
  );
}

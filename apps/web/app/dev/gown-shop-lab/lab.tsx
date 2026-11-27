'use client';

/** The Attire Maker shop lab's body (see page.lab.tsx). Fixture data only — every amount is a SAMPLE, never a price. */
import { gownShopTemplate, type GownShopOptions } from '@/lib/gown-maker';
import { GownMakerPanel } from '@/app/vendor-dashboard/shop/_components/gown-maker-panel';

const P = 100; // ₱1 in centavos — SAMPLE amounts only

function sample(mode: GownShopOptions['mode']): GownShopOptions {
  const o = gownShopTemplate();
  o.mode = mode;
  o.prices = { base_aline: 25000 * P, base_ball: 40000 * P, fab_satin: 350 * P, fab_mikado: 900 * P, lin_satin: 120 * P, zipper: 80 * P, rate: 150 * P };
  o.markupPct = mode === 'covers' ? 20 : 0;
  o.addOns.veil = { state: 'priced', centavos: 3500 * P };
  o.addOns.garter = { state: 'free' };
  o.addOns.garment_bag = { state: 'free' };
  o.addOns.shoes = { state: 'request' };
  o.addOns.fittings = { state: 'priced', centavos: null };
  return o;
}

export default function Lab({ view }: { view: string }) {
  const seed =
    view === 'fresh'
      ? { options: gownShopTemplate(), saved: false, locked: false }
      : view === 'locked'
        ? { options: sample('covers'), saved: true, locked: true }
        : { options: sample(view === 'extras' ? 'extras' : 'covers'), saved: true, locked: false };
  return (
    <main className="mx-auto max-w-xl p-4" data-gown-shop-lab={view}>
      <GownMakerPanel key={view} seed={seed} />
    </main>
  );
}
